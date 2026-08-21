import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import {
  createReportTemplate,
  getReportTemplate,
  listReportTemplates,
  setReportTemplateActive,
  type ReportTemplateListFilters,
} from "@/lib/repositories/report-template-repository";
import { prisma } from "@/lib/db/prisma";
import { reportTemplateSectionsSchema, type ReportTemplateSections } from "@/lib/documents/report-template-sections";
import { AppError } from "@/lib/errors/app-error";
import fmIntegratedTechnicalReportTemplate from "@/lib/documents/starter-templates/fm-integrated-technical-report-template.json";

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

type StarterReportTemplateSpec = {
  templateName: string;
  templateCode: string;
  disciplinesCovered?: string[];
  note?: string;
};

const STARTER_REPORT_TEMPLATES: { spec: StarterReportTemplateSpec; sections: unknown }[] = [
  { spec: fmIntegratedTechnicalReportTemplate as StarterReportTemplateSpec, sections: fmIntegratedTechnicalReportTemplate },
];

/**
 * Installs the built-in FM/technical condition report template into this company's own
 * TechnicalReportTemplate table, so a non-technical user never has to prepare or upload a JSON
 * file themselves — mirrors installTechnicalReportStarterTemplatesForCompany's idempotent-by-code
 * pattern for email templates. Content is Lara's own authored professional content, genericized
 * from a real client deliverable (see the `note` field in the source JSON) — nothing invented.
 */
export async function installStarterReportTemplatesForCompany(actor: CurrentActor) {
  requireCapability(actor, "report-templates:manage");
  const codes = STARTER_REPORT_TEMPLATES.map((t) => t.spec.templateCode);
  const existingCodes = new Set(
    (await prisma.technicalReportTemplate.findMany({
      where: { companyId: actor.companyId, code: { in: codes } },
      select: { code: true },
    })).map((row) => row.code),
  );

  const created = [];
  for (const { spec, sections } of STARTER_REPORT_TEMPLATES) {
    if (existingCodes.has(spec.templateCode)) continue;
    const parsed = reportTemplateSectionsSchema.parse(sections);
    created.push(await createReportTemplate(actor.companyId, {
      name: spec.templateName,
      code: spec.templateCode,
      disciplineTag: (spec.disciplinesCovered ?? []).join(", "),
      description: spec.note ?? "",
      sectionsJson: parsed as ReportTemplateSections,
      isActive: true,
    }));
  }
  return { created, skipped: STARTER_REPORT_TEMPLATES.length - created.length };
}
