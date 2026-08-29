import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeBoqWorkflowState } from "../src/lib/workflow/boq-workflow-state";
import en from "../src/lib/i18n/dictionaries/en";

const base = {
  fileCount: 1,
  extractedEntities: [] as Array<{
    id: string;
    status: string;
    quantity: number | null;
    unit: string | null;
  }>,
  calculations: [] as Array<{
    id: string;
    extractedEntityId: string | null;
    status: string;
    inputValues?: Record<string, number>;
  }>,
  boqItemCount: 0,
  validationWarningCount: 0 as number | null,
  generatedDocumentCount: 0 as number | null,
  isLocked: false,
};

function status(
  result: ReturnType<typeof computeBoqWorkflowState>,
  id: string,
) {
  return result.steps.find((step) => step.id === id)?.status;
}

describe("BOQ workflow recovery", () => {
  it("does not demand dimensions for a reviewed direct schedule/count quantity", () => {
    const result = computeBoqWorkflowState({
      ...base,
      extractedEntities: [
        {
          id: "entity-1",
          status: "CONFIRMED",
          quantity: 12,
          unit: "nr",
        },
      ],
    });

    expect(status(result, "dimensions")).toBe("NOT_REQUIRED");
    expect(status(result, "calculation")).toBe("NOT_REQUIRED");
    expect(result.nextAction.ctaAction).toBe("open_boq");
    expect(result.nextAction.ctaLabel).toBe("Open reviewed items");
  });

  it("does not report dimensions complete from a confirmed Count calculation", () => {
    const result = computeBoqWorkflowState({
      ...base,
      extractedEntities: [
        {
          id: "entity-1",
          status: "CONFIRMED",
          quantity: 1,
          unit: "nr",
        },
      ],
      calculations: [
        {
          id: "count-1",
          extractedEntityId: "entity-1",
          status: "CONFIRMED",
          inputValues: { verifiedCount: 1, futureUnknownInput: 1 },
        },
      ],
    });

    expect(status(result, "dimensions")).toBe("NOT_REQUIRED");
    expect(status(result, "calculation")).toBe("COMPLETE");
  });

  it("reports dimensions complete only from an actual dimensional calculation input", () => {
    const result = computeBoqWorkflowState({
      ...base,
      extractedEntities: [
        {
          id: "entity-1",
          status: "CONFIRMED",
          quantity: 12,
          unit: "m2",
        },
      ],
      calculations: [
        {
          id: "area-1",
          extractedEntityId: "entity-1",
          status: "CONFIRMED",
          inputValues: { length: 4, width: 3 },
        },
      ],
    });

    expect(status(result, "dimensions")).toBe("COMPLETE");
    expect(status(result, "calculation")).toBe("COMPLETE");
  });

  it("requires dimensions when reviewed extraction lacks a usable direct quantity", () => {
    const result = computeBoqWorkflowState({
      ...base,
      extractedEntities: [
        {
          id: "entity-1",
          status: "CORRECTED",
          quantity: null,
          unit: null,
        },
      ],
    });

    expect(status(result, "dimensions")).toBe("NEEDS_ATTENTION");
    expect(result.nextAction.ctaAction).toBe("review_dimensions");
  });

  it("never interprets unavailable validation as zero warnings", () => {
    const result = computeBoqWorkflowState({
      ...base,
      boqItemCount: 1,
      validationWarningCount: null,
    });

    expect(status(result, "validation")).toBe("NEEDS_ATTENTION");
    expect(result.nextAction.ctaAction).toBe("run_validation");
    expect(result.nextAction.message).toContain("unavailable");
  });

  it("keeps validation read-only even when preview reports zero warnings", () => {
    const result = computeBoqWorkflowState({
      ...base,
      boqItemCount: 1,
      validationWarningCount: 0,
    });

    expect(status(result, "validation")).toBe("CURRENT");
    expect(result.nextAction.ctaAction).toBe("run_validation");
    expect(result.nextAction.ctaLabel).toBe("Open validation");
  });

  it("marks locked BOQ as ready for output, not output-complete without a document", () => {
    const ready = computeBoqWorkflowState({
      ...base,
      boqItemCount: 1,
      validationWarningCount: 0,
      generatedDocumentCount: 0,
      isLocked: true,
    });

    expect(status(ready, "output")).toBe("CURRENT");
    expect(ready.nextAction.ctaAction).toBe("view_output");

    const generated = computeBoqWorkflowState({
      ...base,
      boqItemCount: 1,
      validationWarningCount: 0,
      generatedDocumentCount: 1,
      isLocked: true,
    });

    expect(status(generated, "output")).toBe("COMPLETE");
    expect(generated.nextAction.ctaAction).toBe("view_output");
  });
});

describe("BOQ page workflow controls", () => {
  const page = readFileSync(
    path.resolve(__dirname, "../src/app/projects/[projectId]/boq/page.tsx"),
    "utf8",
  );

  it("routes validation to verification instead of the lock mutation", () => {
    expect(page).toContain('case "run_validation"');
    expect(page).toContain("/verification");
    expect(page).toContain('case "lock_boq"');
    expect(page).toContain("void lockRevision(activeRevision)");
  });

  it("routes Sources, Extraction and Output to their real workspaces", () => {
    expect(page).toContain(`/files`);
    expect(page).toContain(`/extractions`);
    expect(page).toContain(`/documents`);
    expect(page).toContain('case "view_output"');
  });

  it("never catches validation-preview failure as zero warnings", () => {
    expect(page).not.toContain(".catch(() => setValidationWarningCount(0))");
    expect(page).toContain('t("boqEditor.validationPreviewUnavailable"');
    expect(en.boqEditor.validationPreviewUnavailable).toContain(
      "No zero-warning status is being assumed",
    );
  });

  it("does not claim incomplete workflow facts are zero", () => {
    expect(page).toContain("workflowFactsWarning");
    expect(page).toContain('t("boqEditor.workflowFactsWarning"');
    expect(en.boqEditor.workflowFactsWarning).toContain(
      "no unavailable count is being treated as zero",
    );
  });
});
