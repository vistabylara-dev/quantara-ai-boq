import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { ExtractedTableType, ExtractionJobStatus, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { uploadProjectFile } from "../src/lib/services/project-file-service";
import { triggerFileExtraction, listExtractedTablesForFile } from "../src/lib/services/table-extraction-service";
import { parseCsvTables } from "../src/lib/files/table-extraction/csv-table-parser";
import { parseXlsxTables } from "../src/lib/files/table-extraction/xlsx-table-parser";
import { parsePdfTables } from "../src/lib/files/table-extraction/pdf-table-parser";
import { AppError, NotFoundError, PermissionDeniedError } from "../src/lib/errors/app-error";
import type { CurrentActor } from "../src/lib/auth/current-actor";

const RUN_ID = Date.now();

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 4000, intervalMs = 20): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("waitFor: condition not met within timeout");
}

async function buildXlsxWithReinforcementSchedule(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Structural");
  sheet.addRow(["Element", "Concrete", "Diameter", "Quantity"]);
  sheet.addRow(["Foundations", "53 m3", "25 mm", "0.58 tonne"]);
  sheet.addRow(["", "", "20 mm", "0.46 tonne"]);
  sheet.addRow(["", "", "16 mm", "4.50 tonne"]);
  sheet.addRow(["", "", "12 mm", "0.48 tonne"]);
  sheet.mergeCells("A2:A5");
  sheet.mergeCells("B2:B5");
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

async function buildFlatXlsx(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Doors");
  sheet.addRow(["Item Code", "Description", "Quantity", "Unit"]);
  sheet.addRow(["D-01", "Single Timber Door", "12", "nr"]);
  sheet.addRow(["D-02", "Double Glazed Door", "4", "nr"]);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/** A real bordered/grid table (drawn lines + positioned text) — what PDFParse.getTable() actually detects. */
function buildPdfWithBorderedTable(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.font("Helvetica").fontSize(10);

    const x0 = 40;
    const y0 = 60;
    const colWidths = [80, 220, 80, 60];
    const colX = [x0, x0 + colWidths[0], x0 + colWidths[0] + colWidths[1], x0 + colWidths[0] + colWidths[1] + colWidths[2]];
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const rowHeight = 20;
    const rowCount = 3; // header + 2 data rows

    for (let r = 0; r <= rowCount; r += 1) {
      doc.moveTo(x0, y0 + r * rowHeight).lineTo(x0 + tableWidth, y0 + r * rowHeight).stroke();
    }
    for (let c = 0; c <= colX.length; c += 1) {
      const x = c < colX.length ? colX[c] : x0 + tableWidth;
      doc.moveTo(x, y0).lineTo(x, y0 + rowCount * rowHeight).stroke();
    }

    const rows = [
      ["Item Code", "Description", "Quantity", "Unit"],
      ["D-01", "Single Timber Door", "12", "nr"],
      ["D-02", "Double Glazed Door", "4", "nr"],
    ];
    rows.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        doc.text(value, colX[colIndex] + 4, y0 + rowIndex * rowHeight + 5, { lineBreak: false });
      });
    });

    doc.end();
  });
}

/** No text/drawing content at all — the honest "no text layer" case. */
function buildBlankPdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.rect(50, 50, 100, 100).fill("#cccccc");
    doc.end();
  });
}

describe("Phase 8 sub-phase 4: structured table and schedule extraction", () => {
  describe("csv-table-parser (unit)", () => {
    it("parses a flat table with no grouping", () => {
      const csv = "Item Code,Description,Quantity,Unit\nD-01,Single Timber Door,12,nr\nD-02,Double Glazed Door,4,nr\n";
      const [table] = parseCsvTables(Buffer.from(csv));
      expect(table.rows).toHaveLength(2);
      expect(table.confidence).toBe(90);
      expect(table.rows.every((row) => row.parentRowNumber === undefined)).toBe(true);
    });

    it("groups child rows under the nearest preceding row via blank-cell inheritance", () => {
      const csv = "Element,Concrete,Diameter,Quantity\nFoundations,53 m3,25 mm,0.58 tonne\n,,20 mm,0.46 tonne\n,,16 mm,4.50 tonne\n";
      const [table] = parseCsvTables(Buffer.from(csv));
      expect(table.confidence).toBe(70);
      const parent = table.rows.find((row) => row.parentRowNumber === undefined);
      const children = table.rows.filter((row) => row.parentRowNumber !== undefined);
      expect(parent).toBeDefined();
      expect(children).toHaveLength(2);
      expect(children.every((row) => row.parentRowNumber === parent!.rowNumber)).toBe(true);
      // The parent's "53 m3" concrete quantity must appear once, on the parent, never copied onto a child row.
      expect(parent!.cells.some((c) => c.rawValue === "53 m3")).toBe(true);
      expect(children.some((row) => row.cells.some((c) => c.rawValue === "53 m3"))).toBe(false);
      expect(children[0].cells.some((c) => c.columnKey === "parent_element")).toBe(false);
    });
  });

  describe("xlsx-table-parser (unit, real ExcelJS workbooks)", () => {
    it("parses a flat table with high confidence and no grouping", async () => {
      const buffer = await buildFlatXlsx();
      const [table] = await parseXlsxTables(buffer);
      expect(table.confidence).toBe(95);
      expect(table.rows).toHaveLength(2);
    });

    it("reconstructs the merged reinforcement schedule into one parent + 4 children without duplicating the concrete quantity", async () => {
      const buffer = await buildXlsxWithReinforcementSchedule();
      const [table] = await parseXlsxTables(buffer);
      expect(table.confidence).toBe(85);

      const parent = table.rows.find((row) => row.parentRowNumber === undefined);
      const children = table.rows.filter((row) => row.parentRowNumber !== undefined);
      expect(parent).toBeDefined();
      expect(children).toHaveLength(4);
      expect(children.every((row) => row.parentRowNumber === parent!.rowNumber)).toBe(true);

      const elementCell = parent!.cells.find((c) => c.columnKey === "parent_element");
      expect(elementCell?.rawValue).toBe("Foundations");
      const concreteCell = parent!.cells.find((c) => c.rawValue === "53 m3");
      expect(concreteCell).toBeDefined();

      // Children must carry only diameter/quantity — never a repeated Element/Concrete cell.
      for (const child of children) {
        expect(child.cells.some((c) => c.rawValue === "53 m3")).toBe(false);
        expect(child.cells.some((c) => c.columnKey === "parent_element")).toBe(false);
      }
      const diameters = children.map((child) => child.cells.find((c) => c.columnKey === "diameter")?.rawValue);
      expect(diameters).toEqual(["25 mm", "20 mm", "16 mm", "12 mm"]);
    });
  });

  describe("pdf-table-parser (unit, real pdfkit-generated PDFs)", () => {
    it("detects a real bordered/grid table via vector line detection, at moderate, review-forcing confidence", async () => {
      const buffer = await buildPdfWithBorderedTable();
      const result = await parsePdfTables(buffer);
      expect(result.hasTextLayer).toBe(true);
      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].confidence).toBeLessThanOrEqual(65);
      expect(result.tables[0].rows).toHaveLength(2);
      expect(result.tables[0].rows[0].cells.find((c) => c.columnKey === "item_code")?.rawValue).toBe("D-01");
      expect(result.tables[0].rows[1].cells.find((c) => c.columnKey === "quantity")?.rawValue).toBe("4");
    });

    it("honestly reports no text layer for a PDF with no text content, rather than fabricating a result", async () => {
      const buffer = await buildBlankPdf();
      const result = await parsePdfTables(buffer);
      expect(result.hasTextLayer).toBe(false);
      expect(result.tables).toEqual([]);
    });

    it("reports a text layer with zero tables for plain paragraph text with no grid lines, rather than guessing at structure", async () => {
      const buffer = await new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 40 });
        const chunks: Buffer[] = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
        doc.font("Helvetica").fontSize(10).text("This is a plain paragraph of inspection notes with no tabular structure at all.");
        doc.end();
      });
      const result = await parsePdfTables(buffer);
      expect(result.hasTextLayer).toBe(true);
      expect(result.tables).toEqual([]);
    });
  });

  describe("end-to-end via the real job queue + handler + service (integration, real local Postgres)", () => {
    let companyId: string;
    let projectId: string;
    let ownerActor: CurrentActor;
    let reviewerActor: CurrentActor;
    let ownerActorOtherCompany: CurrentActor;
    const cleanupCompanyIds: string[] = [];

    beforeAll(async () => {
      const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });

      const company = await prisma.company.create({ data: { legalName: `Phase8 Tables Co ${RUN_ID}`, tradeName: "Phase8 TB", email: `phase8-tb-${RUN_ID}@example.com` } });
      companyId = company.id;
      cleanupCompanyIds.push(companyId);
      await prisma.companyIndustryEngine.create({ data: { companyId, industryEngineId: construction.id, enabled: true } });
      const client = await createClient(companyId, { name: "Client TB", email: `phase8-tb-client-${RUN_ID}@example.com` });

      const ownerUser = await prisma.user.create({ data: { companyId, email: `phase8-tb-owner-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Owner TB", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() } });
      const reviewerUser = await prisma.user.create({ data: { companyId, email: `phase8-tb-reviewer-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Reviewer TB", role: UserRole.REVIEWER, isActive: true, emailVerifiedAt: new Date() } });
      ownerActor = { userId: ownerUser.id, companyId, role: UserRole.COMPANY_OWNER, fullName: "Owner TB", email: ownerUser.email };
      reviewerActor = { userId: reviewerUser.id, companyId, role: UserRole.REVIEWER, fullName: "Reviewer TB", email: reviewerUser.email };

      const { project } = await createProjectWithDefaultBoq(ownerActor, {
        clientId: client.id, industryEngineId: "construction", reference: `P8TB-${RUN_ID}`, name: "Phase8 Tables Project",
        location: "Dubai", currency: "AED", taxRate: "5", language: "English",
      });
      projectId = project.databaseId;

      const otherCompany = await prisma.company.create({ data: { legalName: `Phase8 Tables Co Other ${RUN_ID}`, tradeName: "Phase8 TB Other", email: `phase8-tb-other-${RUN_ID}@example.com` } });
      cleanupCompanyIds.push(otherCompany.id);
      const otherOwner = await prisma.user.create({ data: { companyId: otherCompany.id, email: `phase8-tb-other-owner-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Owner Other", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() } });
      ownerActorOtherCompany = { userId: otherOwner.id, companyId: otherCompany.id, role: UserRole.COMPANY_OWNER, fullName: "Owner Other", email: otherOwner.email };
    });

    afterAll(async () => {
      for (const id of cleanupCompanyIds) {
        await prisma.extractedTableCell.deleteMany({ where: { companyId: id } });
        await prisma.extractedTableRow.deleteMany({ where: { companyId: id } });
        await prisma.extractedTable.deleteMany({ where: { companyId: id } });
        await prisma.extractionJob.deleteMany({ where: { companyId: id } });
        await prisma.projectFile.deleteMany({ where: { companyId: id } });
        await prisma.bOQItem.deleteMany({ where: { companyId: id } });
        await prisma.bOQSection.deleteMany({ where: { companyId: id } });
        await prisma.bOQ.deleteMany({ where: { companyId: id } });
        await prisma.project.deleteMany({ where: { companyId: id } });
        await prisma.client.deleteMany({ where: { companyId: id } });
        await prisma.companyIndustryEngine.deleteMany({ where: { companyId: id } });
        await prisma.user.deleteMany({ where: { companyId: id } });
        await prisma.company.delete({ where: { id } });
      }
    });

    it("extracts a CSV existing-BOQ file end-to-end and infers the table type from the file's classification", async () => {
      const csv = "Item Code,Description,Quantity,Unit\nD-01,Single Timber Door,12,nr\n";
      const uploaded = await uploadProjectFile(ownerActor, projectId, { originalName: "Existing-BOQ.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
      await prisma.projectFile.update({ where: { id: uploaded.file.id }, data: { classification: "EXISTING_BOQ" } });

      const job = await triggerFileExtraction(ownerActor, uploaded.file.id);
      expect(["QUEUED", "RUNNING", "COMPLETED"]).toContain(job.status);

      await waitFor(async () => {
        const current = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
        return current.status === ExtractionJobStatus.COMPLETED;
      });

      const tables = await listExtractedTablesForFile(ownerActor, uploaded.file.id);
      expect(tables).toHaveLength(1);
      expect(tables[0].tableType).toBe(ExtractedTableType.EXISTING_BOQ);
      expect(tables[0].status).toBe("EXTRACTED");
      expect(tables[0].rows).toHaveLength(1);
      expect(tables[0].rows[0].cells.some((c) => c.columnKey === "item_code" && c.rawValue === "D-01")).toBe(true);
    });

    it("extracts a merged XLSX structural schedule end-to-end with correct parent-child structure", async () => {
      const buffer = await buildXlsxWithReinforcementSchedule();
      const uploaded = await uploadProjectFile(ownerActor, projectId, { originalName: "structural-schedule.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });

      const job = await triggerFileExtraction(ownerActor, uploaded.file.id);
      await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } })).status === ExtractionJobStatus.COMPLETED);

      const [table] = await listExtractedTablesForFile(ownerActor, uploaded.file.id);
      const parentRows = table.rows.filter((r) => r.parentRowId === null);
      const childRows = table.rows.filter((r) => r.parentRowId !== null);
      expect(parentRows).toHaveLength(1);
      expect(childRows).toHaveLength(4);
      expect(childRows.every((r) => r.parentRowId === parentRows[0].id)).toBe(true);
    });

    it("extracts a PDF and always forces NEEDS_REVIEW regardless of confidence", async () => {
      const buffer = await buildPdfWithBorderedTable();
      const uploaded = await uploadProjectFile(ownerActor, projectId, { originalName: "door-schedule-scan.pdf", mimeType: "application/pdf", buffer });

      const job = await triggerFileExtraction(ownerActor, uploaded.file.id);
      await waitFor(async () => {
        const current = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
        return current.status === ExtractionJobStatus.NEEDS_REVIEW || current.status === ExtractionJobStatus.COMPLETED;
      });

      const final = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(final.status).toBe(ExtractionJobStatus.NEEDS_REVIEW);
    });

    it("reports a clear, honest message for a PDF with no extractable text layer, without fabricating tables", async () => {
      const buffer = await buildBlankPdf();
      const uploaded = await uploadProjectFile(ownerActor, projectId, { originalName: "scanned-photo.pdf", mimeType: "application/pdf", buffer });

      const job = await triggerFileExtraction(ownerActor, uploaded.file.id);
      await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } })).status === ExtractionJobStatus.NEEDS_REVIEW);

      const final = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
      expect((final.resultSummaryJson as { message?: string })?.message).toContain("no extractable text layer");
      const tables = await listExtractedTablesForFile(ownerActor, uploaded.file.id);
      expect(tables).toHaveLength(0);
    });

    it("does not re-extract and discard already-reviewed rows", async () => {
      const csv = "Item Code,Description,Quantity,Unit\nD-01,Single Timber Door,12,nr\n";
      const uploaded = await uploadProjectFile(ownerActor, projectId, { originalName: "review-guard.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

      const firstJob = await triggerFileExtraction(ownerActor, uploaded.file.id);
      await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: firstJob.id } })).status === ExtractionJobStatus.COMPLETED);

      const [table] = await listExtractedTablesForFile(ownerActor, uploaded.file.id);
      await prisma.extractedTableRow.update({ where: { id: table.rows[0].id }, data: { status: "CONFIRMED" } });

      const secondJob = await triggerFileExtraction(ownerActor, uploaded.file.id);
      await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: secondJob.id } })).status === ExtractionJobStatus.COMPLETED);

      const finalJob = await prisma.extractionJob.findUniqueOrThrow({ where: { id: secondJob.id } });
      expect((finalJob.resultSummaryJson as { skipped?: boolean })?.skipped).toBe(true);

      const tablesAfter = await listExtractedTablesForFile(ownerActor, uploaded.file.id);
      expect(tablesAfter[0].rows[0].status).toBe("CONFIRMED");
    });

    it("rejects triggering extraction for an unsupported file type", async () => {
      const uploaded = await uploadProjectFile(ownerActor, projectId, { originalName: "photo.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) });
      await expect(triggerFileExtraction(ownerActor, uploaded.file.id)).rejects.toThrow(AppError);
    });

    it("rejects triggering extraction from a role without files:manage", async () => {
      const csv = "A,B\n1,2\n";
      const uploaded = await uploadProjectFile(ownerActor, projectId, { originalName: "rbac-check.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
      await expect(triggerFileExtraction(reviewerActor, uploaded.file.id)).rejects.toThrow(PermissionDeniedError);
    });

    it("enforces tenant isolation on extraction trigger and table listing", async () => {
      const csv = "A,B\n1,2\n";
      const uploaded = await uploadProjectFile(ownerActor, projectId, { originalName: "tenant-check.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
      await expect(triggerFileExtraction(ownerActorOtherCompany, uploaded.file.id)).rejects.toThrow(NotFoundError);
      await expect(listExtractedTablesForFile(ownerActorOtherCompany, uploaded.file.id)).rejects.toThrow(NotFoundError);
    });
  });
});
