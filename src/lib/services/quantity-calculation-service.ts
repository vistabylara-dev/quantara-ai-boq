import type { QuantityCalculationType } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError } from "@/lib/errors/app-error";
import {
  getRequiredDimensions,
  getMissingRequiredDimensions,
  type DimensionValue,
} from "@/lib/calculations/required-dimensions-registry";
import type { FormulaResult } from "@/lib/calculations/quantity-formulas";
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
 * numeric value merely because a formula needs it. Three defensible sources,
 * in priority order:
 * 1. ExtractedEntity.technicalDataJson[key] — an exact key-name match only.
 * 2. ExtractedEntity.quantity/unit — only when the unit matches the
 *    specific required input's unit exactly (never a unit-converted guess).
 * 3. An explicitly professional-selected DetectedRoom's own area/perimeter/
 *    ceilingHeight — never fuzzy-matched, only used when the caller passes
 *    detectedRoomId explicitly (a human decision, not an inference).
 */
export async function prefillDimensionValues(
  companyId: string,
  calculationType: QuantityCalculationType,
  options: { extractedEntityId?: string | null; detectedRoomId?: string | null },
): Promise<DimensionValue[]> {
  const definition = getRequiredDimensions(calculationType);
  if (!definition) return [];

  let entity: Awaited<ReturnType<typeof getExtractedEntityRecord>> | null = null;
  if (options.extractedEntityId) {
    entity = await getExtractedEntityRecord(companyId, options.extractedEntityId);
  }
  let room: { area: unknown; perimeter: unknown; ceilingHeight: unknown } | null = null;
  if (options.detectedRoomId) {
    room = await prisma.detectedRoom.findFirst({
      where: { id: options.detectedRoomId, companyId },
      select: { area: true, perimeter: true, ceilingHeight: true },
    });
  }
  const technicalData = (entity?.technicalDataJson as Record<string, unknown> | null) ?? null;
  const entityConfidence = entity ? entity.confidence.toNumber() : null;

  // Only these three registry input keys have a well-defined, schema-backed DetectedRoom
  // equivalent — an explicit, documented mapping, never a fuzzy guess.
  const roomFieldByKey: Record<string, "area" | "perimeter" | "ceilingHeight"> = {
    netFloorArea: "area",
    ceilingArea: "area",
    perimeter: "perimeter",
    wallHeight: "ceilingHeight",
  };

  return definition.inputs.map((input): DimensionValue => {
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

    if (entity && entity.quantity && entity.unit && input.unit && entity.unit.toLowerCase() === input.unit.toLowerCase()) {
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
  const definition = getRequiredDimensions(input.calculationType);
  if (!definition) {
    throw new AppError("CALCULATION_TYPE_NOT_SUPPORTED", `No deterministic formula is registered for calculation type "${input.calculationType}".`, 400);
  }
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
    // never trust a client-supplied ID blindly.
    const entity = await getExtractedEntityRecord(actor.companyId, input.extractedEntityId);
    if (entity.projectId !== input.projectId) {
      throw new AppError("ENTITY_PROJECT_MISMATCH", "This extracted entity does not belong to the specified project.", 400);
    }
  }

  const values = Object.fromEntries(input.dimensionValues.filter((d) => d.value !== null).map((d) => [d.key, d.value as number]));
  const result = definition.compute(values);

  const providedConfidences = input.dimensionValues.map((d) => d.confidence).filter((c): c is number => c !== null);
  // Confidence reflects the weakest evidence actually used — never a fabricated blanket
  // number. A fully professional-entered calculation (no extracted evidence) is 100%
  // confident by construction: every value was a direct human decision, not an extraction.
  const confidence = providedConfidences.length > 0 ? Math.min(...providedConfidences) : 100;

  const created = await createQuantityCalculation(actor.companyId, {
    projectId: input.projectId,
    extractedEntityId: input.extractedEntityId ?? null,
    calculationType: input.calculationType,
    inputValues: result.inputValues,
    deductions: result.deductions ?? null,
    allowances: result.allowances ?? null,
    formula: result.formula,
    resultValue: result.resultValue,
    resultUnit: result.resultUnit,
    confidence,
  });

  await createAuditLog(actor.companyId, {
    entityType: "QuantityCalculation",
    entityId: created.id,
    action: "CALCULATION_CREATED",
    payload: { calculationType: input.calculationType, formula: result.formula, resultValue: result.resultValue, resultUnit: result.resultUnit },
  });

  return toQuantityCalculationDTO(created);
}

export async function listCalculationsForProject(actor: CurrentActor, projectId: string) {
  const rows = await listQuantityCalculationsForProject(actor.companyId, projectId);
  return rows.map(toQuantityCalculationDTO);
}

export async function listCalculationsForEntity(actor: CurrentActor, extractedEntityId: string) {
  const rows = await listQuantityCalculationsForEntity(actor.companyId, extractedEntityId);
  return rows.map(toQuantityCalculationDTO);
}

export async function getCalculation(actor: CurrentActor, calculationId: string) {
  const row = await getQuantityCalculationRecord(actor.companyId, calculationId);
  return toQuantityCalculationDTO(row);
}

/** Human confirmation (spec section 6) — records confirmedBy/confirmedAt, matching confirmExtractedEntity's pattern exactly. */
export async function confirmCalculation(actor: CurrentActor, calculationId: string) {
  requireCapability(actor, "verification:manage");
  const updated = await confirmQuantityCalculationRecord(actor.companyId, calculationId, actor.userId);
  await createAuditLog(actor.companyId, { entityType: "QuantityCalculation", entityId: calculationId, action: "CALCULATION_CONFIRMED", payload: {} });
  return toQuantityCalculationDTO(updated);
}

export async function rejectCalculation(actor: CurrentActor, calculationId: string, reason: string) {
  requireCapability(actor, "verification:manage");
  const updated = await rejectQuantityCalculationRecord(actor.companyId, calculationId);
  await createAuditLog(actor.companyId, { entityType: "QuantityCalculation", entityId: calculationId, action: "CALCULATION_REJECTED", payload: { reason } });
  return toQuantityCalculationDTO(updated);
}

export async function overrideCalculationResult(actor: CurrentActor, calculationId: string, newResultValue: number, reason: string) {
  requireCapability(actor, "verification:manage");
  if (!reason || !reason.trim()) {
    throw new AppError("OVERRIDE_REASON_REQUIRED", "A reason is required to override a calculated quantity.", 400);
  }
  const current = await getQuantityCalculationRecord(actor.companyId, calculationId);
  const updated = await overrideQuantityCalculationRecord(actor.companyId, calculationId, newResultValue, reason);
  await createAuditLog(actor.companyId, {
    entityType: "QuantityCalculation",
    entityId: calculationId,
    action: "CALCULATION_OVERRIDDEN",
    payload: { originalResultValue: current.resultValue.toNumber(), newResultValue, reason },
  });
  return toQuantityCalculationDTO(updated);
}
