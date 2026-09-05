import {
  ExtractedEntityType,
  QuantityCalculationType,
} from "@prisma/client";
import {
  getRequiredDimensions,
} from "@/lib/calculations/required-dimensions-registry";
import { recommendMeasurementMethod } from "@/lib/calculations/measurement-method-recommender";
import {
  tayqanMeasurementMethodForCalculationType,
  type TayqanMeasurementException,
  type TayqanMeasurementInput,
} from "@/lib/tayqan/tayqan-measurement-contract";
import type {
  TayqanMeasurementEvidenceBundle,
  TayqanMeasurementReasoner,
} from "@/lib/tayqan/tayqan-measurement-reasoner";

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function technicalDimension(
  calculationType: QuantityCalculationType,
  inputKey: string,
  technicalData: Record<string, unknown>,
): number | null {
  const direct = positiveNumber(technicalData[inputKey]);
  if (direct !== null) return direct;
  if (calculationType === QuantityCalculationType.FLOOR_AREA && inputKey === "netFloorArea") {
    const length = positiveNumber(technicalData.length);
    const width = positiveNumber(technicalData.width);
    return length !== null && width !== null ? length * width : null;
  }
  return null;
}

function ruleForEntity(
  bundle: TayqanMeasurementEvidenceBundle,
  entity: TayqanMeasurementEvidenceBundle["existingEntities"][number],
) {
  const rules = bundle.governingContext?.industryPolicy?.rules ?? [];
  const technicalData = record(entity.technicalData);
  const categoryPath = record(technicalData.categoryPath);
  const explicitRuleId = typeof categoryPath.workPackage === "string"
    ? categoryPath.workPackage
    : typeof technicalData.workPackage === "string"
      ? technicalData.workPackage
      : null;
  if (explicitRuleId) {
    const exact = rules.find((rule) => rule.id === explicitRuleId);
    if (exact) return exact;
  }

  const explicitCalculationType = typeof technicalData.calculationType === "string"
    ? technicalData.calculationType
    : null;
  if (explicitCalculationType) {
    const matches = rules.filter((rule) => rule.calculationType === explicitCalculationType);
    if (matches.length === 1) return matches[0];
  }

  const recommendation = recommendMeasurementMethod({
    entityType: entity.entityType as ExtractedEntityType,
    label: entity.label,
    sourceText: entity.sourceText,
    unit: entity.unit,
  });
  if (!recommendation.calculationType) return null;
  const matches = rules.filter(
    (rule) => rule.calculationType === recommendation.calculationType,
  );
  return matches.length === 1 ? matches[0] : null;
}

function sourcePageId(
  bundle: TayqanMeasurementEvidenceBundle,
  entity: TayqanMeasurementEvidenceBundle["existingEntities"][number],
): string | null {
  if (entity.drawingPageId) return entity.drawingPageId;
  return bundle.pages.find((page) => page.projectFileId === entity.projectFileId)?.id ?? null;
}

function inputsForEntity(
  bundle: TayqanMeasurementEvidenceBundle,
  entity: TayqanMeasurementEvidenceBundle["existingEntities"][number],
  calculationType: QuantityCalculationType,
  pageId: string,
): { inputs: TayqanMeasurementInput[]; missing: string[] } {
  const definition = getRequiredDimensions(calculationType);
  if (!definition) return { inputs: [], missing: ["registered deterministic formula"] };
  const technicalData = record(entity.technicalData);
  const inputs: TayqanMeasurementInput[] = [];
  const missing: string[] = [];

  for (const dimension of definition.inputs) {
    const value = dimension.key === "verifiedCount"
      && calculationType === QuantityCalculationType.COUNT
      ? positiveNumber(entity.quantity)
      : technicalDimension(calculationType, dimension.key, technicalData);
    if (value === null) {
      if (dimension.required) missing.push(dimension.label);
      continue;
    }
    inputs.push({
      key: dimension.key,
      value,
      unit: dimension.unit,
      derivation: entity.extractionMethod === "TABLE_PARSER"
        ? "SCHEDULE_VALUE"
        : dimension.key === "verifiedCount"
          ? "DIRECT_COUNT"
          : "EXPLICIT_DIMENSION",
      evidencePageIds: [pageId],
      evidenceRoomIds: [],
      evidenceNote: entity.sourceReference || entity.sourceText || "Deterministically extracted project evidence.",
      confidence: entity.confidence,
    });
  }
  return { inputs, missing };
}

/**
 * Standard Quantara estimator reasoner.
 *
 * It performs no network or model call. It routes persisted extraction evidence
 * through the selected industry's registered calculation rules and leaves any
 * ambiguous or incomplete scope as a visible review exception.
 */
export function createDeterministicMeasurementReasoner(): TayqanMeasurementReasoner {
  return async ({ bundle, onProgress }) => {
    const subjects = [];
    const exceptions: TayqanMeasurementException[] = [];

    for (const entity of bundle.existingEntities) {
      const pageId = sourcePageId(bundle, entity);
      const rule = ruleForEntity(bundle, entity);
      if (!pageId || !rule) {
        exceptions.push({
          kind: "METHOD_SELECTION_UNCERTAIN",
          message: `No unique coded industry rule could be bound to extracted scope "${entity.label}". Review its classification; no paid AI call was made.`,
          pageIds: pageId ? [pageId] : [],
          relatedEntityId: entity.id,
        });
        continue;
      }
      const method = tayqanMeasurementMethodForCalculationType(rule.calculationType);
      const resolved = inputsForEntity(bundle, entity, rule.calculationType, pageId);
      if (!method || resolved.missing.length > 0) {
        exceptions.push({
          kind: "INSUFFICIENT_EVIDENCE",
          message: `"${entity.label}" is missing coded input(s): ${resolved.missing.join(", ")}. No quantity was invented.`,
          pageIds: [pageId],
          relatedEntityId: entity.id,
        });
        continue;
      }

      const technicalData = record(entity.technicalData);
      subjects.push({
        existingEntityId: entity.id,
        primaryPageId: pageId,
        evidencePageIds: [pageId],
        entityType: entity.entityType as ExtractedEntityType,
        label: entity.label,
        workPackage: rule.id,
        location: typeof technicalData.location === "string"
          ? technicalData.location
          : null,
        measurementMethod: method,
        methodSelectionRationale: `Selected by registered industry rule ${rule.id} from persisted extraction evidence.`,
        methodConfidence: entity.confidence,
        calculationType: rule.calculationType,
        inputs: resolved.inputs,
        supportingChecks: [],
        rationale: "Calculated by Quantara's deterministic formula registry from explicit extracted dimensions.",
        sourceSummary: entity.sourceReference || entity.sourceText || entity.label,
        confidence: entity.confidence,
      });
    }

    await onProgress?.({
      phase: "CLUSTER_REVIEW_COMPLETE",
      completed: bundle.pages.length,
      total: Math.max(1, bundle.pages.length),
    });
    const coveredPages = new Set(subjects.flatMap((subject) => subject.evidencePageIds));
    return {
      provider: "quantara-deterministic",
      model: "industry-formula-registry/v1",
      responseIds: [],
      plan: { subjects, exceptions },
      seniorReview: {
        clusterReviewCount: bundle.pages.length,
        globalReviewApplied: false,
        acceptedSubjectCount: subjects.length,
        rejectedSubjectCount: 0,
        findingCount: exceptions.length,
        evidencePageCoveragePercent: bundle.pages.length === 0
          ? 0
          : (coveredPages.size / bundle.pages.length) * 100,
      },
    };
  };
}
