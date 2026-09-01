import { ExtractionEngineType, ProjectFileStatus, type ProjectFileClassification } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import {
  archiveProjectFileRow,
  confirmOrReclassifyProjectFile,
  createProjectFile,
  findDuplicateByChecksum,
  getProjectFileRecord,
  listProjectFiles,
  toProjectFileDTO,
  updateProjectFileStatus,
} from "@/lib/repositories/project-file-repository";
import { toExtractionJobDTO } from "@/lib/repositories/extraction-job-repository";
import { buildStorageKey, computeChecksum, validateUpload } from "@/lib/files/file-security";
import { createStorageAdapter } from "@/lib/storage/storage-factory";
import { requireProjectStorageReady } from "@/lib/storage/storage-readiness";
import type { DocumentStorageAdapter } from "@/lib/storage/document-storage-adapter";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { extractionJobQueue } from "@/lib/jobs/extraction-worker";

export type UploadProjectFileInput = {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
  sourceAttribution?: {
    provider: "google-drive";
    externalConnectionId: string;
    externalFileId: string;
    modifiedTime: string | null;
    webViewLink: string | null;
  };
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
    cachedStorageAdapter = createStorageAdapter({ provider: requireProjectStorageReady(), purpose: "project-files" });
  }
  return cachedStorageAdapter;
}

/**
 * Autodesk DWG candidate sources are explicit metadata-only references: they
 * satisfy the source FK without claiming that Quantara uploaded or stores the
 * remote DWG bytes. Storage operations must never try to open that namespace.
 */
function isMetadataOnlyExternalSource(metadataJson: unknown): boolean {
  if (!metadataJson || typeof metadataJson !== "object" || Array.isArray(metadataJson)) return false;
  const metadata = metadataJson as Record<string, unknown>;
  return metadata.sourceKind === "EXTERNAL_REFERENCE" && metadata.localCopy === false;
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
  const project = await getProjectRecord(actor.companyId, projectId);
  const canonicalProjectId = project.id;

  const { extension, safeFileName } = validateUpload(input.originalName, input.mimeType, input.buffer.byteLength);
  const checksum = computeChecksum(input.buffer);
  const duplicate = await findDuplicateByChecksum(actor.companyId, canonicalProjectId, checksum);

  const storageKey = buildStorageKey(actor.companyId, canonicalProjectId, "originals", safeFileName);
  const storage = getProjectFileStorageAdapter();
  await storage.putObject({ key: storageKey, body: input.buffer, contentType: input.mimeType });

  let row;
  try {
    row = await createProjectFile(actor.companyId, {
      projectId: canonicalProjectId,
      uploadedByUserId: actor.userId,
      originalName: input.originalName,
      safeFileName,
      storageKey,
      mimeType: input.mimeType,
      extension,
      fileSize: input.buffer.byteLength,
      checksum,
      metadataJson: input.sourceAttribution
        ? { importSource: input.sourceAttribution }
        : undefined,
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
    payload: {
      projectId: canonicalProjectId,
      originalName: input.originalName,
      fileSize: input.buffer.byteLength,
      checksum,
      ...(input.sourceAttribution ? { importSource: input.sourceAttribution } : {}),
    },
  });

  return { file: toProjectFileDTO(row), duplicateOfFileId: duplicate?.id ?? null };
}

export async function listProjectFilesForProject(actor: CurrentActor, projectId: string) {
  const project = await getProjectRecord(actor.companyId, projectId);
  const rows = await listProjectFiles(actor.companyId, project.id);
  return rows.map(toProjectFileDTO);
}

export async function getProjectFile(actor: CurrentActor, fileId: string) {
  const row = await getProjectFileRecord(actor.companyId, fileId);
  return toProjectFileDTO(row);
}

export type DownloadByteRange = { start: number; end: number };

/**
 * CORE-FLOW-1 — a tenant-scoped, storage-free lookup of just the file's
 * size/name/type (all already persisted on the ProjectFile row). Lets the
 * download route validate an incoming Range header before ever opening a
 * storage stream, so a single request never needs more than one call to
 * getProjectFileForStreamingDownload below.
 */
export async function getProjectFileDownloadMeta(actor: CurrentActor, fileId: string) {
  const row = await getProjectFileRecord(actor.companyId, fileId);
  if (isMetadataOnlyExternalSource(row.metadataJson)) {
    throw new AppError(
      "EXTERNAL_SOURCE_NO_LOCAL_COPY",
      "This Autodesk source is connected externally and has no local file copy.",
      409,
    );
  }
  return {
    fileName: row.originalName,
    mimeType: row.mimeType,
    extension: row.extension,
    totalSize: row.fileSize,
  };
}

/**
 * CORE-FLOW-1 — the only path that ever reads project-file bytes off
 * storage. Tenant-scoped lookup happens before the storage adapter is ever
 * touched, so a cross-company fileId 404s before any file access. Streams
 * the object (optionally one byte range) rather than buffering it — a large
 * PDF is never held in application memory to serve a preview or a single
 * range. Every requested range is validated against the file's real,
 * database-recorded size before being honored; an out-of-bounds range is
 * rejected here so the route layer can return 416 without ever touching
 * storage. The audit log fires once per logical download (unranged, or the
 * first byte of a ranged sequence) rather than once per range request.
 */
export async function getProjectFileForStreamingDownload(actor: CurrentActor, fileId: string, range?: DownloadByteRange) {
  const row = await getProjectFileRecord(actor.companyId, fileId);

  if (isMetadataOnlyExternalSource(row.metadataJson)) {
    throw new AppError(
      "EXTERNAL_SOURCE_NO_LOCAL_COPY",
      "This Autodesk source is connected externally and has no local file copy.",
      409,
    );
  }

  if (range) {
    if (range.start < 0 || range.end < range.start || range.start >= row.fileSize) {
      throw new AppError("RANGE_NOT_SATISFIABLE", "The requested byte range is not satisfiable.", 416);
    }
  }

  const clampedRange = range ? { start: range.start, end: Math.min(range.end, row.fileSize - 1) } : undefined;
  const stream = await getProjectFileStorageAdapter().getObjectStream(row.storageKey, clampedRange);

  if (!range || range.start === 0) {
    await createAuditLog(actor.companyId, {
      entityType: "ProjectFile",
      entityId: fileId,
      action: "FILE_DOWNLOADED",
      payload: { projectId: row.projectId, originalName: row.originalName },
    });
  }

  return {
    body: stream.body,
    totalSize: row.fileSize,
    servedRange: stream.servedRange,
    fileName: row.originalName,
    mimeType: row.mimeType,
  };
}

/** Archives the source without deleting its immutable bytes or downstream
 * extraction/review evidence. Direct retrieval and download remain available
 * to authorized users; active project lists hide the archived source. */
export async function archiveProjectFile(actor: CurrentActor, fileId: string) {
  requireCapability(actor, "files:archive");
  const result = await prisma.$transaction(async (tx) => {
    const archived = await archiveProjectFileRow(actor.companyId, fileId, actor.userId, tx);
    if (!archived.alreadyArchived) {
      await createAuditLog(actor.companyId, {
        entityType: "ProjectFile",
        entityId: fileId,
        action: "FILE_ARCHIVED",
        payload: {
          projectId: archived.record.projectId,
          originalName: archived.record.originalName,
          storageKeyRetained: true,
          bytesRetained: !isMetadataOnlyExternalSource(archived.record.metadataJson),
        },
        actorName: actor.fullName,
      }, tx);
    }
    return archived;
  });
  return toProjectFileDTO(result.record);
}

/** Enqueues the automatic classification engine. Idempotent — re-triggering while a job is already in flight returns that same job rather than starting a duplicate. */
export async function triggerFileClassification(actor: CurrentActor, fileId: string) {
  requireCapability(actor, "files:manage");

  // Register the complete handler composition before dispatch so the singleton queue
  // has every supported handler even when processing crosses a request/module boundary.
  await import("@/lib/jobs/register-handlers");
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
