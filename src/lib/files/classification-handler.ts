import { ExtractionEngineType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { extractionJobQueue } from "@/lib/jobs/extraction-worker";
import { applyAutoClassification } from "@/lib/repositories/project-file-repository";
import { classifyProjectFile } from "./file-classifier";

/**
 * Registers the DOCUMENT_CLASSIFICATION handler on the shared queue
 * singleton. Imported (for its side effect) by register-handlers.ts, which
 * every route that can trigger job processing imports first — this file
 * itself does no work at import time beyond the registerHandler call.
 */
extractionJobQueue.registerHandler(ExtractionEngineType.DOCUMENT_CLASSIFICATION, async (job, ctx) => {
  const file = await prisma.projectFile.findUniqueOrThrow({
    where: { id: job.projectFileId },
    include: { drawingPages: { orderBy: { pageNumber: "asc" }, select: { textLayerJson: true } } },
  });
  await ctx.updateProgress(30, "analyzing rendered drawing content");

  const contentText = file.drawingPages.flatMap((page) => {
    const value = page.textLayerJson;
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const text = (value as Record<string, unknown>).text;
    return typeof text === "string" && text.trim() ? [text] : [];
  }).join("\n");

  const suggestion = classifyProjectFile({
    originalName: file.originalName,
    mimeType: file.mimeType,
    extension: file.extension,
    contentText,
  });

  await ctx.updateProgress(80, "recording classification result");
  await applyAutoClassification(job.companyId, job.projectFileId, suggestion);

  return { resultSummary: { classification: suggestion.classification, confidence: suggestion.confidence, matchedSignals: suggestion.matchedSignals } };
});
