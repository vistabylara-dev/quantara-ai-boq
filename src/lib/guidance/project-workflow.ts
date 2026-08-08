export type ProjectWorkflowStageState = "COMPLETE" | "CURRENT" | "NEEDS_ATTENTION" | "NOT_STARTED";

export type ProjectWorkflowStageId =
  | "PROJECT_SETUP"
  | "SOURCES"
  | "EXTRACTION"
  | "DIMENSIONS"
  | "CALCULATIONS"
  | "BOQ"
  | "REVIEW"
  | "VALIDATION"
  | "OUTPUT";

export type ProjectWorkflowStage = {
  id: ProjectWorkflowStageId;
  label: string;
  state: ProjectWorkflowStageState;
};

export type ProjectWorkflowNextStep = {
  message: string;
  ctaLabel: string;
  href: string;
};

export type ExtractionReviewSummary = {
  total: number;
  reviewed: number;
  reviewable: number;
  needsAttention: number;
  unknown: number;
  complete: boolean;
};

export type ProjectWorkflowInput = {
  projectExists: boolean;
  projectId: string;
  fileCount: number;
  entityStatuses: readonly (string | null | undefined)[];
  hasBoq: boolean;
};

export type ProjectWorkflowResult = {
  projectExists: boolean;
  fileCount: number;
  stages: ProjectWorkflowStage[];
  nextStep: ProjectWorkflowNextStep | null;
  extractionSummary: ExtractionReviewSummary;
  completedStageCount: number;
  progressPercentage: number;
};

export type ProjectSourceOrigin = "Google Drive" | "Uploaded manually";

export type ProjectSourceProcessingTone = "default" | "info" | "warning" | "success" | "error";

export type ProjectSourceProcessingState = {
  label: string;
  tone: ProjectSourceProcessingTone;
  needsAttention: boolean;
  isProcessing: boolean;
  warning: string | null;
};

export type CorrectionDraft = {
  label?: string | null;
  quantity?: string | number | null;
  unit?: string | null;
  reason?: string | null;
};

export type ValidCorrectionDraft = {
  label?: string;
  quantity?: number;
  unit?: string;
  reason: string;
};

export type CorrectionDraftFieldErrors = Partial<Record<"label" | "quantity" | "unit" | "reason", string>>;

export type CorrectionDraftValidation =
  | { ok: true; value: ValidCorrectionDraft }
  | { ok: false; fieldErrors: CorrectionDraftFieldErrors };

const WORKFLOW_STAGES: readonly { id: ProjectWorkflowStageId; label: string }[] = [
  { id: "PROJECT_SETUP", label: "Project Setup" },
  { id: "SOURCES", label: "Sources" },
  { id: "EXTRACTION", label: "Extraction" },
  { id: "DIMENSIONS", label: "Dimensions" },
  { id: "CALCULATIONS", label: "Calculations" },
  { id: "BOQ", label: "BOQ" },
  { id: "REVIEW", label: "Review" },
  { id: "VALIDATION", label: "Validation" },
  { id: "OUTPUT", label: "Output" },
];

const REVIEWED_EXTRACTION_STATUSES = new Set(["CONFIRMED", "CORRECTED", "REJECTED", "IMPORTED"]);
const REVIEWABLE_EXTRACTION_STATUSES = new Set(["EXTRACTED", "NEEDS_REVIEW"]);

const GENERIC_PROCESSING_WARNING = "Processing could not be completed. Review this source or try again.";

function normalizeStatus(status: string | null | undefined): string {
  return typeof status === "string" ? status.trim().toUpperCase() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isReviewableExtractionStatus(status: unknown): boolean {
  return typeof status === "string" && REVIEWABLE_EXTRACTION_STATUSES.has(status);
}

export function summarizeExtractionReview(
  statuses: readonly (string | null | undefined)[],
): ExtractionReviewSummary {
  let reviewed = 0;
  let reviewable = 0;
  let unknown = 0;

  for (const status of statuses) {
    if (typeof status === "string" && REVIEWED_EXTRACTION_STATUSES.has(status)) {
      reviewed += 1;
    } else if (isReviewableExtractionStatus(status)) {
      reviewable += 1;
    } else {
      // Unknown states must never become implicit completion. Keeping them in
      // needsAttention is the conservative, truthful Release-1 behavior.
      unknown += 1;
    }
  }

  const total = statuses.length;
  const needsAttention = reviewable + unknown;
  return {
    total,
    reviewed,
    reviewable,
    needsAttention,
    unknown,
    complete: total > 0 && needsAttention === 0,
  };
}

export function deriveProjectWorkflow(input: ProjectWorkflowInput): ProjectWorkflowResult {
  const extractionSummary = summarizeExtractionReview(input.entityStatuses);
  const fileCount = Number.isFinite(input.fileCount) && input.fileCount > 0
    ? Math.floor(input.fileCount)
    : 0;
  const states: Record<ProjectWorkflowStageId, ProjectWorkflowStageState> = {
    PROJECT_SETUP: "NOT_STARTED",
    SOURCES: "NOT_STARTED",
    EXTRACTION: "NOT_STARTED",
    DIMENSIONS: "NOT_STARTED",
    CALCULATIONS: "NOT_STARTED",
    BOQ: "NOT_STARTED",
    REVIEW: "NOT_STARTED",
    VALIDATION: "NOT_STARTED",
    OUTPUT: "NOT_STARTED",
  };

  let nextStep: ProjectWorkflowNextStep | null = null;
  const projectPath = `/projects/${encodeURIComponent(input.projectId)}`;

  if (!input.projectExists) {
    states.PROJECT_SETUP = "CURRENT";
  } else {
    states.PROJECT_SETUP = "COMPLETE";

    if (fileCount === 0) {
      states.SOURCES = "CURRENT";
      nextStep = {
        message: "Add your project drawings, schedules or project information.",
        ctaLabel: "Add Project Sources",
        href: `${projectPath}/files`,
      };
    } else {
      states.SOURCES = "COMPLETE";

      if (extractionSummary.total === 0) {
        states.EXTRACTION = "CURRENT";
        nextStep = {
          message: "Your project sources are available. Process the supported files to continue.",
          ctaLabel: "Review Project Sources",
          href: `${projectPath}/files`,
        };
      } else if (extractionSummary.needsAttention > 0) {
        states.EXTRACTION = "NEEDS_ATTENTION";
        nextStep = {
          message: "Quantara found project information that requires professional review.",
          ctaLabel: "Review Extracted Data",
          href: `${projectPath}/extractions`,
        };
      } else {
        states.EXTRACTION = "COMPLETE";
        // Dimension review is the next provable stage. The guided BOQ
        // workspace owns that review, but BOQ work has not started yet.
        states.DIMENSIONS = "CURRENT";
        nextStep = input.hasBoq
          ? {
              message: "Source review is complete. Continue to dimension review in the BOQ workspace.",
              ctaLabel: "Review Dimensions",
              href: `${projectPath}/boq`,
            }
          : {
              message: "Source review is complete. Create the BOQ workspace to begin dimension review.",
              ctaLabel: "Create BOQ",
              href: `${projectPath}/boq`,
            };
      }
    }
  }

  const stages = WORKFLOW_STAGES.map((stage) => ({ ...stage, state: states[stage.id] }));
  const completedStageCount = stages.filter((stage) => stage.state === "COMPLETE").length;

  return {
    projectExists: input.projectExists,
    fileCount,
    stages,
    nextStep,
    extractionSummary,
    completedStageCount,
    progressPercentage: Math.round((completedStageCount / WORKFLOW_STAGES.length) * 100),
  };
}

export function getProjectSourceOrigin(metadata: unknown): ProjectSourceOrigin {
  if (!isRecord(metadata) || !isRecord(metadata.importSource)) {
    return "Uploaded manually";
  }
  return metadata.importSource.provider === "google-drive" ? "Google Drive" : "Uploaded manually";
}

export function getProjectSourceProcessingState(
  fileStatus: string | null | undefined,
  latestJobStatus?: string | null,
  hasStoredError = false,
): ProjectSourceProcessingState {
  const file = normalizeStatus(fileStatus);
  const job = normalizeStatus(latestJobStatus);

  if (hasStoredError || file === "FAILED" || job === "FAILED") {
    return {
      label: "Failed",
      tone: "error",
      needsAttention: true,
      isProcessing: false,
      warning: GENERIC_PROCESSING_WARNING,
    };
  }

  if (file === "ARCHIVED") {
    return { label: "Archived", tone: "default", needsAttention: false, isProcessing: false, warning: null };
  }

  if (file === "CANCELLED" || job === "CANCELLED") {
    return {
      label: "Cancelled",
      tone: "warning",
      needsAttention: true,
      isProcessing: false,
      warning: "Processing was cancelled. Start processing again when ready.",
    };
  }

  if (file === "NEEDS_REVIEW" || job === "NEEDS_REVIEW" || job === "NEEDS_INPUT") {
    return { label: "Needs review", tone: "warning", needsAttention: true, isProcessing: false, warning: null };
  }

  if (
    file === "CLASSIFYING"
    || file === "PREPROCESSING"
    || file === "PROCESSING"
    || job === "QUEUED"
    || job === "RUNNING"
  ) {
    return { label: "Processing", tone: "info", needsAttention: false, isProcessing: true, warning: null };
  }

  if (
    file === "CLASSIFIED"
    || file === "READY_FOR_PROCESSING"
    || file === "COMPLETED"
    || job === "COMPLETED"
  ) {
    return { label: "Ready", tone: "success", needsAttention: false, isProcessing: false, warning: null };
  }

  if (file === "UPLOADED") {
    return { label: "Uploaded", tone: "default", needsAttention: false, isProcessing: false, warning: null };
  }

  return {
    label: "Needs review",
    tone: "warning",
    needsAttention: true,
    isProcessing: false,
    warning: "The processing status is not recognized. Review this source before continuing.",
  };
}

export function validateCorrectionDraft(input: CorrectionDraft): CorrectionDraftValidation {
  const fieldErrors: CorrectionDraftFieldErrors = {};
  const label = typeof input.label === "string" ? input.label.trim() : "";
  const unit = typeof input.unit === "string" ? input.unit.trim() : "";
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";

  if (label.length > 200) {
    fieldErrors.label = "Label must be 200 characters or fewer.";
  }
  if (unit.length > 20) {
    fieldErrors.unit = "Unit must be 20 characters or fewer.";
  }
  if (!reason) {
    fieldErrors.reason = "A correction reason is required.";
  } else if (reason.length > 500) {
    fieldErrors.reason = "Reason must be 500 characters or fewer.";
  }

  let quantity: number | undefined;
  if (typeof input.quantity === "number") {
    quantity = input.quantity;
  } else if (typeof input.quantity === "string" && input.quantity.trim() !== "") {
    quantity = Number(input.quantity.trim());
  }
  if (quantity !== undefined && !Number.isFinite(quantity)) {
    fieldErrors.quantity = "Quantity must be a valid number.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: {
      ...(label ? { label } : {}),
      ...(quantity !== undefined ? { quantity } : {}),
      ...(unit ? { unit } : {}),
      reason,
    },
  };
}
