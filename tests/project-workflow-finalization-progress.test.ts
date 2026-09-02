import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProjectWorkflowGuide } from "../src/components/guidance/project-workflow-guide";
import {
  deriveProjectWorkflow,
  type ProjectWorkflowStageId,
} from "../src/lib/guidance/project-workflow";
import {
  buildProjectWorkflowSnapshot,
  type ProjectWorkflowSnapshotRecords,
} from "../src/lib/guidance/project-workflow-snapshot";

const PROJECT_ID = "project-furn-e2e-20260902-01";

vi.mock("@/components/guidance/guide-tip", () => ({ GuideTip: () => null }));

function buildWorkflow(overrides: Partial<ProjectWorkflowSnapshotRecords>) {
  const snapshot = buildProjectWorkflowSnapshot({
    projectId: "22222222-2222-4222-8222-222222222222",
    projectSlug: PROJECT_ID,
    files: [
      {
        id: "source-1",
        originalName: "controlled-furniture-schedule.csv",
        metadata: null,
        status: "COMPLETED",
        pageCount: 0,
        classification: "FURNITURE_SCHEDULE",
        revisionNumber: "R01",
        processingErrorCode: null,
        processingErrorMessage: null,
        drawingPageCount: 0,
        extractedTableCount: 1,
      },
    ],
    jobs: [
      {
        id: "job-1",
        projectFileId: "source-1",
        engineType: "TABLE_EXTRACTION",
        status: "COMPLETED",
        createdAt: "2026-09-02T05:00:00.000Z",
        resultSummary: { tableCount: 1 },
      },
    ],
    entityStatuses: ["IMPORTED"],
    calculationStatuses: [],
    hasBoq: true,
    ...overrides,
  });

  return deriveProjectWorkflow({
    projectExists: true,
    projectId: PROJECT_ID,
    snapshot,
    hasBoq: snapshot.boq.exists ?? false,
  });
}

function stateOf(
  result: ReturnType<typeof buildWorkflow>,
  stageId: ProjectWorkflowStageId,
) {
  return result.stages.find((stage) => stage.id === stageId)?.state;
}

function buildTerminalFurnitureWorkflow() {
  return buildWorkflow({
    entities: [
      {
        id: "furniture-row-1",
        status: "IMPORTED",
        quantity: 2,
        unit: "pcs",
      },
    ],
    calculations: [],
    activeBoq: {
      itemCount: 1,
      isLocked: true,
      completedDocumentCount: 1,
    },
  });
}

describe("project workflow finalization progress", () => {
  it("shows a terminal Furniture schedule as fully satisfied without inventing dimension calculations", () => {
    const result = buildTerminalFurnitureWorkflow();

    expect(stateOf(result, "PROJECT_SETUP")).toBe("COMPLETE");
    expect(stateOf(result, "SOURCES")).toBe("COMPLETE");
    expect(stateOf(result, "EXTRACTION")).toBe("COMPLETE");
    expect(stateOf(result, "DIMENSIONS")).toBe("NOT_REQUIRED");
    expect(stateOf(result, "CALCULATIONS")).toBe("NOT_REQUIRED");
    expect(stateOf(result, "BOQ")).toBe("COMPLETE");
    expect(stateOf(result, "REVIEW")).toBe("COMPLETE");
    expect(stateOf(result, "VALIDATION")).toBe("COMPLETE");
    expect(stateOf(result, "OUTPUT")).toBe("COMPLETE");
    expect(result.completedStageCount).toBe(7);
    expect(result.notRequiredStageCount).toBe(2);
    expect(result.satisfiedStageCount).toBe(9);
    expect(result.progressPercentage).toBe(100);
    expect(result.nextStep).toMatchObject({
      ctaLabel: "View output",
      href: `/projects/${PROJECT_ID}/documents`,
    });
  });

  it("keeps Output current until the active locked revision has a completed final document", () => {
    const result = buildWorkflow({
      entities: [
        {
          id: "furniture-row-1",
          status: "IMPORTED",
          quantity: 2,
          unit: "pcs",
        },
      ],
      calculations: [],
      activeBoq: {
        itemCount: 1,
        isLocked: true,
        completedDocumentCount: 0,
      },
    });

    expect(stateOf(result, "OUTPUT")).toBe("CURRENT");
    expect(result.progressPercentage).toBe(89);
    expect(result.nextStep?.href).toBe(`/projects/${PROJECT_ID}/documents`);
  });

  it("preserves real Construction dimension and calculation completion evidence", () => {
    const result = buildWorkflow({
      entityStatuses: ["CONFIRMED"],
      calculationStatuses: ["CONFIRMED"],
      entities: [
        {
          id: "floor-finish-1",
          status: "CONFIRMED",
          quantity: 12,
          unit: "m2",
        },
      ],
      calculations: [
        {
          id: "area-1",
          extractedEntityId: "floor-finish-1",
          status: "CONFIRMED",
          inputValues: { length: 4, width: 3 },
        },
      ],
      activeBoq: {
        itemCount: 1,
        isLocked: true,
        completedDocumentCount: 1,
      },
    });

    expect(stateOf(result, "DIMENSIONS")).toBe("COMPLETE");
    expect(stateOf(result, "CALCULATIONS")).toBe("COMPLETE");
    expect(result.notRequiredStageCount).toBe(0);
    expect(result.completedStageCount).toBe(9);
    expect(result.progressPercentage).toBe(100);
  });

  it("renders not-required stages and announces fully satisfied progress honestly", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectWorkflowGuide, { workflow: buildTerminalFurnitureWorkflow() }),
    );

    expect(html).toContain('aria-valuenow="100"');
    expect(html).toContain('aria-valuetext="9 of 9 stages complete or not required"');
    expect(html).toContain("7 complete · 2 not required");
    expect(html.match(/>Not required<\/p>/g) ?? []).toHaveLength(2);
  });

  it("keeps the workflow snapshot on the newest tenant-scoped BOQ and its final documents", () => {
    const snapshotSource = readFileSync(
      path.resolve(__dirname, "../src/lib/guidance/project-workflow-snapshot.ts"),
      "utf8",
    );

    expect(snapshotSource).toContain("getProjectRecord(actor.companyId, projectIdentifier)");
    expect(snapshotSource).toContain('prisma.bOQ.findFirst({');
    expect(snapshotSource).toContain('where: { companyId: actor.companyId, projectId: project.id }');
    expect(snapshotSource).toContain('orderBy: [{ revisionNumber: "desc" }, { createdAt: "desc" }]');
    expect(snapshotSource).toContain('status: "COMPLETED"');
    expect(snapshotSource).toContain("isDraft: false");
    expect(snapshotSource).toContain("completedDocumentCount: boq.generatedDocuments.length");
  });
});
