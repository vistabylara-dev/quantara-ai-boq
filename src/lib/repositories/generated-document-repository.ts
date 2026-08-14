import { DocumentAudience, GeneratedDocumentStatus, GeneratedDocumentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";

const documentInclude = {
  template: true,
  templateVersion: { select: { versionNumber: true } },
  generatedByUser: { select: { fullName: true } },
  _count: { select: { proposalDocuments: true } },
} satisfies Prisma.GeneratedDocumentInclude;

type DocumentRecord = Prisma.GeneratedDocumentGetPayload<{ include: typeof documentInclude }>;

export function toGeneratedDocumentDTO(row: DocumentRecord) {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId,
    boqId: row.boqId,
    templateId: row.templateId,
    templateVersionId: row.templateVersionId,
    templateVersionNumber: row.templateVersion?.versionNumber ?? null,
    templateName: row.template.name,
    revisionNumber: row.revisionNumber,
    type: row.type,
    audience: row.audience,
    status: row.status,
    isDraft: row.isDraft,
    fileName: row.fileName,
    mimeType: row.mimeType,
    retentionLocked: row._count.proposalDocuments > 0,
    canDelete: row._count.proposalDocuments === 0,
    fileSize: row.fileSize,
    checksum: row.checksum,
    generatedByUserId: row.generatedByUserId,
    generatedByName: row.generatedByName,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
  };
}

export type CreateQueuedDocumentInput = {
  projectId: string;
  boqId: string;
  templateId: string;
  /** TEMPLATE-LINK-1 — the exact PUBLISHED DocumentTemplateVersion resolved at generation time; null if the template has no published version yet. */
  templateVersionId?: string | null;
  revisionNumber: number;
  type: GeneratedDocumentType;
  audience: DocumentAudience;
  isDraft: boolean;
  generatedByUserId?: string | null;
  generatedByName: string;
};

export async function createQueuedDocument(companyId: string, input: CreateQueuedDocumentInput) {
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.generatedDocument.create({
      data: {
        companyId,
        projectId: input.projectId,
        boqId: input.boqId,
        templateId: input.templateId,
        templateVersionId: input.templateVersionId ?? null,
        revisionNumber: input.revisionNumber,
        type: input.type,
        audience: input.audience,
        isDraft: input.isDraft,
        status: GeneratedDocumentStatus.GENERATING,
        generatedByUserId: input.generatedByUserId ?? null,
        generatedByName: input.generatedByName,
      },
      include: documentInclude,
    });
    await createAuditLog(companyId, {
      entityType: "GeneratedDocument",
      entityId: row.id,
      action: "DOCUMENT_GENERATION_REQUESTED",
      payload: { type: row.type, audience: row.audience, boqId: row.boqId, revisionNumber: row.revisionNumber },
    }, tx);
    return row;
  });
  return toGeneratedDocumentDTO(created);
}

export type CompleteDocumentInput = {
  storageKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
  generationMetadataJson?: Prisma.InputJsonValue;
};

export async function markDocumentCompleted(companyId: string, documentId: string, input: CompleteDocumentInput) {
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.generatedDocument.update({
      where: { id: documentId, companyId },
      data: {
        status: GeneratedDocumentStatus.COMPLETED,
        storageKey: input.storageKey,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        checksum: input.checksum,
        generationMetadataJson: input.generationMetadataJson ?? Prisma.JsonNull,
        completedAt: new Date(),
      },
      include: documentInclude,
    });
    await createAuditLog(companyId, {
      entityType: "GeneratedDocument",
      entityId: row.id,
      action: "DOCUMENT_GENERATED",
      payload: { type: row.type, fileName: row.fileName, fileSize: row.fileSize, checksum: row.checksum },
    }, tx);
    return row;
  });
  return toGeneratedDocumentDTO(updated);
}

export async function markDocumentFailed(companyId: string, documentId: string, errorMessage: string) {
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.generatedDocument.update({
      where: { id: documentId, companyId },
      data: { status: GeneratedDocumentStatus.FAILED, errorMessage, failedAt: new Date() },
      include: documentInclude,
    });
    await createAuditLog(companyId, {
      entityType: "GeneratedDocument",
      entityId: row.id,
      action: "DOCUMENT_GENERATION_FAILED",
      payload: { type: row.type, errorMessage },
    }, tx);
    return row;
  });
  return toGeneratedDocumentDTO(updated);
}

export async function getGeneratedDocumentRecord(companyId: string, documentId: string): Promise<DocumentRecord> {
  const row = await prisma.generatedDocument.findFirst({ where: { id: documentId, companyId }, include: documentInclude });
  if (!row) throw new NotFoundError("Generated document not found.");
  return row;
}

export async function getGeneratedDocument(companyId: string, documentId: string) {
  return toGeneratedDocumentDTO(await getGeneratedDocumentRecord(companyId, documentId));
}

export async function listGeneratedDocumentsForProject(companyId: string, projectId: string) {
  const rows = await prisma.generatedDocument.findMany({
    where: { companyId, projectId },
    include: documentInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toGeneratedDocumentDTO);
}

export async function recordDownload(companyId: string, documentId: string) {
  await createAuditLog(companyId, {
    entityType: "GeneratedDocument",
    entityId: documentId,
    action: "DOCUMENT_DOWNLOADED",
    payload: {},
  });
}

export async function deleteGeneratedDocument(companyId: string, documentId: string) {
  const current = await getGeneratedDocumentRecord(companyId, documentId);
  if (current._count.proposalDocuments > 0) {
    throw new AppError(
      "DOCUMENT_RETENTION_LOCKED",
      "This document is attached to proposal evidence and cannot be deleted.",
      409,
    );
  }
  await prisma.$transaction(async (tx) => {
    await tx.generatedDocument.delete({ where: { id: current.id, companyId } });
    await createAuditLog(companyId, {
      entityType: "GeneratedDocument",
      entityId: current.id,
      action: "DOCUMENT_DELETED",
      payload: { type: current.type, fileName: current.fileName },
    }, tx);
  });
  return { id: current.id, storageKey: current.storageKey, deleted: true };
}
