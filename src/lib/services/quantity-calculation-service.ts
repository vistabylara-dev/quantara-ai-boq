import { QuantityCalculationType } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError } from "@/lib/errors/app-error";
import {
  getRequiredDimensions,
  getMissingRequiredDimensions,
  type DimensionValue,
} from "@/lib/calculations/required-dimensions-registry";
import { recommendMeasurementMethod } from "@/lib/calculations/measurement-method-recommender";
import type { FormulaResult } from "@/lib/calculations/quantity-formulas";
import {
  assertValidCalculatedResult,
  assertValidDimensionValues,
  assertValidFormulaResult,
  assertValidOverrideResult,
} from "@/lib/calculations/quantity-domain-validator";
import {
  confirmQuantityCalculation as confirmQuantityCalculationRecord,
  createQuantityCalculation,
  getQuantityCalculationRecord,
  listQuantityCalculationsForEntity,
  listQuantityCalculationsForProject,
  overrideQuantityCalculationResult as overrideQuantityCalculationRecord,
  rejectQuantityCalculation as rejectQuantityCalculationRecord,
  toQuantityCalculationDTO,
} from "@/lib/repositories/quantity-calculation-repository";
import { getExtractedEntityRecord } from "@/lib/repositories/extracted-entity-repository";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { prisma } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/repositories/audit-repository";

/**
 * Guided BOQ measurement workflow (Release 1) — the minimal safe
 * orchestration the existing QuantityCalculation model was missing (spec
 * section 6). Reuses required-dimensions-registry.ts for the formula/inputs
 * contract, extracted-entity-repository.ts for evidence, and the existing
 * QuantityCalculation Prisma model as-is — no migration.
 */

export type PrefillSource = DimensionValue["source"];

/**
 * Reads only evidence that actually exists — never invents a missing
 * numeric value merely because a formula needs it. Exactly two defensible
 * sources, in priority order:
 * 1. ExtractedEntity.technicalDataJson[key] — an exact key-name match only.
 * 2. An explicitly professional-selected DetectedRoom's own area/perimeter/
 *    ceilingHeight — never fuzzy-matched, only used when the caller passes
 *    detectedRoomId explicitly (a human decision, not an inference).
 * Deliberately does NOT fall back to ExtractedEntity.quantity/unit merely
 * because the unit matches — a single quantity/unit pair carries no
 * semantic meaning about WHICH required dimension it is (e.g. a lone
 * "5 m" reading could be length, width, or depth of a CONCRETE_VOLUME
 * calculation), so that would silently invent a value rather than read one.
 * All evidence is scoped to a single canonical project — an extracted
 * entity or detected room from another project can never prefill here.
 */
export async function prefillDimensionValues(
  companyId: string,
  calculationType: QuantityCalculationType,
  options: { projectId: string; extractedEntityId?: string | null; detectedRoomId?: string | null },
): Promise<DimensionValue[]> {
  const definition = getRequiredDimensions(calculationType);
  if (!definition) return [];

  const project = await getProjectRecord(companyId, options.projectId);

  let entity: Awaited<ReturnType<typeof getExtractedEntityRecord>> | null = null;
  if (options.extractedEntityId) {
    entity = await getExtractedEntityRecord(companyId, options.extractedEntityId);
    if (entity.projectId !== project.id) {
      throw new AppError("ENTITY_PROJECT_MISMATCH", "This extracted entity does not belong to the specified project.", 400);
    }
    if (entity.status !== "CONFIRMED" && entity.status !== "CORRECTED") {
      throw new AppError(
        "ENTITY_NOT_CONFIRMED",
        "This extracted entity must receive a professional confirmation or correction before it can prefill a calculation.",
        409,
      );
    }
  }
  let room: { area: unknown; perimeter: unknown; ceilingHeight: unknown } | null = null;
  if (options.detectedRoomId) {
    const selectedRoom = await prisma.detectedRoom.findFirst({
      where: { id: options.detectedRoomId, companyId },
      select: { projectId: true, status: true, area: true, perimeter: true, ceilingHeight: true },
    });
    if (!selectedRoom || selectedRoom.projectId !== project.id) {
      throw new AppError("ROOM_PROJECT_MISMATCH", "This detected room does not belong to the specified project.", 400);
    }
    if (selectedRoom.status !== "CONFIRMED" && selectedRoom.status !== "CORRECTED") {
      throw new AppError("ROOM_NOT_CONFIRMED", "This room must receive a professional confirmation or correction before it can prefill a calculation.", 409);
    }
    room = selectedRoom;
  }
  const technicalData = (entity?.technicalDataJson as Record<string, unknown> | null) ?? null;
  const entityConfidence = entity ? entity.confidence.toNumber() : null;
  const entityMeasurementRecommendation = entity
    ? recommendMeasurementMethod({
        entityType: entity.entityType,
        label: entity.label,
        sourceText: entity.sourceText,
        unit: entity.unit,
      })
    : null;

  // Only these registry input keys have a well-defined, schema-backed DetectedRoom
  // equivalent — an explicit, documented mapping, never a fuzzy guess.
  const roomFieldByKey: Record<string, "area" | "perimeter" | "ceilingHeight"> = {
    netFloorArea: "area",
    ceilingArea: "area",
    perimeter: "perimeter",
    wallLength: "perimeter",
    wallHeight: "ceilingHeight",
  };

  return definition.inputs.map((input): DimensionValue => {
    if (
      input.key === "verifiedCount"
      && entity
      && entity.quantity !== null
      && entity.quantity.toNumber() > 0
      && entityMeasurementRecommendation?.calculationType
        === QuantityCalculationType.COUNT
    ) {
      return {
        key: input.key,
        label: input.label,
        unit: input.unit,
        required: input.required,
        value: entity.quantity.toNumber(),
        source: "extracted_entity",
        confidence: entityConfidence,
        reviewStatus: "PREFILLED",
      };
    }

    const fromTechnicalData = technicalData?.[input.key];
    if (typeof fromTechnicalData === "number" && Number.isFinite(fromTechnicalData)) {
      return {
        key: input.key,
        label: input.label,
        unit: input.unit,
        required: input.required,
        value: fromTechnicalData,
        source: "extracted_entity",
        confidence: entityConfidence,
        reviewStatus: "PREFILLED",
      };
    }

    const roomField = roomFieldByKey[input.key];
    if (room && roomField && room[roomField] !== null && room[roomField] !== undefined) {
      const rawValue = room[roomField] as { toNumber: () => number };
      return {
        key: input.key,
        label: input.label,
        unit: input.unit,
        required: input.required,
        value: rawValue.toNumber(),
        source: "detected_room",
        confidence: null,
        reviewStatus: "PREFILLED",
      };
    }

    return {
      key: input.key,
      label: input.label,
      unit: input.unit,
      required: input.required,
      value: null,
      source: null,
      confidence: null,
      reviewStatus: input.required ? "MISSING" : "MISSING",
    };
  });
}

export type CalculationPreview = {
  calculationType: QuantityCalculationType;
  dimensionValues: DimensionValue[];
  missingRequiredDimensions: DimensionValue[];
  result: FormulaResult | null;
};

/**
 * Read-only preview: computes a result ONLY if every required dimension has
 * a value already (prefilled or professional-entered). Never persists
 * anything. This is what powers the "visible equation" before commitment
 * (spec section 5).
 */
export function previewCalculation(calculationType: QuantityCalculationType, dimensionValues: DimensionValue[]): CalculationPreview {
  assertValidDimensionValues(dimensionValues);
  const definition = getRequiredDimensions(calculationType);
  if (!definition) {
    return { calculationType, dimensionValues, missingRequiredDimensions: [], result: null };
  }
  const missingRequiredDimensions = getMissingRequiredDimensions(definition, dimensionValues);
  if (missingRequiredDimensions.length > 0) {
    return { calculationType, dimensionValues, missingRequiredDimensions, result: null };
  }
  const values = Object.fromEntries(dimensionValues.filter((d) => d.value !== null).map((d) => [d.key, d.value as number]));
  const result = definition.compute(values);
  assertValidFormulaResult(result);
  return { calculationType, dimensionValues, missingRequiredDimensions: [], result };
}

export type CreateCalculationInput = {
  projectId: string;
  calculationType: QuantityCalculationType;
  extractedEntityId?: string | null;
  dimensionValues: DimensionValue[];
};

/**
 * Persists a calculation only once every required dimension is present —
 * mirrors previewCalculation's guard so a calculation can never be saved
 * mid-flight with an invented or missing value standing in for a real one.
 */
export async function createCalculation(actor: CurrentActor, input: CreateCalculationInput) {
  requireCapability(actor, "boq:edit");
  // Resolve the caller-supplied identifier (slug or UUID) to the canonical, tenant-owned
  // project FIRST — this is the actual proof that projectId belongs to actor.companyId.
  // A company can never create a calculation against another company's project: a foreign
  // or unknown identifier throws the same tenant-safe NotFound as any other lookup.
  const project = await getProjectRecord(actor.companyId, input.projectId);

  const definition = getRequiredDimensions(input.calculationType);
  if (!definition) {
    throw new AppError("CALCULATION_TYPE_NOT_SUPPORTED", `No deterministic formula is registered for calculation type "${input.calculationType}".`, 400);
  }
  assertValidDimensionValues(input.dimensionValues);
  const missing = getMissingRequiredDimensions(definition, input.dimensionValues);
  if (missing.length > 0) {
    throw new AppError(
      "MISSING_REQUIRED_DIMENSIONS",
      `Cannot calculate: missing required dimension(s): ${missing.map((m) => m.label).join(", ")}.`,
      400,
      Object.fromEntries(missing.map((m) => [m.key, [`${m.label} is required and not yet provided.`]])),
    );
  }

  if (input.extractedEntityId) {
    // Confirm the entity actually belongs to this company and this project before linking —
    // never trust a client-supplied ID blindly. Compared against the canonical project UUID,
    // not the caller-supplied identifier, since that may have been a slug.
    const entity = await getExtractedEntityRecord(actor.companyId, input.extractedEntityId);
    if (entity.projectId !== project.id) {
      throw new AppError("ENTITY_PROJECT_MISMATCH", "This extracted entity does not belong to the specified project.", 400);
    }
    if (entity.status !== "CONFIRMED" && entity.status !== "CORRECTED") {
      throw new AppError(
        "ENTITY_NOT_CONFIRMED",
        "This extracted entity must receive a professional confirmation or correction before it can be linked to a calculation.",
        409,
      );
    }
  }
