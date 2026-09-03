import { createHash } from "node:crypto";
import { ExtractionEngineType, ExtractionJobStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { extractionJobQueue } from "@/lib/jobs/extraction-worker";
import { createStorageAdapter, resolveStorageProvider } from "@/lib/storage/storage-factory";
import type { DocumentStorageAdapter } from "@/lib/storage/document-storage-adapter";
import { buildStorageKey } from "@/lib/files/file-security";
import { replaceDrawingPagesForFile, type CreateDrawingPageInput } from "@/lib/repositories/drawing-page-repository";
import { buildPageTextExtraction } from "@/lib/files/pdf-text-extraction";
import { loadPdfParse } from "@/lib/files/pdf-parse-runtime";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "tif", "tiff"]);

/**
 * Was previously hardcoded to the local-filesystem storage adapter — fine in
 * dev/test, but Vercel's serverless bundle is read-only outside /tmp, so
 * both the source-PDF read and the rendered-page-image writes failed in
 * production. Routed through the same factory drawing-service.ts and
 * project-file-service.ts already use correctly.
 */
let cachedStorageAdapter: DocumentStorageAdapter | null = null;
function getProjectFileStorageAdapter(): DocumentStorageAdapter {
  if (!cachedStorageAdapter) {
    cachedStorageAdapter = createStorageAdapter({ provider: resolveStorageProvider(), purpose: "project-files" });
  }
  return cachedStorageAdapter;
}

async function computeDurableChecksum(storage: DocumentStorageAdapter, storageKey: string): Promise<string> {
  const { body } = await storage.getObjectStream(storageKey);
  const reader = body.getReader();
  const hash = createHash("sha256");
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    hash.update(value);
  }
  return hash.digest("hex");
}

/**
 * Rasterizes a file into one or more viewable DrawingPage images: real page
 * rasterization for PDFs (via pdf-parse's PDFParse.getScreenshot(), backed
 * by pdfjs-dist), and a direct one-page pass-through for standalone image
 * files (already an image — no rasterization needed). Other file types
 * (CSV/XLSX/DOCX/DXF/DWG/IFC) have no visual "page" concept yet and are
 * honestly reported as unsupported rather than faked.
 *
 * For PDFs, also extracts each page's real text layer (pdf-parse's own
 * PDFParse.getText(), the same detector pdf-table-parser.ts relies on) and
 * stores it alongside the page — a page image is only ever marked READY
 * after its bytes are confirmed written to storage.
 */
extractionJobQueue.registerHandler(ExtractionEngineType.FILE_PREPROCESSING, async (job, ctx) => {
  const file = await prisma.projectFile.findUniqueOrThrow({ where: { id: job.projectFileId } });
  await ctx.updateProgress(10, "reading file");
  const storage = getProjectFileStorageAdapter();
  const checksum = await computeDurableChecksum(storage, file.storageKey);
  await prisma.projectFile.update({
    where: { id: file.id },
    data: { checksum },
  });

  if (IMAGE_EXTENSIONS.has(file.extension)) {
    const pages: CreateDrawingPageInput[] = [{ projectFileId: file.id, pageNumber: 1, imageStorageKey: file.storageKey, processingStatus: "READY" }];
    await replaceDrawingPagesForFile(job.companyId, job.projectFileId, pages);
    return { resultSummary: { pagesCreated: 1 } };
  }

  if (file.extension !== "pdf") {
    return { status: ExtractionJobStatus.NEEDS_REVIEW, resultSummary: { message: `Page rasterization is not supported yet for .${file.extension} files.`, pagesCreated: 0 } };
  }

  const buffer = await storage.getObject(file.storageKey);
  const { PDFParse } = await loadPdfParse();
  const parser = new PDFParse({ data: buffer });
  try {
    await ctx.updateProgress(30, "rasterizing pages");
    const screenshots = await parser.getScreenshot({ imageBuffer: true, imageDataUrl: false, scale: 1.5 });

    await ctx.updateProgress(50, "extracting text layer");
    // pageJoiner disabled: its default non-empty marker would make an otherwise-blank
    // page's text non-empty, which would corrupt the honest per-page hasText signal.
    const textResult = await parser.getText({ pageJoiner: "" });
    const textByPage = new Map(textResult.pages.map((page) => [page.num, page.text]));

    const pages: CreateDrawingPageInput[] = [];
    for (const shot of screenshots.pages) {
      const imageKey = buildStorageKey(job.companyId, job.projectId, "pages", `${file.id}-page-${shot.pageNumber}.png`);
      await storage.putObject({
        key: imageKey,
        body: Buffer.from(shot.data),
        contentType: "image/png",
        allowOverwrite: true,
      });
      pages.push({
        projectFileId: file.id,
        pageNumber: shot.pageNumber,
        width: shot.width,
        height: shot.height,
        dpi: Math.round(72 * shot.scale),
        imageStorageKey: imageKey,
        processingStatus: "READY",
        textLayerJson: buildPageTextExtraction(textByPage.get(shot.pageNumber) ?? "", file.id),
      });
    }

    await ctx.updateProgress(80, "storing pages");
    await replaceDrawingPagesForFile(job.companyId, job.projectFileId, pages);
    return { resultSummary: { pagesCreated: pages.length } };
  } finally {
    await parser.destroy();
  }
});
