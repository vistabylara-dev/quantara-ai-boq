import type { EmailTemplate } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";

export type EmailTemplateWriteInput = {
  name: string;
  code: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  language?: string;
  isActive?: boolean;
};

function toEmailTemplateDTO(row: EmailTemplate) {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    code: row.code,
    subject: row.subject,
    bodyHtml: row.bodyHtml,
    bodyText: row.bodyText,
    language: row.language,
    isDefault: row.isDefault,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type EmailTemplateDTO = ReturnType<typeof toEmailTemplateDTO>;

async function getEmailTemplateRecord(companyId: string, templateId: string) {
  const row = await prisma.emailTemplate.findFirst({ where: { id: templateId, companyId } });
  if (!row) throw new NotFoundError("Email template not found.");
  return row;
}

export async function getEmailTemplate(companyId: string, templateId: string) {
  return toEmailTemplateDTO(await getEmailTemplateRecord(companyId, templateId));
}

export async function listEmailTemplates(companyId: string, includeInactive = false) {
  const rows = await prisma.emailTemplate.findMany({
    where: { companyId, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  return rows.map(toEmailTemplateDTO);
}

export async function getDefaultEmailTemplate(companyId: string) {
  const row = await prisma.emailTemplate.findFirst({ where: { companyId, isDefault: true, isActive: true } });
  return row ? toEmailTemplateDTO(row) : null;
}

export async function createEmailTemplate(companyId: string, input: EmailTemplateWriteInput) {
  const existing = await prisma.emailTemplate.findFirst({ where: { companyId, code: input.code } });
  if (existing) throw new ConflictError("EMAIL_TEMPLATE_CODE_EXISTS", "An email template with this code already exists.");

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.emailTemplate.create({
      data: {
        companyId,
        name: input.name,
        code: input.code,
        subject: input.subject,
        bodyHtml: input.bodyHtml,
        bodyText: input.bodyText,
        language: input.language ?? "English",
        isActive: input.isActive ?? true,
      },
    });
    await createAuditLog(companyId, { entityType: "EmailTemplate", entityId: row.id, action: "EMAIL_TEMPLATE_CREATED", payload: { name: row.name, code: row.code } }, tx);
    return row;
  });
  return toEmailTemplateDTO(created);
}

export async function updateEmailTemplate(companyId: string, templateId: string, input: Partial<EmailTemplateWriteInput>) {
  const current = await getEmailTemplateRecord(companyId, templateId);
  if (input.code !== undefined && input.code !== current.code) {
    const duplicate = await prisma.emailTemplate.findFirst({ where: { companyId, code: input.code } });
    if (duplicate) throw new ConflictError("EMAIL_TEMPLATE_CODE_EXISTS", "An email template with this code already exists.");
  }
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.emailTemplate.update({
      where: { id: current.id, companyId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.subject !== undefined ? { subject: input.subject } : {}),
        ...(input.bodyHtml !== undefined ? { bodyHtml: input.bodyHtml } : {}),
        ...(input.bodyText !== undefined ? { bodyText: input.bodyText } : {}),
        ...(input.language !== undefined ? { language: input.language } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    await createAuditLog(companyId, { entityType: "EmailTemplate", entityId: row.id, action: "EMAIL_TEMPLATE_UPDATED", payload: { name: row.name, code: row.code } }, tx);
    return row;
  });
  return toEmailTemplateDTO(updated);
}

export async function setEmailTemplateActive(companyId: string, templateId: string, isActive: boolean) {
  const current = await getEmailTemplateRecord(companyId, templateId);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.emailTemplate.update({ where: { id: current.id, companyId }, data: { isActive } });
    await createAuditLog(companyId, {
      entityType: "EmailTemplate",
      entityId: row.id,
      action: isActive ? "EMAIL_TEMPLATE_ACTIVATED" : "EMAIL_TEMPLATE_DEACTIVATED",
      payload: { name: row.name, code: row.code },
    }, tx);
    return row;
  });
  return toEmailTemplateDTO(updated);
}

export async function setEmailTemplateDefault(companyId: string, templateId: string) {
  const current = await getEmailTemplateRecord(companyId, templateId);
  const updated = await prisma.$transaction(async (tx) => {
    await tx.emailTemplate.updateMany({ where: { companyId, isDefault: true, id: { not: current.id } }, data: { isDefault: false } });
    const row = await tx.emailTemplate.update({ where: { id: current.id, companyId }, data: { isDefault: true } });
    await createAuditLog(companyId, { entityType: "EmailTemplate", entityId: row.id, action: "EMAIL_TEMPLATE_UPDATED", payload: { setDefault: true } }, tx);
    return row;
  });
  return toEmailTemplateDTO(updated);
}

export async function duplicateEmailTemplate(companyId: string, templateId: string) {
  const current = await getEmailTemplateRecord(companyId, templateId);
  let code = `${current.code}-copy`;
  let suffix = 2;
  while (await prisma.emailTemplate.findFirst({ where: { companyId, code } })) {
    code = `${current.code}-copy-${suffix}`;
    suffix += 1;
  }
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.emailTemplate.create({
      data: {
        companyId,
        name: `${current.name} (Copy)`,
        code,
        subject: current.subject,
        bodyHtml: current.bodyHtml,
        bodyText: current.bodyText,
        language: current.language,
        isDefault: false,
        isActive: true,
      },
    });
    await createAuditLog(companyId, { entityType: "EmailTemplate", entityId: row.id, action: "EMAIL_TEMPLATE_CREATED", payload: { duplicatedFrom: current.id } }, tx);
    return row;
  });
  return toEmailTemplateDTO(created);
}
