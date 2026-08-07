import PDFDocument from "pdfkit";
import { PDFParse } from "pdf-parse";
import { describe, expect, it } from "vitest";

function buildMarkerPdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.font("Helvetica").fontSize(14).text("QUANTARA_WORKER_TEST_7291");
    doc.rect(60, 200, 150, 80).stroke();
    doc.end();
  });
}

function buildTwoPagePdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.font("Helvetica").fontSize(14).text("QUANTARA_PAGECOUNT_WORKER_8472 page 1");
    doc.addPage();
    doc.font("Helvetica").fontSize(14).text("QUANTARA_PAGECOUNT_WORKER_8472 page 2");
    doc.end();
  });
}

/**
 * Real runtime proof (no mocked worker loading) that pdfjs-dist's lazy
 * same-thread "fake worker" setup — triggered by any PDFParse method that
 * loads a document — actually resolves and runs. This exercises the exact
 * same code path (PDFParse -> getText/getScreenshot) that crashed on Vercel
 * with `Cannot find module '.../pdf.worker.mjs'`; this test always passes
 * locally regardless of that bug (full node_modules is always present
 * locally), so it doesn't prove the Vercel-specific fix — the staged
 * deployment test does that. What this proves is that the actual
 * PDFParse API usage itself is correct.
 */
describe("pdf-parse PDFParse — worker-dependent operations", () => {
  it("getText() finds the real marker via the actual installed pdfjs-dist worker path", async () => {
    const buffer = await buildMarkerPdf();
    const parser = new PDFParse({ data: buffer });
    try {
      const textResult = await parser.getText({ pageJoiner: "" });
      expect(textResult.text).toContain("QUANTARA_WORKER_TEST_7291");
    } finally {
      await parser.destroy();
    }
  });

  it("getScreenshot() renders a valid, non-empty PNG via the actual installed worker path", async () => {
    const buffer = await buildMarkerPdf();
    const parser = new PDFParse({ data: buffer });
    try {
      const screenshots = await parser.getScreenshot({ imageBuffer: true, imageDataUrl: false, scale: 1.5 });
      expect(screenshots.pages).toHaveLength(1);
      const [page] = screenshots.pages;
      expect(page.data.byteLength).toBeGreaterThan(0);
      const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(Buffer.from(page.data.slice(0, 8)).equals(pngSignature)).toBe(true);
    } finally {
      await parser.destroy();
    }
  });

  /**
   * Same worker-dependent code path as drawing-service.ts's
   * extractPdfPageCount() (PDFParse.getInfo()) — the metadata-only call the
   * normal drawing upload route and the direct-to-Blob finalize route both
   * use for pageCount. Real two-page PDF, no mocked worker loading.
   */
  it("getInfo() reports the real page count via the actual installed worker path", async () => {
    const buffer = await buildTwoPagePdf();
    const parser = new PDFParse({ data: buffer });
    try {
      const info = await parser.getInfo();
      expect(info.total).toBe(2);
    } finally {
      await parser.destroy();
    }
  });
});
