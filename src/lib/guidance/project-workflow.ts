import {
  GUIDE_STAGE_IDS,
  getGuideStageDefinition,
  type GuideStageId,
} from "@/lib/guidance/guide-registry";
import {
  getProjectBoqHref,
  getProjectExtractionsHref,
  getProjectFilesHref,
} from "@/lib/guidance/guide-navigation";
import type { ProjectWorkflowSnapshot } from "@/lib/guidance/project-workflow-snapshot";

export type ProjectWorkflowStageState = "COMPLETE" | "CURRENT" | "NEEDS_ATTENTION" | "NOT_STARTED";
export type ProjectWorkflowStageId = GuideStageId;

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

export type ProjectWorkflowExtractionSummary = {
  total: number | null;
  reviewed: number | null;
  reviewable: number | null;
  needsAttention: number | null;
  unknown: number | null;
  complete: boolean;
};

type ProjectWorkflowInputBase = {
  projectExists: boolean;
  projectId: string;
  /** Release-1 compatibility for callers that have not adopted the snapshot API. */
  fileCount?: number;
  /** Release-1 compatibility for callers that have not adopted the snapshot API. */
  entityStatuses?: readonly (string | null | undefined)[];
  /** Release-1 compatibility for callers that have not adopted the snapshot API. */
  hasBoq?: boolean;
};

export type ProjectWorkflowInput = ProjectWorkflowInputBase & (
  | { snapshot: ProjectWorkflowSnapshot }
  | {
      snapshot?: null;
      fileCount: number;
      entityStatuses: readonly (string | null | undefined)[];
      hasBoq: boolean;
    }
);

export type ProjectWorkflowResult = {
  projectExists: boolean;
  projectId: string;
  fileCount: number;
  stages: ProjectWorkflowStage[];
  nextStep: ProjectWorkflowNextStep | null;
  extractionSummary: ProjectWorkflowExtractionSummary;
  factualSummary: string[];
  completedStageCount: number;
  progressPercentage: number;
  snapshot: ProjectWorkflowSnapshot;
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

const REVIEWED_EXTRACTION_STATUSES = new Set(["CONFIRMED", "CORRECTED", "REJECTED", "IMPORTED"]);
const REVIEWABLE_EXTRACTION_STATUSES = new Set(["EXTRACTED", "NEEDS_REVIEW"]);
const GENERIC_PROCESSING_WARNING = "Processing could not be completed. Review this source or try again.";

function normalizeStatus(status: string | null | undefined): string {
  return typeof status === "string" ? status.trim().toUpperCase() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function countStatuses(statuses: readonly string[], accepted: ReadonlySet<string>): number {
  return statuses.filter((status) => accepted.has(status)).length;
}

function legacySnapshot(input: ProjectWorkflowInput): ProjectWorkflowSnapshot {
  const fileCount = Number.isFinite(input.fileCount) && (input.fileCount ?? 0) > 0
    ? Math.floor(input.fileCount ?? 0)
    : 0;
  const statuses = (input.entityStatuses ?? []).map(normalizeStatus);
  const reviewable = countStatuses(statuses, REVIEWABLE_EXTRACTION_STATUSES);
  const reviewed = countStatuses(statuses, REVIEWED_EXTRACTION_STATUSES);
  const unknown = statuses.length - reviewable - reviewed;

  return {
    projectId: input.projectId,
    projectSlug: input.projectId,
    files: {
      total: fileCount,
      manualOriginCount: null,
      googleDriveOriginCount: null,
      statusCounts: null,
      processingErrorCount: null,
      needsReviewCount: null,
      classifiedCount: null,
      revisionedCount: null,
    },
    processingJobs: {
      total: null,
      queued: null,
      running: null,
      completed: null,
      failed: null,
      needsReview: null,
      cancelled: null,
      storedResultCount: null,
    },
    capturedResults: {
      pageCount: null,
      tableCount: null,
      storedJobResultCount: null,
      artifactCount: null,
    },
    extractedEntities: {
      total: statuses.length,
      needsReview: reviewable + unknown,
      confirmed: statuses.filter((status) => status === "CONFIRMED").length,
      corrected: statuses.filter((status) => status === "CORRECTED").length,
      rejected: statuses.filter((status) => status === "REJECTED").length,
      imported: statuses.filter((status) => status === "IMPORTED").length,
      unknown,
    },
    boq: { exists: input.hasBoq ?? null },
    sources: [],
  };
}

function extractionSummaryFromSnapshot(snapshot: ProjectWorkflowSnapshot): ProjectWorkflowExtractionSummary {
  const total = snapshot.extractedEntities.total;
  const needsAttention = snapshot.extractedEntities.needsReview;
  const unknown = snapshot.extractedEntities.unknown;
  const reviewed = total === null || needsAttention === null
    ? null
    : Math.max(0, total - needsAttention);
  const reviewable = needsAttention === null || unknown === null
    ? null
    : Math.max(0, needsAttention - unknown);

  return {
    total,
    reviewed,
    reviewable,
    needsAttention,
    unknown,
    complete: total !== null && total > 0 && needsAttention === 0,
  };
}

function buildFactualSummary(snapshot: ProjectWorkflowSnapshot, projectExists: boolean): string[] {
  if (!projectExists) return [];

  const facts: string[] = [];
  if (snapshot.files.total === 0) {
    facts.push("Project context established");
    return facts;
  }

  facts.push(`${snapshot.files.total} ${pluralize(snapshot.files.total, "source")} added`);

  const completedJobs = snapshot.processingJobs.completed;
  if (completedJobs !== null && completedJobs > 0) {
    facts.push(`${completedJobs} processing ${pluralize(completedJobs, "job")} completed`);
  }

  const pageCount = snapshot.capturedResults.pageCount;
  if (pageCount !== null && pageCount > 0) {
    facts.push(`${pageCount} ${pluralize(pageCount, "page")} available`);
  }

  const tableCount = snapshot.capturedResults.tableCount;
  if (tableCount !== null && tableCount > 0) {
    facts.push(`${tableCount} ${pluralize(tableCount, "table")} captured`);
  }

  const candidateCount = snapshot.extractedEntities.total;
  const hasProvenProcessing = (completedJobs ?? 0) > 0
    || (pageCount ?? 0) > 0
    || (tableCount ?? 0) > 0
    || (snapshot.capturedResults.storedJobResultCount ?? 0) > 0;
  if (candidateCount !== null && candidateCount === 0 && hasProvenProcessing) {
    facts.push("0 candidates ready for review");
  } else if (candidateCount !== null && candidateCount > 0) {
    facts.push(`${candidateCount} ${pluralize(candidateCount, "candidate")} captured`);
    const reviewed = Math.max(0, candidateCount - (snapshot.extractedEntities.needsReview ?? 0));
    if (reviewed > 0) facts.push(`${reviewed} reviewed`);
    const needsReview = snapshot.extractedEntities.needsReview ?? 0;
    if (needsReview > 0) facts.push(`${needsReview} need professional review`);
  }

  if ((snapshot.files.processingErrorCount ?? 0) > 0) {
    const processingErrorCount = snapshot.files.processingErrorCount ?? 0;
    facts.push(`${processingErrorCount} ${pluralize(processingErrorCount, "source")} need processing attention`);
  }

  return facts;
}

export function deriveProjectWorkflow(input: ProjectWorkflowInput): ProjectWorkflowResult {
  const snapshot = input.snapshot ?? legacySnapshot(input);
  const extractionSummary = extractionSummaryFromSnapshot(snapshot);
  const states = Object.fromEntries(
    GUIDE_STAGE_IDS.map((stageId) => [stageId, "NOT_STARTED"]),
  ) as Record<ProjectWorkflowStageId, ProjectWorkflowStageState>;
  let nextStep: ProjectWorkflowNextStep | null = null;

  if (!input.projectExists) {
    states.PROJECT_SETUP = "CURRENT";
  } else {
    states.PROJECT_SETUP = "COMPLETE";

    if (snapshot.files.total === 0) {
      states.SOURCES = "CURRENT";
      nextStep = {
        message: "Add your project drawings, schedules or project information.",
        ctaLabel: "Add Project Sources",
        href: getProjectFilesHref(input.projectId),
      };
    } else {
      states.SOURCES = "COMPLETE";
      const failedSource = snapshot.sources.find((source) => source.hasProcessingError);
      const processingSource = snapshot.sources.find((source) => source.isProcessing);
      const sourceNeedingReview = snapshot.sources.find((source) => source.needsReview);
      const capturedSource = snapshot.sources.find((source) => source.hasCapturedResults);
      const runningJobs = (snapshot.processingJobs.queued ?? 0) + (snapshot.processingJobs.running ?? 0);
      const candidateTotal = snapshot.extractedEntities.total;
      const candidatesNeedingReview = snapshot.extractedEntities.needsReview;
      const hasCapturedData = (snapshot.capturedResults.pageCount ?? 0) > 0
        || (snapshot.capturedResults.tableCount ?? 0) > 0
        || (snapshot.capturedResults.storedJobResultCount ?? 0) > 0;
      const hasCompletedProcessing = (snapshot.processingJobs.completed ?? 0) > 0;

      if (failedSource || (snapshot.files.processingErrorCount ?? 0) > 0) {
        states.EXTRACTION = "NEEDS_ATTENTION";
        nextStep = {
          message: GENERIC_PROCESSING_WARNING,
          ctaLabel: "Review Source",
          href: getProjectFilesHref(input.projectId, failedSource?.id),
        };
      } else if (sourceNeedingReview) {
        states.EXTRACTION = "NEEDS_ATTENTION";
        nextStep = {
          message: "Source processing requires professional attention before Quantara can report further captured results.",
          ctaLabel: "Review Source",
          href: getProjectFilesHref(input.projectId, sourceNeedingReview.id),
        };
      } else if (runningJobs > 0 || processingSource) {
        states.EXTRACTION = "CURRENT";
        const processingCount = snapshot.sources.filter((source) => source.isProcessing).length;
        nextStep = {
          message: `Quantara is processing ${processingCount} project ${pluralize(processingCount, "source")}. Review the current source-processing state while work continues.`,
          ctaLabel: "View Source Processing",
          href: getProjectFilesHref(input.projectId, processingSource?.id),
        };
      } else if (candidateTotal !== null && candidateTotal > 0 && (candidatesNeedingReview ?? 0) > 0) {
        states.EXTRACTION = "NEEDS_ATTENTION";
        nextStep = {
          message: "Quantara captured project information that requires professional confirmation, correction, or rejection.",
          ctaLabel: "Review Extracted Information",
          href: getProjectExtractionsHref(input.projectId),
        };
      } else if (candidateTotal !== null && candidateTotal > 0 && candidatesNeedingReview === 0) {
        states.EXTRACTION = "COMPLETE";
        states.DIMENSIONS = "CURRENT";
        nextStep = (snapshot.boq.exists ?? input.hasBoq)
          ? {
              message: "Extraction review is complete. Continue to the BOQ workspace to review the dimensions used for professional quantities.",
              ctaLabel: "Review Dimensions",
              href: getProjectBoqHref(input.projectId),
            }
          : {
              message: "Extraction review is complete. Open the BOQ workspace to begin professional dimension review.",
              ctaLabel: "Create BOQ",
              href: getProjectBoqHref(input.projectId),
            };
      } else if (candidateTotal === 0 && (hasCompletedProcessing || hasCapturedData)) {
        states.EXTRACTION = "CURRENT";
        nextStep = {
          message: "Quantara has processed your project information and captured the available results, but no candidate BOQ items are ready for professional review yet.",
          ctaLabel: "Review Processing Results",
          href: getProjectFilesHref(input.projectId, capturedSource?.id),
        };
      } else {
        states.EXTRACTION = "CURRENT";
        nextStep = {
          message: "Project sources are available, but completed processing results are not yet proven. Review the supported source-processing actions.",
          ctaLabel: "View Source Processing",
          href: getProjectFilesHref(input.projectId),
        };
      }
    }
  }

  const stages = GUIDE_STAGE_IDS.map((stageId) => ({
    id: stageId,
    label: getGuideStageDefinition(stageId).title,
    state: states[stageId],
  }));
  const completedStageCount = stages.filter((stage) => stage.state === "COMPLETE").length;

  return {
    projectExists: input.projectExists,
    projectId: input.projectId,
    fileCount: snapshot.files.total,
    stages,
    nextStep,
    extractionSummary,
    factualSummary: buildFactualSummary(snapshot, input.projectExists),
    completedStageCount,
    progressPercentage: Math.round((completedStageCount / GUIDE_STAGE_IDS.length) * 100),
    snapshot,
  };
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

  if (file === "ARCHIVED") {
    return { label: "Archived", tone: "default", needsAttention: false, isProcessing: false, warning: null };
  }

  if (job === "FAILED") {
    return {
      label: "Failed",
      tone: "error",
      needsAttention: true,
      isProcessing: false,
      warning: GENERIC_PROCESSING_WARNING,
    };
  }

  if (job === "CANCELLED") {
    return {
      label: "Cancelled",
      tone: "warning",
      needsAttention: true,
      isProcessing: false,
      warning: "Processing was cancelled. Start processing again when ready.",
    };
  }

  if (job === "NEEDS_REVIEW" || job === "NEEDS_INPUT") {
    return { label: "Needs review", tone: "warning", needsAttention: true, isProcessing: false, warning: null };
  }

  if (
    job === "QUEUED"
    || job === "RUNNING"
  ) {
    return { label: "Processing", tone: "info", needsAttention: false, isProcessing: true, warning: null };
  }

  if (
    job === "COMPLETED"
  ) {
    return { label: "Ready", tone: "success", needsAttention: false, isProcessing: false, warning: null };
  }

  if (job) {
    return {
      label: "Needs review",
      tone: "warning",
      needsAttention: true,
      isProcessing: false,
      warning: "The processing status is not recognized. Review this source before continuing.",
    };
  }

  if (hasStoredError || file === "FAILED") {
    return {
      label: "Failed",
      tone: "error",
      needsAttention: true,
      isProcessing: false,
      warning: GENERIC_PROCESSING_WARNING,
    };
  }

  if (file === "CANCELLED") {
    return {
      label: "Cancelled",
      tone: "warning",
      needsAttention: true,
      isProcessing: false,
      warning: "Processing was cancelled. Start processing again when ready.",
    };
  }

  if (file === "NEEDS_REVIEW") {
    return { label: "Needs review", tone: "warning", needsAttention: true, isProcessing: false, warning: null };
  }

  if (file === "CLASSIFYING" || file === "PREPROCESSING" || file === "PROCESSING") {
    return { label: "Processing", tone: "info", needsAttention: false, isProcessing: true, warning: null };
  }

  if (file === "CLASSIFIED" || file === "READY_FOR_PROCESSING" || file === "COMPLETED") {
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

  if (label.length > 200) fieldErrors.label = "Label must be 200 characters or fewer.";
  if (unit.length > 20) fieldErrors.unit = "Unit must be 20 characters or fewer.";
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
