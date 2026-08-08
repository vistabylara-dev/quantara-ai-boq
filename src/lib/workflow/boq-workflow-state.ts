import type { BOQ } from "@/types/boq";

/**
 * Guided BOQ measurement workflow (Release 1), spec section 1 — a single,
 * pure, testable function deriving the 7-stage workflow status from real
 * data only. Never marks a stage COMPLETE without evidence: every branch
 * below is driven by an actual count from the API, never a guess.
 */

export type WorkflowStepStatus = "COMPLETE" | "CURRENT" | "NEEDS_ATTENTION" | "NOT_STARTED";

export type WorkflowStepId = "sources" | "extraction" | "dimensions" | "calculation" | "boq_review" | "validation" | "output";

export type WorkflowStep = {
  id: WorkflowStepId;
  label: string;
  status: WorkflowStepStatus;
};

export type NextStepAction = {
  message: string;
  ctaLabel: string;
  ctaAction: "open_files" | "review_extractions" | "review_dimensions" | "review_calculations" | "open_boq" | "run_validation" | "lock_boq" | null;
};

export type BoqWorkflowStateInput = {
  fileCount: number;
  extractedEntities: { id: string; status: string }[];
  calculations: { id: string; extractedEntityId: string | null; status: string }[];
  boqItemCount: number;
  validationWarningCount: number;
  isLocked: boolean;
};

const REVIEWED_ENTITY_STATUSES = new Set(["CONFIRMED", "CORRECTED", "REJECTED", "IMPORTED"]);

export function computeBoqWorkflowState(input: BoqWorkflowStateInput): { steps: WorkflowStep[]; nextAction: NextStepAction } {
  const reviewableEntities = input.extractedEntities.filter((e) => e.status !== "REJECTED");
  const unreviewedEntities = input.extractedEntities.filter((e) => !REVIEWED_ENTITY_STATUSES.has(e.status));
  const reviewedEntityIds = new Set(
    input.extractedEntities.filter((e) => e.status === "CONFIRMED" || e.status === "CORRECTED").map((e) => e.id),
  );
  const entitiesMissingDimensions = [...reviewedEntityIds].filter(
    (entityId) => !input.calculations.some((c) => c.extractedEntityId === entityId),
  );
  const unconfirmedCalculations = input.calculations.filter((c) => c.status !== "CONFIRMED");

  const sourcesStatus: WorkflowStepStatus = input.fileCount > 0 ? "COMPLETE" : "NOT_STARTED";

  const extractionStatus: WorkflowStepStatus =
    input.fileCount === 0
      ? "NOT_STARTED"
      : unreviewedEntities.length > 0
        ? "NEEDS_ATTENTION"
        : reviewableEntities.length > 0
          ? "COMPLETE"
          : "CURRENT";

  const dimensionsStatus: WorkflowStepStatus =
    entitiesMissingDimensions.length > 0 ? "NEEDS_ATTENTION" : reviewedEntityIds.size > 0 ? "COMPLETE" : "NOT_STARTED";

  const calculationStatus: WorkflowStepStatus =
    unconfirmedCalculations.length > 0 ? "NEEDS_ATTENTION" : input.calculations.length > 0 ? "COMPLETE" : "NOT_STARTED";

  const boqReviewStatus: WorkflowStepStatus = input.isLocked
    ? "COMPLETE"
    : input.boqItemCount > 0
      ? "CURRENT"
      : "NOT_STARTED";

  const validationStatus: WorkflowStepStatus = input.isLocked
    ? "COMPLETE"
    : input.boqItemCount === 0
      ? "NOT_STARTED"
      : input.validationWarningCount > 0
        ? "NEEDS_ATTENTION"
        : "CURRENT";

  const outputStatus: WorkflowStepStatus = input.isLocked ? "COMPLETE" : "NOT_STARTED";

  const steps: WorkflowStep[] = [
    { id: "sources", label: "Sources", status: sourcesStatus },
    { id: "extraction", label: "Extraction", status: extractionStatus },
    { id: "dimensions", label: "Dimensions", status: dimensionsStatus },
    { id: "calculation", label: "Calculation", status: calculationStatus },
    { id: "boq_review", label: "BOQ Review", status: boqReviewStatus },
    { id: "validation", label: "Validation", status: validationStatus },
    { id: "output", label: "Output", status: outputStatus },
  ];

  let nextAction: NextStepAction;
  if (input.fileCount === 0 && input.boqItemCount === 0) {
    nextAction = { message: "Add project drawings or source files first.", ctaLabel: "Add source files", ctaAction: "open_files" };
  } else if (unreviewedEntities.length > 0) {
    nextAction = {
      message: `Review the information Quantara found — ${unreviewedEntities.length} item(s) need your confirmation.`,
      ctaLabel: "Review extracted items",
      ctaAction: "review_extractions",
    };
  } else if (entitiesMissingDimensions.length > 0) {
    nextAction = {
      message: `${entitiesMissingDimensions.length} item(s) need measurements before quantities can be calculated.`,
      ctaLabel: "Add dimensions",
      ctaAction: "review_dimensions",
    };
  } else if (unconfirmedCalculations.length > 0) {
    nextAction = {
      message: `${unconfirmedCalculations.length} calculation(s) are ready for professional review.`,
      ctaLabel: "Review calculations",
      ctaAction: "review_calculations",
    };
  } else if (input.boqItemCount === 0) {
    nextAction = { message: "Add your first BOQ item to get started.", ctaLabel: "Open BOQ", ctaAction: "open_boq" };
  } else if (!input.isLocked && input.validationWarningCount > 0) {
    nextAction = {
      message: `${input.validationWarningCount} validation warning(s) need attention before this BOQ can be locked.`,
      ctaLabel: "Run validation",
      ctaAction: "run_validation",
    };
  } else if (!input.isLocked) {
    nextAction = { message: "Your next step is BOQ validation and locking.", ctaLabel: "Lock BOQ", ctaAction: "lock_boq" };
  } else {
    nextAction = { message: "This BOQ revision is locked and ready for output.", ctaLabel: "View output", ctaAction: null };
  }

  return { steps, nextAction };
}

export function isBoqLockedForWorkflow(boq: BOQ | null): boolean {
  return Boolean(boq?.isLocked) || boq?.status === "locked" || boq?.status === "approved";
}
