import {
  Prisma,
  WorkerDecisionCode,
  WorkerDecisionOutcome,
  WorkerDecisionSeverity,
  WorkerMaterialQuestionType,
  WorkerReviewConclusion,
} from "@prisma/client";

export const REVIEW_EXISTING_BOQ_INSPECTION_VERSION = "worker-v0-review-existing-boq/1";

type QuantityProvenanceInput = {
  id: string;
  sourceType: string;
  quantitySnapshot: string;
  unitSnapshot: string;
  confirmedAt: Date | string | null;
};

type RateProvenanceInput = {
  id: string;
  sourceType: string;
  unitCostSnapshot: string;
  freightCostSnapshot: string;
  installationCostSnapshot: string;
  additionalCostSnapshot: string;
  marginModeSnapshot: string;
  marginPercentageSnapshot: string;
  sourceExpiryDate: Date | string | null;
  confirmedAt: Date | string | null;
};

export type ReviewExistingBOQItemInput = {
  id: string;
  sectionId: string;
  sectionCode: string;
  sectionSortOrder: number;
  sortOrder: number;
  itemNumber: number;
  itemCode: string;
  description: string;
  status: string;
  quantity: string;
  unit: string;
  unitCost: string;
  freightCost: string;
  installationCost: string;
  additionalCost: string;
  marginMode: string;
  marginPercentage: string;
  quantityProvenance: QuantityProvenanceInput | null;
  rateProvenance: RateProvenanceInput | null;
};

export type ReviewExistingBOQExceptionInput = {
  id: string;
  boqItemId: string | null;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  resolved: boolean;
};

export type ReviewExistingBOQInput = {
  inspectionAsOf: Date | string;
  boq: {
    id: string;
    projectId: string;
    title: string;
    revisionNumber: number;
    version: number;
    verifiedVersion: number | null;
    status: string;
    isLocked: boolean;
  };
  sectionCount: number;
  items: ReviewExistingBOQItemInput[];
  verificationExceptions: ReviewExistingBOQExceptionInput[];
  revisionSnapshotId: string | null;
  revisionEvidenceItemIds: string[];
};

export type WorkerMaterialQuestionDraft = {
  questionType: WorkerMaterialQuestionType;
  subjectType: string;
  subjectId: string | null;
  prompt: string;
  whyMaterial: string;
  recommendedAction: string;
};

export type WorkerDecisionDraft = {
  code: WorkerDecisionCode;
  outcome: WorkerDecisionOutcome;
  severity: WorkerDecisionSeverity;
  subjectType: string;
  subjectId: string | null;
  summary: string;
  rationale: Prisma.InputJsonObject;
  evidenceRefs: Prisma.InputJsonObject;
  question?: WorkerMaterialQuestionDraft;
};

export type ReviewExistingBOQResult = {
  conclusion: WorkerReviewConclusion;
  status: "COMPLETED" | "NEEDS_INPUT";
  summary: Prisma.InputJsonObject;
  items: Prisma.InputJsonArray;
  decisions: WorkerDecisionDraft[];
};

function decimalEquals(left: string, right: string): boolean {
  try {
    return new Prisma.Decimal(left).equals(new Prisma.Decimal(right));
  } catch {
    return false;
  }
}

function validDate(value: Date | string, field: string): Date {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid deterministic date.`);
  }
  return parsed;
}

function quantityState(item: ReviewExistingBOQItemInput): "MISSING" | "UNCONFIRMED" | "MISMATCH" | "CONFIRMED" {
  const provenance = item.quantityProvenance;
  if (!provenance) return "MISSING";
  if (provenance.sourceType === "LEGACY_UNVERIFIED" || !provenance.confirmedAt) return "UNCONFIRMED";
  if (!decimalEquals(provenance.quantitySnapshot, item.quantity) || provenance.unitSnapshot !== item.unit) {
    return "MISMATCH";
  }
  return "CONFIRMED";
}

function rateState(item: ReviewExistingBOQItemInput): "MISSING" | "UNCONFIRMED" | "MISMATCH" | "CONFIRMED" {
  const provenance = item.rateProvenance;
  if (!provenance) return "MISSING";
  if (provenance.sourceType === "LEGACY_UNVERIFIED" || !provenance.confirmedAt) return "UNCONFIRMED";
  const matches =
    decimalEquals(provenance.unitCostSnapshot, item.unitCost)
    && decimalEquals(provenance.freightCostSnapshot, item.freightCost)
    && decimalEquals(provenance.installationCostSnapshot, item.installationCost)
    && decimalEquals(provenance.additionalCostSnapshot, item.additionalCost)
    && provenance.marginModeSnapshot === item.marginMode
    && decimalEquals(provenance.marginPercentageSnapshot, item.marginPercentage);
  return matches ? "CONFIRMED" : "MISMATCH";
}

function materialDecision(input: Omit<WorkerDecisionDraft, "outcome" | "severity">): WorkerDecisionDraft {
  return {
    ...input,
    outcome: WorkerDecisionOutcome.NEEDS_INPUT,
    severity: WorkerDecisionSeverity.MATERIAL,
  };
}

function quantityDecision(item: ReviewExistingBOQItemInput, state: Exclude<ReturnType<typeof quantityState>, "CONFIRMED">) {
  const code = state === "MISSING"
    ? WorkerDecisionCode.QUANTITY_PROVENANCE_MISSING
    : state === "UNCONFIRMED"
      ? WorkerDecisionCode.QUANTITY_PROVENANCE_UNCONFIRMED
      : WorkerDecisionCode.QUANTITY_PROVENANCE_MISMATCH;
  const reason = state === "MISSING"
    ? "No relational quantity provenance exists."
    : state === "UNCONFIRMED"
      ? "Quantity provenance is legacy-unverified or lacks professional confirmation."
      : "The provenance snapshot does not match the current quantity or unit.";
  return materialDecision({
    code,
    subjectType: "BOQItem",
    subjectId: item.id,
    summary: `Quantity evidence needs professional action for item ${item.itemCode}.`,
    rationale: { state, reason },
    evidenceRefs: {
      boqItemId: item.id,
      quantityProvenanceId: item.quantityProvenance?.id ?? null,
    },
    question: {
      questionType: WorkerMaterialQuestionType.CONFIRM_QUANTITY_PROVENANCE,
      subjectType: "BOQItem",
      subjectId: item.id,
      prompt: `What governed evidence confirms the quantity and unit for ${item.itemCode}?`,
      whyMaterial: "The estimate cannot treat this quantity as governed until its provenance matches the current BOQ value.",
      recommendedAction: "Review the source or calculation, then confirm the item through the BOQ integrity workflow.",
    },
  });
}

function rateDecision(item: ReviewExistingBOQItemInput, state: Exclude<ReturnType<typeof rateState>, "CONFIRMED">) {
  const code = state === "MISSING"
    ? WorkerDecisionCode.RATE_PROVENANCE_MISSING
    : state === "UNCONFIRMED"
      ? WorkerDecisionCode.RATE_PROVENANCE_UNCONFIRMED
      : WorkerDecisionCode.RATE_PROVENANCE_MISMATCH;
  const reason = state === "MISSING"
    ? "No relational rate provenance exists."
    : state === "UNCONFIRMED"
      ? "Rate provenance is legacy-unverified or lacks professional confirmation."
      : "The provenance snapshot does not match the current commercial inputs.";
  return materialDecision({
    code,
    subjectType: "BOQItem",
    subjectId: item.id,
    summary: `Rate evidence needs professional action for item ${item.itemCode}.`,
    rationale: { state, reason },
    evidenceRefs: {
      boqItemId: item.id,
      rateProvenanceId: item.rateProvenance?.id ?? null,
    },
    question: {
      questionType: WorkerMaterialQuestionType.CONFIRM_RATE_PROVENANCE,
      subjectType: "BOQItem",
      subjectId: item.id,
      prompt: `What approved source confirms the commercial inputs for ${item.itemCode}?`,
      whyMaterial: "The estimate cannot treat this rate as governed until its source snapshot matches the current BOQ values.",
      recommendedAction: "Review the catalogue, library, prior BOQ, import, or manual basis, then confirm it through the BOQ integrity workflow.",
    },
  });
}

/**
 * Pure, deterministic Worker V0 inspection. The function has no database,
 * network, model, or clock access and cannot mutate the governed estimate.
 */
export function inspectExistingBOQ(input: ReviewExistingBOQInput): ReviewExistingBOQResult {
  const inspectionAsOf = validDate(input.inspectionAsOf, "inspectionAsOf");
  const activeItems = input.items
    .filter((item) => item.status !== "REJECTED")
    .slice()
    .sort((left, right) =>
      left.sectionSortOrder - right.sectionSortOrder
      || left.sortOrder - right.sortOrder
      || left.id.localeCompare(right.id));
  const decisions: WorkerDecisionDraft[] = [];

  if (activeItems.length === 0) {
    decisions.push(materialDecision({
      code: WorkerDecisionCode.BOQ_EMPTY,
      subjectType: "BOQ",
      subjectId: input.boq.id,
      summary: "The BOQ has no active items to review.",
      rationale: { activeItemCount: 0 },
      evidenceRefs: { boqId: input.boq.id },
      question: {
        questionType: WorkerMaterialQuestionType.CONFIRM_EMPTY_BOQ_SCOPE,
        subjectType: "BOQ",
        subjectId: input.boq.id,
        prompt: "Is this BOQ intentionally empty, or are governed items still missing?",
        whyMaterial: "A review cannot establish estimate completeness without at least one active item or an explicit professional scope decision.",
        recommendedAction: "Confirm the intended scope and add governed items where required, then run a new review assignment.",
      },
    }));
  }

  if (input.boq.verifiedVersion !== input.boq.version) {
    decisions.push(materialDecision({
      code: WorkerDecisionCode.BOQ_VERIFICATION_STALE,
      subjectType: "BOQ",
      subjectId: input.boq.id,
      summary: "The BOQ has not been verified at its current version.",
      rationale: {
        sourceBoqVersion: input.boq.version,
        verifiedVersion: input.boq.verifiedVersion,
      },
      evidenceRefs: { boqId: input.boq.id },
      question: {
        questionType: WorkerMaterialQuestionType.RUN_CURRENT_VERIFICATION,
        subjectType: "BOQ",
        subjectId: input.boq.id,
        prompt: "Who will run and review verification for the current BOQ version?",
        whyMaterial: "Verification results from an older version cannot support a current professional review.",
        recommendedAction: "Run the existing deterministic BOQ verification workflow, resolve material exceptions, then create a new worker review.",
      },
    }));
  }

  const unresolvedExceptions = input.verificationExceptions
    .filter((entry) => !entry.resolved)
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id));
  for (const exception of unresolvedExceptions) {
    if (exception.severity === "CRITICAL") {
      decisions.push(materialDecision({
        code: WorkerDecisionCode.UNRESOLVED_CRITICAL_EXCEPTION,
        subjectType: "VerificationException",
        subjectId: exception.id,
        summary: exception.message,
        rationale: { exceptionType: exception.type, severity: exception.severity },
        evidenceRefs: {
          verificationExceptionId: exception.id,
          boqItemId: exception.boqItemId,
        },
        question: {
          questionType: WorkerMaterialQuestionType.RESOLVE_CRITICAL_VERIFICATION_EXCEPTION,
          subjectType: "VerificationException",
          subjectId: exception.id,
          prompt: `How will the critical verification exception “${exception.message}” be resolved?`,
          whyMaterial: "Critical verification exceptions block a professionally reliable estimate review.",
          recommendedAction: "Correct or explicitly resolve the exception in the verification workspace, then run a new worker review.",
        },
      }));
    } else if (exception.severity === "WARNING") {
      decisions.push({
        code: WorkerDecisionCode.UNRESOLVED_WARNING_EXCEPTION,
        outcome: WorkerDecisionOutcome.OBSERVATION,
        severity: WorkerDecisionSeverity.WARNING,
        subjectType: "VerificationException",
        subjectId: exception.id,
        summary: exception.message,
        rationale: { exceptionType: exception.type, severity: exception.severity },
        evidenceRefs: {
          verificationExceptionId: exception.id,
          boqItemId: exception.boqItemId,
        },
      });
    }
  }

  let confirmedQuantityCount = 0;
  let confirmedRateCount = 0;
  const workspaceItems: Prisma.InputJsonValue[] = [];
  for (const item of activeItems) {
    const currentQuantityState = quantityState(item);
    const currentRateState = rateState(item);
    if (currentQuantityState === "CONFIRMED") confirmedQuantityCount += 1;
    else decisions.push(quantityDecision(item, currentQuantityState));
    if (currentRateState === "CONFIRMED") confirmedRateCount += 1;
    else decisions.push(rateDecision(item, currentRateState));

    if (
      currentRateState === "CONFIRMED"
      && item.rateProvenance?.sourceExpiryDate
      && validDate(item.rateProvenance.sourceExpiryDate, "sourceExpiryDate").getTime() < inspectionAsOf.getTime()
    ) {
      decisions.push(materialDecision({
        code: WorkerDecisionCode.RATE_SOURCE_EXPIRED,
        subjectType: "BOQItem",
        subjectId: item.id,
        summary: `The confirmed rate source for ${item.itemCode} is expired.`,
        rationale: {
          sourceExpiryDate: validDate(item.rateProvenance.sourceExpiryDate, "sourceExpiryDate").toISOString(),
          inspectionAsOf: inspectionAsOf.toISOString(),
        },
        evidenceRefs: {
          boqItemId: item.id,
          rateProvenanceId: item.rateProvenance.id,
        },
        question: {
          questionType: WorkerMaterialQuestionType.CONFIRM_EXPIRED_RATE_SOURCE,
          subjectType: "BOQItem",
          subjectId: item.id,
          prompt: `Should the expired rate source for ${item.itemCode} be refreshed or explicitly reconfirmed?`,
          whyMaterial: "An expired source may no longer support the current commercial input.",
          recommendedAction: "Refresh the governed rate source or professionally reconfirm the current rate, then run a new worker review.",
        },
      }));
    }

    workspaceItems.push({
      boqItemId: item.id,
      sectionId: item.sectionId,
      sectionCode: item.sectionCode,
      itemNumber: item.itemNumber,
      itemCode: item.itemCode,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitCost: item.unitCost,
      quantityIntegrity: {
        state: currentQuantityState,
        provenanceId: item.quantityProvenance?.id ?? null,
        sourceType: item.quantityProvenance?.sourceType ?? null,
      },
      rateIntegrity: {
        state: currentRateState,
        provenanceId: item.rateProvenance?.id ?? null,
        sourceType: item.rateProvenance?.sourceType ?? null,
        sourceExpiryDate: item.rateProvenance?.sourceExpiryDate
          ? validDate(item.rateProvenance.sourceExpiryDate, "sourceExpiryDate").toISOString()
          : null,
      },
    });
  }

  const revisionEvidenceIds = new Set(input.revisionEvidenceItemIds);
  if (input.boq.isLocked) {
    if (!input.revisionSnapshotId) {
      decisions.push(materialDecision({
        code: WorkerDecisionCode.LOCKED_REVISION_SNAPSHOT_MISSING,
        subjectType: "BOQ",
        subjectId: input.boq.id,
        summary: "The locked BOQ has no revision snapshot.",
        rationale: { revisionNumber: input.boq.revisionNumber },
        evidenceRefs: { boqId: input.boq.id },
        question: {
          questionType: WorkerMaterialQuestionType.RESTORE_LOCKED_REVISION_EVIDENCE,
          subjectType: "BOQ",
          subjectId: input.boq.id,
          prompt: "Who will investigate the missing locked-revision snapshot?",
          whyMaterial: "A locked estimate must retain its exact issued revision evidence.",
          recommendedAction: "Stop release activity and investigate the evidence store; do not reconstruct or invent historical values.",
        },
      }));
    } else {
      const missingEvidenceIds = activeItems
        .map((item) => item.id)
        .filter((itemId) => !revisionEvidenceIds.has(itemId));
      if (missingEvidenceIds.length > 0) {
        decisions.push(materialDecision({
          code: WorkerDecisionCode.LOCKED_REVISION_EVIDENCE_MISSING,
          subjectType: "BOQRevisionSnapshot",
          subjectId: input.revisionSnapshotId,
          summary: "The locked revision is missing item-level integrity evidence.",
          rationale: { missingItemCount: missingEvidenceIds.length },
          evidenceRefs: {
            boqRevisionSnapshotId: input.revisionSnapshotId,
            missingBoqItemIds: missingEvidenceIds,
          },
          question: {
            questionType: WorkerMaterialQuestionType.RESTORE_LOCKED_REVISION_EVIDENCE,
            subjectType: "BOQRevisionSnapshot",
            subjectId: input.revisionSnapshotId,
            prompt: "Who will investigate the incomplete locked-revision evidence set?",
            whyMaterial: "Every active item in a locked revision must remain linked to frozen quantity and rate provenance.",
            recommendedAction: "Stop release activity and investigate the immutable evidence chain; do not silently backfill invented evidence.",
          },
        }));
      }
    }
  }

  if (decisions.length === 0) {
    decisions.push({
      code: WorkerDecisionCode.BOQ_REVIEW_CLEAR,
      outcome: WorkerDecisionOutcome.PASS,
      severity: WorkerDecisionSeverity.INFO,
      subjectType: "BOQ",
      subjectId: input.boq.id,
      summary: "All active BOQ items have matching confirmed quantity and rate provenance.",
      rationale: {
        activeItemCount: activeItems.length,
        verifiedVersion: input.boq.verifiedVersion,
      },
      evidenceRefs: {
        boqId: input.boq.id,
        boqRevisionSnapshotId: input.revisionSnapshotId,
      },
    });
  }

  const materialQuestionCount = decisions.filter((decision) => decision.question).length;
  const observationCount = decisions.filter((decision) => decision.outcome === WorkerDecisionOutcome.OBSERVATION).length;
  const unresolvedCriticalCount = unresolvedExceptions.filter((entry) => entry.severity === "CRITICAL").length;
  const unresolvedWarningCount = unresolvedExceptions.filter((entry) => entry.severity === "WARNING").length;
  const conclusion = materialQuestionCount > 0
    ? WorkerReviewConclusion.NEEDS_INPUT
    : observationCount > 0
      ? WorkerReviewConclusion.CLEAR_WITH_OBSERVATIONS
      : WorkerReviewConclusion.CLEAR;

  return {
    conclusion,
    status: materialQuestionCount > 0 ? "NEEDS_INPUT" : "COMPLETED",
    summary: {
      inspectionVersion: REVIEW_EXISTING_BOQ_INSPECTION_VERSION,
      inspectionAsOf: inspectionAsOf.toISOString(),
      sectionCount: input.sectionCount,
      itemCount: input.items.length,
      activeItemCount: activeItems.length,
      confirmedQuantityCount,
      confirmedRateCount,
      unresolvedCriticalCount,
      unresolvedWarningCount,
      revisionEvidenceCount: input.revisionEvidenceItemIds.length,
      decisionCount: decisions.length,
      materialQuestionCount,
      conclusion,
    },
    items: workspaceItems,
    decisions,
  };
}
