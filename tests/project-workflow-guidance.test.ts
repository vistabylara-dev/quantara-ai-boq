import { describe, expect, it } from "vitest";
import {
  deriveProjectWorkflow,
  getProjectSourceOrigin,
  getProjectSourceProcessingState,
  isReviewableExtractionStatus,
  summarizeExtractionReview,
  validateCorrectionDraft,
  type ProjectWorkflowStageId,
} from "../src/lib/guidance/project-workflow";

const PROJECT_ID = "dubai-tower";

function workflow(overrides: Partial<Parameters<typeof deriveProjectWorkflow>[0]> = {}) {
  return deriveProjectWorkflow({
    projectExists: true,
    projectId: PROJECT_ID,
    fileCount: 0,
    entityStatuses: [],
    hasBoq: false,
    ...overrides,
  });
}

function stateOf(result: ReturnType<typeof workflow>, stageId: ProjectWorkflowStageId) {
  return result.stages.find((stage) => stage.id === stageId)?.state;
}

describe("deterministic project workflow guidance", () => {
  it("A. sends a project with no files to Add Project Sources", () => {
    const result = workflow();

    expect(result.nextStep).toEqual({
      message: "Add your project drawings, schedules or project information.",
      ctaLabel: "Add Project Sources",
      href: "/projects/dubai-tower/files",
    });
    expect(stateOf(result, "PROJECT_SETUP")).toBe("COMPLETE");
    expect(stateOf(result, "SOURCES")).toBe("CURRENT");
    expect(stateOf(result, "EXTRACTION")).toBe("NOT_STARTED");
  });

  it("C. sends files with no extraction candidates to Review Project Sources", () => {
    const result = workflow({ fileCount: 2 });

    expect(result.nextStep).toEqual({
      message: "Your project sources are available. Process the supported files to continue.",
      ctaLabel: "Review Project Sources",
      href: "/projects/dubai-tower/files",
    });
    expect(stateOf(result, "SOURCES")).toBe("COMPLETE");
    expect(stateOf(result, "EXTRACTION")).toBe("CURRENT");
    expect(result.extractionSummary.complete).toBe(false);
  });

  it("B. sends any unreviewed extracted information to Review Extracted Data", () => {
    const result = workflow({
      fileCount: 1,
      entityStatuses: ["CONFIRMED", "EXTRACTED", "NEEDS_REVIEW"],
      hasBoq: true,
    });

    expect(result.nextStep).toEqual({
      message: "Quantara found project information that requires professional review.",
      ctaLabel: "Review Extracted Data",
      href: "/projects/dubai-tower/extractions",
    });
    expect(stateOf(result, "EXTRACTION")).toBe("NEEDS_ATTENTION");
    expect(stateOf(result, "BOQ")).toBe("NOT_STARTED");
  });

  it("D. sends reviewed extraction with an existing BOQ to dimension review", () => {
    const result = workflow({
      fileCount: 1,
      entityStatuses: ["CONFIRMED", "CORRECTED", "REJECTED", "IMPORTED"],
      hasBoq: true,
    });

    expect(result.nextStep).toEqual({
      message: "Source review is complete. Continue to dimension review in the BOQ workspace.",
      ctaLabel: "Review Dimensions",
      href: "/projects/dubai-tower/boq",
    });
    expect(stateOf(result, "EXTRACTION")).toBe("COMPLETE");
    expect(stateOf(result, "DIMENSIONS")).toBe("CURRENT");
    expect(stateOf(result, "CALCULATIONS")).toBe("NOT_STARTED");
    expect(stateOf(result, "BOQ")).toBe("NOT_STARTED");
  });

  it("E. sends reviewed extraction without a BOQ to workspace creation before dimension review", () => {
    const result = workflow({ fileCount: 1, entityStatuses: ["CONFIRMED"], hasBoq: false });

    expect(result.nextStep).toEqual({
      message: "Source review is complete. Create the BOQ workspace to begin dimension review.",
      ctaLabel: "Create BOQ",
      href: "/projects/dubai-tower/boq",
    });
    expect(stateOf(result, "EXTRACTION")).toBe("COMPLETE");
    expect(stateOf(result, "DIMENSIONS")).toBe("CURRENT");
    expect(stateOf(result, "CALCULATIONS")).toBe("NOT_STARTED");
    expect(stateOf(result, "BOQ")).toBe("NOT_STARTED");
  });

  it("never reports zero candidates as completed extraction", () => {
    const result = workflow({ fileCount: 4, entityStatuses: [], hasBoq: true });

    expect(result.extractionSummary).toMatchObject({ total: 0, reviewed: 0, needsAttention: 0, complete: false });
    expect(stateOf(result, "EXTRACTION")).toBe("CURRENT");
    expect(result.nextStep?.ctaLabel).toBe("Review Project Sources");
  });

  it("treats unknown extraction states as attention instead of implicit completion", () => {
    const result = workflow({ fileCount: 1, entityStatuses: ["CONFIRMED", "FUTURE_STATUS", null] });

    expect(result.extractionSummary).toEqual({
      total: 3,
      reviewed: 1,
      reviewable: 0,
      needsAttention: 2,
      unknown: 2,
      complete: false,
    });
    expect(stateOf(result, "EXTRACTION")).toBe("NEEDS_ATTENTION");
  });

  it("never marks later scoped stages complete without evidence", () => {
    const scenarios = [
      workflow(),
      workflow({ fileCount: 1 }),
      workflow({ fileCount: 1, entityStatuses: ["EXTRACTED"] }),
      workflow({ fileCount: 1, entityStatuses: ["CONFIRMED"], hasBoq: true }),
    ];
    const neverComplete: ProjectWorkflowStageId[] = ["DIMENSIONS", "CALCULATIONS", "BOQ", "REVIEW", "VALIDATION", "OUTPUT"];

    for (const result of scenarios) {
      for (const stageId of neverComplete) {
        expect(stateOf(result, stageId)).not.toBe("COMPLETE");
      }
    }
  });

  it("reports no completion when the project itself cannot be proved", () => {
    const result = workflow({ projectExists: false, fileCount: 10, entityStatuses: ["CONFIRMED"], hasBoq: true });

    expect(result.nextStep).toBeNull();
    expect(result.completedStageCount).toBe(0);
    expect(result.progressPercentage).toBe(0);
    expect(result.stages.every((stage) => stage.state !== "COMPLETE")).toBe(true);
  });
});

describe("extraction review summaries", () => {
  it("recognizes only the two reviewable statuses", () => {
    expect(isReviewableExtractionStatus("EXTRACTED")).toBe(true);
    expect(isReviewableExtractionStatus("NEEDS_REVIEW")).toBe(true);
    expect(isReviewableExtractionStatus("CONFIRMED")).toBe(false);
    expect(isReviewableExtractionStatus("UNKNOWN")).toBe(false);
  });

  it("counts every supported handled status as reviewed", () => {
    expect(summarizeExtractionReview(["CONFIRMED", "CORRECTED", "REJECTED", "IMPORTED"])).toEqual({
      total: 4,
      reviewed: 4,
      reviewable: 0,
      needsAttention: 0,
      unknown: 0,
      complete: true,
    });
  });
});

describe("project source presentation", () => {
  it("derives Google Drive origin only from the exact import-source provider", () => {
    expect(getProjectSourceOrigin({ importSource: { provider: "google-drive", externalFileId: "drive-1" } })).toBe("Google Drive");
    expect(getProjectSourceOrigin({ importSource: { provider: "dropbox" } })).toBe("Uploaded manually");
    expect(getProjectSourceOrigin({ importSource: "google-drive" })).toBe("Uploaded manually");
    expect(getProjectSourceOrigin(null)).toBe("Uploaded manually");
  });

  it("maps real file and latest-job states without inventing percentages", () => {
    expect(getProjectSourceProcessingState("UPLOADED")).toMatchObject({ label: "Uploaded", isProcessing: false });
    expect(getProjectSourceProcessingState("UPLOADED", "RUNNING")).toMatchObject({ label: "Processing", tone: "info", isProcessing: true });
    expect(getProjectSourceProcessingState("COMPLETED")).toMatchObject({ label: "Ready", tone: "success" });
    expect(getProjectSourceProcessingState("PROCESSING", "NEEDS_REVIEW")).toMatchObject({ label: "Needs review", needsAttention: true });
    expect(getProjectSourceProcessingState("UPLOADED", "FAILED")).toMatchObject({ label: "Failed", tone: "error", needsAttention: true });
  });

  it("uses a generic warning and fails safely for stored or unknown errors", () => {
    const failed = getProjectSourceProcessingState("READY_FOR_PROCESSING", null, true);
    const unknown = getProjectSourceProcessingState("A_FUTURE_STATUS");

    expect(failed.warning).toBe("Processing could not be completed. Review this source or try again.");
    expect(failed.warning).not.toMatch(/stack|token|provider/i);
    expect(unknown).toMatchObject({ label: "Needs review", needsAttention: true });
  });
});

describe("correction draft validation", () => {
  it("requires a non-blank correction reason", () => {
    expect(validateCorrectionDraft({ label: "Door", quantity: "4", unit: "nr", reason: "  " })).toEqual({
      ok: false,
      fieldErrors: { reason: "A correction reason is required." },
    });
  });

  it("returns only the currently supported trimmed correction fields", () => {
    expect(validateCorrectionDraft({ label: "  Timber door  ", quantity: "4.5", unit: " nr ", reason: " Drawing note confirms count. " })).toEqual({
      ok: true,
      value: {
        label: "Timber door",
        quantity: 4.5,
        unit: "nr",
        reason: "Drawing note confirms count.",
      },
    });
  });

  it("rejects an invalid quantity instead of silently coercing it", () => {
    expect(validateCorrectionDraft({ quantity: "four", reason: "Count reviewed." })).toEqual({
      ok: false,
      fieldErrors: { quantity: "Quantity must be a valid number." },
    });
  });
});
