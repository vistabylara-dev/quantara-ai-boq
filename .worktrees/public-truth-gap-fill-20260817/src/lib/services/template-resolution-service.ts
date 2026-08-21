import type { EmailTemplateCategory } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError } from "@/lib/errors/app-error";

/**
 * TEMPLATE-LINK-1 — the one centralized place every real call site resolves
 * "which template (and which exact PUBLISHED version) applies" instead of
 * each service duplicating its own lookup + category guard. Replaces:
 * email-service.ts's `getEmailTemplate`/`getDefaultEmailTemplate` +
 * `assertBoqTemplate`, and technical-report-email-service.ts's equivalent
 * `assertTechnicalReportTemplate` pair.
 *
 * There is only one tier today (company-owned) — every template row already
 * requires a non-nullable companyId, so this always resolves within the
 * caller's own company. A future Quantara-master / company-override tier
 * (explicitly out of scope for this pass) would slot in here as an
 * additional fallback step without changing any call site.
 *
 * Never silently falls back to a draft: if a company has no PUBLISHED
 * version for the requested template, resolution fails loudly with a safe,
 * specific reason — callers must not send a malformed email or generate an
 * empty document.
 */

export type ResolvedEmailTemplate = {
  kind: "EMAIL";
  templateId: string;
  templateCode: string;
  templateName: string;
  versionId: string;
  versionNumber: number;
  subject: string;
  bodyHtml: string;
  bodyText: string;
};

export type ResolvedDocumentTemplate = {
  kind: "BOQ_DOCUMENT";
  templateId: string;
  templateCode: string;
  templateName: string;
  versionId: string | null;
  versionNumber: number | null;
  styleConfigJson: unknown;
  contentConfigJson: unknown;
};

export type ResolvedTechnicalReportTemplate = {
  kind: "TECHNICAL_REPORT";
  templateId: string;
  templateCode: string;
  templateName: string;
  versionId: string | null;
  versionNumber: number | null;
  sectionsJson: unknown;
};

/**
 * Resolves an email template for a business event or an explicit user pick.
 * Priority: `templateId` (an explicit selection from a template picker —
 * still validated for company ownership and category, closing the gap a
 * direct API call could otherwise open) -> `code` (the stable template code
 * for a business event that knows exactly which template it wants) ->
 * the company's single `isDefault` template within that category, matching
 * today's behavior for flows that don't yet have per-event codes.
 */
export async function resolveEmailTemplate(input: { companyId: string; category: EmailTemplateCategory; templateId?: string; code?: string }): Promise<ResolvedEmailTemplate> {
  const template = input.templateId
    ? await prisma.emailTemplate.findFirst({ where: { id: input.templateId, companyId: input.companyId, isActive: true } })
    : input.code
      ? await prisma.emailTemplate.findFirst({ where: { companyId: input.companyId, code: input.code, category: input.category, isActive: true } })
      : await prisma.emailTemplate.findFirst({ where: { companyId: input.companyId, category: input.category, isDefault: true, isActive: true } });

  if (!template) {
    // An explicit templateId that doesn't resolve within the caller's own company (wrong tenant,
    // wrong id, inactive) is a "not found" in the ordinary sense; a missing code/default is a
    // configuration gap the caller should get a clearer message for, not a bare 404.
    if (input.templateId) throw new NotFoundError("Email template not found.");
    throw new AppError("TEMPLATE_NOT_FOUND", `No active ${input.category} email template ${input.code ? `with code "${input.code}"` : "marked as default"} exists for this company.`, 404);
  }
  if (input.templateId && template.category !== input.category) {
    throw new AppError("WRONG_TEMPLATE_CATEGORY", `This email template is not a ${input.category} template.`, 400);
  }

  const version = await prisma.emailTemplateVersion.findFirst({ where: { emailTemplateId: template.id, status: "PUBLISHED" } });
  if (!version) {
    throw new AppError("TEMPLATE_NOT_PUBLISHED", `Email template "${template.name}" (${template.code}) has no published version yet.`, 409);
  }

  return {
    kind: "EMAIL",
    templateId: template.id,
    templateCode: template.code,
    templateName: template.name,
    versionId: version.id,
    versionNumber: version.versionNumber,
    subject: version.subject,
    bodyHtml: version.bodyHtml,
    bodyText: version.bodyText,
  };
}

/**
 * Resolves a BOQ document template. Since document-template selection today
 * is an explicit user choice (a template gallery, not an automatic event),
 * this takes the already-chosen templateId directly rather than a code —
 * its job is purely to pin the exact PUBLISHED version in effect right now,
 * falling back to the template's own live config only if it has no
 * published version yet (pre-versioning / freshly-created templates), so
 * generation is never blocked by this addition.
 */
export async function resolveDocumentTemplateVersion(input: { companyId: string; templateId: string }): Promise<ResolvedDocumentTemplate> {
  const template = await prisma.documentTemplate.findFirst({ where: { id: input.templateId, companyId: input.companyId } });
  if (!template) throw new NotFoundError("Document template not found.");

  const version = await prisma.documentTemplateVersion.findFirst({ where: { documentTemplateId: template.id, status: "PUBLISHED" } });
  return {
    kind: "BOQ_DOCUMENT",
    templateId: template.id,
    templateCode: template.code,
    templateName: template.name,
    versionId: version?.id ?? null,
    versionNumber: version?.versionNumber ?? null,
    styleConfigJson: version?.styleConfigJson ?? template.styleConfigJson,
    contentConfigJson: version?.contentConfigJson ?? template.contentConfigJson,
  };
}

/** Same shape of reasoning as resolveDocumentTemplateVersion, for technical report templates. */
export async function resolveTechnicalReportTemplateVersion(input: { companyId: string; templateId: string }): Promise<ResolvedTechnicalReportTemplate> {
  const template = await prisma.technicalReportTemplate.findFirst({ where: { id: input.templateId, companyId: input.companyId } });
  if (!template) throw new NotFoundError("Technical report template not found.");

  const version = await prisma.technicalReportTemplateVersion.findFirst({ where: { technicalReportTemplateId: template.id, status: "PUBLISHED" } });
  return {
    kind: "TECHNICAL_REPORT",
    templateId: template.id,
    templateCode: template.code,
    templateName: template.name,
    versionId: version?.id ?? null,
    versionNumber: version?.versionNumber ?? null,
    sectionsJson: version?.sectionsJson ?? template.sectionsJson,
  };
}
