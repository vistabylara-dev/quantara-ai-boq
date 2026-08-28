import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FEATURE_HINT_REGISTRY } from "../src/components/guidance/feature-hint";
import {
  GUIDE_NAVIGATION_MODE,
  getCatalogueHref,
  getGuideStageHref,
  getIntegrationsHref,
  getProjectDocumentsHref,
  getProjectFilesHref,
  isSupportedGuideHref,
} from "../src/lib/guidance/guide-navigation";
import {
  GUIDE_STAGE_IDS,
  GUIDE_STAGE_REGISTRY,
  getGuideStageDefinition,
} from "../src/lib/guidance/guide-registry";
import {
  deriveProjectWorkflow,
  type ProjectWorkflowResult,
  type ProjectWorkflowStageId,
} from "../src/lib/guidance/project-workflow";
import {
  buildProjectWorkflowSnapshot,
  type ProjectWorkflowSnapshotFileRecord,
  type ProjectWorkflowSnapshotJobRecord,
  type ProjectWorkflowSnapshotRecords,
} from "../src/lib/guidance/project-workflow-snapshot";

const PROJECT_ID = "dubai-tower";

function file(
  id: string,
  overrides: Partial<ProjectWorkflowSnapshotFileRecord> = {},
): ProjectWorkflowSnapshotFileRecord {
  return {
    id,
    originalName: `${id}.pdf`,
    metadata: null,
    status: "COMPLETED",
    pageCount: null,
    classification: "ARCHITECTURAL_PLAN",
    revisionNumber: null,
    processingErrorCode: null,
    processingErrorMessage: null,
    drawingPageCount: 0,
    extractedTableCount: 0,
    ...overrides,
  };
}

function job(
  id: string,
  projectFileId: string,
  status: string,
  createdAt: string,
  overrides: Partial<ProjectWorkflowSnapshotJobRecord> = {},
): ProjectWorkflowSnapshotJobRecord {
  return { id, projectFileId, engineType: "TABLE_EXTRACTION", status, createdAt, ...overrides };
}

function records(overrides: Partial<ProjectWorkflowSnapshotRecords> = {}): ProjectWorkflowSnapshotRecords {
  return {
    projectId: "22222222-2222-4222-8222-222222222222",
    projectSlug: PROJECT_ID,
    files: [],
    jobs: [],
    entityStatuses: [],
    hasBoq: false,
    ...overrides,
  };
}

function workflow(snapshotRecords: Partial<ProjectWorkflowSnapshotRecords>): ProjectWorkflowResult {
  const snapshot = buildProjectWorkflowSnapshot(records(snapshotRecords));
  return deriveProjectWorkflow({
    projectExists: true,
    projectId: PROJECT_ID,
    snapshot,
    hasBoq: snapshot.boq.exists ?? false,
  });
}

function stateOf(result: ProjectWorkflowResult, stageId: ProjectWorkflowStageId) {
  return result.stages.find((stage) => stage.id === stageId)?.state;
}

function processedVistaWorkflow() {
  return workflow({
    files: [
      file("source-1", { drawingPageCount: 10, extractedTableCount: 3 }),
      file("source-2", { drawingPageCount: 8, extractedTableCount: 1 }),
    ],
    jobs: [
      job("job-1", "source-1", "COMPLETED", "2026-08-09T08:00:00.000Z"),
      job("job-2", "source-2", "COMPLETED", "2026-08-09T08:01:00.000Z"),
    ],
    entityStatuses: [],
  });
}

describe("Quantara Guide v2 registry and advisory navigation", () => {
  it("reports a confirmed project calculation without hiding extraction attention", () => {
    const result = workflow({
      files: [file("source-1", { drawingPageCount: 1 })],
      jobs: [job("job-1", "source-1", "COMPLETED", "2026-08-28T15:00:00.000Z")],
      entityStatuses: ["CONFIRMED", "NEEDS_REVIEW"],
      calculationStatuses: ["CONFIRMED"],
      hasBoq: true,
    });

    expect(stateOf(result, "EXTRACTION")).toBe("NEEDS_ATTENTION");
    expect(stateOf(result, "BOQ")).toBe("CURRENT");
    expect(stateOf(result, "CALCULATIONS")).toBe("COMPLETE");
    expect(result.nextStep?.ctaLabel).toBe("Review Extracted Information");
    expect(result.factualSummary).toContain("1 confirmed calculation");
  });

  it("defines all nine professional workflow stages in their required order", () => {
    expect(GUIDE_STAGE_IDS).toEqual([
      "PROJECT_SETUP",
      "SOURCES",
      "EXTRACTION",
      "DIMENSIONS",
      "CALCULATIONS",
      "BOQ",
      "REVIEW",
      "VALIDATION",
      "OUTPUT",
    ]);

    for (const stageId of GUIDE_STAGE_IDS) {
      const definition = getGuideStageDefinition(stageId);
      expect(definition).toBe(GUIDE_STAGE_REGISTRY[stageId]);
      expect(definition).toMatchObject({ id: stageId });
      expect([
        definition.title,
        definition.shortDescription,
        definition.professionalPurpose,
        definition.whatQuantaraDoes,
        definition.whatUserCanDo,
        definition.suggestedActionLabel,
      ].every((value) => value.trim().length > 0)).toBe(true);
    }
  });

  it("describes only the merged, professionally confirmed measurement workflow", () => {
    expect(GUIDE_STAGE_REGISTRY.DIMENSIONS.whatQuantaraDoes).toContain(
      "supported deterministic measurement types",
    );
    expect(GUIDE_STAGE_REGISTRY.DIMENSIONS.whatQuantaraDoes).toContain(
      "missing required values visible",
    );
    expect(GUIDE_STAGE_REGISTRY.CALCULATIONS.whatQuantaraDoes).toContain(
      "equation, inputs, deductions or allowances, and calculated result",
    );
    expect(GUIDE_STAGE_REGISTRY.CALCULATIONS.whatUserCanDo).toContain(
      "explicitly confirm",
    );
    expect(GUIDE_STAGE_REGISTRY.BOQ.whatQuantaraDoes).toContain(
      "without applying it until the user confirms the quantity update",
    );
    expect(FEATURE_HINT_REGISTRY.MANUAL_MEASUREMENTS.availability).toBe("AVAILABLE");
    expect(FEATURE_HINT_REGISTRY.VISIBLE_QUANTITY_EQUATIONS.availability).toBe("AVAILABLE");
    expect("cta" in FEATURE_HINT_REGISTRY.MANUAL_MEASUREMENTS).toBe(false);
    expect("cta" in FEATURE_HINT_REGISTRY.VISIBLE_QUANTITY_EQUATIONS).toBe(false);
  });

  it("emits only supported real project routes and no dead query parameters", () => {
    const hrefs = GUIDE_STAGE_IDS.map((stageId) => getGuideStageHref(stageId, PROJECT_ID));
    expect(hrefs.every(isSupportedGuideHref)).toBe(true);
    expect(getGuideStageHref("DIMENSIONS", PROJECT_ID)).toBe(
      `/projects/${PROJECT_ID}/boq?action=review_dimensions`,
    );
    expect(getGuideStageHref("CALCULATIONS", PROJECT_ID)).toBe(
      `/projects/${PROJECT_ID}/boq?action=review_calculations`,
    );
    expect(getGuideStageHref("REVIEW", PROJECT_ID)).toBe(`/projects/${PROJECT_ID}/extractions`);
    expect(getGuideStageHref("VALIDATION", PROJECT_ID)).toBe(`/projects/${PROJECT_ID}/verification`);
    expect(getGuideStageHref("OUTPUT", PROJECT_ID)).toBe(`/projects/${PROJECT_ID}/documents`);
    expect(isSupportedGuideHref(`/projects/${PROJECT_ID}/boq?stage=dimensions`)).toBe(false);
    expect(isSupportedGuideHref("https://example.com/projects/dubai-tower")).toBe(false);
  });

  it("keeps navigation advisory instead of locking valid workspaces", () => {
    expect(GUIDE_NAVIGATION_MODE).toBe("ADVISORY");
    const validDestinations = [
      getGuideStageHref("SOURCES", PROJECT_ID),
      getGuideStageHref("BOQ", PROJECT_ID),
      getCatalogueHref(),
      getIntegrationsHref(),
      getProjectDocumentsHref(PROJECT_ID),
    ];
    expect(validDestinations.every(isSupportedGuideHref)).toBe(true);

    const guideSource = readFileSync(
      path.resolve(__dirname, "../src/components/guidance/project-workflow-guide.tsx"),
      "utf8",
    );
    expect(guideSource).not.toMatch(/aria-disabled|pointer-events-none/);
    expect(guideSource).not.toContain("disabled=");
  });
});

describe("Quantara Guide v2 snapshot and workflow decisions", () => {
  it("sends a project with no sources to Add Project Sources", () => {
    const result = workflow({ files: [], jobs: [], entityStatuses: [] });
    expect(stateOf(result, "PROJECT_SETUP")).toBe("COMPLETE");
    expect(stateOf(result, "SOURCES")).toBe("CURRENT");
    expect(result.nextStep).toEqual({
      message: "Add your project drawings, schedules or project information.",
      ctaLabel: "Add Project Sources",
      href: `/projects/${PROJECT_ID}/files`,
    });
  });

  it("directs running processing to a proven source without calling it a failure", () => {
    const result = workflow({
      files: [file("source-1", { status: "PROCESSING" }), file("source-2", { status: "PROCESSING" })],
      jobs: [
        job("job-1", "source-1", "RUNNING", "2026-08-09T08:00:00.000Z"),
        job("job-2", "source-2", "QUEUED", "2026-08-09T08:01:00.000Z"),
      ],
      entityStatuses: [],
    });

    expect(stateOf(result, "EXTRACTION")).toBe("CURRENT");
    expect(result.nextStep?.ctaLabel).toBe("View Source Processing");
    expect(result.nextStep?.href).toBe(`/projects/${PROJECT_ID}/files?file=source-1`);
    expect(result.nextStep?.message).toContain("processing 2 project sources");
    expect(result.nextStep?.message).not.toMatch(/failed|error/i);

    const parallelEngines = workflow({
      files: [file("source-1", { status: "PROCESSING" })],
      jobs: [
        job("preprocess", "source-1", "RUNNING", "2026-08-09T08:02:00.000Z", { engineType: "FILE_PREPROCESSING" }),
        job("tables", "source-1", "RUNNING", "2026-08-09T08:03:00.000Z", { engineType: "TABLE_EXTRACTION" }),
      ],
      entityStatuses: [],
    });
    expect(parallelEngines.nextStep?.message).toContain("processing 1 project source");
  });

  it("describes the processed Vista case with pages and tables but zero candidates truthfully", () => {
    const result = processedVistaWorkflow();

    expect(stateOf(result, "EXTRACTION")).toBe("CURRENT");
    expect(result.nextStep?.ctaLabel).toBe("Review Processing Results");
    expect(result.nextStep?.href).toBe(`/projects/${PROJECT_ID}/files?file=source-1`);
    expect(result.nextStep?.message).toContain("processed your project information");
    expect(result.factualSummary).toEqual([
      "2 sources added",
      "2 processing jobs completed",
      "18 pages available",
      "4 tables captured",
      "0 candidates ready for review",
    ]);
    expect(result.nextStep?.message).not.toMatch(/failed|error/i);
    expect(stateOf(result, "EXTRACTION")).not.toBe("COMPLETE");
  });

  it("flags only an actual latest processing failure and links to the affected source", () => {
    const failed = workflow({
      files: [file("failed-source", { status: "FAILED" })],
      jobs: [job("failed-job", "failed-source", "FAILED", "2026-08-09T09:00:00.000Z")],
      entityStatuses: [],
    });
    expect(stateOf(failed, "EXTRACTION")).toBe("NEEDS_ATTENTION");
    expect(failed.nextStep).toEqual({
      message: "Processing could not be completed. Review this source or try again.",
      ctaLabel: "Review Source",
      href: `/projects/${PROJECT_ID}/files?file=failed-source`,
    });

    const recovered = workflow({
      files: [file("recovered-source")],
      jobs: [
        job("new-success", "recovered-source", "COMPLETED", "2026-08-09T10:00:00.000Z"),
        job("old-failure", "recovered-source", "FAILED", "2026-08-09T08:00:00.000Z"),
      ],
      entityStatuses: [],
    });
    expect(recovered.nextStep?.ctaLabel).toBe("Review Processing Results");
    expect(stateOf(recovered, "EXTRACTION")).toBe("CURRENT");

    const retryingStaleFailure = workflow({
      files: [file("retrying-source", {
        status: "FAILED",
        processingErrorCode: "OLD_FAILURE",
        processingErrorMessage: "Superseded by retry",
      })],
      jobs: [
        job("new-retry", "retrying-source", "RUNNING", "2026-08-09T11:00:00.000Z"),
        job("old-failure", "retrying-source", "FAILED", "2026-08-09T08:00:00.000Z"),
      ],
      entityStatuses: [],
    });
    expect(retryingStaleFailure.nextStep?.ctaLabel).toBe("View Source Processing");

    const separateEngineFailure = workflow({
      files: [file("multi-engine-source", { extractedTableCount: 1 })],
      jobs: [
        job("table-success", "multi-engine-source", "COMPLETED", "2026-08-09T12:00:00.000Z", { engineType: "TABLE_EXTRACTION" }),
        job("preprocess-failure", "multi-engine-source", "FAILED", "2026-08-09T09:00:00.000Z", { engineType: "FILE_PREPROCESSING" }),
      ],
      entityStatuses: [],
    });

    expect(separateEngineFailure.snapshot.sources[0]?.currentJobStatusesByEngine).toEqual({
      TABLE_EXTRACTION: "COMPLETED",
      FILE_PREPROCESSING: "FAILED",
    });
    expect(separateEngineFailure.snapshot.sources[0]?.hasCapturedResults).toBe(true);
    expect(separateEngineFailure.snapshot.sources[0]?.hasProcessingError).toBe(true);
    expect(separateEngineFailure.nextStep?.ctaLabel).toBe("Review Processing Results");
    expect(separateEngineFailure.nextStep?.message).not.toMatch(/processing could not be completed/i);
  });

  it("sends reviewable candidates to professional extraction review", () => {
    const result = workflow({
      files: [file("source-1")],
      jobs: [job("job-1", "source-1", "COMPLETED", "2026-08-09T08:00:00.000Z")],
      entityStatuses: ["CONFIRMED", "EXTRACTED", "NEEDS_REVIEW"],
      hasBoq: true,
    });
    expect(stateOf(result, "EXTRACTION")).toBe("NEEDS_ATTENTION");
    expect(result.nextStep?.ctaLabel).toBe("Review Extracted Information");
    expect(result.nextStep?.href).toBe(`/projects/${PROJECT_ID}/extractions`);
  });

  it("moves reviewed extraction to Dimensions without completing later stages", () => {
    const result = workflow({
      files: [file("source-1")],
      jobs: [job("job-1", "source-1", "COMPLETED", "2026-08-09T08:00:00.000Z")],
      entityStatuses: ["CONFIRMED", "CORRECTED", "REJECTED", "IMPORTED"],
      hasBoq: true,
    });

    expect(stateOf(result, "EXTRACTION")).toBe("COMPLETE");
    expect(stateOf(result, "DIMENSIONS")).toBe("CURRENT");
    expect(stateOf(result, "CALCULATIONS")).toBe("NOT_STARTED");
    expect(stateOf(result, "BOQ")).toBe("CURRENT");
    expect(result.nextStep?.ctaLabel).toBe("Review Dimensions");
    expect(result.nextStep?.href).toBe(
      `/projects/${PROJECT_ID}/boq?action=review_dimensions`,
    );

    const sourceStillNeedsReview = workflow({
      files: [file("source-1")],
      jobs: [job("job-1", "source-1", "NEEDS_REVIEW", "2026-08-09T09:00:00.000Z")],
      entityStatuses: ["CONFIRMED"],
      hasBoq: true,
    });
    expect(stateOf(sourceStillNeedsReview, "EXTRACTION")).toBe("NEEDS_ATTENTION");
    expect(stateOf(sourceStillNeedsReview, "DIMENSIONS")).toBe("NOT_STARTED");
    expect(sourceStillNeedsReview.nextStep?.ctaLabel).toBe("Review Source");

    for (const attentionResult of [
      workflow({
        files: [file("cancelled-source")],
        jobs: [job("cancelled-job", "cancelled-source", "CANCELLED", "2026-08-09T09:01:00.000Z")],
        entityStatuses: ["CONFIRMED"],
      }),
      workflow({
        files: [file("unknown-job-source")],
        jobs: [job("unknown-job", "unknown-job-source", "FUTURE_STATUS", "2026-08-09T09:02:00.000Z")],
        entityStatuses: ["CONFIRMED"],
      }),
      workflow({
        files: [file("unknown-file-source", { status: "FUTURE_STATUS" })],
        jobs: [],
        entityStatuses: ["CONFIRMED"],
      }),
      workflow({
        files: [file("mixed-engine-source")],
        jobs: [
          job("needs-review", "mixed-engine-source", "NEEDS_REVIEW", "2026-08-09T09:03:00.000Z", { engineType: "FILE_PREPROCESSING" }),
          job("still-running", "mixed-engine-source", "RUNNING", "2026-08-09T09:04:00.000Z", { engineType: "TABLE_EXTRACTION" }),
        ],
        entityStatuses: ["CONFIRMED"],
      }),
    ]) {
      expect(stateOf(attentionResult, "EXTRACTION")).toBe("NEEDS_ATTENTION");
      expect(stateOf(attentionResult, "DIMENSIONS")).toBe("NOT_STARTED");
      expect(attentionResult.nextStep?.ctaLabel).toBe("Review Source");
    }
  });

  it("never marks later professional stages complete without evidence", () => {
    const scenarios = [
      workflow({ files: [] }),
      workflow({ files: [file("source-1", { status: "PROCESSING" })], jobs: [job("job-1", "source-1", "RUNNING", "2026-08-09T08:00:00.000Z")] }),
      processedVistaWorkflow(),
      workflow({ files: [file("source-1")], entityStatuses: ["EXTRACTED"] }),
      workflow({ files: [file("source-1")], entityStatuses: ["CONFIRMED"], hasBoq: true }),
    ];
    const laterStages: ProjectWorkflowStageId[] = ["DIMENSIONS", "CALCULATIONS", "BOQ", "REVIEW", "VALIDATION", "OUTPUT"];

    for (const scenario of scenarios) {
      for (const stageId of laterStages) {
        expect(stateOf(scenario, stageId)).not.toBe("COMPLETE");
      }
      if (scenario.nextStep) expect(isSupportedGuideHref(scenario.nextStep.href)).toBe(true);
    }
  });

  it("keeps unproven metrics null and omits invented zero facts", () => {
    const snapshot = buildProjectWorkflowSnapshot(records({
      files: [file("unknown-source", { pageCount: null, drawingPageCount: null, extractedTableCount: null })],
      jobs: null,
      entityStatuses: null,
      hasBoq: null,
    }));
    expect(snapshot.processingJobs.total).toBeNull();
    expect(snapshot.capturedResults.pageCount).toBeNull();
    expect(snapshot.capturedResults.tableCount).toBeNull();
    expect(snapshot.extractedEntities.total).toBeNull();
    expect(snapshot.boq.exists).toBeNull();

    const result = deriveProjectWorkflow({ projectExists: true, projectId: PROJECT_ID, snapshot });
    expect(result.extractionSummary).toMatchObject({
      total: null,
      reviewed: null,
      reviewable: null,
      needsAttention: null,
      unknown: null,
      complete: false,
    });
    expect(result.factualSummary.join(" ")).not.toMatch(/0 (pages|tables|jobs|candidates)/i);
  });

  it("preserves exact Google Drive attribution and treats every unproved origin as manual", () => {
    const snapshot = buildProjectWorkflowSnapshot(records({
      files: [
        file("drive", { metadata: { importSource: { provider: "google-drive", externalFileId: "drive-1" } } }),
        file("manual", { metadata: null }),
        file("spoofed", { metadata: { importSource: { provider: "dropbox" } } }),
      ],
    }));
    expect(snapshot.files.googleDriveOriginCount).toBe(1);
    expect(snapshot.files.manualOriginCount).toBe(2);
    expect(snapshot.sources.map((source) => source.origin)).toEqual([
      "Google Drive",
      "Uploaded manually",
      "Uploaded manually",
    ]);
  });
});

describe("GuideTip, feature hints, and source deep-link contracts", () => {
  it("implements hover, keyboard focus, mobile tap, Escape, and accessible button semantics", () => {
    const source = readFileSync(path.resolve(__dirname, "../src/components/guidance/guide-tip.tsx"), "utf8");
    expect(source).toContain('type="button"');
    expect(source).toContain("aria-label=");
    expect(source).toContain("aria-expanded=");
    expect(source).toContain("aria-controls=");
    expect(source).toContain('role="dialog"');
    expect(source).toContain("onMouseEnter=");
    expect(source).toContain("onMouseLeave=");
    expect(source).toContain("onFocusCapture=");
    expect(source).toContain("onBlurCapture=");
    expect(source).toContain("onClick={handlePinToggle}");
    expect(source).toContain('event.key !== "Escape"');
    expect(source).toContain('document.addEventListener("pointerdown"');
  });

  it("renders a GuideTip for every visible stage without turning the card into a hidden action", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../src/components/guidance/project-workflow-guide.tsx"),
      "utf8",
    );
    expect(source).toContain("workflow.stages.map");
    expect(source).toContain("<GuideTip");
    expect(source).toContain("definition.whatQuantaraDoes");
    expect(source).toContain("definition.whatUserCanDo");
    expect(source).not.toMatch(/<li[^>]+onClick=/s);
  });

  it("advertises verified voice only as a supported input method and contains no fake purchase CTA", () => {
    expect(FEATURE_HINT_REGISTRY.VOICE_GUIDANCE.availability).toBe("AVAILABLE");
    expect(FEATURE_HINT_REGISTRY.VOICE_GUIDANCE.description).toBe(
      "Use voice to enter or correct supported BOQ measurements.",
    );
    expect("cta" in FEATURE_HINT_REGISTRY.VOICE_GUIDANCE).toBe(false);

    const serialized = JSON.stringify(FEATURE_HINT_REGISTRY);
    expect(serialized).not.toMatch(/buy now|purchase|checkout|subscribe/i);
    for (const definition of Object.values(FEATURE_HINT_REGISTRY)) {
      if (definition.availability === "AVAILABLE" && "cta" in definition) {
        expect(isSupportedGuideHref(definition.cta.href)).toBe(true);
      }
      if (definition.availability !== "AVAILABLE") {
        expect("cta" in definition).toBe(false);
      }
    }
  });

  it("preserves the consumed project-file deep link and does not invent empty detail results", () => {
    expect(getProjectFilesHref("Dubai Tower", "file/id 1")).toBe(
      "/projects/Dubai%20Tower/files?file=file%2Fid%201",
    );
    const source = readFileSync(
      path.resolve(__dirname, "../src/app/projects/[projectId]/files/page.tsx"),
      "utf8",
    );
    expect(source).toContain("file?: string | string[]");
    expect(source).toContain("Array.isArray(searchParams.file) ? searchParams.file[0]");
    expect(source).toContain("files.some((file) => file.id === requestedFileId)");
    expect(source).toContain("loadDetail(requestedFileId)");
    expect(source).toContain("Promise.allSettled");
    expect(source).not.toContain(".catch(() => [])");
  });
});
