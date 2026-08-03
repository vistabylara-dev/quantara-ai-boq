import { ExtractionEngineType, ExtractionJobStatus } from "@prisma/client";
import { PDFParse } from "pdf-parse";
import { prisma } from "@/lib/db/prisma";
import { extractionJobQueue } from "@/lib/jobs/extraction-worker";
import { localProjectFileStorageAdapter } from "@/lib/storage/local-project-file-storage-adapter";
import { buildStorageKey } from "@/lib/files/file-security";
import { replaceDrawingPagesForFile, type CreateDrawingPageInput } from "@/lib/repositories/drawing-page-repository";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "tif", "tiff"]);

/**
 * Rasterizes a file into one or more viewable DrawingPage images: real page
 * rasterization for PDFs (via pdf-parse's PDFParse.getScreenshot(), backed
 * by pdfjs-dist), and a direct one-page pass-through for standalone image
 * files (already an image — no rasterization needed). Other file types
 * (CSV/XLSX/DOCX/DXF/DWG/IFC) have no visual "page" concept yet and are
 * honestly reported as unsupported rather than faked.
 */
extractionJobQueue.registerHandler(ExtractionEngineType.FILE_PREPROCESSING, async (job, ctx) => {
  const file = await prisma.projectFile.findUniqueOrThrow({ where: { id: job.projectFileId } });
  await ctx.updateProgress(10, "reading file");

  if (IMAGE_EXTENSIONS.has(file.extension)) {
    const pages: CreateDrawingPageInput[] = [{ projectFileId: file.id, pageNumber: 1, imageStorageKey: file.storageKey, processingStatus: "READY" }];
    await replaceDrawingPagesForFile(job.companyId, job.projectFileId, pages);
    return { resultSummary: { pagesCreated: 1 } };
  }

  if (file.extension !== "pdf") {
    return { status: ExtractionJobStatus.NEEDS_REVIEW, resultSummary: { message: `Page rasterization is not supported yet for .${file.extension} files.`, pagesCreated: 0 } };
  }

  const buffer = await localProjectFileStorageAdapter.getObject(file.storageKey);
  const parser = new PDFParse({ data: buffer });
  try {
    await ctx.updateProgress(30, "rasterizing pages");
    const screenshots = await parser.getScreenshot({ imageBuffer: true, imageDataUrl: false, scale: 1.5 });

    const pages: CreateDrawingPageInput[] = [];
    for (const shot of screenshots.pages) {
      const imageKey = buildStorageKey(job.companyId, job.projectId, "pages", `${file.id}-page-${shot.pageNumber}.png`);
      await localProjectFileStorageAdapter.putObject({ key: imageKey, body: Buffer.from(shot.data), contentType: "image/png" });
      pages.push({
        projectFileId: file.id,
        pageNumber: shot.pageNumber,
        width: shot.width,
        height: shot.height,
        dpi: Math.round(72 * shot.scale),
        imageStorageKey: imageKey,
        processingStatus: "READY",
      });
    }

    await ctx.updateProgress(80, "storing pages");
    await replaceDrawingPagesForFile(job.companyId, job.projectFileId, pages);
    return { resultSummary: { pagesCreated: pages.length } };
  } finally {
    await parser.destroy();
  }
});
