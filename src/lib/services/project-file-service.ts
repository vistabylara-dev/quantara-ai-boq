import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import {
  createProjectFile,
  deleteProjectFileRow,
  findDuplicateByChecksum,
  getProjectFileRecord,
  listProjectFiles,
  toProjectFileDTO,
} from "@/lib/repositories/project-file-repository";
import { buildStorageKey, computeChecksum, validateUpload } from "@/lib/files/file-security";
import { localProjectFileStorageAdapter } from "@/lib/storage/local-project-file-storage-adapter";
import { createAuditLog } from "@/lib/repositories/audit-repository";

export type UploadProjectFileInput = {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
};

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
  await localProjectFileStorageAdapter.putObject({ key: storageKey, body: input.buffer, contentType: input.mimeType });

  const row = await createProjectFile(actor.companyId, {
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

/** The only path that ever reads project-file bytes off disk — tenant-scoped lookup happens before the storage adapter is touched. */
export async function getProjectFileForDownload(actor: CurrentActor, fileId: string) {
  const row = await getProjectFileRecord(actor.companyId, fileId);
  const buffer = await localProjectFileStorageAdapter.getObject(row.storageKey);
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
  await localProjectFileStorageAdapter.deleteObject(row.storageKey);

  await createAuditLog(actor.companyId, {
    entityType: "ProjectFile",
    entityId: fileId,
    action: "FILE_DELETED",
    payload: { projectId: row.projectId, originalName: row.originalName },
  });
}
