import type { BOQ } from "@/types/boq";

/**
 * BOQ workflow state derived only from evidence that is actually available.
 *
 * Direct reviewed schedule/count quantities do not require a dimensional
 * calculation. Rejected calculations never satisfy a required measurement.
 * Imported entities remain professionally accepted evidence. Validation
 * failure is never converted into "0 warnings".
 */
export type WorkflowStepStatus =
  | "COMPLETE"
  | "CURRENT"
  | "NEEDS_ATTENTION"
  | "NOT_STARTED"
  | "NOT_REQUIRED";

export type WorkflowStepId =
  | "sources"
  | "extraction"
  | "dimensions"
  | "calculation"
  | "boq_review"
  | "validation"
  | "output";

export type WorkflowStep = {
  id: WorkflowStepId;
  label: string;
  status: WorkflowStepStatus;
};

export type NextStepAction = {
  message: string;
  ctaLabel: string;
  ctaAction:
    | "open_files"
    | "review_extractions"
    | "review_dimensions"
    | "review_calculations"
    | "open_boq"
    | "run_validation"
    | "lock_boq"
    | "view_output"
    | null;
};

export type WorkflowEntityFact = {
  id: string;
  status: string;
  quantity?: number | null;
  unit?: string | null;
};

export type WorkflowCalculationFact = {
  id: string;
  extractedEntityId: string | null;
  status: string;
};

export type BoqWorkflowStateInput = {
  fileCount: number;
  extractedEntities: WorkflowEntityFact[];
  calculations: WorkflowCalculationFact[];
  boqItemCount: number;
  validationWarningCount: number | null;
  /**
   * Number of completed, non-draft generated documents for this exact BOQ
   * revision. null means output history could not be proven.
   */
  generatedDocumentCount: number | null;
  isLocked: boolean;
};

const REVIEWED_ENTITY_STATUSES = new Set([
  "CONFIRMED",
  "CORRECTED",
  "REJECTED",
  "IMPORTED",
]);

const ACCEPTED_ENTITY_STATUSES = new Set([
  "CONFIRMED",
  "CORRECTED",
  "IMPORTED",
]);

function hasUsableDirectReviewedQuantity(entity: WorkflowEntityFact): boolean {
  return (
    typeof entity.quantity === "number"
    && Number.isFinite(entity.quantity)
    && entity.quantity > 0
    && typeof entity.unit === "string"
    && entity.unit.trim().length > 0
  );
}

export function computeBoqWorkflowState(
  input: BoqWorkflowStateInput,
): { steps: WorkflowStep[]; nextAction: NextStepAction } {
  const unreviewedEntities = input.extractedEntities.filter(
    (entity) => !REVIEWED_ENTITY_STATUSES.has(entity.status),
  );

  const acceptedEntities = input.extractedEntities.filter(
    (entity) => ACCEPTED_ENTITY_STATUSES.has(entity.status),
  );

  const importableEntities = input.extractedEntities.filter(
    (entity) => entity.status === "CONFIRMED" || entity.status === "CORRECTED",
  );

  const acceptedEntityIds = new Set(acceptedEntities.map((entity) => entity.id));

  const nonRejectedCalculations = input.calculations.filter(
    (calculation) => calculation.status !== "REJECTED",
  );

  const linkedNonRejectedCalculations = nonRejectedCalculations.filter(
    (calculation) =>
      calculation.extractedEntityId !== null
      && acceptedEntityIds.has(calculation.extractedEntityId),
  );

  const confirmedCalculations = nonRejectedCalculations.filter(
    (calculation) => calculation.status === "CONFIRMED",
  );

  const relevantConfirmedCalculations = acceptedEntities.length > 0
    ? confirmedCalculations.filter(
        (calculation) =>
          calculation.extractedEntityId !== null
          && acceptedEntityIds.has(calculation.extractedEntityId),
      )
    : confirmedCalculations;

  const entitiesMissingDimensions = acceptedEntities.filter((entity) => {
    if (hasUsableDirectReviewedQuantity(entity)) return false;

    return !linkedNonRejectedCalculations.some(
      (calculation) => calculation.extractedEntityId === entity.id,
    );
  });

  const unconfirmedCalculations = nonRejectedCalculations.filter(
    (calculation) => calculation.status !== "CONFIRMED",
  );

  const hasAnyEntityCalculation = linkedNonRejectedCalculations.length > 0;

  const sourcesStatus: WorkflowStepStatus =
    input.fileCount > 0 ? "COMPLETE" : "NOT_STARTED";

  const extractionStatus: WorkflowStepStatus =
    input.fileCount === 0
      ? "NOT_STARTED"
      : unreviewedEntities.length > 0
        ? "NEEDS_ATTENTION"
        : input.extractedEntities.length > 0
          ? "COMPLETE"
          : "CURRENT";

  const dimensionsStatus: WorkflowStepStatus =
    entitiesMissingDimensions.length > 0
      ? "NEEDS_ATTENTION"
      : acceptedEntities.length === 0
        ? "NOT_STARTED"
        : hasAnyEntityCalculation
          ? "COMPLETE"
          : "NOT_REQUIRED";

  const calculationStatus: WorkflowStepStatus =
    unconfirmedCalculations.length > 0
      ? "NEEDS_ATTENTION"
      : relevantConfirmedCalculations.length > 0
        ? "COMPLETE"
        : acceptedEntities.length > 0 && entitiesMissingDimensions.length === 0
          ? "NOT_REQUIRED"
          : "NOT_STARTED";

  const boqReviewStatus: WorkflowStepStatus = input.isLocked
    ? "COMPLETE"
    : input.boqItemCount > 0
      ? "CURRENT"
      : "NOT_STARTED";

  const validationStatus: WorkflowStepStatus = input.isLocked
    ? "COMPLETE"
    : input.boqItemCount === 0
      ? "NOT_STARTED"
      : input.validationWarningCount === null
        ? "NEEDS_ATTENTION"
        : input.validationWarningCount > 0
          ? "NEEDS_ATTENTION"
          : "CURRENT";

  const outputStatus: WorkflowStepStatus = !input.isLocked
    ? "NOT_STARTED"
    : input.generatedDocumentCount !== null && input.generatedDocumentCount > 0
      ? "COMPLETE"
      : "CURRENT";

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
    nextAction = {
      message: "Add project drawings or source files first.",
      ctaLabel: "Add source files",
      ctaAction: "open_files",
    };
  } else if (unreviewedEntities.length > 0) {
    nextAction = {
      message: `Review the information Quantara found — ${unreviewedEntities.length} item(s) need your confirmation.`,
      ctaLabel: "Review extracted items",
      ctaAction: "review_extractions",
    };
  } else if (entitiesMissingDimensions.length > 0) {
    nextAction = {
      message: `${entitiesMissingDimensions.length} reviewed item(s) need professional dimensions before a quantity can be calculated.`,
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
    nextAction = {
      message:
        importableEntities.length > 0
          ? "Reviewed project information is ready to be added to the BOQ."
          : "Add your first BOQ item to get started.",
      ctaLabel:
        importableEntities.length > 0
          ? "Open reviewed items"
          : "Open BOQ",
      ctaAction: "open_boq",
    };
  } else if (input.isLocked) {
    nextAction = {
      message:
        input.generatedDocumentCount !== null && input.generatedDocumentCount > 0
          ? "This locked BOQ revision has professional output available."
          : "This BOQ revision is locked and ready for professional output generation.",
      ctaLabel: "View output",
      ctaAction: "view_output",
    };
  } else if (input.validationWarningCount === null) {
    nextAction = {
      message:
        "Validation status is currently unavailable. Open verification and run the checks before locking this revision.",
      ctaLabel: "Open validation",
      ctaAction: "run_validation",
    };
  } else if (input.validationWarningCount > 0) {
    nextAction = {
      message: `${input.validationWarningCount} validation warning(s) need professional attention before this BOQ is locked.`,
      ctaLabel: "Review validation",
      ctaAction: "run_validation",
    };
  } else {
    nextAction = {
      message:
        "The validation preview reports no structural warnings. Review verification, then use the explicit Lock revision control when professionally satisfied.",
      ctaLabel: "Open validation",
      ctaAction: "run_validation",
    };
  }

  return { steps, nextAction };
}

export function isBoqLockedForWorkflow(boq: BOQ | null): boolean {
  return Boolean(boq?.isLocked) || boq?.status === "locked" || boq?.status === "approved";
}
