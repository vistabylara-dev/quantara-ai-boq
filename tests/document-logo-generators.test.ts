import ExcelJS from "exceljs";
import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";

const logoMocks = vi.hoisted(() => ({ loadLogoImage: vi.fn() }));

vi.mock("@/lib/documents/logo-image", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/documents/logo-image")>();
  return { ...actual, loadLogoImage: logoMocks.loadLogoImage };
});

import { generateDocx } from "@/lib/documents/generators/docx-generator";
import { generatePdf } from "@/lib/documents/generators/pdf-generator";
import { generateXlsx } from "@/lib/documents/generators/xlsx-generator";
import { buildSampleDocumentData } from "@/lib/documents/sample-document-data";
import { DEFAULT_CONTENT_CONFIG, DEFAULT_STYLE_CONFIG, mergeContentConfig, mergeStyleConfig } from "@/lib/documents/template-config";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const logo = { buffer: tinyPng, format: "png" as const, width: 1, height: 1 };
const style = mergeStyleConfig(DEFAULT_STYLE_CONFIG);
const content = mergeContentConfig(DEFAULT_CONTENT_CONFIG);

function brandedData() {
  const data = buildSampleDocumentData({ templateName: "Branding Test", documentType: "PDF" });
  return { ...data, company: { ...data.company, logoUrl: "https://assets.quantara.ai/logo.png" } };
}

describe("binary document logo embedding", () => {
  afterEach(() => {
    logoMocks.loadLogoImage.mockReset();
  });

  it("embeds validated logo bytes in DOCX, XLSX and PDF outputs", async () => {
    logoMocks.loadLogoImage.mockResolvedValue(logo);
    const data = brandedData();

    const docx = await generateDocx({ data, style, content });
    const docxZip = await JSZip.loadAsync(docx);
    expect(Object.keys(docxZip.files).some((name) => name.startsWith("word/media/"))).toBe(true);

    const xlsx = await generateXlsx(data);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsx);
    expect(workbook.getWorksheet("BOQ")?.getImages()).toHaveLength(1);

    const pdf = await generatePdf({ data, style, content });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1")).toContain("/Subtype /Image");
    expect(logoMocks.loadLogoImage).toHaveBeenCalledTimes(3);
  });

  it("keeps all binary formats available when validation omits the logo", async () => {
    logoMocks.loadLogoImage.mockResolvedValue(null);
    const data = brandedData();

    expect((await generateDocx({ data, style, content })).subarray(0, 2).toString()).toBe("PK");
    expect((await generateXlsx(data)).subarray(0, 2).toString()).toBe("PK");
    expect((await generatePdf({ data, style, content })).subarray(0, 5).toString()).toBe("%PDF-");
  });
});
