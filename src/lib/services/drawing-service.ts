import { createHash } from "node:crypto";
import type { Prisma, ProjectFileUploadSession } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { hasCapability, requireCapability } from "@/lib/auth/rbac";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import {
  archiveProjectFileRow,
  createProjectFile,
  findDuplicateByChecksum,
  findProjectFileRecord,
  getProjectFileRecord,
  listProjectFiles,
  toProjectFileDTO,
  updateProjectFileMetadata,
  type ProjectFileRecord,
} from "@/lib/repositories/project-file-repository";
import {
  createUploadSession,
  getUploadSessionForUpdate,
  setUploadSessionStatus,
} from "@/lib/repositories/project-file-upload-session-repository";
import { buildDrawingStorageKey, computeChecksum } from "@/lib/files/file-security";
import { createStorageAdapter, resolveStorageProvider } from "@/lib/storage/storage-factory";
import { requireProjectStorageReady } from "@/lib/storage/storage-readiness";
import type { DocumentStorageAdapter } from "@/lib/storage/document-storage-adapter";
import { generateDrawingUploadToken } from "@/lib/storage/blob-client-upload";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import {
  DRAWING_EXTENSIONS,
  DRAWING_UPLOAD_MAX_BYTES_DEFAULT,
  isDrawingExtensionPreviewable,
  type DrawingMetadataInput,
} from "@/lib/validation/drawing-schema";
import { randomUUID } from "node:crypto";

/**
 * Deterministic, real page count via pdf-parse's document-info reader (no
 * rasterization — cheap, metadata-only). Returns null on any parse failure
 * rather than throwing: a page count is a nice-to-have enrichment, never a
 * reason to fail an otherwise-valid upload. This is genuinely CONFIRMED data
 * (parsed straight from the PDF's own page tree), never inferred or guessed.
 *
 * pdf-parse is lazy-loaded here rather than imported at module scope: its
 * pdfjs-dist dependency chain tries to require("@napi-rs/canvas") at load
 * time to polyfill DOMMatrix, and that require is invisible to Vercel's
 * static output-file trace, so the package can be absent from the deployed
 * bundle. A module-scope import meant every consumer of drawing-service.ts —
 * including a plain drawings LIST request that never touches a PDF — paid
 * that load and crashed with "DOMMatrix is not defined" in production.
 */
async function extractPdfPageCount(buffer: Buffer): Promise<number | null> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const info = await parser.getInfo();
    return typeof info.total === "number" && info.total > 0 ? info.total : null;
  } catch {
    return null;
  } finally {
    await parser.destroy();
  }
}

/**
 * CORE-FLOW-1 — PDF additionally accepts application/octet-stream: browsers
 * routinely mislabel PDFs this way (and some OS/network layers strip the
 * real content type entirely). Extension + declared size are still checked
 * here; the actual bytes are verified against the real PDF file signature
 * at finalize time (verifyPdfSignature, below) before the file is ever
 * trusted — this is what actually blocks a renamed executable, not the
 * MIME string, which is trivially spoofable either way.
 */
const DRAWING_MIME_BY_EXTENSION: Record<string, readonly string[] | null> = {
  pdf: ["application/pdf", "application/octet-stream"],
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

/** Server-selected MIME used by the token, stored Blob, and ProjectFile. */
const CANONICAL_DRAWING_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  tif: "image/tiff",
  tiff: "image/tiff",
  dwg: "application/octet-stream",
  dxf: "application/octet-stream",
  ifc: "application/octet-stream",
  rvt: "application/octet-stream",
  zip: "application/zip",
};

/** The real PDF file signature — "%PDF-". Checked against the first 5 bytes of the actually-uploaded object, never trusted from a declared MIME type alone. */
const PDF_SIGNATURE = Buffer.from("%PDF-", "ascii");

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
 * Reads DRAWING_UPLOAD_MAX_BYTES if set (the one central, server-controlled
 * limit — see .env.example), otherwise the safe 250MB default. The client
 * UI displays this same default for UX only; this function is the only
 * place that actually enforces it.
 */
export function resolveDrawingUploadMaxBytes(): number {
  const raw = process.env.DRAWING_UPLOAD_MAX_BYTES;
  if (!raw) return DRAWING_UPLOAD_MAX_BYTES_DEFAULT;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DRAWING_UPLOAD_MAX_BYTES_DEFAULT;
}

/**
 * Drawing-specific validation, deliberately separate from file-security.ts's
 * validateUpload: a narrower extension allowlist (drawings only — no csv/
 * xlsx/docx).
 */
function validateDrawingUpload(
  originalName: string,
  mimeType: string,
  fileSize: number,
  maxSizeBytes: number = resolveDrawingUploadMaxBytes(),
): { extension: string; safeFileName: string; canonicalMimeType: string } {
  if (fileSize <= 0) {
    throw new AppError("FILE_EMPTY", "The uploaded file is empty.", 400);
  }
  if (fileSize > maxSizeBytes) {
    throw new AppError(
      "FILE_TOO_LARGE",
      `The uploaded file exceeds the ${Math.floor(maxSizeBytes / (1024 * 1024))}MB size limit for drawing uploads.`,
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
  return {
    extension,
    safeFileName,
    canonicalMimeType: CANONICAL_DRAWING_MIME_BY_EXTENSION[extension],
  };
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
 * The multipart drawing endpoint exists only for local development without a
 * Blob provider. Keeping this assertion separate lets the route reject a
 * production request before parsing FormData, while the service repeats the
 * guard for every non-route caller.
 */
export function assertBufferedDrawingUploadAllowed(): void {
  if (process.env.NODE_ENV === "production") {
    throw new AppError(
      "BUFFERED_UPLOAD_NOT_SUPPORTED",
      "Buffered drawing uploads are not available in production. Use Drawing Intake's direct upload flow.",
      409,
    );
  }
}

/**
 * Required server sequence (spec order): capability check, project
 * ownership check, size/extension/MIME validation, filename
 * sanitization, server-generated drawingId, tenant-scoped immutable Blob
 * key, checksum, upload, persist, audit — with a Blob rollback if the
 * database write fails after a successful upload.
 */
export async function uploadProjectDrawing(actor: CurrentActor, projectId: string, input: UploadProjectDrawingInput) {
  requireCapability(actor, "files:manage");
  assertBufferedDrawingUploadAllowed();
  // The route param may be the project's slug (e.g. "project-00") or its
  // database UUID. getProjectRecord resolves either, but every operation
  // after this point must use the canonical UUID it returns — ProjectFile.
  // projectId is a native Postgres `uuid` column, and handing it a slug
  // throws "invalid input syntax for type uuid" instead of a clean result.
  const project = await getProjectRecord(actor.companyId, projectId);
  const canonicalProjectId = project.id;

  const { extension, safeFileName, canonicalMimeType } = validateDrawingUpload(
    input.originalName,
    input.mimeType,
    input.buffer.byteLength,
  );
  if (extension === "pdf" && !input.buffer.subarray(0, PDF_SIGNATURE.byteLength).equals(PDF_SIGNATURE)) {
    throw new AppError("UNSAFE_FILE_CONTENT", "The uploaded file does not have a valid PDF signature.", 400);
  }
  const checksum = computeChecksum(input.buffer);
  const [duplicate, pageCount] = await Promise.all([
    findDuplicateByChecksum(actor.companyId, canonicalProjectId, checksum),
    extension === "pdf" ? extractPdfPageCount(input.buffer) : Promise.resolve(null),
  ]);

  const drawingId = randomUUID();
  const storageKey = buildDrawingStorageKey(actor.companyId, canonicalProjectId, drawingId, safeFileName);
  const storage = getDrawingStorageAdapter();

  try {
    await storage.putObject({ key: storageKey, body: input.buffer, contentType: canonicalMimeType });
  } catch (error) {
    await createAuditLog(actor.companyId, {
      entityType: "ProjectFile",
      entityId: drawingId,
      action: "DRAWING_UPLOAD_FAILED",
      payload: { projectId: canonicalProjectId, originalName: input.originalName, stage: "blob_put" },
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
      projectId: canonicalProjectId,
      uploadedByUserId: actor.userId,
      originalName: input.originalName,
      safeFileName,
      storageKey,
      mimeType: canonicalMimeType,
      extension,
      fileSize: input.buffer.byteLength,
      checksum,
      drawingNumber: drawingNumber ?? null,
      drawingTitle: title ?? null,
      revisionNumber: revision ?? null,
      scaleText: scale ?? null,
      pageCount,
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
      payload: { projectId: canonicalProjectId, originalName: input.originalName, stage: "db_write" },
    });
    throw error;
  }

  await createAuditLog(actor.companyId, {
    entityType: "ProjectFile",
    entityId: row.id,
    action: "DRAWING_UPLOADED",
    payload: { projectId: canonicalProjectId, originalName: input.originalName, fileSize: input.buffer.byteLength, checksum, discipline: discipline ?? null, drawingType: drawingType ?? null },
  });

  return { drawing: toDrawingDTO(row), duplicateOfFileId: duplicate && isDrawingRecord(duplicate) ? duplicate.id : null };
}

export async function listProjectDrawings(actor: CurrentActor, projectId: string) {
  const project = await getProjectRecord(actor.companyId, projectId);
  const rows = await listProjectFiles(actor.companyId, project.id);
  const canArchive = hasCapability(actor.role, "files:archive");
  return rows.filter(isDrawingRecord).map((row) => ({ ...toDrawingDTO(row), canArchive }));
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

export async function archiveProjectDrawing(actor: CurrentActor, fileId: string) {
  requireCapability(actor, "files:archive");
  const row = await getOwnDrawingRecord(actor, fileId);
  const result = await prisma.$transaction(async (tx) => {
    const archived = await archiveProjectFileRow(actor.companyId, fileId, actor.userId, tx);
    if (!archived.alreadyArchived) {
      await createAuditLog(actor.companyId, {
        entityType: "ProjectFile",
        entityId: fileId,
        action: "DRAWING_ARCHIVED",
        payload: {
          projectId: row.projectId,
          originalName: row.originalName,
          storageKeyRetained: true,
          bytesRetained: true,
        },
        actorName: actor.fullName,
      }, tx);
    }
    return archived;
  });
  return toDrawingDTO(result.record);
}

// ---------------------------------------------------------------------------
// CORE-FLOW-1 — direct-to-Blob large drawing upload
// ---------------------------------------------------------------------------

/** 30 minutes — generous for a 250MB upload on a slow connection, short enough that a stale session is not a lingering liability. */
const UPLOAD_SESSION_TTL_MS = 30 * 60 * 1000;

/** Reads only the first 5 bytes of the stored object via a ranged stream — never the whole file — to confirm a genuine "%PDF-" signature. */
async function verifyPdfSignature(storage: DocumentStorageAdapter, storageKey: string): Promise<boolean> {
  const { body } = await storage.getObjectStream(storageKey, { start: 0, end: 4 });
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let collected = 0;
  while (collected < PDF_SIGNATURE.byteLength) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    collected += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const head = Buffer.concat(chunks).subarray(0, PDF_SIGNATURE.byteLength);
  return head.equals(PDF_SIGNATURE);
}

/** Streams the full object through a sha256 hash without ever holding the whole file in memory at once — bounded memory regardless of file size. */
async function computeStreamedChecksum(storage: DocumentStorageAdapter, storageKey: string): Promise<string> {
  const { body } = await storage.getObjectStream(storageKey);
  const hash = createHash("sha256");
  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    hash.update(value);
  }
  return hash.digest("hex");
}

export type AuthorizeDrawingUploadInput = {
  originalName: string;
  declaredMimeType: string;
  declaredByteSize: number;
};

export type AuthorizeDrawingUploadResult = {
  sessionId: string;
  uploadToken: string;
  pathname: string;
  contentType: string;
  maxSizeBytes: number;
  expiresAt: string;
};

/**
 * Step 1 of the direct-upload flow. Validates everything that can be known
 * before any bytes exist (filename, extension, declared MIME, declared
 * size against the server-controlled maximum), generates the file's future
 * id and its exact, tenant-scoped storage pathname, and issues a Blob
 * client token that is only ever valid for that one pathname, that one
 * declared content type, up to the declared size, until expiry. The
 * browser-declared companyId/tenant path is never trusted — the pathname
 * is built here from the authenticated actor's own companyId.
 */
export async function authorizeDrawingUpload(
  actor: CurrentActor,
  projectId: string,
  input: AuthorizeDrawingUploadInput,
): Promise<AuthorizeDrawingUploadResult> {
  requireCapability(actor, "files:manage");
  const project = await getProjectRecord(actor.companyId, projectId);
  const canonicalProjectId = project.id;

  if (requireProjectStorageReady() !== "vercel-blob") {
    throw new AppError(
      "DIRECT_UPLOAD_NOT_SUPPORTED",
      "Direct upload requires STORAGE_PROVIDER=vercel-blob. This environment is not configured for it.",
      409,
    );
  }

  const maxSizeBytes = resolveDrawingUploadMaxBytes();
  const { extension, safeFileName, canonicalMimeType } = validateDrawingUpload(
    input.originalName,
    input.declaredMimeType,
    input.declaredByteSize,
    maxSizeBytes,
  );

  const fileId = randomUUID();
  const storageKey = buildDrawingStorageKey(actor.companyId, canonicalProjectId, fileId, safeFileName);
  const expiresAt = new Date(Date.now() + UPLOAD_SESSION_TTL_MS);

  // Generate the scoped token before creating durable state. If token
  // generation fails, no PENDING database session is left behind. The token
  // is not returned to the browser until the session + authorization audit
  // transaction below also commits, so a database failure cannot expose an
  // untracked upload capability.
  const uploadToken = await generateDrawingUploadToken({
    pathname: storageKey,
    contentType: canonicalMimeType,
    maxSizeBytes: input.declaredByteSize,
    ttlMs: UPLOAD_SESSION_TTL_MS,
  });

  const session = await prisma.$transaction(async (tx) => {
    const created = await createUploadSession({
      companyId: actor.companyId,
      projectId: canonicalProjectId,
      actorUserId: actor.userId,
      fileId,
      storageKey,
      originalName: input.originalName,
      declaredMimeType: canonicalMimeType,
      declaredByteSize: input.declaredByteSize,
      extension,
      expiresAt,
    }, tx);
    await createAuditLog(actor.companyId, {
      entityType: "ProjectFile",
      entityId: fileId,
      action: "DRAWING_UPLOAD_AUTHORIZED",
      payload: { projectId: canonicalProjectId, originalName: input.originalName, declaredByteSize: input.declaredByteSize },
    }, tx);
    return created;
  });

  return {
    sessionId: session.id,
    uploadToken,
    pathname: storageKey,
    contentType: canonicalMimeType,
    maxSizeBytes,
    expiresAt: expiresAt.toISOString(),
  };
}

export type FinalizeDrawingUploadInput = {
  sessionId: string;
  metadata: DrawingMetadataInput;
};

type ExistingUploadResolution =
  | { kind: "missing"; session: ProjectFileUploadSession }
  | { kind: "existing"; row: ProjectFileRecord }
  | { kind: "cancelled" }
  | { kind: "expired" };

function assertUploadSessionProject(session: ProjectFileUploadSession, canonicalProjectId: string): void {
  if (session.projectId !== canonicalProjectId) {
    // Looks identical to "session not found" — never confirms or denies a
    // session's existence in another project.
    throw new NotFoundError("Upload session not found.");
  }
}

function assertUploadSessionActor(session: ProjectFileUploadSession, actorUserId: string): void {
  if (session.actorUserId !== actorUserId) {
    // Do not disclose a same-tenant user's upload capability to another user.
    throw new NotFoundError("Upload session not found.");
  }
}

function assertExpectedFinalizedFile(
  session: ProjectFileUploadSession,
  row: ProjectFileRecord,
  canonicalProjectId: string,
): void {
  if (
    row.projectId !== canonicalProjectId
    || row.storageKey !== session.storageKey
    || row.originalName !== session.originalName
    || row.uploadedByUserId !== session.actorUserId
    || row.mimeType !== session.declaredMimeType
    || row.extension !== session.extension
    || Number(row.fileSize) !== session.declaredByteSize
    || !isDrawingRecord(row)
  ) {
    throw new AppError(
      "UPLOAD_SESSION_CONFLICT",
      "The upload session conflicts with an existing project file. Contact support before retrying.",
      409,
    );
  }
}

async function ensureDrawingUploadedAudit(
  database: Prisma.TransactionClient,
  companyId: string,
  row: ProjectFileRecord,
): Promise<void> {
  const existingAudit = await database.auditLog.findFirst({
    where: {
      companyId,
      entityType: "ProjectFile",
      entityId: row.id,
      action: "DRAWING_UPLOADED",
    },
    select: { id: true },
  });
  if (existingAudit) return;

  const drawingMetadata = metadataRecord(row);
  await createAuditLog(companyId, {
    entityType: "ProjectFile",
    entityId: row.id,
    action: "DRAWING_UPLOADED",
    payload: {
      projectId: row.projectId,
      originalName: row.originalName,
      fileSize: Number(row.fileSize),
      checksum: row.checksum,
      discipline: (drawingMetadata.discipline as string | undefined) ?? null,
      drawingType: (drawingMetadata.drawingType as string | undefined) ?? null,
      path: "direct_upload",
    },
  }, database);
}

/**
 * Fast idempotency/self-healing pass. A prior process may have committed the
 * expected ProjectFile under the old non-transactional implementation and
 * crashed before updating the PENDING session or writing its success audit.
 * Locking the session lets one retry heal that state while every concurrent
 * retry returns the same file.
 */
async function resolveExistingUpload(
  companyId: string,
  actorUserId: string,
  canonicalProjectId: string,
  sessionId: string,
): Promise<ExistingUploadResolution> {
  return prisma.$transaction(async (tx) => {
    const session = await getUploadSessionForUpdate(companyId, sessionId, tx);
    assertUploadSessionProject(session, canonicalProjectId);
    assertUploadSessionActor(session, actorUserId);

    if (session.status === "CANCELLED") return { kind: "cancelled" };

    const existing = await findProjectFileRecord(companyId, session.fileId, tx);
    if (existing) {
      if (session.status === "EXPIRED") return { kind: "expired" };
      assertExpectedFinalizedFile(session, existing, canonicalProjectId);
      if (session.status !== "FINALIZED") {
        await setUploadSessionStatus(session.id, "FINALIZED", new Date(), tx);
      }
      await ensureDrawingUploadedAudit(tx, companyId, existing);
      return { kind: "existing", row: existing };
    }

    if (session.status === "EXPIRED" || session.expiresAt.getTime() <= Date.now()) {
      if (session.status === "PENDING") {
        await setUploadSessionStatus(session.id, "EXPIRED", undefined, tx);
      }
      return { kind: "expired" };
    }

    return { kind: "missing", session };
  });
}

/**
 * Step 2 of the direct-upload flow, called by the browser only after its
 * direct PUT to Blob succeeds. Never trusts that PUT's success alone —
 * independently re-verifies the object actually exists at the exact
 * expected pathname, with a size and (for PDFs) a real file signature that
 * both match what was declared, before ever creating the ProjectFile row
 * real application data depends on. Idempotent: calling this twice for an
 * already-finalized session returns the same result rather than erroring
 * or duplicating the row.
 */
export async function finalizeDrawingUpload(actor: CurrentActor, projectId: string, input: FinalizeDrawingUploadInput) {
  requireCapability(actor, "files:manage");
  const project = await getProjectRecord(actor.companyId, projectId);
  const canonicalProjectId = project.id;

  const resolution = await resolveExistingUpload(
    actor.companyId,
    actor.userId,
    canonicalProjectId,
    input.sessionId,
  );
  if (resolution.kind === "existing") {
    return { drawing: toDrawingDTO(resolution.row), duplicateOfFileId: null, alreadyFinalized: true };
  }
  if (resolution.kind === "cancelled") {
    throw new AppError("UPLOAD_SESSION_CANCELLED", "This upload session was cancelled.", 409);
  }
  if (resolution.kind === "expired") {
    throw new AppError("UPLOAD_SESSION_EXPIRED", "This upload session has expired. Start the upload again.", 410);
  }
  const session = resolution.session;

  const storage = getDrawingStorageAdapter();
  const metadata = await storage.getMetadata(session.storageKey);
  if (!metadata) {
    throw new AppError("BLOB_OBJECT_MISSING", "The uploaded file could not be found in storage. Try uploading again.", 404);
  }

  const maxSizeBytes = resolveDrawingUploadMaxBytes();
  if (metadata.size <= 0 || metadata.size > maxSizeBytes) {
    await storage.deleteObject(session.storageKey).catch(() => undefined);
    throw new AppError("UPLOAD_SIZE_INVALID", "The uploaded file size is invalid.", 409);
  }
  if (metadata.size !== session.declaredByteSize) {
    await storage.deleteObject(session.storageKey).catch(() => undefined);
    throw new AppError("UPLOAD_SIZE_MISMATCH", "The uploaded file size does not match what was declared.", 409);
  }

  const storedContentType = metadata.contentType.split(";", 1)[0].trim().toLowerCase();
  if (storedContentType !== session.declaredMimeType.toLowerCase()) {
    await storage.deleteObject(session.storageKey).catch(() => undefined);
    throw new AppError(
      "UPLOAD_MIME_MISMATCH",
      "The uploaded file content type does not match the authorized upload type.",
      409,
    );
  }

  if (session.extension === "pdf") {
    const isRealPdf = await verifyPdfSignature(storage, session.storageKey);
    if (!isRealPdf) {
      await storage.deleteObject(session.storageKey).catch(() => undefined);
      throw new AppError("UNSAFE_FILE_CONTENT", "The uploaded file does not have a valid PDF signature.", 400);
    }
  }

  const checksum = await computeStreamedChecksum(storage, session.storageKey);
  const duplicate = await findDuplicateByChecksum(actor.companyId, canonicalProjectId, checksum);

  // Direct uploads must finalize on the request's critical path. Pulling the
  // complete Blob back into a Vercel Function and booting pdf-parse here can
  // outlive the function timeout even for a small, valid drawing, leaving the
  // browser permanently stuck on “Finalizing…”. Page count is optional
  // enrichment (never a security or acceptance gate) and is populated by the
  // existing preprocessing/page-rendering workflow after the ProjectFile is
  // safely persisted.
  const pageCount = null;

  const { discipline, drawingType, issueDate, sheetNumber, preparedBy, checkedBy, approvedBy, notes, drawingNumber, title, revision, scale } = input.metadata;

  let committed:
    | { kind: "created"; row: ProjectFileRecord }
    | { kind: "existing"; row: ProjectFileRecord }
    | { kind: "cancelled" }
    | { kind: "expired" };
  try {
    committed = await prisma.$transaction(async (tx) => {
      const lockedSession = await getUploadSessionForUpdate(actor.companyId, input.sessionId, tx);
      assertUploadSessionProject(lockedSession, canonicalProjectId);
      assertUploadSessionActor(lockedSession, actor.userId);

      if (lockedSession.status === "CANCELLED") return { kind: "cancelled" as const };

      const existing = await findProjectFileRecord(actor.companyId, lockedSession.fileId, tx);
      if (existing) {
        if (lockedSession.status === "EXPIRED") return { kind: "expired" as const };
        assertExpectedFinalizedFile(lockedSession, existing, canonicalProjectId);
        if (lockedSession.status !== "FINALIZED") {
          await setUploadSessionStatus(lockedSession.id, "FINALIZED", new Date(), tx);
        }
        await ensureDrawingUploadedAudit(tx, actor.companyId, existing);
        return { kind: "existing" as const, row: existing };
      }

      if (lockedSession.status === "EXPIRED" || lockedSession.expiresAt.getTime() <= Date.now()) {
        if (lockedSession.status === "PENDING") {
          await setUploadSessionStatus(lockedSession.id, "EXPIRED", undefined, tx);
        }
        return { kind: "expired" as const };
      }

      const row = await createProjectFile(actor.companyId, {
        id: lockedSession.fileId,
        projectId: canonicalProjectId,
        uploadedByUserId: lockedSession.actorUserId,
        originalName: lockedSession.originalName,
        safeFileName: lockedSession.storageKey.split("/").pop() ?? lockedSession.originalName,
        storageKey: lockedSession.storageKey,
        mimeType: lockedSession.declaredMimeType,
        extension: lockedSession.extension,
        fileSize: metadata.size,
        checksum,
        drawingNumber: drawingNumber ?? null,
        drawingTitle: title ?? null,
        revisionNumber: revision ?? null,
        scaleText: scale ?? null,
        pageCount,
        metadataJson: { recordKind: "drawing", discipline, drawingType, issueDate, sheetNumber, preparedBy, checkedBy, approvedBy, notes },
      }, tx);

      await setUploadSessionStatus(lockedSession.id, "FINALIZED", new Date(), tx);
      await ensureDrawingUploadedAudit(tx, actor.companyId, row);
      return { kind: "created" as const, row };
    });
  } catch (error) {
    await createAuditLog(actor.companyId, {
      entityType: "ProjectFile",
      entityId: session.fileId,
      action: "DRAWING_UPLOAD_FAILED",
      payload: { projectId: canonicalProjectId, originalName: session.originalName, stage: "finalize_db_write" },
    }).catch(() => undefined);
    throw error;
  }

  if (committed.kind === "cancelled") {
    throw new AppError("UPLOAD_SESSION_CANCELLED", "This upload session was cancelled.", 409);
  }
  if (committed.kind === "expired") {
    throw new AppError("UPLOAD_SESSION_EXPIRED", "This upload session has expired. Start the upload again.", 410);
  }

  return {
    drawing: toDrawingDTO(committed.row),
    duplicateOfFileId: committed.kind === "created" && duplicate && isDrawingRecord(duplicate) ? duplicate.id : null,
    alreadyFinalized: committed.kind === "existing",
  };
}
