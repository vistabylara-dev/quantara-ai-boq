import { z } from "zod";
import { reportTemplateSectionsSchema } from "@/lib/documents/report-template-sections";

export const reportTemplateImportSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(255),
    code: z.string().trim().min(1, "Code is required.").max(100).regex(/^[A-Za-z0-9_-]+$/, "Code may only contain letters, numbers, dashes, and underscores."),
    disciplineTag: z.string().trim().max(255).optional(),
    description: z.string().trim().max(2_000).optional(),
    sections: reportTemplateSectionsSchema,
    isActive: z.boolean().optional(),
  })
  .strict();

export const reportTemplateActiveSchema = z.object({ isActive: z.boolean() }).strict();

export const reportTemplateListQuerySchema = z
  .object({
    includeInactive: z.coerce.boolean().optional(),
  })
  .strict();

export const technicalReportCreateSchema = z
  .object({
    templateId: z.string().uuid("A valid report template ID is required."),
    name: z.string().trim().min(1, "Report name is required.").max(255),
  })
  .strict();

export const technicalReportFieldValuesSchema = z
  .object({
    fieldValues: z.record(z.string(), z.string().max(10_000)),
  })
  .strict();

export const technicalReportGenerateSchema = z
  .object({
    documentType: z.enum(["CSV", "XLSX", "PDF", "DOCX", "HTML"]).default("DOCX"),
  })
  .strict();
