import type { BOQ } from "@/types/boq";
import { defaultTranslator, type TranslateFn } from "@/lib/i18n/translate";

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
    | "view_boq"
    | "run_validation"
    | "lock_boq"
    | "view_output"
    | null;
};

/**
 * Maps each stepper stage to the action that already exists for it via the
 * "what should I do next" CTA — the stepper badges reuse the same handler
 * instead of duplicating navigation/guard logic. "boq_review" gets its own
 * "view_boq" action (scroll to the already-visible editor) rather than
 * "open_boq", which pops the add-item modal — the wrong control for a step
 * whose whole point is reviewing items that are already on screen.
 */
export const WORKFLOW_STEP_ACTIONS: Record<WorkflowStepId, NonNullable<NextStepAction["ctaAction"]>> = {
  sources: "open_files",
  extraction: "review_extractions",
  dimensions: "review_dimensions",
  calculation: "review_calculations",
  boq_review: "view_boq",
  validation: "run_validation",
  output: "view_output",
};

export function describeWorkflowStepReason(
  status: WorkflowStepStatus,
  t: TranslateFn = defaultTranslator,
): string {
  const reasons: Record<WorkflowStepStatus, string> = {
    COMPLETE: t("boqEditor.reasonComplete"),
    CURRENT: t("boqEditor.reasonCurrent"),
    NEEDS_ATTENTION: t("boqEditor.reasonNeedsAttention"),
    NOT_STARTED: t("boqEditor.reasonNotStarted"),
    NOT_REQUIRED: t("boqEditor.reasonNotRequired"),
  };
  return reasons[status];
}

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
  inputValues?: Record<string, number> | null;
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

const DIMENSION_INPUT_KEYS = new Set([
  "approvedAllowancePercentage",
  "approvedTerminationAllowance",
  "barLength",
  "ceilingArea",
  "coats",
  "depth",
  "ductPerimeter",
  "exposedConcreteSurfaceArea",
  "faces",
  "height",
  "length",
  "netFloorArea",
  "openingsArea",
  "perimeter",
  "routeLength",
  "scheduleQuantity",
  "totalDoorWidths",
  "unitWeightPerMeter",
  "verifiedRouteLength",
  "verticalDrops",
  "wallArea",
  "wallHeight",
  "wallLength",
  "wastagePercentage",
  "width",
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
  t: TranslateFn = defaultTranslator,
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

  // A calculation is workflow-relevant only when it is a deliberate manual
  // project calculation (no extractedEntityId) or belongs to professionally
  // accepted extracted evidence. Calculations attached to rejected/unaccepted
  // entities must not keep the workflow permanently blocked.
  const relevantNonRejectedCalculations = nonRejectedCalculations.filter(
    (calculation) =>
      calculation.extractedEntityId === null
      || acceptedEntityIds.has(calculation.extractedEntityId),
  );

  const relevantConfirmedCalculations = relevantNonRejectedCalculations.filter(
    (calculation) => calculation.status === "CONFIRMED",
  );

  const entitiesMissingDimensions = acceptedEntities.filter((entity) => {
    if (hasUsableDirectReviewedQuantity(entity)) return false;

    return !linkedNonRejectedCalculations.some(
      (calculation) => calculation.extractedEntityId === entity.id,
    );
  });

  const unconfirmedCalculations = relevantNonRejectedCalculations.filter(
    (calculation) => calculation.status !== "CONFIRMED",
  );

  const hasAnyEntityDimensionEvidence = linkedNonRejectedCalculations.some(
    (calculation) => Object.keys(calculation.inputValues ?? {}).some(
      (inputKey) => DIMENSION_INPUT_KEYS.has(inputKey),
    ),
  );

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
        : hasAnyEntityDimensionEvidence
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
    { id: "sources", label: t("boqEditor.stepSources"), status: sourcesStatus },
    { id: "extraction", label: t("boqEditor.stepExtraction"), status: extractionStatus },
    { id: "dimensions", label: t("boqEditor.stepDimensions"), status: dimensionsStatus },
    { id: "calculation", label: t("boqEditor.stepCalculation"), status: calculationStatus },
    { id: "boq_review", label: t("boqEditor.stepBoqReview"), status: boqReviewStatus },
    { id: "validation", label: t("boqEditor.stepValidation"), status: validationStatus },
    { id: "output", label: t("boqEditor.stepOutput"), status: outputStatus },
  ];

  let nextAction: NextStepAction;

  if (input.fileCount === 0 && input.boqItemCount === 0) {
    nextAction = {
      message: t("boqEditor.nextAddSources"),
      ctaLabel: t("boqEditor.nextAddSourcesCta"),
      ctaAction: "open_files",
    };
  } else if (unreviewedEntities.length > 0) {
    nextAction = {
      message: t("boqEditor.nextReviewExtractions", { count: unreviewedEntities.length }),
      ctaLabel: t("boqEditor.nextReviewExtractionsCta"),
      ctaAction: "review_extractions",
    };
  } else if (entitiesMissingDimensions.length > 0) {
    nextAction = {
      message: t("boqEditor.nextAddDimensions", { count: entitiesMissingDimensions.length }),
      ctaLabel: t("boqEditor.nextAddDimensionsCta"),
      ctaAction: "review_dimensions",
    };
  } else if (unconfirmedCalculations.length > 0) {
    nextAction = {
      message: t("boqEditor.nextReviewCalculations", { count: unconfirmedCalculations.length }),
      ctaLabel: t("boqEditor.nextReviewCalculationsCta"),
      ctaAction: "review_calculations",
    };
  } else if (input.boqItemCount === 0) {
    nextAction = {
      message:
        importableEntities.length > 0
          ? t("boqEditor.nextReviewedReady")
          : t("boqEditor.nextAddFirstItem"),
      ctaLabel:
        importableEntities.length > 0
          ? t("boqEditor.nextOpenReviewedCta")
          : t("boqEditor.nextOpenBoqCta"),
      ctaAction: "open_boq",
    };
  } else if (input.isLocked) {
    nextAction = {
      message:
        input.generatedDocumentCount !== null && input.generatedDocumentCount > 0
          ? t("boqEditor.nextOutputAvailable")
          : t("boqEditor.nextReadyForOutput"),
      ctaLabel: t("boqEditor.nextViewOutputCta"),
      ctaAction: "view_output",
    };
  } else if (input.validationWarningCount === null) {
    nextAction = {
      message: t("boqEditor.nextValidationUnavailable"),
      ctaLabel: t("boqEditor.nextOpenValidationCta"),
      ctaAction: "run_validation",
    };
  } else if (input.validationWarningCount > 0) {
    nextAction = {
      message: t("boqEditor.nextValidationWarnings", { count: input.validationWarningCount }),
      ctaLabel: t("boqEditor.nextReviewValidationCta"),
      ctaAction: "run_validation",
    };
  } else {
    nextAction = {
      message: t("boqEditor.nextValidationClean"),
      ctaLabel: t("boqEditor.nextOpenValidationCta"),
      ctaAction: "run_validation",
    };
  }

  return { steps, nextAction };
}

export function isBoqLockedForWorkflow(boq: BOQ | null): boolean {
  return Boolean(boq?.isLocked) || boq?.status === "locked" || boq?.status === "approved";
}

export type WorkflowGuidanceSummary = {
  currentStage: WorkflowStep | null;
  why: string;
  doThisNow: string;
  afterThat: WorkflowStep | null;
};

/**
 * Structures the same facts already in `steps`/`nextAction` into the
 * persistent "what should I do next" panel's labeled fields — no new
 * business logic, just presentation of state computed above. "afterThat" is
 * the next step in stepper order that isn't already COMPLETE/NOT_REQUIRED,
 * so it never promises work that's already done or not applicable.
 */
export function summarizeWorkflowGuidance(
  steps: WorkflowStep[],
  nextAction: NextStepAction,
): WorkflowGuidanceSummary {
  const currentStage =
    steps.find((step) => step.status === "NEEDS_ATTENTION")
    ?? steps.find((step) => step.status === "CURRENT")
    ?? [...steps].reverse().find((step) => step.status === "COMPLETE")
    ?? null;

  const currentIndex = currentStage ? steps.findIndex((step) => step.id === currentStage.id) : -1;
  const afterThat =
    currentIndex >= 0
      ? steps.slice(currentIndex + 1).find((step) => step.status !== "COMPLETE" && step.status !== "NOT_REQUIRED") ?? null
      : null;

  return {
    currentStage,
    why: nextAction.message,
    doThisNow: nextAction.ctaLabel,
    afterThat,
  };
}
