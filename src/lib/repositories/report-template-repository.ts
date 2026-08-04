import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { reportTemplateSectionsSchema, type ReportTemplateSections } from "@/lib/documents/report-template-sections";

export type ReportTemplateWriteInput = {
  name: string;
  code: string;
  disciplineTag?: string;
  description?: string;
  sectionsJson: ReportTemplateSections;
  isActive?: boolean;
};

export type ReportTemplateListFilters = {
  includeInactive?: boolean;
};

function toSections(json: Prisma.JsonValue): ReportTemplateSections {
  // The DB already only ever holds validated sectionsJson (validated at write time in
  // importTemplateFromSpec/createTemplate) — re-parsing here is a cheap integrity check, not the
  // primary validation gate.
  return reportTemplateSectionsSchema.parse(json);
}

export function toReportTemplateDTO(row: {
  id: string;
  companyId: string;
  name: string;
  code: string;
  disciplineTag: string;
  description: string;
  sectionsJson: Prisma.JsonValue;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    code: row.code,
    disciplineTag: row.disciplineTag,
    description: row.description,
    sections: toSections(row.sectionsJson),
    isDefault: row.isDefault,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getTemplateRecord(companyId: string, templateId: string) {
  const template = await prisma.technicalReportTemplate.findFirst({ where: { id: templateId, companyId } });
  if (!template) throw new NotFoundError("Report template not found.");
  return template;
}

export async function getReportTemplateRecord(companyId: string, templateId: string) {
  return getTemplateRecord(companyId, templateId);
}

export async function getReportTemplate(companyId: string, templateId: string) {
  return toReportTemplateDTO(await getTemplateRecord(companyId, templateId));
}

export async function listReportTemplates(companyId: string, filters: ReportTemplateListFilters = {}) {
  const templates = await prisma.technicalReportTemplate.findMany({
    where: { companyId, ...(filters.includeInactive ? {} : { isActive: true }) },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  return templates.map(toReportTemplateDTO);
}

export async function createReportTemplate(companyId: string, input: ReportTemplateWriteInput) {
  const existing = await prisma.technicalReportTemplate.findFirst({ where: { companyId, code: input.code } });
  if (existing) throw new ConflictError("REPORT_TEMPLATE_CODE_EXISTS", "A report template with this code already exists.");

  const template = await prisma.$transaction(async (tx) => {
    const created = await tx.technicalReportTemplate.create({
      data: {
        companyId,
        name: input.name,
        code: input.code,
        disciplineTag: input.disciplineTag ?? "",
        description: input.description ?? "",
        sectionsJson: input.sectionsJson as unknown as Prisma.InputJsonValue,
        isActive: input.isActive ?? true,
      },
    });
    // TEMPLATE-LINK-1 — mirrors document-template-repository.ts's createTemplate: usable
    // immediately via a PUBLISHED version 1, though report creation itself never requires one
    // (resolveTechnicalReportTemplateVersion falls back to the template's own live sectionsJson).
    await tx.technicalReportTemplateVersion.create({
      data: {
        technicalReportTemplateId: created.id,
        versionNumber: 1,
        status: "PUBLISHED",
        sectionsJson: created.sectionsJson as Prisma.InputJsonValue,
        effectiveDate: new Date(),
        changeSummary: "Initial version.",
      },
    });
    await createAuditLog(companyId, {
      entityType: "TechnicalReportTemplate",
      entityId: created.id,
      action: "REPORT_TEMPLATE_IMPORTED",
      payload: { name: created.name, code: created.code, sectionCount: input.sectionsJson.sections.length },
    }, tx);
    return created;
  });
  return toReportTemplateDTO(template);
}

export async function setReportTemplateActive(companyId: string, templateId: string, isActive: boolean) {
  const current = await getTemplateRecord(companyId, templateId);
  const template = await prisma.$transaction(async (tx) => {
    const updated = await tx.technicalReportTemplate.update({ where: { id: current.id, companyId }, data: { isActive } });
    await createAuditLog(companyId, {
      entityType: "TechnicalReportTemplate",
      entityId: updated.id,
      action: isActive ? "REPORT_TEMPLATE_ACTIVATED" : "REPORT_TEMPLATE_DEACTIVATED",
      payload: { name: updated.name, code: updated.code },
    }, tx);
    return updated;
  });
  return toReportTemplateDTO(template);
}
