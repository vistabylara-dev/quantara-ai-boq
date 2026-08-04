import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import {
  createReportTemplate,
  getReportTemplate,
  listReportTemplates,
  setReportTemplateActive,
  type ReportTemplateListFilters,
} from "@/lib/repositories/report-template-repository";
import { reportTemplateSectionsSchema, type ReportTemplateSections } from "@/lib/documents/report-template-sections";
import { AppError } from "@/lib/errors/app-error";

export type ImportReportTemplateInput = {
  name: string;
  code: string;
  disciplineTag?: string;
  description?: string;
  sections: unknown;
  isActive?: boolean;
};

/**
 * Loads a report template from the same JSON shape the conversion tooling produces (front matter
 * + ordered sections of heading/paragraph/table/callout blocks — see
 * report-template-sections.ts). This is the "upload a template like a BOQ import" entry point:
 * one call creates one reusable TechnicalReportTemplate row, ready for a project to instantiate.
 */
export async function importTemplateFromSpec(actor: CurrentActor, input: ImportReportTemplateInput) {
  requireCapability(actor, "report-templates:manage");

  const parsed = reportTemplateSectionsSchema.safeParse(input.sections);
  if (!parsed.success) {
    throw new AppError(
      "INVALID_REPORT_TEMPLATE_SECTIONS",
      "The template's sections did not match the expected structure.",
      400,
      Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).filter((e): e is [string, string[]] => Boolean(e[1]?.length)),
      ),
    );
  }
  if (parsed.data.sections.length === 0) {
    throw new AppError("EMPTY_REPORT_TEMPLATE", "A report template must contain at least one section.", 400);
  }

  return createReportTemplate(actor.companyId, {
    name: input.name,
    code: input.code,
    disciplineTag: input.disciplineTag,
    description: input.description,
    sectionsJson: parsed.data as ReportTemplateSections,
    isActive: input.isActive,
  });
}

export async function listReportTemplatesForCompany(actor: CurrentActor, filters: ReportTemplateListFilters = {}) {
  return listReportTemplates(actor.companyId, filters);
}

export async function getReportTemplateForCompany(actor: CurrentActor, templateId: string) {
  return getReportTemplate(actor.companyId, templateId);
}

export async function setReportTemplateActiveState(actor: CurrentActor, templateId: string, isActive: boolean) {
  requireCapability(actor, "report-templates:manage");
  return setReportTemplateActive(actor.companyId, templateId, isActive);
}
