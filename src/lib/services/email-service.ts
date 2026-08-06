import { ClientProposalEventType, ClientProposalStatus, EmailDispatchStatus, ProposalActorType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { getBOQ } from "@/lib/repositories/boq-repository";
import { getGeneratedTechnicalReport } from "@/lib/repositories/generated-technical-report-repository";
import { getProposal, createProposalEvent, markProposalSent, verifyProposalToken } from "@/lib/repositories/client-proposal-repository";
import { resolveEmailTemplate } from "@/lib/services/template-resolution-service";
import { renderEmailTemplate, type EmailTemplateVariables } from "@/lib/email/render-email-template";
import { developmentEmailProvider } from "@/lib/email/development-email-provider";
import { getEmailProvider } from "@/lib/email/get-email-provider";
import { buildProposalSecureUrl } from "@/lib/services/client-proposal-service";
import { formatDate } from "@/lib/formatting/dates";

async function buildVariables(companyId: string, proposalId: string, rawToken: string | null, senderName: string): Promise<EmailTemplateVariables> {
  const proposal = await getProposal(companyId, proposalId);
  const project = await prisma.project.findFirstOrThrow({ where: { id: proposal.projectId, companyId } });
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });

  const shared = {
    clientName: proposal.recipientName,
    clientCompany: proposal.clientName,
    projectName: project.name,
    projectReference: project.reference,
    proposalValidityDate: formatDate(proposal.expiresAt),
    companyName: company.tradeName || company.legalName,
    companyPhone: company.phone ?? "",
    companyWebsite: company.website ?? "",
    senderName,
    senderEmail: company.email,
    senderTitle: company.authorizedSignatoryTitle ?? "",
    secureReviewUrl: rawToken ? buildProposalSecureUrl(rawToken) : "",
    currency: project.currency,
  };

  if (proposal.sourceType === "TECHNICAL_REPORT_REVISION") {
    const report = await getGeneratedTechnicalReport(companyId, proposal.technicalReportId!);
    return {
      ...shared,
      // Technical reports have no revision number or monetary total — these two required
      // template slots are reused with report-appropriate text rather than inventing a
      // parallel variable set, per the "reuse existing fields" governance rule for this feature.
      boqReference: `${project.reference}-${report.name}`,
      revision: report.templateName,
      documentList: report.fileName ? `${report.documentType ?? "Document"} — ${report.fileName}` : "",
      grandTotal: "—",
    };
  }

  const boq = await getBOQ(companyId, proposal.boqId!);
  const documents = await prisma.generatedDocument.findMany({ where: { companyId, id: { in: proposal.documents.map((d) => d.id) } } });
  return {
    ...shared,
    boqReference: `${project.reference}-${boq.revision}`,
    revision: boq.revision,
    documentList: documents.map((doc) => `${doc.type} — ${doc.fileName ?? "document"}`).join("\n"),
    grandTotal: boq.totals.grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  };
}

export type PreviewEmailInput = {
  proposalId: string;
  emailTemplateId?: string;
  rawToken: string;
};

async function assertTokenMatchesProposal(companyId: string, proposalId: string, rawToken: string): Promise<void> {
  const matches = await verifyProposalToken(companyId, proposalId, rawToken);
  if (!matches) {
    throw new AppError(
      "STALE_PROPOSAL_TOKEN",
      "This link is out of date for the proposal (it was likely regenerated). Regenerate the link again to preview or send.",
      409,
    );
  }
}

export async function previewProposalEmail(actor: CurrentActor, input: PreviewEmailInput) {
  requireCapability(actor, "proposals:manage");
  await assertTokenMatchesProposal(actor.companyId, input.proposalId, input.rawToken);
  const sourceProposal = await getProposal(actor.companyId, input.proposalId);
  const category = sourceProposal.sourceType === "TECHNICAL_REPORT_REVISION" ? "TECHNICAL_REPORT" : "BOQ";
  const resolved = await resolveEmailTemplate({ companyId: actor.companyId, category, templateId: input.emailTemplateId });

  const variables = await buildVariables(actor.companyId, input.proposalId, input.rawToken, actor.fullName);
  const rendered = renderEmailTemplate({ subject: resolved.subject, bodyHtml: resolved.bodyHtml, bodyText: resolved.bodyText, variables });

  await createProposalEvent(actor.companyId, input.proposalId, {
    eventType: ClientProposalEventType.EMAIL_PREVIEWED,
    actorType: ProposalActorType.INTERNAL,
    actorUserId: actor.userId,
    actorName: actor.fullName,
  });
  await createAuditLog(actor.companyId, { entityType: "ClientProposal", entityId: input.proposalId, action: "EMAIL_PREVIEWED", payload: { templateId: resolved.templateId } });

  return { template: { id: resolved.templateId, code: resolved.templateCode, name: resolved.templateName }, ...rendered, secureUrl: variables.secureReviewUrl };
}

/**
 * Always routed through the development provider regardless of
 * EMAIL_PROVIDER, and never persisted as an EmailDispatch or reflected in
 * proposal status — a test send can never be mistaken for the proposal
 * having actually gone out, by construction rather than by a flag.
 */
export async function testSendProposalEmail(actor: CurrentActor, input: PreviewEmailInput & { testRecipient: string }) {
  requireCapability(actor, "proposals:manage");
  await assertTokenMatchesProposal(actor.companyId, input.proposalId, input.rawToken);
  const sourceProposal = await getProposal(actor.companyId, input.proposalId);
  const category = sourceProposal.sourceType === "TECHNICAL_REPORT_REVISION" ? "TECHNICAL_REPORT" : "BOQ";
  const resolved = await resolveEmailTemplate({ companyId: actor.companyId, category, templateId: input.emailTemplateId });

  const variables = await buildVariables(actor.companyId, input.proposalId, input.rawToken, actor.fullName);
  const rendered = renderEmailTemplate({ subject: `[TEST] ${resolved.subject}`, bodyHtml: resolved.bodyHtml, bodyText: resolved.bodyText, variables });
  const result = await developmentEmailProvider.sendEmail({
    to: input.testRecipient,
    subject: rendered.subject,
    html: rendered.bodyHtml,
    text: rendered.bodyText,
  });
  await createAuditLog(actor.companyId, {
    entityType: "ClientProposal",
    entityId: input.proposalId,
    action: "EMAIL_TEST_SENT",
    payload: { templateId: resolved.templateId, templateVersionId: resolved.versionId, providerResultStatus: result.status },
  });
  return { ...rendered, providerResult: result };
}

export type SendProposalEmailInput = {
  proposalId: string;
  rawToken: string;
  emailTemplateId?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
};

export async function sendProposalEmail(actor: CurrentActor, input: SendProposalEmailInput) {
  requireCapability(actor, "proposals:manage");
  await assertTokenMatchesProposal(actor.companyId, input.proposalId, input.rawToken);
  const proposal = await getProposal(actor.companyId, input.proposalId);
  if (proposal.status !== ClientProposalStatus.READY && proposal.status !== ClientProposalStatus.SENT) {
    throw new AppError("PROPOSAL_NOT_READY", "Mark the proposal READY before sending it.", 409);
  }
  const category = proposal.sourceType === "TECHNICAL_REPORT_REVISION" ? "TECHNICAL_REPORT" : "BOQ";
  const resolved = await resolveEmailTemplate({ companyId: actor.companyId, category, templateId: input.emailTemplateId });

  const variables = await buildVariables(actor.companyId, input.proposalId, input.rawToken, actor.fullName);
  const rendered = renderEmailTemplate({ subject: resolved.subject, bodyHtml: resolved.bodyHtml, bodyText: resolved.bodyText, variables });

  const dispatch = await prisma.emailDispatch.create({
    data: {
      companyId: actor.companyId,
      projectId: proposal.projectId,
      boqId: proposal.sourceType === "BOQ_REVISION" ? proposal.boqId : null,
      generatedTechnicalReportId: proposal.sourceType === "TECHNICAL_REPORT_REVISION" ? proposal.technicalReportId : null,
      clientProposalId: proposal.id,
      emailTemplateId: resolved.templateId,
      emailTemplateVersionId: resolved.versionId,
      createdByUserId: actor.userId,
      createdByName: actor.fullName,
      recipient: proposal.recipientEmail,
      ccJson: input.cc ?? [],
      bccJson: input.bcc ?? [],
      replyTo: input.replyTo,
      subject: rendered.subject,
      bodyHtml: rendered.bodyHtml,
      bodyText: rendered.bodyText,
      provider: getEmailProvider().providerName,
      status: EmailDispatchStatus.QUEUED,
      attempts: 1,
    },
  });
  await createProposalEvent(actor.companyId, proposal.id, {
    eventType: ClientProposalEventType.EMAIL_QUEUED,
    actorType: ProposalActorType.INTERNAL,
    actorUserId: actor.userId,
    actorName: actor.fullName,
  });

  const provider = getEmailProvider();
  const result = await provider.sendEmail({
    to: proposal.recipientEmail,
    cc: input.cc,
    bcc: input.bcc,
    replyTo: input.replyTo,
    subject: rendered.subject,
    html: rendered.bodyHtml,
    text: rendered.bodyText,
  });

  if (result.status === "FAILED") {
    await prisma.emailDispatch.update({
      where: { id: dispatch.id },
      data: { status: EmailDispatchStatus.FAILED, failedAt: new Date(), errorCode: result.errorCode, errorMessage: result.errorMessage },
    });
    await createProposalEvent(actor.companyId, proposal.id, {
      eventType: ClientProposalEventType.EMAIL_FAILED,
      actorType: ProposalActorType.INTERNAL,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      metadataJson: { errorCode: result.errorCode ?? null },
    });
    await createAuditLog(actor.companyId, { entityType: "ClientProposal", entityId: proposal.id, action: "EMAIL_FAILED", payload: { errorCode: result.errorCode ?? null } });
    // Proposal must not falsely become SENT; the client link remains valid and a retry is allowed.
    return { dispatchId: dispatch.id, status: result.status, providerMessageId: null, proposalStatus: proposal.status };
  }

  const finalStatus = result.status === "SENT" ? EmailDispatchStatus.SENT : EmailDispatchStatus.QUEUED;
  await prisma.emailDispatch.update({
    where: { id: dispatch.id },
    data: {
      status: finalStatus,
      providerMessageId: result.providerMessageId,
      sentAt: result.status === "SENT" ? new Date() : undefined,
    },
  });
  await createProposalEvent(actor.companyId, proposal.id, {
    eventType: ClientProposalEventType.EMAIL_SENT,
    actorType: ProposalActorType.INTERNAL,
    actorUserId: actor.userId,
    actorName: actor.fullName,
    metadataJson: { provider: provider.providerName, status: result.status },
  });
  await createAuditLog(actor.companyId, { entityType: "ClientProposal", entityId: proposal.id, action: "EMAIL_SENT", payload: { provider: provider.providerName } });

  let proposalStatus: ClientProposalStatus = proposal.status;
  if (proposal.status === ClientProposalStatus.READY) {
    const updated = await markProposalSent(actor.companyId, proposal.id);
    proposalStatus = updated.status;
  }

  return { dispatchId: dispatch.id, status: result.status, providerMessageId: result.providerMessageId ?? null, proposalStatus };
}

export async function listEmailDispatchesForProposal(actor: CurrentActor, proposalId: string) {
  const rows = await prisma.emailDispatch.findMany({
    where: { companyId: actor.companyId, clientProposalId: proposalId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    recipient: row.recipient,
    subject: row.subject,
    provider: row.provider,
    status: row.status,
    attempts: row.attempts,
    sentAt: row.sentAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
  }));
}
