import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PDFParse } from "pdf-parse";
import { describe, expect, it } from "vitest";
import {
  buildDocumentData,
  type BuildDocumentDataInput,
} from "@/lib/documents/build-document-data";
import { generateDocx } from "@/lib/documents/generators/docx-generator";
import { generateHtml } from "@/lib/documents/generators/html-generator";
import { generatePdf } from "@/lib/documents/generators/pdf-generator";
import { generateXlsx } from "@/lib/documents/generators/xlsx-generator";
import {
  DEFAULT_CONTENT_CONFIG,
  DEFAULT_STYLE_CONFIG,
  mergeContentConfig,
  mergeStyleConfig,
} from "@/lib/documents/template-config";
import {
  FURNITURE_CANONICAL_OUTPUT_VERSION,
  FURNITURE_CANONICAL_SECTIONS,
} from "@/lib/furniture/canonical-output";
import { FURNITURE_JOINERY_INDUSTRY_KEY, FURNITURE_JOINERY_INDUSTRY_NAME } from "@/lib/furniture/types";
import type { BOQ, BOQItem } from "@/types/boq";

const TOKENS = ["PROJECT_RECON", "BOARD_RECON_23", "HARDWARE_RECON_47", "CUT_RECON_209", "VERIFY_EDGE_93_040"];
const EVIDENCE_TOKEN = "CELL_EVIDENCE_B2";

function item(index: number, token: string, quantity: number, unit: string): BOQItem {
  return {
    id: `item-${index}`,
    itemNumber: index,
    itemCode: `FJC-${index}`,
    category: index === 2 ? "BOARD" : index === 3 ? "HARDWARE" : "CUTTING_LIST",
    description: token,
    specification: index === 2 ? "18 mm melamine; 10% wastage; 23 sheets" : `${token} verified specification`,
    quantity,
    unit,
    unitCost: 1,
    landedCost: 1,
    marginPercentage: 0,
    sellingRate: 1,
    totalAmount: quantity,
    wastagePercentage: index === 2 ? 10 : 0,
    taxApplicable: true,
    sourceReference: `[FJC_MANAGED_V1:${encodeURIComponent(token)}] Madam_Juli_BOQ_Cutting_List.xlsx · Cutting List · row ${index}`,
    roomOrZone: index === 4 ? "Kitchen" : "All rooms",
    drawingReference: `F-${index}`,
    confidenceScore: index === 5 ? 72 : 100,
    status: "confirmed",
    notes: `${EVIDENCE_TOKEN}; Source cells: 'Cutting List'!B${index}:N${index}`,
    options: [],
  };
}

const itemsByCode = new Map([
  ["PRJ", [item(1, TOKENS[0], 1, "project")]],
  ["BRD", [item(2, TOKENS[1], 23, "sheets")]],
  ["HWA", [item(3, TOKENS[2], 47, "pcs")]],
  ["CUT", [item(4, TOKENS[3], 209, "pcs")]],
  ["VER", [item(5, TOKENS[4], 93.04, "lm")]],
]);

const furnitureBoq: BOQ = {
  id: "boq-furniture-doc",
  projectId: "project-furniture-doc",
  title: "Furniture Reconciliation BOQ",
  revision: "R01",
  status: "locked",
  isLocked: true,
  createdAt: "2026-08-31T00:00:00.000Z",
  lockedAt: "2026-08-31T00:30:00.000Z",
  sections: FURNITURE_CANONICAL_SECTIONS.map((section, index) => ({
    id: `section-${section.code}`,
    code: section.code,
    // Deliberately stale labels prove the document normalizer uses the one
    // canonical definition rather than trusting format-specific labels.
    title: `stale-${section.code}`,
    description: "stale description",
    order: index + 1,
    items: itemsByCode.get(section.code) ?? [],
  })),
  totals: {
    directCost: 373.04,
    landedCost: 373.04,
    grossProfit: 0,
    grossMarginPercentage: 0,
    subtotal: 373.04,
    discountPercentage: 0,
    discountAmount: 0,
    taxableAmount: 373.04,
    taxAmount: 18.652,
    grandTotal: 391.692,
  },
};

const baseInput: Omit<BuildDocumentDataInput, "boq" | "industryName" | "industryKey"> = {
  company: {
    legalName: "Furniture Test Company LLC",
    tradeName: "Furniture Test Company",
    email: "documents@furniture-test.example",
    phone: "+971-4-555-0100",
    website: "furniture-test.example",
    address: "Dubai, UAE",
    taxRegistrationNumber: "100000000000003",
    defaultCurrency: "AED",
  },
  client: { name: "Controlled Client", companyName: "Controlled Client LLC" },
  project: {
    name: "Madam Juli Furniture",
    reference: "FJC-DOC-001",
    location: "Dubai, UAE",
    currency: "AED",
    taxRate: 5,
    language: "English",
  },
  revisionNumber: 1,
  audience: "CLIENT",
  templateName: "Furniture Technical",
  documentType: "PDF",
  generatedByName: "Controlled Test Owner",
  generatedAt: new Date("2026-08-31T01:00:00.000Z"),
  isDraft: false,
};

function furnitureData() {
  return buildDocumentData({
    ...baseInput,
    boq: furnitureBoq,
    industryName: FURNITURE_JOINERY_INDUSTRY_NAME,
    industryKey: FURNITURE_JOINERY_INDUSTRY_KEY,
  });
}

const style = mergeStyleConfig(DEFAULT_STYLE_CONFIG);
// Furniture evidence remains mandatory even when a generic template hides
// its specification column.
const content = mergeContentConfig({ ...DEFAULT_CONTENT_CONFIG, columns: { specification: false } });

function expectReconciliationText(text: string): void {
  for (const token of TOKENS) expect(text).toContain(token);
  // PDF text extraction may insert whitespace at visual wrap points inside a
  // long audit token; compare the same characters after whitespace removal.
  expect(text.replace(/\s/g, "")).toContain(EVIDENCE_TOKEN);
  expect(text).toContain("Furniture Test Company LLC");
}

describe("Furniture canonical document reconciliation", () => {
  it("activates only for the exact combined-industry key and normalizes all five sections once", () => {
    const data = furnitureData();
    expect(data.furniture?.outputVersion).toBe(FURNITURE_CANONICAL_OUTPUT_VERSION);
    expect(data.furniture?.sections.map(({ code, title }) => ({ code, title }))).toEqual(
      FURNITURE_CANONICAL_SECTIONS.map(({ code, title }) => ({ code, title })),
    );

    const existingIndustry = buildDocumentData({
      ...baseInput,
      boq: furnitureBoq,
      industryName: "Construction",
      industryKey: "construction",
    });
    expect(existingIndustry.furniture).toBeUndefined();
    expect(existingIndustry.boq.sections[0]?.title).toBe("stale-PRJ");
  });

  it("fails closed when an exact-industry BOQ is missing a canonical section", () => {
    expect(() => buildDocumentData({
      ...baseInput,
      boq: { ...furnitureBoq, sections: furnitureBoq.sections.filter((section) => section.code !== "VER") },
      industryName: FURNITURE_JOINERY_INDUSTRY_NAME,
      industryKey: FURNITURE_JOINERY_INDUSTRY_KEY,
    })).toThrow("missing canonical section VER");
  });

  it("renders the same canonical values, evidence, and five titles in HTML", () => {
    const html = generateHtml({ data: furnitureData(), style, content });
    expectReconciliationText(html);
    for (const section of FURNITURE_CANONICAL_SECTIONS) {
      expect(html).toContain(section.title.replace("&", "&amp;"));
    }
    expect(html).toContain("Specification / Evidence");
    expect(html).not.toContain("FJC_MANAGED_V1");
  });

  it("renders the same canonical values, evidence, and five titles in DOCX", async () => {
    const buffer = await generateDocx({ data: furnitureData(), style, content });
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")!.async("string");
    expectReconciliationText(xml);
    for (const section of FURNITURE_CANONICAL_SECTIONS) {
      expect(xml).toContain(section.title.replace("&", "&amp;"));
    }
    expect(xml).toContain("Specification / Evidence");
    expect(xml).not.toContain("FJC_MANAGED_V1");
  });

  it("renders the same canonical values, evidence, and five titles in XLSX", async () => {
    const buffer = await generateXlsx(furnitureData());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet("BOQ")!;
    const allValues = Array.from({ length: sheet.rowCount }, (_, index) =>
      (sheet.getRow(index + 1).values as unknown[]).filter((value) => value !== undefined).join(" | "),
    );
    const text = allValues.join("\n");
    expectReconciliationText(text);
    expect(allValues.filter((line) => FURNITURE_CANONICAL_SECTIONS.some((section) => line.includes(`${section.code} — ${section.title}`)))).toHaveLength(5);
    expect(text).not.toContain("FJC_MANAGED_V1");
  });

  it("renders the same canonical values, evidence, and five titles in PDF", async () => {
    const buffer = await generatePdf({ data: furnitureData(), style, content });
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText({ pageJoiner: "\n" });
      expectReconciliationText(result.text);
      for (const section of FURNITURE_CANONICAL_SECTIONS) {
        expect(result.text).toContain(section.title);
      }
      expect(result.text.replace(/\s/g, "")).toContain("Specification/Evidence");
      expect(result.text).not.toContain("FJC_MANAGED_V1");
    } finally {
      await parser.destroy();
    }
  });
});
