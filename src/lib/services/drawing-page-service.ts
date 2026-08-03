import { ExtractionEngineType } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { getProjectFileRecord } from "@/lib/repositories/project-file-repository";
import { getDrawingPageRecord, listDrawingPages, toDrawingPageDTO } from "@/lib/repositories/drawing-page-repository";
import { toExtractionJobDTO } from "@/lib/repositories/extraction-job-repository";
import { localProjectFileStorageAdapter } from "@/lib/storage/local-project-file-storage-adapter";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import "@/lib/jobs/register-handlers";
import { extractionJobQueue } from "@/lib/jobs/extraction-worker";

export async function triggerFilePreprocessing(actor: CurrentActor, fileId: string) {
  requireCapability(actor, "files:manage");
  const file = await getProjectFileRecord(actor.companyId, fileId);

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
  return rows.map(toDrawingPageDTO);
}

export async function getDrawingPageImage(actor: CurrentActor, pageId: string) {
  const page = await getDrawingPageRecord(actor.companyId, pageId);
  if (!page.imageStorageKey) throw new Error("This page has no rendered image yet.");
  const buffer = await localProjectFileStorageAdapter.getObject(page.imageStorageKey);
  return { buffer, mimeType: "image/png" };
}
