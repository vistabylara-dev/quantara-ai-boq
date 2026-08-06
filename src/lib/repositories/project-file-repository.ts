import { Prisma, ProjectFileClassification, ProjectFileStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";

type DbClient = typeof prisma | Prisma.TransactionClient;

const projectFileInclude = {
  uploadedByUser: { select: { id: true, fullName: true, email: true } },
  classificationConfirmedByUser: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.ProjectFileInclude;

export type ProjectFileRecord = Prisma.ProjectFileGetPayload<{ include: typeof projectFileInclude }>;

export type CreateProjectFileInput = {
  /** CORE-FLOW-1: explicit id so a pre-generated fileId (embedded in the Blob storage pathname before finalize) becomes the real ProjectFile.id. Omit to auto-generate as before. */
  id?: string;
  projectId: string;
  uploadedByUserId: string;
  originalName: string;
  safeFileName: string;
  storageKey: string;
  mimeType: string;
  extension: string;
  fileSize: number;
  checksum: string;
  drawingNumber?: string | null;
  drawingTitle?: string | null;
  revisionNumber?: string | null;
  scaleText?: string | null;
  pageCount?: number | null;
  metadataJson?: Prisma.InputJsonValue;
};

export function toProjectFileDTO(row: ProjectFileRecord) {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId,
    originalName: row.originalName,
    safeFileName: row.safeFileName,
    mimeType: row.mimeType,
    extension: row.extension,
    fileSize: Number(row.fileSize),
    checksum: row.checksum,
    classification: row.classification,
    classificationConfidence: row.classificationConfidence?.toNumber() ?? null,
    classificationConfirmedAt: row.classificationConfirmedAt?.toISOString() ?? null,
    classificationConfirmedBy: row.classificationConfirmedByUser
      ? { id: row.classificationConfirmedByUser.id, fullName: row.classificationConfirmedByUser.fullName }
      : null,
    status: row.status,
    language: row.language,
    pageCount: row.pageCount,
    sheetCount: row.sheetCount,
    drawingNumber: row.drawingNumber,
    drawingTitle: row.drawingTitle,
    revisionNumber: row.revisionNumber,
    scaleText: row.scaleText,
    detectedScale: row.detectedScale,
    measurementUnit: row.measurementUnit,
    processingErrorCode: row.processingErrorCode,
    processingErrorMessage: row.processingErrorMessage,
    metadata: row.metadataJson,
    uploadedBy: { id: row.uploadedByUser.id, fullName: row.uploadedByUser.fullName, email: row.uploadedByUser.email },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createProjectFile(companyId: string, input: CreateProjectFileInput, db: DbClient = prisma): Promise<ProjectFileRecord> {
  return db.projectFile.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      companyId,
      projectId: input.projectId,
      uploadedByUserId: input.uploadedByUserId,
      originalName: input.originalName,
      safeFileName: input.safeFileName,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      extension: input.extension,
      fileSize: input.fileSize,
      checksum: input.checksum,
      status: ProjectFileStatus.UPLOADED,
      classification: ProjectFileClassification.UNKNOWN,
      drawingNumber: input.drawingNumber,
      drawingTitle: input.drawingTitle,
      revisionNumber: input.revisionNumber,
      scaleText: input.scaleText,
      pageCount: input.pageCount,
      metadataJson: input.metadataJson,
    },
    include: projectFileInclude,
  });
}

export async function getProjectFileRecord(companyId: string, fileId: string, db: DbClient = prisma): Promise<ProjectFileRecord> {
  const row = await db.projectFile.findFirst({
    where: { id: fileId, companyId },
    include: projectFileInclude,
  });
  if (!row) throw new NotFoundError("File not found.");
  return row;
}

/** Non-throwing lookup — used by finalize to detect an already-completed (idempotent replay) upload. */
export async function findProjectFileRecord(companyId: string, fileId: string, db: DbClient = prisma): Promise<ProjectFileRecord | null> {
  return db.projectFile.findFirst({ where: { id: fileId, companyId }, include: projectFileInclude });
}

export async function listProjectFiles(companyId: string, projectId: string, db: DbClient = prisma): Promise<ProjectFileRecord[]> {
  return db.projectFile.findMany({
    where: { companyId, projectId },
    include: projectFileInclude,
    orderBy: { createdAt: "desc" },
  });
}

/** Non-blocking duplicate signal — the caller decides whether to warn or proceed; uploads are never silently rejected on this alone. */
export async function findDuplicateByChecksum(companyId: string, projectId: string, checksum: string, db: DbClient = prisma): Promise<ProjectFileRecord | null> {
  return db.projectFile.findFirst({
    where: { companyId, projectId, checksum },
    include: projectFileInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteProjectFileRow(companyId: string, fileId: string, db: DbClient = prisma): Promise<void> {
  const result = await db.projectFile.deleteMany({ where: { id: fileId, companyId } });
  if (result.count === 0) throw new NotFoundError("File not found.");
}

export async function updateProjectFileStatus(companyId: string, fileId: string, status: ProjectFileStatus, db: DbClient = prisma): Promise<void> {
  const result = await db.projectFile.updateMany({ where: { id: fileId, companyId }, data: { status } });
  if (result.count === 0) throw new NotFoundError("File not found.");
}

export type ProjectFileMetadataPatch = {
  drawingNumber?: string | null;
  drawingTitle?: string | null;
  revisionNumber?: string | null;
  scaleText?: string | null;
  metadataJson?: Prisma.InputJsonValue;
};

/** Column-level patch for the fields a drawing's classification form can edit, plus a full metadataJson replacement for everything that has no dedicated column. */
export async function updateProjectFileMetadata(
  companyId: string,
  fileId: string,
  patch: ProjectFileMetadataPatch,
  db: DbClient = prisma,
): Promise<ProjectFileRecord> {
  const row = await db.projectFile.findFirst({ where: { id: fileId, companyId } });
  if (!row) throw new NotFoundError("File not found.");

  return db.projectFile.update({
    where: { id: fileId },
    data: patch,
    include: projectFileInclude,
  });
}

/**
 * Applies an automatic classification suggestion. Never overwrites a
 * human-confirmed classification (spec section 9: "classification must not
 * delete or mutate extracted data silently") — if the file already has a
 * confirmed classification, only the metadataJson suggestion snapshot is
 * refreshed, the confirmed classification/confidence/status are left alone.
 */
export async function applyAutoClassification(
  companyId: string,
  fileId: string,
  suggestion: { classification: ProjectFileClassification; confidence: number; matchedSignals: string[]; method: string },
  db: DbClient = prisma,
): Promise<void> {
  const file = await db.projectFile.findFirst({ where: { id: fileId, companyId } });
  if (!file) throw new NotFoundError("File not found.");

  const existingMeta = (file.metadataJson as Record<string, unknown> | null) ?? {};
  const metadataJson = {
    ...existingMeta,
    autoClassification: { ...suggestion, ranAt: new Date().toISOString() },
  };

  if (file.classificationConfirmedAt) {
    await db.projectFile.update({ where: { id: fileId }, data: { metadataJson } });
    return;
  }

  await db.projectFile.update({
    where: { id: fileId },
    data: {
      classification: suggestion.classification,
      classificationConfidence: suggestion.confidence,
      status: ProjectFileStatus.CLASSIFIED,
      metadataJson,
    },
  });
}

export type ConfirmOrReclassifyResult = { updated: ProjectFileRecord; previousClassification: ProjectFileClassification; isReclassification: boolean };

/** Human confirm-or-change action. Confirming as-is only stamps who/when; changing the type also sets confidence to 100 (human-certain, no longer probabilistic) and always requires an explicit audit log entry (written by the caller). */
export async function confirmOrReclassifyProjectFile(
  companyId: string,
  fileId: string,
  userId: string,
  newClassification: ProjectFileClassification | undefined,
  db: DbClient = prisma,
): Promise<ConfirmOrReclassifyResult> {
  const file = await db.projectFile.findFirst({ where: { id: fileId, companyId } });
  if (!file) throw new NotFoundError("File not found.");

  const isReclassification = newClassification !== undefined && newClassification !== file.classification;
  const updated = await db.projectFile.update({
    where: { id: fileId },
    data: {
      classification: newClassification ?? file.classification,
      classificationConfidence: isReclassification ? 100 : file.classificationConfidence,
      classificationConfirmedByUserId: userId,
      classificationConfirmedAt: new Date(),
    },
    include: projectFileInclude,
  });

  return { updated, previousClassification: file.classification, isReclassification };
}
