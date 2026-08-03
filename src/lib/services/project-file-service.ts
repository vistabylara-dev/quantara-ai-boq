import { ExtractionEngineType, ProjectFileStatus, type ProjectFileClassification } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import {
  confirmOrReclassifyProjectFile,
  createProjectFile,
  deleteProjectFileRow,
  findDuplicateByChecksum,
  getProjectFileRecord,
  listProjectFiles,
  toProjectFileDTO,
  updateProjectFileStatus,
} from "@/lib/repositories/project-file-repository";
import { toExtractionJobDTO } from "@/lib/repositories/extraction-job-repository";
import { buildStorageKey, computeChecksum, validateUpload } from "@/lib/files/file-security";
import { createStorageAdapter, resolveStorageProvider } from "@/lib/storage/storage-factory";
import type { DocumentStorageAdapter } from "@/lib/storage/document-storage-adapter";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import "@/lib/jobs/register-handlers";
import { extractionJobQueue } from "@/lib/jobs/extraction-worker";

export type UploadProjectFileInput = {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
};

/**
 * Resolved once per process, not once per call — `resolveStorageProvider()`
 * throws in production if STORAGE_PROVIDER is unset, and creating a fresh
 * Vercel Blob client on every request would be wasteful. Local dev/test
 * behavior is unchanged (still the local filesystem adapter); production
 * now actually uses private Vercel Blob instead of the function's ephemeral
 * local disk, which never survived a redeploy or cold start.
 */
let cachedStorageAdapter: DocumentStorageAdapter | null = null;
function getProjectFileStorageAdapter(): DocumentStorageAdapter {
  if (!cachedStorageAdapter) {
    cachedStorageAdapter = createStorageAdapter({ provider: resolveStorageProvider(), purpose: "project-files" });
  }
  return cachedStorageAdapter;
}

/**
 * Validates, stores, and records an uploaded source file. The original is
 * stored once under the "originals" category and is never overwritten —
 * every later Phase 8 sub-phase (preprocessing, page splitting, previews)
 * writes its own derivatives under separate storage-key categories instead
 * of mutating this object.
 */
export async function uploadProjectFile(actor: CurrentActor, projectId: string, input: UploadProjectFileInput) {
  requireCapability(actor, "files:manage");
  await getProjectRecord(actor.companyId, projectId);

  const { extension, safeFileName } = validateUpload(input.originalName, input.mimeType, input.buffer.byteLength);
  const checksum = computeChecksum(input.buffer);
  const duplicate = await findDuplicateByChecksum(actor.companyId, projectId, checksum);

  const storageKey = buildStorageKey(actor.companyId, projectId, "originals", safeFileName);
  const storage = getProjectFileStorageAdapter();
  await storage.putObject({ key: storageKey, body: input.buffer, contentType: input.mimeType });

  let row;
  try {
    row = await createProjectFile(actor.companyId, {
      projectId,
      uploadedByUserId: actor.userId,
      originalName: input.originalName,
      safeFileName,
      storageKey,
      mimeType: input.mimeType,
      extension,
      fileSize: input.buffer.byteLength,
      checksum,
    });
  } catch (error) {
    // The Blob object was already written above — if the metadata write
    // fails, roll it back rather than leaving an orphaned, unreferenced
    // object with no database row pointing at it.
    await storage.deleteObject(storageKey).catch(() => undefined);
    throw error;
  }

  await createAuditLog(actor.companyId, {
    entityType: "ProjectFile",
    entityId: row.id,
    action: "FILE_UPLOADED",
    payload: { projectId, originalName: input.originalName, fileSize: input.buffer.byteLength, checksum },
  });

  return { file: toProjectFileDTO(row), duplicateOfFileId: duplicate?.id ?? null };
}

export async function listProjectFilesForProject(actor: CurrentActor, projectId: string) {
  await getProjectRecord(actor.companyId, projectId);
  const rows = await listProjectFiles(actor.companyId, projectId);
  return rows.map(toProjectFileDTO);
}

export async function getProjectFile(actor: CurrentActor, fileId: string) {
  const row = await getProjectFileRecord(actor.companyId, fileId);
  return toProjectFileDTO(row);
}

/** The only path that ever reads project-file bytes off storage — tenant-scoped lookup happens before the storage adapter is touched. */
export async function getProjectFileForDownload(actor: CurrentActor, fileId: string) {
  const row = await getProjectFileRecord(actor.companyId, fileId);
  const buffer = await getProjectFileStorageAdapter().getObject(row.storageKey);

  await createAuditLog(actor.companyId, {
    entityType: "ProjectFile",
    entityId: fileId,
    action: "FILE_DOWNLOADED",
    payload: { projectId: row.projectId, originalName: row.originalName },
  });

  return { buffer, fileName: row.originalName, mimeType: row.mimeType };
}

/**
 * Hard-deletes the file row and its stored bytes. Later sub-phases that
 * introduce downstream records referencing a ProjectFile (DrawingPage,
 * ExtractionJob, ExtractedEntity, InspectionPhoto, issued reports, etc.)
 * must extend this with a reference check before the delete — per spec
 * section 5, "deletion blocked where a file is referenced by issued
 * records." No such downstream records exist yet in this sub-phase.
 */
export async function deleteProjectFile(actor: CurrentActor, fileId: string) {
  requireCapability(actor, "files:manage");
  const row = await getProjectFileRecord(actor.companyId, fileId);
  await deleteProjectFileRow(actor.companyId, fileId);
  await getProjectFileStorageAdapter().deleteObject(row.storageKey);

  await createAuditLog(actor.companyId, {
    entityType: "ProjectFile",
    entityId: fileId,
    action: "FILE_DELETED",
    payload: { projectId: row.projectId, originalName: row.originalName },
  });
}

/** Enqueues the automatic classification engine. Idempotent — re-triggering while a job is already in flight returns that same job rather than starting a duplicate. */
export async function triggerFileClassification(actor: CurrentActor, fileId: string) {
  requireCapability(actor, "files:manage");
  const file = await getProjectFileRecord(actor.companyId, fileId);
  await updateProjectFileStatus(actor.companyId, fileId, ProjectFileStatus.CLASSIFYING);

  const job = await extractionJobQueue.enqueue({
    companyId: actor.companyId,
    projectId: file.projectId,
    projectFileId: file.id,
    engineType: ExtractionEngineType.DOCUMENT_CLASSIFICATION,
    createdByUserId: actor.userId,
  });

  await createAuditLog(actor.companyId, {
    entityType: "ProjectFile",
    entityId: fileId,
    action: "FILE_CLASSIFICATION_TRIGGERED",
    payload: { jobId: job.id },
  });

  return toExtractionJobDTO(job);
}

/**
 * Human confirm-or-change action (spec section 9). Omitting `classification`
 * confirms the current (auto-suggested) value as-is; providing one
 * reclassifies. Always audit-logged, always distinguishes the two actions.
 */
export async function updateFileClassification(actor: CurrentActor, fileId: string, classification: ProjectFileClassification | undefined) {
  requireCapability(actor, "files:manage");
  const { updated, previousClassification, isReclassification } = await confirmOrReclassifyProjectFile(actor.companyId, fileId, actor.userId, classification);

  await createAuditLog(actor.companyId, {
    entityType: "ProjectFile",
    entityId: fileId,
    action: isReclassification ? "FILE_RECLASSIFIED" : "FILE_CLASSIFICATION_CONFIRMED",
    payload: { previousClassification, newClassification: updated.classification },
  });

  return toProjectFileDTO(updated);
}
