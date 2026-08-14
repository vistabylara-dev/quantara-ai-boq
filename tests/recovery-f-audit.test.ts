import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeBoqWorkflowState } from "../src/lib/workflow/boq-workflow-state";
import { buildProjectWorkflowSnapshot } from "../src/lib/guidance/project-workflow-snapshot";
import { deriveProjectWorkflow } from "../src/lib/guidance/project-workflow";
import en from "../src/lib/i18n/dictionaries/en";

function stepStatus(
  result: ReturnType<typeof computeBoqWorkflowState>,
  id: string,
) {
  return result.steps.find((step) => step.id === id)?.status;
}

describe("Recovery F final workflow audit", () => {
  it("keeps table constants lightweight while loading handlers through the composition root", () => {
    const service = readFileSync(
      path.resolve(__dirname, "../src/lib/services/table-extraction-service.ts"),
      "utf8",
    );
    const handlers = readFileSync(
      path.resolve(__dirname, "../src/lib/jobs/register-handlers.ts"),
      "utf8",
    );
    expect(service).toContain("@/lib/files/table-extraction/constants");
    expect(service).not.toContain(
      'import { TABLE_EXTRACTABLE_EXTENSIONS } from "@/lib/files/table-extraction-handler"',
    );
    expect(service).toContain('await import("@/lib/jobs/register-handlers")');
    expect(handlers).toContain('import "@/lib/files/table-extraction-handler"');
  });

  it("keeps local env defaults local while documenting Vercel Blob override", () => {
    const env = readFileSync(path.resolve(__dirname, "../.env.example"), "utf8");
    expect(env).toContain('STORAGE_PROVIDER="local"');
    expect(env).toContain('# BLOB_READ_WRITE_TOKEN=');
  });

  it("records PDF grid detection truthfully", () => {
    const parser = readFileSync(
      path.resolve(__dirname, "../src/lib/files/table-extraction/pdf-table-grid-normalization.ts"),
      "utf8",
    );
    expect(parser).toContain('method: "pdf-grid-detection"');
    expect(parser).not.toContain('method: "pdf-positional-text-fallback"');
  });

  it("sends PDF table candidates requiring review to Extraction Review", () => {
    const snapshot = buildProjectWorkflowSnapshot({
      projectId: "22222222-2222-4222-8222-222222222222",
      projectSlug: "audit-project",
      files: [{
        id: "file-1",
        originalName: "schedule.pdf",
        metadata: null,
        status: "COMPLETED",
        pageCount: null,
        classification: "EXISTING_BOQ",
        revisionNumber: null,
        processingErrorCode: null,
        processingErrorMessage: null,
        drawingPageCount: 2,
        extractedTableCount: 1,
      }],
      jobs: [{
        id: "job-1",
        projectFileId: "file-1",
        engineType: "TABLE_EXTRACTION",
        status: "NEEDS_REVIEW",
        createdAt: "2026-08-10T00:00:00.000Z",
        resultSummary: { tablesFound: 1 },
      }],
      entityStatuses: ["NEEDS_REVIEW"],
      hasBoq: true,
    });

    const result = deriveProjectWorkflow({
      projectExists: true,
      projectId: "audit-project",
      snapshot,
      hasBoq: true,
    });

    expect(result.nextStep?.ctaLabel).toBe("Review Extracted Information");
    expect(result.nextStep?.href).toBe("/projects/audit-project/extractions");
  });

  it("does not let a rejected calculation satisfy a missing reviewed quantity", () => {
    const result = computeBoqWorkflowState({
      fileCount: 1,
      extractedEntities: [{
        id: "entity-1",
        status: "CONFIRMED",
        quantity: null,
        unit: null,
      }],
      calculations: [{
        id: "calc-1",
        extractedEntityId: "entity-1",
        status: "REJECTED",
      }],
      boqItemCount: 0,
      validationWarningCount: 0,
      generatedDocumentCount: 0,
      isLocked: false,
    });

    expect(stepStatus(result, "dimensions")).toBe("NEEDS_ATTENTION");
    expect(stepStatus(result, "calculation")).toBe("NOT_STARTED");
    expect(result.nextAction.ctaAction).toBe("review_dimensions");
  });

  it("keeps imported direct-quantity evidence in the completed workflow", () => {
    const result = computeBoqWorkflowState({
      fileCount: 1,
      extractedEntities: [{
        id: "entity-1",
        status: "IMPORTED",
        quantity: 12,
        unit: "nr",
      }],
      calculations: [],
      boqItemCount: 1,
      validationWarningCount: 0,
      generatedDocumentCount: 0,
      isLocked: false,
    });

    expect(stepStatus(result, "extraction")).toBe("COMPLETE");
    expect(stepStatus(result, "dimensions")).toBe("NOT_REQUIRED");
    expect(stepStatus(result, "calculation")).toBe("NOT_REQUIRED");
  });

  it("counts only non-draft completed output for the active revision", () => {
    const page = readFileSync(
      path.resolve(__dirname, "../src/app/projects/[projectId]/boq/page.tsx"),
      "utf8",
    );
    expect(page).toContain("document.isDraft === false");
  });

  it("blocks add/import while local BOQ edits are unsaved", () => {
    const page = readFileSync(
      path.resolve(__dirname, "../src/app/projects/[projectId]/boq/page.tsx"),
      "utf8",
    );
    expect(page).toContain('t("boqEditor.saveBeforeAddingOrImporting")');
    expect(en.boqEditor.saveBeforeAddingOrImporting).toContain(
      "Your unsaved edits will not be discarded",
    );
    expect(page).toContain("actionInProgress || hasUnsavedChanges");
  });

  it("makes BOQ specification visible and editable before extracted import", () => {
    const modal = readFileSync(
      path.resolve(__dirname, "../src/components/boq/add-item-from-source-modal.tsx"),
      "utf8",
    );
    const route = readFileSync(
      path.resolve(__dirname, "../src/app/api/projects/[projectId]/extractions/import-to-boq/route.ts"),
      "utf8",
    );
    const service = readFileSync(
      path.resolve(__dirname, "../src/lib/services/extraction-to-boq-service.ts"),
      "utf8",
    );

    expect(modal).toContain('t("boqEditor.boqSpecificationLabel")');
    expect(en.boqEditor.boqSpecificationLabel).toBe(
      "BOQ specification — review before import",
    );
    expect(modal).toContain("specification: extractionDraft.specification");
    expect(route).toContain("specification: z.string().max(2000)");
    expect(service).toContain("specification: input.specification ?? entity.sourceText ??");
  });
});
