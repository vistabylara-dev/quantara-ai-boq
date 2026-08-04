import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import {
  createEmailTemplate,
  duplicateEmailTemplate,
  getEmailTemplate,
  listEmailTemplates,
  setEmailTemplateActive,
  setEmailTemplateDefault,
  updateEmailTemplate,
  type EmailTemplateWriteInput,
} from "@/lib/repositories/email-template-repository";
import { prisma } from "@/lib/db/prisma";
import { TECHNICAL_REPORT_STARTER_EMAIL_TEMPLATES } from "@/lib/email/starter-technical-report-email-templates";

export async function listEmailTemplatesForCompany(actor: CurrentActor, includeInactive = false) {
  return listEmailTemplates(actor.companyId, includeInactive);
}

export async function getEmailTemplateForCompany(actor: CurrentActor, templateId: string) {
  return getEmailTemplate(actor.companyId, templateId);
}

export async function createEmailTemplateForCompany(actor: CurrentActor, input: EmailTemplateWriteInput) {
  requireCapability(actor, "email-templates:manage");
  return createEmailTemplate(actor.companyId, input);
}

export async function updateEmailTemplateForCompany(actor: CurrentActor, templateId: string, input: Partial<EmailTemplateWriteInput>) {
  requireCapability(actor, "email-templates:manage");
  return updateEmailTemplate(actor.companyId, templateId, input);
}

export async function setEmailTemplateActiveForCompany(actor: CurrentActor, templateId: string, isActive: boolean) {
  requireCapability(actor, "email-templates:manage");
  return setEmailTemplateActive(actor.companyId, templateId, isActive);
}

export async function setEmailTemplateDefaultForCompany(actor: CurrentActor, templateId: string) {
  requireCapability(actor, "email-templates:manage");
  return setEmailTemplateDefault(actor.companyId, templateId);
}

export async function duplicateEmailTemplateForCompany(actor: CurrentActor, templateId: string) {
  requireCapability(actor, "email-templates:manage");
  return duplicateEmailTemplate(actor.companyId, templateId);
}

/**
 * Installs the built-in technical-report starter templates (attach-and-send + automated-secure-
 * link) into this company's own EmailTemplate table. Idempotent by `code`: a template already
 * installed (or since renamed/edited by the company, but keeping its original code) is left
 * untouched and simply skipped rather than duplicated or overwritten — re-clicking "Install" is
 * always safe.
 */
export async function installTechnicalReportStarterTemplatesForCompany(actor: CurrentActor) {
  requireCapability(actor, "email-templates:manage");
  const existingCodes = new Set(
    (await prisma.emailTemplate.findMany({
      where: { companyId: actor.companyId, code: { in: TECHNICAL_REPORT_STARTER_EMAIL_TEMPLATES.map((t) => t.code) } },
      select: { code: true },
    })).map((row) => row.code),
  );

  const created = [];
  for (const template of TECHNICAL_REPORT_STARTER_EMAIL_TEMPLATES) {
    if (existingCodes.has(template.code)) continue;
    created.push(await createEmailTemplate(actor.companyId, {
      name: template.name,
      code: template.code,
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText,
    }));
  }
  return { created, skipped: TECHNICAL_REPORT_STARTER_EMAIL_TEMPLATES.length - created.length };
}
