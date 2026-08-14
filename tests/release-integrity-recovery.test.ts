import { readFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { PDFParse } from "pdf-parse";
import { describe, expect, it } from "vitest";
import { parsePdfTables } from "../src/lib/files/table-extraction/pdf-table-parser";
import { computeBoqWorkflowState } from "../src/lib/workflow/boq-workflow-state";

function buildTwoPageTextPdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.font("Helvetica").fontSize(10).text("Page one has a text layer.");
    doc.addPage();
    doc.font("Helvetica").fontSize(10).text("Page two has a text layer.");
    doc.end();
  });
}

describe("Release integrity recovery", () => {
  it("quarantines the exact pdf-parse incomplete-grid crash per page instead of failing the whole PDF", async () => {
    const buffer = await buildTwoPageTextPdf();
    const originalGetTable = PDFParse.prototype.getTable;
    const visitedPages: number[] = [];

    PDFParse.prototype.getTable = (async (params = {}) => {
      const pageNumber = params.partial?.[0] ?? -1;
      visitedPages.push(pageNumber);
      if (pageNumber === 1) {
        throw new TypeError("Cannot read properties of undefined (reading 'from')");
      }
      return { total: 2, pages: [{ num: pageNumber, tables: [] }], mergedTables: [] } as Awaited<ReturnType<typeof originalGetTable>>;
    }) as typeof originalGetTable;

    try {
      const result = await parsePdfTables(buffer);
      expect(result.hasTextLayer).toBe(true);
      // Page 1 is a real geometry failure; page 2 simply has no table.
      // Both are recorded as pages with no recovered table, but only page 1 is a parser failure.
      expect(result.skippedTablePages).toEqual([1, 2]);
      expect(result.geometryFailedPages).toEqual([1]);
      expect(result.tables).toEqual([]);
      expect(visitedPages).toEqual([1, 2]);
    } finally {
      PDFParse.prototype.getTable = originalGetTable;
    }
  });

  it("uses the canonical BOQ database project UUID for validation-preview repository queries", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../src/lib/services/boq-validation-service.ts"),
      "utf8",
    );
    expect(source).toContain('import { getBOQRecord } from "@/lib/repositories/boq-repository"');
    expect(source).toContain("const boq = await getBOQRecord(actor.companyId, boqId);");
    expect(source).not.toContain("const boq = await getBOQ(actor.companyId, boqId);");
    expect(source).toContain("listQuantityCalculationsForProject(actor.companyId, boq.projectId)");
    expect(source).toContain("listExtractedEntities(actor.companyId, boq.projectId)");
  });

  it("does not let a calculation linked to rejected extraction keep the workflow blocked", () => {
    const result = computeBoqWorkflowState({
      fileCount: 1,
      extractedEntities: [{ id: "rejected-entity", status: "REJECTED", quantity: null, unit: null }],
      calculations: [{ id: "stale-calc", extractedEntityId: "rejected-entity", status: "DRAFT" }],
      boqItemCount: 0,
      validationWarningCount: 0,
      generatedDocumentCount: 0,
      isLocked: false,
    });

    expect(result.steps.find((step) => step.id === "calculation")?.status).not.toBe("NEEDS_ATTENTION");
    expect(result.nextAction.ctaAction).not.toBe("review_calculations");
  });

  it("keeps a deliberate manual unconfirmed calculation reviewable", () => {
    const result = computeBoqWorkflowState({
      fileCount: 1,
      extractedEntities: [],
      calculations: [{ id: "manual-calc", extractedEntityId: null, status: "DRAFT" }],
      boqItemCount: 0,
      validationWarningCount: 0,
      generatedDocumentCount: 0,
      isLocked: false,
    });

    expect(result.steps.find((step) => step.id === "calculation")?.status).toBe("NEEDS_ATTENTION");
    expect(result.nextAction.ctaAction).toBe("review_calculations");
  });

  it("keys validation-preview requests to the stable revision id", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../src/app/projects/[projectId]/boq/page.tsx"),
      "utf8",
    );
    expect(source).toContain("const activeRevisionId = activeRevision?.id ?? null;");
    expect(source).toContain("encodeURIComponent(activeRevisionId)");
    expect(source).toContain("}, [activeRevisionId, locale, t]);");
    expect(source).not.toContain("}, [activeRevision]);");
  });
});
