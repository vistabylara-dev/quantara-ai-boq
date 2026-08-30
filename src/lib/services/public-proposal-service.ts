import { cookies } from "next/headers";
import { ClientProposalEventType, ProposalActorType } from "@prisma/client";
import { AppError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { toBOQDTO } from "@/lib/repositories/boq-repository";
import {
  createProposalEvent,
  markExpiredIfNeeded,
  recordApproval,
  recordComment,
  recordOptionSelection,
  recordProposalOpen,
  recordRejection,
  recordRevisionRequest,
  toProposalDTO,
} from "@/lib/repositories/client-proposal-repository";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { accessCookieName, createAccessGrant, verifyAccessGrant } from "@/lib/proposals/access-cookie";
import { buildProposalViewData, buildTechnicalReportProposalViewData, parseSelectedOptions, type ProposalViewData } from "@/lib/proposals/build-proposal-view-data";
import { mergeProposalSettings, type ClientProposalSettings } from "@/lib/proposals/proposal-settings";
import { extractRequestSignals } from "@/lib/proposals/request-context";
import { findProposalByRawToken, validateProposalAccess, type ProposalAccessRecord } from "@/lib/proposals/proposal-token";
import { assertNotRateLimited, approvalLimiter, commentLimiter, documentDownloadLimiter, passcodeAttemptLimiter, rejectionLimiter, revisionRequestLimiter } from "@/lib/security/rate-limiter";
import { createStorageAdapter, resolveStorageProvider } from "@/lib/storage/storage-factory";
import type { DocumentStorageAdapter } from "@/lib/storage/document-storage-adapter";
import { loadLogoImage, logoImageToDataUri } from "@/lib/documents/logo-image";

const MAX_COMMENT_LENGTH = 4_000;

/** Was hardcoded to the local-filesystem adapter — see technical-report-service.ts for the same production fix; both files this reads (generated technical reports and generated BOQ documents) are written through the same "generated-documents" storage namespace. */
let cachedDocumentStorageAdapter: DocumentStorageAdapter | null = null;
function getDocumentStorageAdapter(): DocumentStorageAdapter {
  if (!cachedDocumentStorageAdapter) {
    cachedDocumentStorageAdapter = createStorageAdapter({ provider: resolveStorageProvider(), purpose: "generated-documents" });
  }
  return cachedDocumentStorageAdapter;
}

async function resolveAccessRecord(rawToken: string): Promise<ProposalAccessRecord> {
  const result = await validateProposalAccess(rawToken);
  if (result.ok) return result.proposal;

  if (result.reason === "EXPIRED") {
    const found = await findProposalByRawToken(rawToken);
    if (found) await markExpiredIfNeeded(found.companyId, found.id);
  }
  const messages: Record<typeof result.reason, string> = {
    NOT_FOUND: "This proposal link is not valid.",
    REVOKED: "This proposal link has been revoked.",
    EXPIRED: "This proposal link has expired.",
    INVALID_STATUS: "This proposal is not yet available.",
  };
  const statusCodes: Record<typeof result.reason, number> = {
    NOT_FOUND: 404,
    REVOKED: 410,
    EXPIRED: 410,
    INVALID_STATUS: 409,
  };
  throw new AppError(`PROPOSAL_${result.reason}`, messages[result.reason], statusCodes[result.reason]);
}

async function hasPasscodeGrant(record: ProposalAccessRecord): Promise<boolean> {
  const settings = mergeProposalSettings(record.settingsJson as Partial<ClientProposalSettings> | null);
  if (!settings.requireAccessPasscode) return true;
  const cookie = (await cookies()).get(accessCookieName(record.id))?.value;
  return verifyAccessGrant(cookie, record.id);
}

async function assertPasscodeUnlocked(record: ProposalAccessRecord): Promise<void> {
  if (!(await hasPasscodeGrant(record))) {
    throw new AppError("PASSCODE_REQUIRED", "Enter the access passcode to continue.", 401);
  }
}

async function buildViewData(record: ProposalAccessRecord): Promise<ProposalViewData> {
  const settings = mergeProposalSettings(record.settingsJson as Partial<ClientProposalSettings> | null);
  // Public proposal pages receive validated image bytes, never an arbitrary
  // tenant-controlled remote URL. Failed validation simply omits the logo.
  const logoUrl = logoImageToDataUri(await loadLogoImage(record.company.logoUrl));
  const companyInput = {
    legalName: record.company.legalName,
    tradeName: record.company.tradeName,
    address: record.company.address,
    email: record.company.email,
    phone: record.company.phone,
    website: record.company.website,
    logoUrl,
    taxRegistrationNumber: record.company.taxRegistrationNumber,
  };
  const projectInput = {
    name: record.project.name,
    reference: record.project.reference,
    location: record.project.location ?? "",
    currency: record.project.currency,
    taxRate: record.project.taxRate.toNumber(),
    industryName: record.project.industryEngine.name,
  };
  const clientInput = { name: record.client.name, companyName: record.client.companyName };

  if (record.sourceType === "TECHNICAL_REPORT_REVISION") {
    if (!record.technicalReport) throw new AppError("PROPOSAL_SOURCE_REQUIRED", "This proposal has no source report.", 409);
    return buildTechnicalReportProposalViewData({
      company: companyInput,
      client: clientInput,
      project: projectInput,
      report: {
        id: record.technicalReport.id,
        name: record.technicalReport.name,
        templateName: record.technicalReport.template.name,
        documentType: record.technicalReport.documentType,
        fileName: record.technicalReport.fileName,
        fileSize: record.technicalReport.fileSize,
        completedAt: record.technicalReport.completedAt?.toISOString() ?? null,
      },
      settings,
    });
  }

  const boqDto = toBOQDTO(await prisma.bOQ.findFirstOrThrow({
    where: { id: record.boqId!, companyId: record.companyId },
    include: {
      project: { include: { client: true, industryEngine: true } },
      sections: { orderBy: { sortOrder: "asc" }, include: { items: { orderBy: { sortOrder: "asc" }, include: { options: { orderBy: { createdAt: "asc" } } } } } },
      verificationExceptions: { include: { boqItem: true } },
    },
  }));

  return buildProposalViewData({
    company: companyInput,
    client: clientInput,
    project: projectInput,
    boq: boqDto,
    revisionNumber: record.revisionNumber!,
    settings,
    selectedOptions: parseSelectedOptions(record.selectedOptionsJson),
  });
}

export type PublicProposalViewResult =
  | { ok: true; view: ProposalViewData; proposal: ReturnType<typeof toProposalDTO>; passcodeRequired: false }
  | { ok: true; view: null; proposal: null; passcodeRequired: true; proposalId: string }
  | { ok: false; reason: "NOT_FOUND" | "REVOKED" | "EXPIRED" | "INVALID_STATUS" };

/** Used by the public Server Component page — never throws, returns a discriminated result instead. */
export async function getPublicProposalView(rawToken: string, request: Request): Promise<PublicProposalViewResult> {
  const result = await validateProposalAccess(rawToken);
  if (!result.ok) {
    if (result.reason === "EXPIRED") {
      const found = await findProposalByRawToken(rawToken);
      if (found) await markExpiredIfNeeded(found.companyId, found.id);
    }
    return { ok: false, reason: result.reason };
  }
  const record = result.proposal;

  if (!(await hasPasscodeGrant(record))) {
    return { ok: true, view: null, proposal: null, passcodeRequired: true, proposalId: record.id };
  }

  const opened = await recordProposalOpen(record.companyId, record.id);
  const signals = extractRequestSignals(request);
  await createProposalEvent(record.companyId, record.id, {
    eventType: ClientProposalEventType.LINK_OPENED,
    actorType: ProposalActorType.CLIENT,
    ...signals,
  });
  await createAuditLog(record.companyId, { entityType: "ClientProposal", entityId: record.id, action: "PROPOSAL_OPENED_BY_CLIENT", payload: {} });

  const view = await buildViewData(record);
  return { ok: true, view, proposal: opened, passcodeRequired: false };
}

export async function submitProposalPasscode(rawToken: string, passcode: string, request: Request): Promise<{ proposalId: string }> {
  const record = await resolveAccessRecord(rawToken);
  const signals = extractRequestSignals(request);
  assertNotRateLimited(passcodeAttemptLimiter, `${record.id}:${signals.ipHash ?? "unknown"}`);

  const settings = mergeProposalSettings(record.settingsJson as Partial<ClientProposalSettings> | null);
  if (!settings.requireAccessPasscode || !settings.accessPasscodeHash) {
    throw new AppError("PASSCODE_NOT_REQUIRED", "This proposal does not require a passcode.", 400);
  }
  const valid = await verifyPassword(passcode, settings.accessPasscodeHash);
  if (!valid) {
    // Deliberately the same generic message as an invalid token would produce elsewhere — never reveal which part was wrong.
    throw new AppError("INVALID_ACCESS", "Access could not be verified.", 401);
  }

  const grant = createAccessGrant(record.id);
  (await cookies()).set(accessCookieName(record.id), grant, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 60,
  });
  return { proposalId: record.id };
}

export async function selectProposalOption(rawToken: string, input: { boqItemId: string; optionId: string | null }, request: Request) {
  const record = await resolveAccessRecord(rawToken);
  await assertPasscodeUnlocked(record);
  if (record.sourceType !== "BOQ_REVISION") {
    throw new AppError("OPTIONS_NOT_ALLOWED", "Option selection is only available for BOQ proposals.", 409);
  }
  const settings = mergeProposalSettings(record.settingsJson as Partial<ClientProposalSettings> | null);
  if (!settings.allowOptionSelection) {
    throw new AppError("OPTIONS_NOT_ALLOWED", "Option selection is not enabled for this proposal.", 409);
  }

  const item = await prisma.bOQItem.findFirst({
    where: { id: input.boqItemId, companyId: record.companyId, section: { boqId: record.boqId! } },
    include: { options: true },
  });
  if (!item) throw new AppError("ITEM_NOT_FOUND", "This item does not belong to the proposal's revision.", 404);
  if (input.optionId && !item.options.some((option) => option.id === input.optionId)) {
    throw new AppError("OPTION_NOT_FOUND", "This option is not available for the selected item.", 404);
  }

  const current = parseSelectedOptions(record.selectedOptionsJson);
  if (input.optionId) current[input.boqItemId] = input.optionId;
  else delete current[input.boqItemId];

  const updated = await recordOptionSelection(record.companyId, record.id, current);
  const signals = extractRequestSignals(request);
  await createProposalEvent(record.companyId, record.id, {
    eventType: ClientProposalEventType.OPTION_SELECTED,
    actorType: ProposalActorType.CLIENT,
    metadataJson: { boqItemId: input.boqItemId, optionId: input.optionId },
    ...signals,
  });
  await createAuditLog(record.companyId, { entityType: "ClientProposal", entityId: record.id, action: "PROPOSAL_OPTION_SELECTED", payload: { boqItemId: input.boqItemId } });

  return { proposal: updated, view: await buildViewData(await resolveAccessRecord(rawToken)) };
}

export async function submitProposalComment(rawToken: string, input: { comment: string; actorName?: string; actorEmail?: string }, request: Request) {
  const record = await resolveAccessRecord(rawToken);
  await assertPasscodeUnlocked(record);
  const settings = mergeProposalSettings(record.settingsJson as Partial<ClientProposalSettings> | null);
  if (!settings.allowComments) throw new AppError("COMMENTS_NOT_ALLOWED", "Comments are not enabled for this proposal.", 409);

  const signals = extractRequestSignals(request);
  assertNotRateLimited(commentLimiter, `${record.id}:${signals.ipHash ?? "unknown"}`);

  const comment = input.comment.trim().slice(0, MAX_COMMENT_LENGTH);
  if (!comment) throw new AppError("COMMENT_REQUIRED", "Enter a comment before submitting.", 400);

  const updated = await recordComment(record.companyId, record.id, comment);
  await createProposalEvent(record.companyId, record.id, {
    eventType: ClientProposalEventType.COMMENT_ADDED,
    actorType: ProposalActorType.CLIENT,
    actorName: input.actorName ?? null,
    actorEmail: input.actorEmail ?? null,
    ...signals,
  });
  await createAuditLog(record.companyId, { entityType: "ClientProposal", entityId: record.id, action: "PROPOSAL_COMMENT_ADDED", payload: {} });
  return updated;
}

export async function requestProposalRevision(rawToken: string, input: { name: string; email: string; comment: string }, request: Request) {
  const record = await resolveAccessRecord(rawToken);
  await assertPasscodeUnlocked(record);
  const signals = extractRequestSignals(request);
  assertNotRateLimited(revisionRequestLimiter, `${record.id}:${signals.ipHash ?? "unknown"}`);

  const comment = input.comment.trim().slice(0, MAX_COMMENT_LENGTH);
  if (!input.name.trim() || !input.email.trim() || !comment) {
    throw new AppError("REVISION_REQUEST_FIELDS_REQUIRED", "Name, email, and a reason are required to request a revision.", 400);
  }

  const updated = await recordRevisionRequest(record.companyId, record.id, comment);
  await createProposalEvent(record.companyId, record.id, {
    eventType: ClientProposalEventType.REVISION_REQUESTED,
    actorType: ProposalActorType.CLIENT,
    actorName: input.name,
    actorEmail: input.email,
    ...signals,
  });
  await createAuditLog(record.companyId, { entityType: "ClientProposal", entityId: record.id, action: "PROPOSAL_REVISION_REQUESTED", payload: {} });
  return updated;
}

export async function approveProposalPublic(
  rawToken: string,
  input: { approvalName: string; approvalEmail: string; confirmReview: boolean; comment?: string },
  request: Request,
) {
  const record = await resolveAccessRecord(rawToken);
  await assertPasscodeUnlocked(record);
  const signals = extractRequestSignals(request);
  assertNotRateLimited(approvalLimiter, `${record.id}:${signals.ipHash ?? "unknown"}`);

  const settings = mergeProposalSettings(record.settingsJson as Partial<ClientProposalSettings> | null);
  if (settings.requireApprovalName && !input.approvalName.trim()) {
    throw new AppError("APPROVAL_NAME_REQUIRED", "Your name is required to approve this proposal.", 400);
  }
  if (settings.requireApprovalEmail && !input.approvalEmail.trim()) {
    throw new AppError("APPROVAL_EMAIL_REQUIRED", "Your email is required to approve this proposal.", 400);
  }
  if (!input.confirmReview) {
    throw new AppError("REVIEW_CONFIRMATION_REQUIRED", "Confirm that you have reviewed the proposal before approving.", 400);
  }

  const selectedOptions = parseSelectedOptions(record.selectedOptionsJson);
  const updated = await recordApproval(record.companyId, record.id, {
    approvalName: input.approvalName,
    approvalEmail: input.approvalEmail,
    selectedOptionsJson: selectedOptions,
    clientComment: input.comment,
  });
  await createProposalEvent(record.companyId, record.id, {
    eventType: ClientProposalEventType.APPROVED,
    actorType: ProposalActorType.CLIENT,
    actorName: input.approvalName,
    actorEmail: input.approvalEmail,
    ...signals,
  });
  await createAuditLog(record.companyId, { entityType: "ClientProposal", entityId: record.id, action: "PROPOSAL_APPROVED", payload: {} });
  return updated;
}

export async function rejectProposalPublic(rawToken: string, input: { name: string; email: string; reason: string }, request: Request) {
  const record = await resolveAccessRecord(rawToken);
  await assertPasscodeUnlocked(record);
  const signals = extractRequestSignals(request);
  assertNotRateLimited(rejectionLimiter, `${record.id}:${signals.ipHash ?? "unknown"}`);

  const reason = input.reason.trim().slice(0, MAX_COMMENT_LENGTH);
  if (!input.name.trim() || !input.email.trim() || !reason) {
    throw new AppError("REJECTION_FIELDS_REQUIRED", "Name, email, and a reason are required.", 400);
  }

  const updated = await recordRejection(record.companyId, record.id, { name: input.name, email: input.email, reason });
  await createProposalEvent(record.companyId, record.id, {
    eventType: ClientProposalEventType.REJECTED,
    actorType: ProposalActorType.CLIENT,
    actorName: input.name,
    actorEmail: input.email,
    ...signals,
  });
  await createAuditLog(record.companyId, { entityType: "ClientProposal", entityId: record.id, action: "PROPOSAL_REJECTED", payload: {} });
  return updated;
}

export async function downloadProposalDocument(rawToken: string, documentId: string, request: Request) {
  const record = await resolveAccessRecord(rawToken);
  await assertPasscodeUnlocked(record);
  const settings = mergeProposalSettings(record.settingsJson as Partial<ClientProposalSettings> | null);
  if (!settings.allowDocumentDownload) {
    throw new AppError("DOWNLOAD_NOT_ALLOWED", "Document downloads are not enabled for this proposal.", 409);
  }
  const signals = extractRequestSignals(request);
  assertNotRateLimited(documentDownloadLimiter, `${record.id}:${signals.ipHash ?? "unknown"}`);

  let buffer: Buffer;
  let fileName: string;
  let mimeType: string;

  if (record.sourceType === "TECHNICAL_REPORT_REVISION") {
    const report = record.technicalReport;
    if (!report || report.id !== documentId || report.companyId !== record.companyId || report.projectId !== record.projectId) {
      throw new AppError("DOCUMENT_NOT_AUTHORIZED", "This document is not part of the proposal.", 404);
    }
    if (report.status !== "COMPLETED" || !report.storageKey) {
      throw new AppError("DOCUMENT_NOT_AUTHORIZED", "This document is not available for download.", 404);
    }
    buffer = await getDocumentStorageAdapter().getObject(report.storageKey);
    fileName = report.fileName ?? `${report.name}.docx`;
    mimeType = report.mimeType ?? "application/octet-stream";
  } else {
    const attachment = record.documents.find((doc) => doc.generatedDocumentId === documentId);
    if (!attachment) throw new AppError("DOCUMENT_NOT_AUTHORIZED", "This document is not part of the proposal.", 404);
    const document = attachment.generatedDocument;
    if (document.companyId !== record.companyId || document.projectId !== record.projectId || document.boqId !== record.boqId) {
      throw new AppError("DOCUMENT_NOT_AUTHORIZED", "This document is not part of the proposal.", 404);
    }
    if (document.audience !== "CLIENT" || document.status !== "COMPLETED" || !document.storageKey) {
      throw new AppError("DOCUMENT_NOT_AUTHORIZED", "This document is not available for download.", 404);
    }
    buffer = await getDocumentStorageAdapter().getObject(document.storageKey);
    fileName = document.fileName ?? `document.${document.type.toLowerCase()}`;
    mimeType = document.mimeType ?? "application/octet-stream";
  }

  await createProposalEvent(record.companyId, record.id, {
    eventType: ClientProposalEventType.DOCUMENT_DOWNLOADED,
    actorType: ProposalActorType.CLIENT,
    metadataJson: { documentId },
    ...signals,
  });
  await createAuditLog(record.companyId, { entityType: "ClientProposal", entityId: record.id, action: "PROPOSAL_DOCUMENT_DOWNLOADED", payload: { documentId } });

  return { buffer, fileName, mimeType };
}
