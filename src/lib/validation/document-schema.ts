import { z } from "zod";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

export const generateDocumentSchema = z
  .object({
    boqId: z.string().uuid("A valid BOQ ID is required."),
    templateId: z.string().uuid("A valid template ID is required."),
    documentType: z.enum(["CSV", "XLSX", "PDF", "DOCX", "HTML"]),
    audience: z.enum(["INTERNAL", "CLIENT"]),
    acknowledgedWarnings: z.boolean().default(false),
    /**
     * TAYQAN Draft BOQ Word export: QUANTITIES_ONLY omits all pricing data
     * upstream in buildDocumentData, not just in template rendering. Default
     * preserves every existing caller's current (priced) behavior exactly.
     */
    pricingMode: z.enum(["WITH_PRICES", "QUANTITIES_ONLY"]).default("WITH_PRICES"),
  })
  .strict();

export type GenerateDocumentBody = z.output<typeof generateDocumentSchema>;

export const previewHtmlQuerySchema = z
  .object({
    boqId: z.string().uuid("A valid BOQ ID is required."),
    templateId: z.string().uuid("A valid template ID is required."),
    audience: z.enum(["INTERNAL", "CLIENT"]).default("CLIENT"),
    // UI-language presentation only (e.g. which language the watermark
    // overlay renders in) — never changes the underlying BOQ/company/client
    // data, which is never auto-translated.
    locale: z.enum(SUPPORTED_LOCALES).default("en"),
  })
  .strict();

const styleConfigInputSchema = z
  .object({
    direction: z.enum(["ltr", "rtl"]).optional(),
    coverStyle: z.enum(["light", "dark", "none"]).optional(),
    primaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour.").optional(),
    accentColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour.").optional(),
    fontFamily: z.enum(["sans", "arabic-naskh"]).optional(),
    showLogo: z.boolean().optional(),
    showPageNumbers: z.boolean().optional(),
    footerText: z.string().trim().max(255).optional(),
    watermarkDraftText: z.string().trim().max(100).optional(),
  })
  .strict();

const contentConfigInputSchema = z
  .object({
    showCoverPage: z.boolean().optional(),
    showCompanyInfo: z.boolean().optional(),
    showProjectInfo: z.boolean().optional(),
    showTermsSection: z.boolean().optional(),
    showExclusionsSection: z.boolean().optional(),
    showSignatureSection: z.boolean().optional(),
    showInternalCostFieldsToClient: z.boolean().optional(),
    denseTechnicalTable: z.boolean().optional(),
    columns: z
      .object({
        specification: z.boolean().optional(),
        roomOrZone: z.boolean().optional(),
        drawingReference: z.boolean().optional(),
        notes: z.boolean().optional(),
        brandModel: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const documentTemplateCreateSchema = z
  .object({
    industryEngineId: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(1, "Name is required.").max(255),
    code: z.string().trim().min(1, "Code is required.").max(100).regex(/^[A-Za-z0-9_-]+$/, "Code may only contain letters, numbers, dashes, and underscores."),
    type: z.enum(["CORPORATE_TECHNICAL", "EXECUTIVE_PREMIUM", "FURNITURE_CATALOGUE", "MEP_TENDER", "ARABIC_FORMAL"]),
    description: z.string().trim().max(2_000).optional(),
    styleConfig: styleConfigInputSchema.optional(),
    contentConfig: contentConfigInputSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const documentTemplateUpdateSchema = z
  .object({
    industryEngineId: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(1).max(255).optional(),
    code: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/, "Code may only contain letters, numbers, dashes, and underscores.").optional(),
    description: z.string().trim().max(2_000).optional(),
    styleConfig: styleConfigInputSchema.optional(),
    contentConfig: contentConfigInputSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const templateListQuerySchema = z
  .object({
    industryEngineId: z.string().uuid().optional(),
    type: z.enum(["CORPORATE_TECHNICAL", "EXECUTIVE_PREMIUM", "FURNITURE_CATALOGUE", "MEP_TENDER", "ARABIC_FORMAL"]).optional(),
    includeInactive: z.coerce.boolean().optional(),
  })
  .strict();
