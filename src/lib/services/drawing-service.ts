import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import {
  createProjectFile,
  deleteProjectFileRow,
  findDuplicateByChecksum,
  getProjectFileRecord,
  listProjectFiles,
  toProjectFileDTO,
  updateProjectFileMetadata,
  type ProjectFileRecord,
} from "@/lib/repositories/project-file-repository";
import { buildDrawingStorageKey, computeChecksum } from "@/lib/files/file-security";
import { createStorageAdapter, resolveStorageProvider } from "@/lib/storage/storage-factory";
import type { DocumentStorageAdapter } from "@/lib/storage/document-storage-adapter";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import {
  DRAWING_EXTENSIONS,
  DRAWING_MAX_FILE_SIZE_BYTES,
  isDrawingExtensionPreviewable,
  type DrawingMetadataInput,
} from "@/lib/validation/drawing-schema";
import { randomUUID } from "node:crypto";

const DRAWING_MIME_BY_EXTENSION: Record<string, readonly string[] | null> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  tif: ["image/tiff"],
  tiff: ["image/tiff"],
  dwg: null,
  dxf: null,
  ifc: null,
  rvt: null,
  zip: ["application/zip", "application/x-zip-compressed", "application/octet-stream"],
};

let cachedStorageAdapter: DocumentStorageAdapter | null = null;
function getDrawingStorageAdapter(): DocumentStorageAdapter {
  if (!cachedStorageAdapter) {
    cachedStorageAdapter = createStorageAdapter({ provider: resolveStorageProvider(), purpose: "project-files" });
  }
  return cachedStorageAdapter;
}

function getExtension(originalName: string): string {
  const parts = originalName.trim().split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1].toLowerCase();
}

function slugifyBaseName(originalName: string): string {
  const withoutExtension = originalName.replace(/\.[^./\\]+$/, "");
  const slug = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  return slug || "drawing";
}

/**
 * Drawing-specific validation, deliberately separate from file-security.ts's
 * validateUpload: a narrower extension allowlist (drawings only — no csv/
 * xlsx/docx) and a stricter 25MB cap for tonight's server-upload path,
 * without touching the general project-files feature's 200MB limit.
 */
function validateDrawingUpload(originalName: string, mimeType: string, fileSize: number): { extension: string; safeFileName: string } {
  if (fileSize <= 0) {
    throw new AppError("FILE_EMPTY", "The uploaded file is empty.", 400);
  }
  if (fileSize > DRAWING_MAX_FILE_SIZE_BYTES) {
    throw new AppError(
      "FILE_TOO_LARGE",
      `The uploaded file exceeds the ${Math.floor(DRAWING_MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB size limit for drawing uploads.`,
      400,
    );
  }

  const extension = getExtension(originalName);
  if (!extension || !DRAWING_EXTENSIONS.includes(extension as (typeof DRAWING_EXTENSIONS)[number])) {
    throw new AppError(
      "FILE_TYPE_NOT_SUPPORTED",
      `Files with extension ".${extension || "?"}" are not supported here. Supported types: ${DRAWING_EXTENSIONS.join(", ")}.`,
      400,
    );
  }

  const allowedMimeTypes = DRAWING_MIME_BY_EXTENSION[extension];
  if (allowedMimeTypes && !allowedMimeTypes.includes(mimeType)) {
    throw new AppError(
      "FILE_MIME_MISMATCH",
      `The file's content type ("${mimeType}") does not match its ".${extension}" extension.`,
      400,
    );
  }

  const safeFileName = `${slugifyBaseName(originalName)}.${extension}`;
  return { extension, safeFileName };
}

function metadataRecord(row: ProjectFileRecord): Record<string, unknown> {
  return (row.metadataJson as Record<string, unknown> | null) ?? {};
}

function isDrawingRecord(row: ProjectFileRecord): boolean {
  return metadataRecord(row).recordKind === "drawing";
}

/** Extends the generic ProjectFile DTO with the drawing-specific fields stored in metadataJson, plus honest, derived (never persisted, never faked) capability flags. */
function toDrawingDTO(row: ProjectFileRecord) {
  const meta = metadataRecord(row);
  const base = toProjectFileDTO(row);
  return {
    ...base,
    discipline: (meta.discipline as string | undefined) ?? null,
    drawingType: (meta.drawingType as string | undefined) ?? null,
    issueDate: (meta.issueDate as string | undefined) ?? null,
    sheetNumber: (meta.sheetNumber as string | undefined) ?? null,
    preparedBy: (meta.preparedBy as string | undefined) ?? null,
    checkedBy: (meta.checkedBy as string | undefined) ?? null,
    approvedBy: (meta.approvedBy as string | undefined) ?? null,
    notes: (meta.notes as string | undefined) ?? null,
    previewAvailable: row.status !== "FAILED" && isDrawingExtensionPreviewable(row.extension),
    analysisStatus: "NOT_CONFIGURED" as const,
    securityScanStatus: "NOT_CONFIGURED" as const,
  };
}

export type UploadProjectDrawingInput = {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
  metadata: DrawingMetadataInput;
};

/**
 * Required server sequence (spec order): capability check, project
 * ownership check, size/extension/MIME validation, filename
 * sanitization, server-generated drawingId, tenant-scoped immutable Blob
 * key, checksum, upload, persist, audit — with a Blob rollback if the
 * database write fails after a successful upload.
 */
export async function uploadProjectDrawing(actor: CurrentActor, projectId: string, input: UploadProjectDrawingInput) {
  requireCapability(actor, "files:manage");
  await getProjectRecord(actor.companyId, projectId);

  const { extension, safeFileName } = validateDrawingUpload(input.originalName, input.mimeType, input.buffer.byteLength);
  const checksum = computeChecksum(input.buffer);
  const duplicate = await findDuplicateByChecksum(actor.companyId, projectId, checksum);

  const drawingId = randomUUID();
  const storageKey = buildDrawingStorageKey(actor.companyId, projectId, drawingId, safeFileName);
  const storage = getDrawingStorageAdapter();

  try {
    await storage.putObject({ key: storageKey, body: input.buffer, contentType: input.mimeType });
  } catch (error) {
    await createAuditLog(actor.companyId, {
      entityType: "ProjectFile",
      entityId: drawingId,
      action: "DRAWING_UPLOAD_FAILED",
      payload: { projectId, originalName: input.originalName, stage: "blob_put" },
    });
    throw error;
  }

  const { discipline, drawingType, issueDate, sheetNumber, preparedBy, checkedBy, approvedBy, notes, drawingNumber, title, revision, scale } = input.metadata;

  let row: ProjectFileRecord;
  try {
    // A single create call — classification metadata rides along with the
    // core file row instead of a separate follow-up update, so there is no
    // window where a database row exists without its drawing metadata, and
    // exactly one rollback path (below) covers every DB failure mode.
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
      drawingNumber: drawingNumber ?? null,
      drawingTitle: title ?? null,
      revisionNumber: revision ?? null,
      scaleText: scale ?? null,
      metadataJson: { recordKind: "drawing", discipline, drawingType, issueDate, sheetNumber, preparedBy, checkedBy, approvedBy, notes },
    });
  } catch (error) {
    // Metadata persistence failed after a successful Blob write — roll the
    // object back rather than leaving storage holding bytes no database row
    // references (spec's atomicity requirement).
    await storage.deleteObject(storageKey).catch(() => undefined);
    await createAuditLog(actor.companyId, {
      entityType: "ProjectFile",
      entityId: drawingId,
      action: "DRAWING_UPLOAD_FAILED",
      payload: { projectId, originalName: input.originalName, stage: "db_write" },
    });
    throw error;
  }

  await createAuditLog(actor.companyId, {
    entityType: "ProjectFile",
    entityId: row.id,
    action: "DRAWING_UPLOADED",
    payload: { projectId, originalName: input.originalName, fileSize: input.buffer.byteLength, checksum, discipline: discipline ?? null, drawingType: drawingType ?? null },
  });

  return { drawing: toDrawingDTO(row), duplicateOfFileId: duplicate && isDrawingRecord(duplicate) ? duplicate.id : null };
}

export async function listProjectDrawings(actor: CurrentActor, projectId: string) {
  await getProjectRecord(actor.companyId, projectId);
  const rows = await listProjectFiles(actor.companyId, projectId);
  return rows.filter(isDrawingRecord).map(toDrawingDTO);
}

async function getOwnDrawingRecord(actor: CurrentActor, fileId: string): Promise<ProjectFileRecord> {
  const row = await getProjectFileRecord(actor.companyId, fileId);
  if (!isDrawingRecord(row)) throw new NotFoundError("Drawing not found.");
  return row;
}

export async function getProjectDrawing(actor: CurrentActor, fileId: string) {
  const row = await getOwnDrawingRecord(actor, fileId);
  return toDrawingDTO(row);
}

export async function updateProjectDrawingMetadata(actor: CurrentActor, fileId: string, metadata: DrawingMetadataInput) {
  requireCapability(actor, "files:manage");
  const existing = await getOwnDrawingRecord(actor, fileId);
  const existingMeta = metadataRecord(existing);

  const { discipline, drawingType, issueDate, sheetNumber, preparedBy, checkedBy, approvedBy, notes, drawingNumber, title, revision, scale } = metadata;

  const updated = await updateProjectFileMetadata(actor.companyId, fileId, {
    drawingNumber: drawingNumber ?? existing.drawingNumber,
    drawingTitle: title ?? existing.drawingTitle,
    revisionNumber: revision ?? existing.revisionNumber,
    scaleText: scale ?? existing.scaleText,
    metadataJson: {
      recordKind: "drawing",
      discipline: discipline ?? (existingMeta.discipline as string | undefined) ?? null,
      drawingType: drawingType ?? (existingMeta.drawingType as string | undefined) ?? null,
      issueDate: issueDate ?? (existingMeta.issueDate as string | undefined) ?? null,
      sheetNumber: sheetNumber ?? (existingMeta.sheetNumber as string | undefined) ?? null,
      preparedBy: preparedBy ?? (existingMeta.preparedBy as string | undefined) ?? null,
      checkedBy: checkedBy ?? (existingMeta.checkedBy as string | undefined) ?? null,
      approvedBy: approvedBy ?? (existingMeta.approvedBy as string | undefined) ?? null,
      notes: notes ?? (existingMeta.notes as string | undefined) ?? null,
    },
  });

  await createAuditLog(actor.companyId, {
    entityType: "ProjectFile",
    entityId: fileId,
    action: "DRAWING_METADATA_UPDATED",
    payload: { projectId: existing.projectId, fields: Object.keys(metadata) },
  });

  return toDrawingDTO(updated);
}

export async function deleteProjectDrawing(actor: CurrentActor, fileId: string) {
  requireCapability(actor, "files:manage");
  const row = await getOwnDrawingRecord(actor, fileId);

  await deleteProjectFileRow(actor.companyId, fileId);
  await getDrawingStorageAdapter().deleteObject(row.storageKey);

  await createAuditLog(actor.companyId, {
    entityType: "ProjectFile",
    entityId: fileId,
    action: "DRAWING_DELETED",
    payload: { projectId: row.projectId, originalName: row.originalName },
  });
}
