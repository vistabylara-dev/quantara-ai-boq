import { z } from "zod";

export const templateVersionTransitionSchema = z.object({
  status: z.enum(["REVIEW", "APPROVED", "PUBLISHED", "RETIRED", "DRAFT"]),
}).strict();

export const boqTemplateDraftVersionSchema = z.object({
  styleConfigJson: z.record(z.unknown()),
  contentConfigJson: z.record(z.unknown()),
  changeSummary: z.string().trim().max(500).optional(),
}).strict();

export const technicalReportTemplateDraftVersionSchema = z.object({
  sectionsJson: z.record(z.unknown()),
  changeSummary: z.string().trim().max(500).optional(),
}).strict();

export const emailTemplateDraftVersionSchema = z.object({
  subject: z.string().trim().min(1).max(300),
  bodyHtml: z.string().trim().min(1),
  bodyText: z.string().trim().min(1),
  changeSummary: z.string().trim().max(500).optional(),
}).strict();
