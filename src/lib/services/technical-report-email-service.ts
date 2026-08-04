import { EmailDispatchStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { getEmailTemplate } from "@/lib/repositories/email-template-repository";
import {
  createReportShareLink,
  getGeneratedTechnicalReportRecord,
  revokeReportShareLink,
} from "@/lib/repositories/generated-technical-report-repository";
import { reportTemplateSectionsSchema } from "@/lib/documents/report-template-sections";
import { buildTechnicalReportShareUrl, hashReportShareToken } from "@/lib/documents/technical-report-share";
import {
  renderTechnicalReportEmailTemplate,
  type TechnicalReportEmailVariables,
} from "@/lib/email/render-technical-report-email-template";
import { developmentEmailProvider } from "@/lib/email/development-email-provider";
import { getEmailProvider } from "@/lib/email/get-email-provider";
import { formatDate } from "@/lib/formatting/dates";

export async function createTechnicalReportShareLink(actor: CurrentActor, reportId: string, expiresInDays?: number) {
  requireCapability(actor, "technical-reports:send");
  const record = await getGeneratedTechnicalReportRecord(actor.companyId, reportId);
  if (record.status !== "COMPLETED" || !record.storageKey) {
    throw new AppError("TECHNICAL_REPORT_NOT_READY", "Generate the report document before creating a share link.", 409);
  }
  const { report, rawToken } = await createReportShareLink(actor.companyId, reportId, expiresInDays);
  return { report, rawToken, secureUrl: buildTechnicalReportShareUrl(rawToken) };
}

export async function revokeTechnicalReportShareLink(actor: CurrentActor, reportId: string) {
  requireCapability(actor, "technical-reports:send");
  return revokeReportShareLink(actor.companyId, reportId);
}

/**
 * Real data only: reportReference is derived from the project's own reference plus this record's
 * own id (not invented), sectionList is the report's actual section titles, and issueDate falls
 * back to "now" only when the report has no completedAt yet. secureReportUrl resolves to an empty
 * string (an allowed, non-required variable) when no valid rawShareToken is supplied — an
 * attach-only send never needs one.
 */
async function buildVariables(
  companyId: string,
  reportId: string,
  rawShareToken: string | undefined,
  senderName: string,
  senderEmail: string,
  clientName: string,
  revisionOverride: string | undefined,
): Promise<TechnicalReportEmailVariables> {
  const record = await getGeneratedTechnicalReportRecord(companyId, reportId);
  const project = await prisma.project.findFirstOrThrow({ where: { id: record.projectId, companyId } });
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  const client = await prisma.client.findFirst({ where: { id: project.clientId, companyId } });
  const sections = reportTemplateSectionsSchema.parse(record.sectionsSnapshotJson);

  let secureReportUrl = "";
  if (rawShareToken) {
    const matches = record.shareTokenHash === hashReportShareToken(rawShareToken);
    if (!matches || record.shareRevokedAt || (record.shareExpiresAt && record.shareExpiresAt.getTime() < Date.now())) {
      throw new AppError("STALE_REPORT_SHARE_TOKEN", "This share link is out of date (it was likely regenerated or revoked). Create a new link and try again.", 409);
    }
    secureReportUrl = buildTechnicalReportShareUrl(rawShareToken);
  }

  return {
    clientName,
    clientCompany: client?.name,
    projectName: project.name,
    projectReference: project.reference,
    companyName: company.tradeName || company.legalName,
    companyPhone: company.phone ?? "",
    companyWebsite: company.website ?? "",
    senderName,
    senderEmail,
    senderTitle: company.authorizedSignatoryTitle ?? "",
    reportReference: `${project.reference}-TR-${record.id.slice(0, 8).toUpperCase()}`,
    revision: revisionOverride ?? "",
    issueDate: formatDate((record.completedAt ?? new Date()).toISOString()),
    secureReportUrl,
    sectionList: sections.sections.map((s) => s.title).join("\n"),
  };
}

export type PreviewTechnicalReportEmailInput = {
  reportId: string;
  emailTemplateId: string;
  rawShareToken?: string;
  revision?: string;
};

export async function previewTechnicalReportEmail(actor: CurrentActor, input: PreviewTechnicalReportEmailInput) {
  requireCapability(actor, "technical-reports:send");
  const template = await getEmailTemplate(actor.companyId, input.emailTemplateId);
  const variables = await buildVariables(actor.companyId, input.reportId, input.rawShareToken, actor.fullName, actor.email, "[Client Name]", input.revision);
  const rendered = renderTechnicalReportEmailTemplate({ subject: template.subject, bodyHtml: template.bodyHtml, bodyText: template.bodyText, variables });

  await createAuditLog(actor.companyId, {
    entityType: "GeneratedTechnicalReport",
    entityId: input.reportId,
    action: "TECHNICAL_REPORT_EMAIL_PREVIEWED",
    payload: { templateId: template.id },
  });

  return { template, ...rendered };
}

export type TestSendTechnicalReportEmailInput = PreviewTechnicalReportEmailInput & { testRecipient: string };

/** Always routed through the development provider regardless of EMAIL_PROVIDER, and never
 *  persisted as an EmailDispatch — mirrors testSendProposalEmail's isolation guarantee. */
export async function testSendTechnicalReportEmail(actor: CurrentActor, input: TestSendTechnicalReportEmailInput) {
  requireCapability(actor, "technical-reports:send");
  const template = await getEmailTemplate(actor.companyId, input.emailTemplateId);
  const variables = await buildVariables(actor.companyId, input.reportId, input.rawShareToken, actor.fullName, actor.email, "[Client Name]", input.revision);
  const rendered = renderTechnicalReportEmailTemplate({
    subject: `[TEST] ${template.subject}`,
    bodyHtml: template.bodyHtml,
    bodyText: template.bodyText,
    variables,
  });
  const result = await developmentEmailProvider.sendEmail({
    to: input.testRecipient,
    subject: rendered.subject,
    html: rendered.bodyHtml,
    text: rendered.bodyText,
  });
  return { ...rendered, providerResult: result };
}

export type SendTechnicalReportEmailInput = {
  reportId: string;
  recipientEmail: string;
  recipientName: string;
  emailTemplateId: string;
  rawShareToken?: string;
  revision?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
};

export async function sendTechnicalReportEmail(actor: CurrentActor, input: SendTechnicalReportEmailInput) {
  requireCapability(actor, "technical-reports:send");
  const record = await getGeneratedTechnicalReportRecord(actor.companyId, input.reportId);
  if (record.status !== "COMPLETED" || !record.storageKey) {
    throw new AppError("TECHNICAL_REPORT_NOT_READY", "Generate the report document before emailing it.", 409);
  }
  const template = await getEmailTemplate(actor.companyId, input.emailTemplateId);
  if (!template.isActive) throw new NotFoundError("This email template is inactive.");

  const variables = await buildVariables(actor.companyId, input.reportId, input.rawShareToken, actor.fullName, actor.email, input.recipientName, input.revision);
  const rendered = renderTechnicalReportEmailTemplate({ subject: template.subject, bodyHtml: template.bodyHtml, bodyText: template.bodyText, variables });

  const dispatch = await prisma.emailDispatch.create({
    data: {
      companyId: actor.companyId,
      projectId: record.projectId,
      generatedTechnicalReportId: record.id,
      emailTemplateId: template.id,
      createdByUserId: actor.userId,
      createdByName: actor.fullName,
      recipient: input.recipientEmail,
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

  const provider = getEmailProvider();
  const result = await provider.sendEmail({
    to: input.recipientEmail,
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
    await createAuditLog(actor.companyId, {
      entityType: "GeneratedTechnicalReport",
      entityId: record.id,
      action: "TECHNICAL_REPORT_EMAIL_FAILED",
      payload: { errorCode: result.errorCode ?? null },
    });
    return { dispatchId: dispatch.id, status: result.status, providerMessageId: null };
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
  await createAuditLog(actor.companyId, {
    entityType: "GeneratedTechnicalReport",
    entityId: record.id,
    action: "TECHNICAL_REPORT_EMAIL_SENT",
    payload: { provider: provider.providerName, status: result.status },
  });

  return { dispatchId: dispatch.id, status: result.status, providerMessageId: result.providerMessageId ?? null };
}

export async function listEmailDispatchesForTechnicalReport(actor: CurrentActor, reportId: string) {
  await getGeneratedTechnicalReportRecord(actor.companyId, reportId);
  const rows = await prisma.emailDispatch.findMany({
    where: { companyId: actor.companyId, generatedTechnicalReportId: reportId },
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
