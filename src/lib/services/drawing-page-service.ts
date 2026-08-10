import { ExtractionEngineType } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { getProjectFileRecord } from "@/lib/repositories/project-file-repository";
import { getDrawingPageRecord, listDrawingPages, toDrawingPageDTO } from "@/lib/repositories/drawing-page-repository";
import { toExtractionJobDTO } from "@/lib/repositories/extraction-job-repository";
import { createStorageAdapter, resolveStorageProvider } from "@/lib/storage/storage-factory";
import type { DocumentStorageAdapter } from "@/lib/storage/document-storage-adapter";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { classifyPdfContent, OCR_IMPLEMENTATION_STATUS } from "@/lib/files/pdf-text-extraction";
import { extractionJobQueue } from "@/lib/jobs/extraction-worker";
import { AppError } from "@/lib/errors/app-error";
import { getSourceProcessingCapability } from "@/lib/files/source-processing-capability";

/** Was hardcoded to the local-filesystem adapter — see preprocessing-handler.ts for the same production fix. */
let cachedStorageAdapter: DocumentStorageAdapter | null = null;
function getProjectFileStorageAdapter(): DocumentStorageAdapter {
  if (!cachedStorageAdapter) {
    cachedStorageAdapter = createStorageAdapter({ provider: resolveStorageProvider(), purpose: "project-files" });
  }
  return cachedStorageAdapter;
}

export async function triggerFilePreprocessing(actor: CurrentActor, fileId: string) {
  requireCapability(actor, "files:manage");

  // Register the complete handler composition before dispatch so the singleton queue
  // has every supported handler even when processing crosses a request/module boundary.
  await import("@/lib/jobs/register-handlers");
  const file = await getProjectFileRecord(actor.companyId, fileId);
  const capability = getSourceProcessingCapability(file.extension);
  if (!capability.canRenderPages) {
    throw new AppError("PREPROCESSING_NOT_SUPPORTED", capability.message, 400);
  }

  const job = await extractionJobQueue.enqueue({
    companyId: actor.companyId,
    projectId: file.projectId,
    projectFileId: file.id,
    engineType: ExtractionEngineType.FILE_PREPROCESSING,
    createdByUserId: actor.userId,
  });

  await createAuditLog(actor.companyId, { entityType: "ProjectFile", entityId: fileId, action: "FILE_PREPROCESSING_TRIGGERED", payload: { jobId: job.id } });
  return toExtractionJobDTO(job);
}

export async function listPagesForFile(actor: CurrentActor, fileId: string) {
  await getProjectFileRecord(actor.companyId, fileId);
  const rows = await listDrawingPages(actor.companyId, fileId);
  const pages = rows.map(toDrawingPageDTO);
  return {
    pages,
    classification: classifyPdfContent(pages),
    ocrStatus: OCR_IMPLEMENTATION_STATUS,
  };
}

export async function getDrawingPageImage(actor: CurrentActor, pageId: string) {
  const page = await getDrawingPageRecord(actor.companyId, pageId);
  if (!page.imageStorageKey) throw new Error("This page has no rendered image yet.");
  const buffer = await getProjectFileStorageAdapter().getObject(page.imageStorageKey);
  return { buffer, mimeType: "image/png" };
}
