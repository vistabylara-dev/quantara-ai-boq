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
  projectId: string;
  uploadedByUserId: string;
  originalName: string;
  safeFileName: string;
  storageKey: string;
  mimeType: string;
  extension: string;
  fileSize: number;
  checksum: string;
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
    fileSize: row.fileSize,
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
    uploadedBy: { id: row.uploadedByUser.id, fullName: row.uploadedByUser.fullName, email: row.uploadedByUser.email },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createProjectFile(companyId: string, input: CreateProjectFileInput, db: DbClient = prisma): Promise<ProjectFileRecord> {
  return db.projectFile.create({
    data: {
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
