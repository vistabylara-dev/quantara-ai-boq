import { createHash } from "node:crypto";
import { GeneratedDocumentType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { getReportTemplateRecord } from "@/lib/repositories/report-template-repository";
import { resolveTechnicalReportTemplateVersion } from "@/lib/services/template-resolution-service";
import { reportTemplateSectionsSchema, extractPlaceholders, applyFieldValues } from "@/lib/documents/report-template-sections";
import {
  createDraftReport,
  deleteGeneratedTechnicalReport,
  getGeneratedTechnicalReport,
  getGeneratedTechnicalReportRecord,
  listGeneratedTechnicalReportsForProject,
  markReportCompleted,
  markReportFailed,
  updateReportFieldValues,
} from "@/lib/repositories/generated-technical-report-repository";
import { createStorageAdapter, resolveStorageProvider } from "@/lib/storage/storage-factory";
import type { DocumentStorageAdapter } from "@/lib/storage/document-storage-adapter";
import { generateTechnicalReportDocx } from "@/lib/documents/generators/technical-report-docx-generator";

const SUPPORTED_OUTPUT_TYPES: GeneratedDocumentType[] = [GeneratedDocumentType.DOCX];

/**
 * Was hardcoded to the local-filesystem adapter — the local disk a Vercel
 * serverless function sees is ephemeral and read-only outside /tmp, so both
 * the write on generate and the read on download failed in production. Same
 * fix, same "generated-documents" storage namespace, as the identical
 * pattern already used by document-generation-service.ts for BOQ documents.
 */
let cachedDocumentStorageAdapter: DocumentStorageAdapter | null = null;
function getDocumentStorageAdapter(): DocumentStorageAdapter {
  if (!cachedDocumentStorageAdapter) {
    cachedDocumentStorageAdapter = createStorageAdapter({ provider: resolveStorageProvider(), purpose: "generated-documents" });
  }
  return cachedDocumentStorageAdapter;
}

export type CreateReportFromTemplateInput = {
  templateId: string;
  name: string;
};

/**
 * Instantiates a report for a project from a template — snapshots the template's sections at this
 * moment (so a later template edit never silently changes an in-flight report, mirroring how BOQ
 * revision snapshots protect a locked BOQ) and derives the placeholder list the user will fill in.
 */
export async function createReportFromTemplate(actor: CurrentActor, projectIdentifier: string, input: CreateReportFromTemplateInput) {
  requireCapability(actor, "technical-reports:generate");

  const project = await getProjectRecord(actor.companyId, projectIdentifier);
  const templateRecord = await getReportTemplateRecord(actor.companyId, input.templateId);
  if (!templateRecord.isActive) {
    throw new AppError("REPORT_TEMPLATE_INACTIVE", "This report template has been deactivated and cannot be used.", 409);
  }
  // TEMPLATE-LINK-1 — snapshot from the PUBLISHED version when one exists,
  // falling back to the template's own live sectionsJson otherwise (never
  // blocks report creation), and record which version this snapshot came
  // from so the admin Template Centre can show real usage.
  const resolvedVersion = await resolveTechnicalReportTemplateVersion({ companyId: actor.companyId, templateId: templateRecord.id });
  const sections = reportTemplateSectionsSchema.parse(resolvedVersion.sectionsJson);
  const placeholders = extractPlaceholders(sections);

  return createDraftReport(actor.companyId, {
    projectId: project.id,
    templateId: templateRecord.id,
    templateVersionId: resolvedVersion.versionId,
    name: input.name,
    sectionsSnapshotJson: sections,
    placeholdersJson: placeholders,
    generatedByUserId: actor.userId,
    generatedByName: actor.fullName,
  });
}

export async function listReportsForProject(actor: CurrentActor, projectIdentifier: string) {
  const project = await getProjectRecord(actor.companyId, projectIdentifier);
  return listGeneratedTechnicalReportsForProject(actor.companyId, project.id);
}

export async function getReport(actor: CurrentActor, reportId: string) {
  return getGeneratedTechnicalReport(actor.companyId, reportId);
}

/** Only accepts values for placeholders that actually exist on this report — unknown keys are
 *  silently dropped rather than rejected, so a client can always PATCH with its full local form
 *  state without needing to diff against the current placeholder list first. */
export async function updateReportFields(actor: CurrentActor, reportId: string, values: Record<string, string>) {
  requireCapability(actor, "technical-reports:generate");
  const current = await getGeneratedTechnicalReportRecord(actor.companyId, reportId);
  const placeholders = new Set(current.placeholdersJson as unknown as string[]);
  const filtered = Object.fromEntries(Object.entries(values).filter(([key]) => placeholders.has(key)));
  const merged = { ...(current.fieldValuesJson as unknown as Record<string, string>), ...filtered };
  return updateReportFieldValues(actor.companyId, reportId, merged);
}

export async function generateReportDocument(actor: CurrentActor, reportId: string, documentType: GeneratedDocumentType) {
  requireCapability(actor, "technical-reports:generate");

  if (!SUPPORTED_OUTPUT_TYPES.includes(documentType)) {
    throw new AppError(
      "UNSUPPORTED_REPORT_DOCUMENT_TYPE",
      `Technical reports currently only generate as DOCX. ${documentType} is not yet supported.`,
      400,
    );
  }


  const record = await getGeneratedTechnicalReportRecord(actor.companyId, reportId);
  if (record.status === "COMPLETED") {
    throw new AppError(
      "TECHNICAL_REPORT_IMMUTABLE",
      "Completed technical reports are immutable. Create a new report revision instead.",
      409,
    );
  }
  const project = await getProjectRecord(actor.companyId, record.projectId);
  const company = await prisma.company.findUniqueOrThrow({ where: { id: actor.companyId } });

  const sections = reportTemplateSectionsSchema.parse(record.sectionsSnapshotJson);
  const fieldValues = record.fieldValuesJson as unknown as Record<string, string>;
  const filledSections = applyFieldValues(sections, fieldValues);

  try {
    const fileBuffer = await generateTechnicalReportDocx({
      reportName: record.name,
      companyName: company.tradeName || company.legalName,
      projectName: project.name,
      sections: filledSections,
    });

    const checksum = createHash("sha256").update(fileBuffer).digest("hex");
    const safeName = record.name.replace(/[^a-zA-Z0-9-]/g, "_").slice(0, 80);
    const fileName = `${safeName}-${record.id.slice(0, 8)}.docx`;
    const storageKey = `technical-reports/${actor.companyId}/${project.id}/${record.id}.docx`;

    await getDocumentStorageAdapter().putObject({
      key: storageKey,
      body: fileBuffer,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    return await markReportCompleted(actor.companyId, reportId, {
      documentType: GeneratedDocumentType.DOCX,
      storageKey,
      fileName,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileSize: fileBuffer.byteLength,
      checksum,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Technical report generation failed.";
    await markReportFailed(actor.companyId, reportId, message.slice(0, 500));
    if (error instanceof AppError) throw error;
    throw new AppError("TECHNICAL_REPORT_GENERATION_FAILED", "Technical report generation failed. Please try again.", 500);
  }
}

export async function getReportForDownload(actor: CurrentActor, reportId: string) {
  requireCapability(actor, "documents:download");
  const record = await getGeneratedTechnicalReportRecord(actor.companyId, reportId);
  if (record.status !== "COMPLETED" || !record.storageKey) {
    throw new AppError("TECHNICAL_REPORT_NOT_READY", "This report has not been generated yet.", 409);
  }
  const buffer = await getDocumentStorageAdapter().getObject(record.storageKey);
  return {
    buffer,
    fileName: record.fileName ?? `${record.name}.docx`,
    mimeType: record.mimeType ?? "application/octet-stream",
  };
}

export async function deleteReport(actor: CurrentActor, reportId: string) {
  requireCapability(actor, "technical-reports:delete");
  const result = await deleteGeneratedTechnicalReport(actor.companyId, reportId);
  if (result.storageKey) {
    await getDocumentStorageAdapter().deleteObject(result.storageKey).catch(() => undefined);
  }
  return result;
}
