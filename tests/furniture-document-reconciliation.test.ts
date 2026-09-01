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
import { FURNITURE_JOINERY_LINEAR_EDGE_ASSUMPTION_NOTE } from "@/lib/furniture/linear-edge-format";
import {
  furnitureManagedItemCodeForKey,
  JOINERY_INDUSTRY_KEY,
  JOINERY_INDUSTRY_NAME,
} from "@/lib/furniture/types";
import type { BOQ, BOQItem } from "@/types/boq";

const TOKENS = ["PROJECT_RECON", "BOARD_RECON_23", "HARDWARE_RECON_47", "CUT_RECON_209", "VERIFY_EDGE_93_040"];
const EVIDENCE_TOKEN = "CELL_EVIDENCE_B2";

function item(index: number, token: string, quantity: number, unit: string): BOQItem {
  const managedMarker = `[FJC_MANAGED_V1:${encodeURIComponent(token)}]`;
  return {
    id: `item-${index}`,
    itemNumber: index,
    itemCode: furnitureManagedItemCodeForKey(token),
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
    sourceReference: `${managedMarker} Madam_Juli_BOQ_Cutting_List.xlsx · Cutting List · row ${index}`,
    roomOrZone: index === 4 ? "Kitchen" : "All rooms",
    drawingReference: `F-${index}`,
    confidenceScore: index === 5 ? 72 : 100,
    status: "confirmed",
    notes: `${managedMarker} ${EVIDENCE_TOKEN}; Source cells: 'Cutting List'!B${index}:N${index}`,
    options: [],
  };
}

const itemsByCode = new Map([
  ["PRJ", [item(1, TOKENS[0], 1, "project")]],
  ["BRD", [item(2, TOKENS[1], 23, "sheets")]],
  ["HWA", [
    item(3, TOKENS[2], 47, "pcs"),
    {
      ...item(6, "Front-edge banding length", 93.04, "lm"),
      itemCode: furnitureManagedItemCodeForKey("order:HARDWARE:edge-banding:front"),
      category: "HARDWARE",
      specification: FURNITURE_JOINERY_LINEAR_EDGE_ASSUMPTION_NOTE,
      sourceReference: `[FJC_MANAGED_V1:${encodeURIComponent("order:HARDWARE:edge-banding:front")}] Madam_Juli_BOQ_Cutting_List.xlsx · Cutting List · row 6`,
      notes: `[FJC_MANAGED_V1:${encodeURIComponent("order:HARDWARE:edge-banding:front")}] ${FURNITURE_JOINERY_LINEAR_EDGE_ASSUMPTION_NOTE}`,
    },
  ]],
  ["CUT", [item(4, TOKENS[3], 209, "pcs")]],
  ["VER", [item(5, TOKENS[4], 1, "verification")]],
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
    industryName: JOINERY_INDUSTRY_NAME,
    industryKey: JOINERY_INDUSTRY_KEY,
  });
}

const style = mergeStyleConfig(DEFAULT_STYLE_CONFIG);
// Furniture evidence remains mandatory even when a generic template hides
// its specification column.
const content = mergeContentConfig({ ...DEFAULT_CONTENT_CONFIG, columns: { specification: false } });

function expectReconciliationText(text: string, expectRenderedEdgeQuantity = true): void {
  const normalizedWhitespace = text.replace(/\s+/g, " ");
  for (const token of TOKENS) expect(text).toContain(token);
  // PDF text extraction may insert whitespace at visual wrap points inside a
  // long audit token; compare the same characters after whitespace removal.
  expect(text.replace(/\s/g, "")).toContain(EVIDENCE_TOKEN);
  expect(text).toContain("Furniture Test Company LLC");
  if (expectRenderedEdgeQuantity) expect(text).toContain("93.040");
  expect(normalizedWhitespace).toContain("Editable assumption");
  expect(normalizedWhitespace).toContain("Requires professional verification");
  expect(normalizedWhitespace).toContain("selected-edge interpretation");
}

describe("Furniture canonical document reconciliation", () => {
  it("activates only for the existing Joinery key and normalizes all five sections once", () => {
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
      industryName: JOINERY_INDUSTRY_NAME,
      industryKey: JOINERY_INDUSTRY_KEY,
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
    expectReconciliationText(text, false);
    const edgeRow = Array.from({ length: sheet.rowCount }, (_, index) => sheet.getRow(index + 1))
      .find((row) => row.getCell(4).value === "Front-edge banding length");
    expect(edgeRow?.getCell(6).value).toBe(93.04);
    expect(edgeRow?.getCell(6).numFmt).toBe("0.000");
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

  it("keeps locked legacy Joinery BOQs downloadable when an old section code overlaps the canonical layout", async () => {
    const legacyToken = "LEGACY_LOCKED_JOINERY_ROW";
    const legacyItem = {
      ...item(7, legacyToken, 2, "item"),
      itemCode: "LEGACY-JOINERY-7",
      sourceReference: "Legacy joinery BOQ",
      notes: "Preserved locked manual row",
    };
    const legacyBoq: BOQ = {
      ...furnitureBoq,
      id: "boq-legacy-joinery",
      title: "Legacy locked Joinery BOQ",
      sections: [{
        id: "legacy-section-prj",
        code: "PRJ",
        title: "Legacy Joinery Items",
        description: "Pre-specialized Joinery layout",
        order: 1,
        items: [legacyItem],
      }],
    };
    const data = buildDocumentData({
      ...baseInput,
      boq: legacyBoq,
      industryName: JOINERY_INDUSTRY_NAME,
      industryKey: JOINERY_INDUSTRY_KEY,
    });

    expect(data.furniture).toBeUndefined();
    expect(generateHtml({ data, style, content })).toContain(legacyToken);

    const docx = await generateDocx({ data, style, content });
    const docxZip = await JSZip.loadAsync(docx);
    expect(await docxZip.file("word/document.xml")!.async("string")).toContain(legacyToken);

    const xlsx = await generateXlsx(data);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsx);
    const sheetText = Array.from({ length: workbook.getWorksheet("BOQ")!.rowCount }, (_, index) =>
      (workbook.getWorksheet("BOQ")!.getRow(index + 1).values as unknown[]).join(" | ")).join("\n");
    expect(sheetText).toContain(legacyToken);

    const pdf = await generatePdf({ data, style, content });
    const parser = new PDFParse({ data: pdf });
    try {
      expect((await parser.getText({ pageJoiner: "\n" })).text).toContain(legacyToken);
    } finally {
      await parser.destroy();
    }
  });

  it("does not classify an unmarked legacy five-code layout as managed Joinery output", () => {
    const legacySections = FURNITURE_CANONICAL_SECTIONS.map((definition, index) => ({
      id: `legacy-five-${definition.code}`,
      code: definition.code,
      title: `Legacy ${definition.code}`,
      description: "Unmanaged legacy section",
      order: index + 1,
      items: [{
        ...item(index + 20, `LEGACY_FIVE_${definition.code}`, 1, "item"),
        itemCode: `LEGACY-${definition.code}`,
        sourceReference: "Legacy source",
        notes: "Legacy manual note",
      }],
    }));
    const legacyExtraToken = "LEGACY_EXTRA_SECTION_ROW";
    const data = buildDocumentData({
      ...baseInput,
      boq: {
        ...furnitureBoq,
        id: "boq-legacy-five-code",
        sections: [
          ...legacySections,
          {
            id: "legacy-extra-section",
            code: "OLD",
            title: "Legacy Extra Section",
            description: "Preserved legacy manual rows",
            order: 6,
            items: [{
              ...item(30, legacyExtraToken, 1, "item"),
              itemCode: "LEGACY-OLD-30",
              sourceReference: "Legacy source",
              notes: "Legacy manual note",
            }],
          },
        ],
      },
      industryName: JOINERY_INDUSTRY_NAME,
      industryKey: JOINERY_INDUSTRY_KEY,
    });

    expect(data.furniture).toBeUndefined();
    expect(data.boq.sections).toHaveLength(6);
    expect(generateHtml({ data, style, content })).toContain(legacyExtraToken);
  });

  it("keeps preserved noncanonical manual rows visible inside the five-section managed output", async () => {
    const manualToken = "PRESERVED_LEGACY_MANUAL_ROW";
    const manualItem = {
      ...item(31, manualToken, 3, "item"),
      itemCode: "LEGACY-MANUAL-31",
      sourceReference: "Legacy manual source",
      notes: "Preserved manual Joinery scope",
    };
    const mixedBoq: BOQ = {
      ...furnitureBoq,
      id: "boq-managed-with-legacy-manual",
      sections: [
        ...furnitureBoq.sections,
        {
          id: "legacy-manual-section",
          code: "OLD",
          title: "Legacy Manual Joinery",
          description: "Preserved during managed regeneration",
          order: 6,
          items: [manualItem],
        },
      ],
    };
    const data = buildDocumentData({
      ...baseInput,
      boq: mixedBoq,
      industryName: JOINERY_INDUSTRY_NAME,
      industryKey: JOINERY_INDUSTRY_KEY,
    });

    expect(data.furniture?.sections).toHaveLength(5);
    expect(data.furniture?.sections.find((section) => section.code === "VER")?.items)
      .toContainEqual(expect.objectContaining({ itemCode: "LEGACY-MANUAL-31", description: manualToken }));
    expect(generateHtml({ data, style, content })).toContain(manualToken);

    const docx = await generateDocx({ data, style, content });
    const docxZip = await JSZip.loadAsync(docx);
    expect(await docxZip.file("word/document.xml")!.async("string")).toContain(manualToken);

    const xlsx = await generateXlsx(data);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsx);
    const sheetText = Array.from({ length: workbook.getWorksheet("BOQ")!.rowCount }, (_, index) =>
      (workbook.getWorksheet("BOQ")!.getRow(index + 1).values as unknown[]).join(" | ")).join("\n");
    expect(sheetText).toContain(manualToken);

    const pdf = await generatePdf({ data, style, content });
    const parser = new PDFParse({ data: pdf });
    try {
      expect((await parser.getText({ pageJoiner: "\n" })).text.replace(/\s/g, "")).toContain(manualToken);
    } finally {
      await parser.destroy();
    }
  });
});
