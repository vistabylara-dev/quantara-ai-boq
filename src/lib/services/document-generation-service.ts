import { createHash } from "node:crypto";
import { DocumentAudience, GeneratedDocumentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { getBOQRecord, toBOQDTO } from "@/lib/repositories/boq-repository";
import { runBOQVerification } from "@/lib/repositories/verification-repository";
import { getTemplate } from "@/lib/repositories/document-template-repository";
import { resolveDocumentTemplateVersion } from "@/lib/services/template-resolution-service";
import { mergeStyleConfig, mergeContentConfig } from "@/lib/documents/template-config";
import type { DocumentTemplateStyleConfig, DocumentTemplateContentConfig } from "@/lib/documents/template-config";
import {
  createQueuedDocument,
  deleteGeneratedDocument as deleteGeneratedDocumentRow,
  getGeneratedDocumentRecord,
  listGeneratedDocumentsForProject,
  markDocumentCompleted,
  markDocumentFailed,
  recordDownload,
} from "@/lib/repositories/generated-document-repository";
import { createStorageAdapter, resolveStorageProvider } from "@/lib/storage/storage-factory";
import type { DocumentStorageAdapter } from "@/lib/storage/document-storage-adapter";
import { buildDocumentData } from "@/lib/documents/build-document-data";
import { generateCsv } from "@/lib/documents/generators/csv-generator";
import { generateXlsx } from "@/lib/documents/generators/xlsx-generator";
import { generatePdf } from "@/lib/documents/generators/pdf-generator";
import { generateDocx } from "@/lib/documents/generators/docx-generator";
import { generateHtml } from "@/lib/documents/generators/html-generator";
import { calculateBOQTotals } from "@/lib/calculations/boq-calculator";
import { recordDocumentGenerated } from "@/lib/entitlements/entitlement-service";
import { canGenerateDocumentEffective, getEffectiveEntitlements } from "@/lib/entitlements/effective-entitlement-service";
import { assertCleanOutputAuthorized, assertCleanOutputAuthorizedEffective } from "@/lib/services/commercial-entitlement-service";

export const TRIAL_WATERMARK_TEXT = "Generated with Quantara — Trial Version";

/**
 * Was previously hardcoded to the local-filesystem storage adapter, which
 * writes to disk — fine in dev/test, but Vercel's serverless function
 * bundle is read-only outside /tmp, so every generation attempt in
 * production failed with ENOENT on mkdir. Routed through the same factory
 * project-file-service already uses, so production correctly gets
 * VercelBlobStorageAdapter via STORAGE_PROVIDER=vercel-blob.
 */
let cachedDocumentStorageAdapter: DocumentStorageAdapter | null = null;
function getDocumentStorageAdapter(): DocumentStorageAdapter {
  if (!cachedDocumentStorageAdapter) {
    cachedDocumentStorageAdapter = createStorageAdapter({ provider: resolveStorageProvider(), purpose: "generated-documents" });
  }
  return cachedDocumentStorageAdapter;
}

const FINAL_ONLY_TYPES: GeneratedDocumentType[] = [
  GeneratedDocumentType.PDF,
  GeneratedDocumentType.DOCX,
  GeneratedDocumentType.XLSX,
];

const MIME_TYPES: Record<GeneratedDocumentType, string> = {
  CSV: "text/csv",
  XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  PDF: "application/pdf",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  HTML: "text/html",
};

const FILE_EXTENSIONS: Record<GeneratedDocumentType, string> = {
  CSV: "csv",
  XLSX: "xlsx",
  PDF: "pdf",
  DOCX: "docx",
  HTML: "html",
};

export type GenerateDocumentInput = {
  boqId: string;
  templateId: string;
  documentType: GeneratedDocumentType;
  audience: DocumentAudience;
  acknowledgedWarnings?: boolean;
  /** TAYQAN Draft BOQ Word export. Defaults to today's existing (priced) behavior. */
  pricingMode?: "WITH_PRICES" | "QUANTITIES_ONLY";
};

function assertCompanyProfileComplete(company: {
  legalName: string;
  tradeName: string;
  email: string;
  address: string | null;
  defaultCurrency: string;
  taxRegistrationNumber: string | null;
}): void {
  const missing: string[] = [];
  if (!company.legalName.trim() && !company.tradeName.trim()) missing.push("company name");
  if (!company.email.trim()) missing.push("company email");
  if (!company.address?.trim()) missing.push("company address");
  if (!company.defaultCurrency.trim()) missing.push("default currency");
  if (missing.length > 0) {
    throw new AppError(
      "COMPANY_PROFILE_INCOMPLETE",
      `Complete your company profile in Settings before generating client documents. Missing: ${missing.join(", ")}.`,
      409,
      { company: missing },
    );
  }
}

type SnapshotItemLike = { totalAmount: Prisma.Decimal.Value; landedCost?: Prisma.Decimal.Value; quantity?: Prisma.Decimal.Value; status?: string | null };
type SnapshotLike = {
  discountPercentage: Prisma.Decimal.Value;
  taxRate: Prisma.Decimal.Value;
  sections: Array<{ items: SnapshotItemLike[] }>;
};

/**
 * For a locked revision, verifies the live (frozen, uneditable) BOQ rows
 * still agree with the immutable snapshot captured at lock time — a data
 * integrity guard, not a routine recomputation, since a locked BOQ cannot
 * be edited and should therefore never actually drift from its snapshot.
 */
async function assertMatchesLockedSnapshot(companyId: string, boqId: string, revisionNumber: number, liveGrandTotal: number): Promise<void> {
  const snapshot = await prisma.bOQRevisionSnapshot.findFirst({
    where: { companyId, boqId, revisionNumber },
  });
  if (!snapshot) {
    throw new AppError(
      "LOCKED_REVISION_SNAPSHOT_MISSING",
      "No immutable snapshot was found for this locked revision. Document generation is blocked until this is resolved.",
      500,
    );
  }
  const snapshotRecord = snapshot.snapshotJson as unknown as SnapshotLike;
  const items = snapshotRecord.sections.flatMap((section) => section.items);
  const snapshotTotals = calculateBOQTotals(
    items.map((item) => ({ totalAmount: item.totalAmount, landedCost: item.landedCost, quantity: item.quantity, status: item.status })),
    snapshotRecord.discountPercentage,
    snapshotRecord.taxRate,
  );
  if (Math.abs(liveGrandTotal - snapshotTotals.grandTotal.toNumber()) > 0.01) {
    throw new AppError(
      "SNAPSHOT_TOTALS_MISMATCH",
      "The locked BOQ's live totals no longer match its recorded immutable snapshot. Generation blocked for data integrity.",
      409,
    );
  }
}

/**
 * The single orchestration point for turning a BOQ revision + template
 * selection into a stored, checksummed, audit-logged file. See spec
 * section 19: authorize -> validate project/BOQ/revision/template ->
 * recalculate & compare to snapshot -> verify -> block on criticals ->
 * build canonical data -> generate -> store -> record.
 */
export async function generateDocument(actor: CurrentActor, projectIdentifier: string, input: GenerateDocumentInput) {
  requireCapability(actor, "documents:generate");
  if (input.audience === DocumentAudience.INTERNAL) {
    requireCapability(actor, "documents:generate:internal");
  }

  const project = await getProjectRecord(actor.companyId, projectIdentifier);

  let boqRecord = await getBOQRecord(actor.companyId, input.boqId);
  if (boqRecord.projectId !== project.id) {
    throw new NotFoundError("BOQ not found for this project.");
  }

  const template = await getTemplate(actor.companyId, input.templateId);
  if (!template.isActive) {
    throw new AppError("TEMPLATE_INACTIVE", "This template has been deactivated and cannot be used for generation.", 409);
  }

  // TEMPLATE-LINK-1 — pin generation to the exact PUBLISHED version in effect
  // right now, so a later template edit never silently changes what this
  // already-generated document actually contains. Falls back to the
  // template's own live config only when it has no published version yet
  // (e.g. immediately after this migration, before the backfill runs) —
  // generation must never be blocked by this addition.
  const resolvedVersion = await resolveDocumentTemplateVersion({ companyId: actor.companyId, templateId: template.id });
  const effectiveStyleConfig: DocumentTemplateStyleConfig = resolvedVersion.versionId ? mergeStyleConfig(resolvedVersion.styleConfigJson as Partial<DocumentTemplateStyleConfig> | null) : template.styleConfig;
  const effectiveContentConfig: DocumentTemplateContentConfig = resolvedVersion.versionId ? mergeContentConfig(resolvedVersion.contentConfigJson as Partial<DocumentTemplateContentConfig> | null) : template.contentConfig;

  const isLocked = boqRecord.isLocked;
  const isDraft = !isLocked;

  if (input.audience === DocumentAudience.CLIENT && !isDraft) {
    const company = await prisma.company.findUniqueOrThrow({ where: { id: actor.companyId } });
    assertCompanyProfileComplete(company);
  }

  // Commercial Canva-style enforcement: require subscription for clean output
  if (!isDraft) {
    await assertCleanOutputAuthorizedEffective(
      actor,
      project.id,
      boqRecord.id,
      boqRecord.revisionNumber,
      input.documentType as any
    );
  }

  const documentCheck = await canGenerateDocumentEffective(actor, isDraft, boqRecord.id);
  if (!documentCheck.allowed) {
    const effective = await getEffectiveEntitlements(actor);
    const isFree = effective.planType === "FREE" || effective.status === "NONE";
    const code = isFree ? "DOCUMENT_EXPORT_NOT_ALLOWED" : "TRIAL_EXPORT_LIMIT_REACHED";
    throw new AppError(code, documentCheck.reason ?? "Document generation limit reached.", 403);
  }

  // TAYQAN Draft BOQ Word export: a customer needs to review TAYQAN's
  // measured quantities before an engineer has priced (and therefore
  // locked) anything — the whole point is reviewing scope BEFORE pricing.
  // QUANTITIES_ONLY DOCX carries no commercial data at all, so the
  // locked-snapshot integrity concern FINAL_ONLY_TYPES exists for doesn't
  // apply to it. Every other FINAL_ONLY_TYPES case (including WITH_PRICES
  // DOCX) is unchanged.
  const isQuantitiesOnlyDraftDocx = input.documentType === GeneratedDocumentType.DOCX && input.pricingMode === "QUANTITIES_ONLY";
  if (FINAL_ONLY_TYPES.includes(input.documentType) && isDraft && !isQuantitiesOnlyDraftDocx) {
    throw new AppError(
      "LOCKED_REVISION_REQUIRED",
      `${input.documentType} generation requires a locked BOQ revision. Lock this revision first, or generate a CSV or HTML draft instead.`,
      409,
    );
  }

  const allItems = boqRecord.sections.flatMap(s => s.items);
  if (isLocked && allItems.length === 0) {
    throw new AppError(
      "BOQ_REVISION_EMPTY",
      "This locked revision contains no BOQ items and cannot be used to generate documents.",
      400,
    );
  }

  // Verification: locked revisions are immutable and were already required
  // to be free of unresolved critical exceptions before they could be
  // locked (see assertBOQCanBeLocked in boq-guards.ts), so their frozen
  // exceptions are read directly rather than re-run (runBOQVerification
  // itself refuses to run against a locked BOQ). Draft/unlocked BOQs are
  // re-verified fresh on every generation attempt, since they may have
  // changed since the last run.
  let unresolvedCriticalCount: number;
  if (isLocked) {
    unresolvedCriticalCount = boqRecord.verificationExceptions.filter(
      (exception) => !exception.resolved && exception.severity === "CRITICAL",
    ).length;
  } else {
    const verification = await runBOQVerification(actor.companyId, boqRecord.id);
    unresolvedCriticalCount = verification.summary.unresolvedCritical;
    boqRecord = await getBOQRecord(actor.companyId, boqRecord.id);
  }
  if (unresolvedCriticalCount > 0) {
    throw new AppError(
      "CRITICAL_VERIFICATION_EXCEPTIONS",
      `Generation is blocked: ${unresolvedCriticalCount} unresolved critical verification exception(s) remain on this BOQ.`,
      409,
      { unresolvedCriticalCount: [String(unresolvedCriticalCount)] },
    );
  }

  const boqDto = toBOQDTO(boqRecord);

  if (isLocked) {
    await assertMatchesLockedSnapshot(actor.companyId, boqRecord.id, boqRecord.revisionNumber, boqDto.totals.grandTotal);
  }


  const company = await prisma.company.findUniqueOrThrow({ where: { id: actor.companyId } });
  const applyTrialWatermark = documentCheck.applyTrialWatermark;

  const documentData = buildDocumentData({
    company: {
      legalName: company.legalName,
      tradeName: company.tradeName,
      email: company.email,
      phone: company.phone,
      website: company.website,
      address: company.address,
      taxRegistrationNumber: company.taxRegistrationNumber,
      defaultCurrency: company.defaultCurrency,
    },
    client: {
      name: project.client.name,
      companyName: project.client.companyName,
      email: project.client.email,
      phone: project.client.phone,
      address: project.client.address,
      taxRegistrationNumber: project.client.taxRegistrationNumber,
    },
    project: {
      name: project.name,
      reference: project.reference,
      location: project.location,
      currency: project.currency,
      taxRate: project.taxRate.toNumber(),
      language: project.language,
    },
    industryName: project.industryEngine.name,
    boq: boqDto,
    revisionNumber: boqRecord.revisionNumber,
    audience: input.audience,
    templateName: template.name,
    documentType: input.documentType,
    generatedByName: actor.fullName,
    isDraft,
    showInternalCostFieldsToClient: effectiveContentConfig.showInternalCostFieldsToClient,
    pricingMode: input.pricingMode ?? "WITH_PRICES",
    watermarkText: applyTrialWatermark ? TRIAL_WATERMARK_TEXT : null,
  });

  const queued = await createQueuedDocument(actor.companyId, {
    projectId: project.id,
    boqId: boqRecord.id,
    templateId: template.id,
    templateVersionId: resolvedVersion.versionId,
    revisionNumber: boqRecord.revisionNumber,
    type: input.documentType,
    audience: input.audience,
    isDraft,
    generatedByUserId: actor.userId,
    generatedByName: actor.fullName,
  });

  try {
    let fileBuffer: Buffer;
    switch (input.documentType) {
      case GeneratedDocumentType.CSV:
        fileBuffer = generateCsv(documentData);
        break;
      case GeneratedDocumentType.XLSX:
        fileBuffer = await generateXlsx(documentData);
        break;
      case GeneratedDocumentType.PDF:
        fileBuffer = await generatePdf({ data: documentData, style: effectiveStyleConfig, content: effectiveContentConfig });
        break;
      case GeneratedDocumentType.DOCX:
        fileBuffer = await generateDocx({ data: documentData, style: effectiveStyleConfig, content: effectiveContentConfig });
        break;
      case GeneratedDocumentType.HTML:
        fileBuffer = Buffer.from(generateHtml({ data: documentData, style: effectiveStyleConfig, content: effectiveContentConfig }), "utf-8");
        break;
      default:
        throw new AppError("UNSUPPORTED_DOCUMENT_TYPE", "Unsupported document type.", 400);
    }

    const checksum = createHash("sha256").update(fileBuffer).digest("hex");
    const extension = FILE_EXTENSIONS[input.documentType];
    const safeProjectRef = project.reference.replace(/[^a-zA-Z0-9-]/g, "_");
    const fileName = `${safeProjectRef}-${boqDto.revision}-${input.documentType}-${queued.id.slice(0, 8)}.${extension}`;
    const storageKey = `${actor.companyId}/${project.id}/${boqDto.revision}/${queued.id}.${extension}`;

    await getDocumentStorageAdapter().putObject({
      key: storageKey,
      body: fileBuffer,
      contentType: MIME_TYPES[input.documentType],
    });

    const completed = await markDocumentCompleted(actor.companyId, queued.id, {
      storageKey,
      fileName,
      mimeType: MIME_TYPES[input.documentType],
      fileSize: fileBuffer.byteLength,
      checksum,
      generationMetadataJson: {
        templateCode: template.code,
        templateName: template.name,
        templateVersionNumber: resolvedVersion.versionNumber,
        audience: input.audience,
        isDraft,
        acknowledgedWarnings: Boolean(input.acknowledgedWarnings),
        trialWatermarked: applyTrialWatermark,
      },
    });
    await recordDocumentGenerated(actor.companyId, isDraft);
    return completed;
  } catch (error) {
    console.error('Generation error:', error);
    const message = error instanceof Error ? error.message : "Document generation failed.";
    await markDocumentFailed(actor.companyId, queued.id, message.slice(0, 500));
    if (error instanceof AppError) throw error;
    throw new AppError("DOCUMENT_GENERATION_FAILED", "Document generation failed. Please try again.", 500);
  }
}

export async function listDocumentsForProjectCompany(actor: CurrentActor, projectIdentifier: string) {
  const project = await getProjectRecord(actor.companyId, projectIdentifier);
  return listGeneratedDocumentsForProject(actor.companyId, project.id);
}

export async function getDocumentForDownload(actor: CurrentActor, documentId: string) {
  requireCapability(actor, "documents:download");
  const record = await getGeneratedDocumentRecord(actor.companyId, documentId);
  if (record.status !== "COMPLETED" || !record.storageKey) {
    throw new AppError("DOCUMENT_NOT_READY", "This document has not finished generating.", 409);
  }
  const buffer = await getDocumentStorageAdapter().getObject(record.storageKey);
  await recordDownload(actor.companyId, documentId);
  return {
    buffer,
    fileName: record.fileName ?? `document.${record.type.toLowerCase()}`,
    mimeType: record.mimeType ?? "application/octet-stream",
  };
}

export async function deleteGeneratedDocument(actor: CurrentActor, documentId: string) {
  requireCapability(actor, "documents:delete");
  const result = await deleteGeneratedDocumentRow(actor.companyId, documentId);
  if (result.storageKey) {
    await getDocumentStorageAdapter().deleteObject(result.storageKey).catch(() => undefined);
  }
  return result;
}
