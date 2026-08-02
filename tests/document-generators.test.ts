import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildDocumentData, type BuildDocumentDataInput } from "@/lib/documents/build-document-data";
import { generateCsv } from "@/lib/documents/generators/csv-generator";
import { generateXlsx } from "@/lib/documents/generators/xlsx-generator";
import { generatePdf } from "@/lib/documents/generators/pdf-generator";
import { generateDocx } from "@/lib/documents/generators/docx-generator";
import { generateHtml } from "@/lib/documents/generators/html-generator";
import { DEFAULT_CONTENT_CONFIG, DEFAULT_STYLE_CONFIG, mergeContentConfig, mergeStyleConfig } from "@/lib/documents/template-config";
import type { BOQ } from "@/types/boq";

const sampleBoq: BOQ = {
  id: "boq-1",
  projectId: "project-1",
  title: "Test BOQ",
  revision: "R01",
  status: "locked",
  taxRate: 5,
  isLocked: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
  lockedAt: new Date("2026-01-02T00:00:00.000Z").toISOString(),
  sections: [
    {
      id: "sec-1",
      code: "FND",
      title: "Foundations",
      description: "",
      order: 1,
      items: [
        {
          id: "item-1",
          itemNumber: 1,
          itemCode: "CON-001",
          category: "Concrete",
          description: 'Reinforced footing, "premium" grade, includes rebar, ties',
          specification: "C40 concrete",
          quantity: 25,
          unit: "m3",
          unitCost: 320,
          freightCost: 15,
          installationCost: 10,
          additionalCost: 0,
          landedCost: 345,
          marginMode: "markup",
          marginPercentage: 20,
          sellingRate: 414,
          totalAmount: 10350,
          wastagePercentage: 0,
          taxApplicable: true,
          sourceReference: "",
          roomOrZone: "Block A",
          drawingReference: "S-101",
          confidenceScore: 95,
          status: "confirmed",
          notes: "متطلبات خاصة, priority item",
          options: [],
        },
      ],
    },
  ],
  totals: {
    directCost: 8625,
    landedCost: 8625,
    grossProfit: 1725,
    grossMarginPercentage: 16.67,
    subtotal: 10350,
    discountPercentage: 0,
    discountAmount: 0,
    taxableAmount: 10350,
    taxAmount: 517.5,
    grandTotal: 10867.5,
  },
};

const baseInput: Omit<BuildDocumentDataInput, "audience"> = {
  company: {
    legalName: "Quantara Contracting LLC",
    tradeName: "Quantara",
    email: "hello@quantara.example",
    phone: "+971-4-555-0100",
    website: "quantara.example",
    address: "Dubai, UAE",
    taxRegistrationNumber: "100123456700003",
    defaultCurrency: "AED",
  },
  client: {
    name: "Gulf Business Towers",
    companyName: "Gulf Business Towers LLC",
    email: "projects@gulfbt.com",
    phone: "+971-4-555-0200",
    address: "Business Bay, Dubai",
    taxRegistrationNumber: null,
  },
  project: {
    name: "Gulf Towers Fit-Out",
    reference: "GBT-2026-001",
    location: "Dubai, UAE",
    currency: "AED",
    taxRate: 5,
    language: "English",
  },
  industryName: "Construction",
  boq: sampleBoq,
  revisionNumber: 1,
  templateName: "Corporate Technical",
  documentType: "PDF",
  generatedByName: "Test Runner",
  isDraft: false,
};

const style = mergeStyleConfig(DEFAULT_STYLE_CONFIG);
const content = mergeContentConfig(DEFAULT_CONTENT_CONFIG);
const rtlStyle = mergeStyleConfig({ direction: "rtl", coverStyle: "dark" });

describe("buildDocumentData (canonical document data)", () => {
  it("maps company, client, project, and revision fields correctly", () => {
    const data = buildDocumentData({ ...baseInput, audience: "INTERNAL" });
    expect(data.company.legalName).toBe("Quantara Contracting LLC");
    expect(data.client.companyName).toBe("Gulf Business Towers LLC");
    expect(data.project.reference).toBe("GBT-2026-001");
    expect(data.boq.revision).toBe("R01");
    expect(data.boq.revisionNumber).toBe(1);
    expect(data.boq.sections[0].items[0].itemCode).toBe("CON-001");
    expect(data.boq.totals.grandTotal).toBe(10867.5);
  });

  it("shows internal commercial fields for INTERNAL audience", () => {
    const data = buildDocumentData({ ...baseInput, audience: "INTERNAL" });
    expect(data.boq.showInternalFields).toBe(true);
    expect(data.boq.sections[0].items[0].unitCost).toBe(320);
    expect(data.boq.sections[0].items[0].landedCost).toBe(345);
  });

  it("hides internal commercial fields for CLIENT audience by default", () => {
    const data = buildDocumentData({ ...baseInput, audience: "CLIENT" });
    expect(data.boq.showInternalFields).toBe(false);
    expect(data.boq.sections[0].items[0].unitCost).toBeUndefined();
    expect(data.boq.sections[0].items[0].landedCost).toBeUndefined();
    expect(data.boq.sections[0].items[0].marginPercentage).toBeUndefined();
    // Client-facing fields must still be present.
    expect(data.boq.sections[0].items[0].sellingRate).toBe(414);
    expect(data.boq.sections[0].items[0].totalAmount).toBe(10350);
  });

  it("shows internal fields to CLIENT audience when the template explicitly opts in", () => {
    const data = buildDocumentData({ ...baseInput, audience: "CLIENT", showInternalCostFieldsToClient: true });
    expect(data.boq.showInternalFields).toBe(true);
    expect(data.boq.sections[0].items[0].unitCost).toBe(320);
  });
});

describe("CSV generator", () => {
  it("starts with a UTF-8 BOM and escapes commas/quotes correctly", () => {
    const data = buildDocumentData({ ...baseInput, audience: "INTERNAL" });
    const csv = generateCsv(data);
    expect(csv.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(true);
    const text = csv.toString("utf-8");
    expect(text).toContain('"Reinforced footing, ""premium"" grade, includes rebar, ties"');
  });

  it("preserves Arabic text without corruption", () => {
    const data = buildDocumentData({ ...baseInput, audience: "INTERNAL" });
    const text = generateCsv(data).toString("utf-8");
    expect(text).toContain("متطلبات خاصة");
  });

  it("includes internal cost columns for INTERNAL audience and omits them for CLIENT audience", () => {
    const internalCsv = generateCsv(buildDocumentData({ ...baseInput, audience: "INTERNAL" })).toString("utf-8");
    const clientCsv = generateCsv(buildDocumentData({ ...baseInput, audience: "CLIENT" })).toString("utf-8");
    expect(internalCsv).toContain("Unit Cost");
    expect(internalCsv).toContain("Landed Cost");
    expect(clientCsv).not.toContain("Unit Cost");
    expect(clientCsv).not.toContain("Landed Cost");
  });

  it("includes correct totals", () => {
    const text = generateCsv(buildDocumentData({ ...baseInput, audience: "CLIENT" })).toString("utf-8");
    expect(text).toContain("10867.5");
  });
});

describe("XLSX generator", () => {
  it("produces a workbook that opens with correct values, formulas, and totals", async () => {
    const data = buildDocumentData({ ...baseInput, audience: "INTERNAL" });
    const buffer = await generateXlsx(data);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet("BOQ");
    expect(sheet).toBeDefined();

    const headerRow = sheet!.getRow(6).values as unknown[];
    expect(headerRow).toContain("Item Code");
    expect(headerRow).toContain("Unit Cost");

    const itemRow = sheet!.getRow(8).values as unknown[];
    expect(itemRow).toContain("CON-001");

    const totalCell = sheet!.getCell(8, 15);
    expect(String(totalCell.formula)).toMatch(/^F8\*N8$/);
    expect(totalCell.result).toBe(10350);
  });

  it("omits internal cost columns for CLIENT audience", async () => {
    const data = buildDocumentData({ ...baseInput, audience: "CLIENT" });
    const buffer = await generateXlsx(data);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet("BOQ")!;
    const headerRow = sheet.getRow(6).values as unknown[];
    expect(headerRow).not.toContain("Unit Cost");
    expect(headerRow).not.toContain("Landed Cost");
  });
});

describe("PDF generator", () => {
  it("generates a non-empty, valid PDF for a client-audience LTR template", async () => {
    const data = buildDocumentData({ ...baseInput, audience: "CLIENT" });
    const buffer = await generatePdf({ data, style, content });
    expect(buffer.byteLength).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("generates a non-empty, valid PDF for an RTL (Arabic) template without throwing", async () => {
    const data = buildDocumentData({ ...baseInput, audience: "CLIENT", templateName: "Arabic Formal" });
    const buffer = await generatePdf({ data, style: rtlStyle, content });
    expect(buffer.byteLength).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("DOCX generator", () => {
  it("generates a non-empty, valid ZIP/DOCX structure with expected entries", async () => {
    const data = buildDocumentData({ ...baseInput, audience: "INTERNAL" });
    const buffer = await generateDocx({ data, style, content });
    expect(buffer.byteLength).toBeGreaterThan(500);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");

    const zip = await JSZip.loadAsync(buffer);
    expect(Object.keys(zip.files)).toContain("word/document.xml");
    expect(Object.keys(zip.files)).toContain("[Content_Types].xml");
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("CON-001");
    expect(xml).toContain("Grand Total");
  });

  it("sets bidi/RTL formatting for the Arabic template without corrupting the file", async () => {
    const data = buildDocumentData({ ...baseInput, audience: "CLIENT", templateName: "Arabic Formal" });
    const buffer = await generateDocx({ data, style: rtlStyle, content });
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("bidi");
  });
});

describe("HTML generator", () => {
  it("sets dir=rtl for the Arabic template and dir=ltr otherwise", () => {
    const data = buildDocumentData({ ...baseInput, audience: "CLIENT" });
    expect(generateHtml({ data, style, content })).toContain('dir="ltr"');
    expect(generateHtml({ data, style: rtlStyle, content })).toContain('dir="rtl"');
  });

  it("shows a draft badge only when the document is a draft", () => {
    const draftData = buildDocumentData({ ...baseInput, audience: "CLIENT", isDraft: true });
    const finalData = buildDocumentData({ ...baseInput, audience: "CLIENT", isDraft: false });
    expect(generateHtml({ data: draftData, style, content })).toContain('<div class="draft-badge">');
    expect(generateHtml({ data: finalData, style, content })).not.toContain('<div class="draft-badge">');
  });

  it("hides internal-only columns for CLIENT audience", () => {
    const clientData = buildDocumentData({ ...baseInput, audience: "CLIENT" });
    const internalData = buildDocumentData({ ...baseInput, audience: "INTERNAL" });
    expect(generateHtml({ data: clientData, style, content })).not.toContain(">Landed<");
    expect(generateHtml({ data: internalData, style, content })).toContain(">Landed<");
  });
});
