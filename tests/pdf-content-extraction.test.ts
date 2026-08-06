import { deflateSync } from "node:zlib";
import PDFDocument from "pdfkit";
import { ExtractionEngineType, ExtractionJobStatus, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { uploadProjectFile } from "../src/lib/services/project-file-service";
import { triggerFilePreprocessing, listPagesForFile, getDrawingPageImage } from "../src/lib/services/drawing-page-service";
import { classifyPdfContent, buildPageTextExtraction, normalizeExtractedText, OCR_IMPLEMENTATION_STATUS } from "../src/lib/files/pdf-text-extraction";
import "../src/lib/jobs/register-handlers";
import type { CurrentActor } from "../src/lib/auth/current-actor";

const RUN_ID = Date.now();
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 8000, intervalMs = 20): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("waitFor: condition not met within timeout");
}

/** Standard PNG CRC32 (polynomial 0xEDB88320) — no runtime `zlib.crc32` dependency, since its TypeScript types are not available across the Node/TS versions this repo targets. */
const CRC32_TABLE: number[] = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** A minimal, real, valid single-color PNG — no canvas/text-rendering dependency needed since the point is a genuine raster (non-text-operator) page, not legible glyphs (this codebase has no OCR to recover glyphs from anyway). */
function buildSolidRgbPng(width: number, height: number, rgb: [number, number, number]): Buffer {
  function chunk(type: string, data: Buffer): Buffer {
    const typeBuf = Buffer.from(type, "ascii");
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowBytes = 1 + width * 3;
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * rowBytes;
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < width; x += 1) {
      const offset = rowStart + 1 + x * 3;
      raw[offset] = rgb[0];
      raw[offset + 1] = rgb[1];
      raw[offset + 2] = rgb[2];
    }
  }
  const idat = deflateSync(raw);

  return Buffer.concat([PNG_SIGNATURE, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function pdfFromDoc(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    build(doc);
    doc.end();
  });
}

/** Test A fixture — real text + simple vector geometry on 2 pages. */
function buildTextVectorPdf(): Promise<Buffer> {
  return pdfFromDoc((doc) => {
    doc.font("Helvetica").fontSize(12);
    doc.text("QUANTARA_TEXT_TEST_4729");
    doc.text("Drawing No: MEP-TEST-001");
    doc.text("Supply Air Fan SAF-01");
    doc.text("Airflow 2500 CFM");
    doc.text("Scale 1:100");
    doc.rect(60, 300, 200, 100).stroke();
    doc.moveTo(60, 450).lineTo(260, 450).stroke();
    doc.moveTo(60, 470).lineTo(260, 470).stroke();
    doc.circle(150, 550, 20).stroke();

    doc.addPage();
    doc.text("QUANTARA_TEXT_TEST_PAGE_2");
    doc.text("Duct 600 x 400 mm");
    doc.text("Diffuser D-01");
    doc.text("Quantity 4");
    doc.rect(60, 300, 150, 80).stroke();
    doc.circle(200, 500, 15).stroke();
  });
}

/** Test B fixture — a page with zero text-showing operators, only a raster image: genuinely no PDF text layer, exactly what pdf-parse's own getText() detects as absent. */
function buildScannedPdf(): Promise<Buffer> {
  const png = buildSolidRgbPng(40, 40, [12, 200, 90]);
  return pdfFromDoc((doc) => {
    doc.image(png, 60, 60, { width: 300, height: 300 });
  });
}

/** Test C fixture — page 1 real text, page 2 image-only. */
function buildMixedPdf(): Promise<Buffer> {
  const png = buildSolidRgbPng(40, 40, [200, 30, 30]);
  return pdfFromDoc((doc) => {
    doc.font("Helvetica").fontSize(12).text("QUANTARA_MIXED_TEST_PAGE_1");
    doc.rect(60, 200, 100, 60).stroke();
    doc.addPage();
    doc.image(png, 60, 60, { width: 300, height: 300 });
  });
}

describe("PDF drawing page rasterization + text extraction (unit, pure functions)", () => {
  it("normalizeExtractedText collapses whitespace and trims", () => {
    expect(normalizeExtractedText("  Hello\n\n  World  \t")).toBe("Hello World");
  });

  it("buildPageTextExtraction reports OCR_REQUIRED for empty text and NOT_APPLICABLE for real text", () => {
    const withText = buildPageTextExtraction("Some real text", "file-1");
    expect(withText.hasText).toBe(true);
    expect(withText.ocrStatus).toBe("NOT_APPLICABLE");
    expect(withText.characterCount).toBe("Some real text".length);

    const withoutText = buildPageTextExtraction("   \n  ", "file-1");
    expect(withoutText.hasText).toBe(false);
    expect(withoutText.ocrStatus).toBe("OCR_REQUIRED");
    expect(withoutText.text).toBe("   \n  ");
    expect(withoutText.normalizedText).toBe("");
  });

  it("classifyPdfContent derives TEXT_LAYER / SCANNED_IMAGE / MIXED / UNKNOWN honestly from per-page hasText", () => {
    expect(classifyPdfContent([])).toBe("UNKNOWN");
    expect(classifyPdfContent([{ hasText: true }, { hasText: true }])).toBe("TEXT_LAYER");
    expect(classifyPdfContent([{ hasText: false }, { hasText: false }])).toBe("SCANNED_IMAGE");
    expect(classifyPdfContent([{ hasText: true }, { hasText: false }])).toBe("MIXED");
  });

  it("asserts, as a real code fact (not a claim), that OCR is not implemented in this codebase", () => {
    expect(OCR_IMPLEMENTATION_STATUS).toBe("NOT_IMPLEMENTED");
  });
});

describe("PDF drawing page rasterization + text extraction (integration, real Postgres + real PDFs)", () => {
  let companyId: string;
  let projectId: string;
  let ownerActor: CurrentActor;
  const cleanupCompanyIds: string[] = [];

  beforeAll(async () => {
    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    const company = await prisma.company.create({ data: { legalName: `PDF Extraction Co ${RUN_ID}`, tradeName: "PDF Extraction", email: `pdf-extraction-${RUN_ID}@example.com` } });
    companyId = company.id;
    cleanupCompanyIds.push(companyId);
    await prisma.companyIndustryEngine.create({ data: { companyId, industryEngineId: construction.id, enabled: true } });
    const client = await createClient(companyId, { name: "Client PDFX", email: `pdf-extraction-client-${RUN_ID}@example.com` });

    const ownerUser = await prisma.user.create({ data: { companyId, email: `pdf-extraction-owner-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Owner PDFX", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() } });
    ownerActor = { userId: ownerUser.id, companyId, role: UserRole.COMPANY_OWNER, fullName: "Owner PDFX", email: ownerUser.email };

    const { project } = await createProjectWithDefaultBoq(ownerActor, {
      clientId: client.id, industryEngineId: "construction", reference: `PDFX-${RUN_ID}`, name: "PDF Extraction Project",
      location: "Dubai", currency: "AED", taxRate: "5", language: "English",
    });
    projectId = project.databaseId;
  });

  afterAll(async () => {
    for (const id of cleanupCompanyIds) {
      await prisma.drawingPage.deleteMany({ where: { companyId: id } });
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

  async function runPreprocessing(buffer: Buffer, originalName: string) {
    const uploaded = await uploadProjectFile(ownerActor, projectId, { originalName, mimeType: "application/pdf", buffer });
    const job = await triggerFilePreprocessing(ownerActor, uploaded.file.id);
    await waitFor(async () => {
      const current = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
      return current.status === ExtractionJobStatus.COMPLETED || current.status === ExtractionJobStatus.FAILED;
    });
    const finalJob = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(finalJob.engineType).toBe(ExtractionEngineType.FILE_PREPROCESSING);
    expect(finalJob.status).toBe(ExtractionJobStatus.COMPLETED);
    return uploaded.file.id;
  }

  it("Test A — text/vector PDF: 2 pages, real per-page text, correct page association, PNG images that survive readback, TEXT_LAYER classification", async () => {
    const buffer = await buildTextVectorPdf();
    const fileId = await runPreprocessing(buffer, "mep-drawing.pdf");

    const first = await listPagesForFile(ownerActor, fileId);
    expect(first.pages).toHaveLength(2);
    expect(first.classification).toBe("TEXT_LAYER");
    expect(first.ocrStatus).toBe("NOT_IMPLEMENTED");

    const [page1, page2] = first.pages;
    expect(page1.pageNumber).toBe(1);
    expect(page2.pageNumber).toBe(2);
    expect(page1.processingStatus).toBe("READY");
    expect(page2.processingStatus).toBe("READY");
    expect(page1.hasImage).toBe(true);
    expect(page2.hasImage).toBe(true);

    // Real text extracted, correctly associated with its own page — never bled across pages, never invented.
    expect(page1.hasText).toBe(true);
    expect(page1.text).toContain("QUANTARA_TEXT_TEST_4729");
    expect(page1.text).toContain("Supply Air Fan SAF-01");
    expect(page1.text).not.toContain("QUANTARA_TEXT_TEST_PAGE_2");
    expect(page1.extractionMethod).toBe("pdf-text-layer");
    expect(page1.ocrStatus).toBe("NOT_APPLICABLE");

    expect(page2.hasText).toBe(true);
    expect(page2.text).toContain("QUANTARA_TEXT_TEST_PAGE_2");
    expect(page2.text).toContain("Diffuser D-01");
    expect(page2.text).not.toContain("QUANTARA_TEXT_TEST_4729");

    // Rendered page images: real PNGs, retrievable through the application-mediated read path, twice (readback survives reload).
    for (const page of first.pages) {
      const image1 = await getDrawingPageImage(ownerActor, page.id);
      expect(image1.mimeType).toBe("image/png");
      expect(image1.buffer.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
      expect(image1.buffer.length).toBeGreaterThan(0);

      const image2 = await getDrawingPageImage(ownerActor, page.id);
      expect(image2.buffer.equals(image1.buffer)).toBe(true);
    }

    // Retrievable again on a fresh list call ("after refresh").
    const second = await listPagesForFile(ownerActor, fileId);
    expect(second.pages).toHaveLength(2);
    expect(second.classification).toBe("TEXT_LAYER");
    expect(second.pages[0].text).toBe(page1.text);
    expect(second.pages[1].text).toBe(page2.text);
  });

  it("Test B — scanned/image-only PDF: page renders and persists, no fabricated text, SCANNED_IMAGE classification, OCR_REQUIRED", async () => {
    const buffer = await buildScannedPdf();
    const fileId = await runPreprocessing(buffer, "scanned-drawing.pdf");

    const result = await listPagesForFile(ownerActor, fileId);
    expect(result.pages).toHaveLength(1);
    expect(result.classification).toBe("SCANNED_IMAGE");
    expect(result.ocrStatus).toBe("NOT_IMPLEMENTED");

    const [page] = result.pages;
    expect(page.processingStatus).toBe("READY");
    expect(page.hasImage).toBe(true);
    expect(page.hasText).toBe(false);
    expect(page.text).toBe("");
    expect(page.normalizedText).toBe("");
    expect(page.characterCount).toBe(0);
    expect(page.ocrStatus).toBe("OCR_REQUIRED");

    const image = await getDrawingPageImage(ownerActor, page.id);
    expect(image.buffer.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    expect(image.buffer.length).toBeGreaterThan(0);
  });

  it("Test C — mixed PDF: one text page, one image-only page, classification MIXED", async () => {
    const buffer = await buildMixedPdf();
    const fileId = await runPreprocessing(buffer, "mixed-drawing.pdf");

    const result = await listPagesForFile(ownerActor, fileId);
    expect(result.pages).toHaveLength(2);
    expect(result.classification).toBe("MIXED");

    const [page1, page2] = result.pages;
    expect(page1.hasText).toBe(true);
    expect(page1.text).toContain("QUANTARA_MIXED_TEST_PAGE_1");
    expect(page2.hasText).toBe(false);
    expect(page2.text).toBe("");
    expect(page2.ocrStatus).toBe("OCR_REQUIRED");
  });
});
