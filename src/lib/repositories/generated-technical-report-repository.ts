import { GeneratedDocumentType, Prisma, TechnicalReportStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import type { ReportTemplateSections } from "@/lib/documents/report-template-sections";
import { generateReportShareToken, hashReportShareToken } from "@/lib/documents/technical-report-share";

const reportInclude = {
  template: { select: { id: true, name: true, code: true } },
} satisfies Prisma.GeneratedTechnicalReportInclude;

type ReportRecord = Prisma.GeneratedTechnicalReportGetPayload<{ include: typeof reportInclude }>;

export function toGeneratedTechnicalReportDTO(row: ReportRecord) {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId,
    templateId: row.templateId,
    templateName: row.template.name,
    templateCode: row.template.code,
    name: row.name,
    status: row.status,
    sections: row.sectionsSnapshotJson as unknown as ReportTemplateSections,
    placeholders: row.placeholdersJson as unknown as string[],
    fieldValues: row.fieldValuesJson as unknown as Record<string, string>,
    documentType: row.documentType,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    checksum: row.checksum,
    generatedByUserId: row.generatedByUserId,
    generatedByName: row.generatedByName,
    errorMessage: row.errorMessage,
    // The token hash itself is never exposed to any API response — only whether a link currently
    // resolves (active, not revoked, not expired) and when it expires.
    hasActiveShareLink: Boolean(row.shareTokenHash) && !row.shareRevokedAt && (!row.shareExpiresAt || row.shareExpiresAt.getTime() > Date.now()),
    shareExpiresAt: row.shareExpiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export type CreateDraftReportInput = {
  projectId: string;
  templateId: string;
  name: string;
  sectionsSnapshotJson: ReportTemplateSections;
  placeholdersJson: string[];
  generatedByUserId?: string | null;
  generatedByName: string;
};

export async function createDraftReport(companyId: string, input: CreateDraftReportInput) {
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.generatedTechnicalReport.create({
      data: {
        companyId,
        projectId: input.projectId,
        templateId: input.templateId,
        name: input.name,
        status: TechnicalReportStatus.DRAFT,
        sectionsSnapshotJson: input.sectionsSnapshotJson as unknown as Prisma.InputJsonValue,
        placeholdersJson: input.placeholdersJson as unknown as Prisma.InputJsonValue,
        fieldValuesJson: {} as Prisma.InputJsonValue,
        generatedByUserId: input.generatedByUserId ?? null,
        generatedByName: input.generatedByName,
      },
      include: reportInclude,
    });
    await createAuditLog(companyId, {
      entityType: "GeneratedTechnicalReport",
      entityId: row.id,
      action: "TECHNICAL_REPORT_CREATED",
      payload: { name: row.name, templateId: row.templateId, projectId: row.projectId },
    }, tx);
    return row;
  });
  return toGeneratedTechnicalReportDTO(created);
}

async function getReportRecord(companyId: string, reportId: string): Promise<ReportRecord> {
  const row = await prisma.generatedTechnicalReport.findFirst({ where: { id: reportId, companyId }, include: reportInclude });
  if (!row) throw new NotFoundError("Technical report not found.");
  return row;
}

export async function getGeneratedTechnicalReportRecord(companyId: string, reportId: string) {
  return getReportRecord(companyId, reportId);
}

export async function getGeneratedTechnicalReport(companyId: string, reportId: string) {
  return toGeneratedTechnicalReportDTO(await getReportRecord(companyId, reportId));
}

export async function listGeneratedTechnicalReportsForProject(companyId: string, projectId: string) {
  const rows = await prisma.generatedTechnicalReport.findMany({
    where: { companyId, projectId },
    include: reportInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toGeneratedTechnicalReportDTO);
}

export async function updateReportFieldValues(companyId: string, reportId: string, fieldValues: Record<string, string>) {
  const current = await getReportRecord(companyId, reportId);
  const updated = await prisma.generatedTechnicalReport.update({
    where: { id: current.id, companyId },
    data: { fieldValuesJson: fieldValues as unknown as Prisma.InputJsonValue },
    include: reportInclude,
  });
  return toGeneratedTechnicalReportDTO(updated);
}

export type CompleteReportInput = {
  documentType: GeneratedDocumentType;
  storageKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
};

export async function markReportCompleted(companyId: string, reportId: string, input: CompleteReportInput) {
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.generatedTechnicalReport.update({
      where: { id: reportId, companyId },
      data: {
        status: TechnicalReportStatus.COMPLETED,
        documentType: input.documentType,
        storageKey: input.storageKey,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        checksum: input.checksum,
        completedAt: new Date(),
        errorMessage: null,
      },
      include: reportInclude,
    });
    await createAuditLog(companyId, {
      entityType: "GeneratedTechnicalReport",
      entityId: row.id,
      action: "TECHNICAL_REPORT_GENERATED",
      payload: { fileName: row.fileName, fileSize: row.fileSize, checksum: row.checksum },
    }, tx);
    return row;
  });
  return toGeneratedTechnicalReportDTO(updated);
}

export async function markReportFailed(companyId: string, reportId: string, errorMessage: string) {
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.generatedTechnicalReport.update({
      where: { id: reportId, companyId },
      data: { errorMessage },
      include: reportInclude,
    });
    await createAuditLog(companyId, {
      entityType: "GeneratedTechnicalReport",
      entityId: row.id,
      action: "TECHNICAL_REPORT_GENERATION_FAILED",
      payload: { errorMessage },
    }, tx);
    return row;
  });
  return toGeneratedTechnicalReportDTO(updated);
}

const DEFAULT_SHARE_LINK_TTL_DAYS = 30;

/**
 * Creates (or rotates) the report's client-facing secure link. Rotating overwrites the previous
 * hash, so any previously issued raw token immediately stops resolving — matches
 * regenerateProposalLink's behavior for the same reason (an old link that already reached an
 * inbox should be revocable by generating a new one, without a separate explicit revoke step).
 * Caller (service layer) is responsible for checking the report is COMPLETED first.
 */
export async function createReportShareLink(companyId: string, reportId: string, expiresInDays: number = DEFAULT_SHARE_LINK_TTL_DAYS) {
  const current = await getReportRecord(companyId, reportId);
  const rawToken = generateReportShareToken();
  const shareTokenHash = hashReportShareToken(rawToken);
  const shareExpiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.generatedTechnicalReport.update({
      where: { id: current.id, companyId },
      data: { shareTokenHash, shareExpiresAt, shareRevokedAt: null },
      include: reportInclude,
    });
    await createAuditLog(companyId, {
      entityType: "GeneratedTechnicalReport",
      entityId: row.id,
      action: "TECHNICAL_REPORT_SHARE_LINK_CREATED",
      payload: { shareExpiresAt: shareExpiresAt.toISOString() },
    }, tx);
    return row;
  });
  return { report: toGeneratedTechnicalReportDTO(updated), rawToken };
}

export async function revokeReportShareLink(companyId: string, reportId: string) {
  const current = await getReportRecord(companyId, reportId);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.generatedTechnicalReport.update({
      where: { id: current.id, companyId },
      data: { shareRevokedAt: new Date() },
      include: reportInclude,
    });
    await createAuditLog(companyId, {
      entityType: "GeneratedTechnicalReport",
      entityId: row.id,
      action: "TECHNICAL_REPORT_SHARE_LINK_REVOKED",
      payload: {},
    }, tx);
    return row;
  });
  return toGeneratedTechnicalReportDTO(updated);
}

export async function deleteGeneratedTechnicalReport(companyId: string, reportId: string) {
  const current = await getReportRecord(companyId, reportId);
  await prisma.$transaction(async (tx) => {
    await tx.generatedTechnicalReport.delete({ where: { id: current.id, companyId } });
    await createAuditLog(companyId, {
      entityType: "GeneratedTechnicalReport",
      entityId: current.id,
      action: "TECHNICAL_REPORT_DELETED",
      payload: { name: current.name, fileName: current.fileName },
    }, tx);
  });
  return { id: current.id, storageKey: current.storageKey, deleted: true };
}
