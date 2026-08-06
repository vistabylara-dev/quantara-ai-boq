import { z } from "zod";

const proposalSettingsInputSchema = z
  .object({
    showUnitRates: z.boolean().optional(),
    showSectionTotals: z.boolean().optional(),
    allowOptionSelection: z.boolean().optional(),
    allowComments: z.boolean().optional(),
    allowDocumentDownload: z.boolean().optional(),
    requireApprovalName: z.boolean().optional(),
    requireApprovalEmail: z.boolean().optional(),
    requireAccessPasscode: z.boolean().optional(),
    accessPasscode: z.string().trim().min(4).max(50).optional(),
    clientLanguage: z.enum(["English", "Arabic"]).optional(),
    showTerms: z.boolean().optional(),
    showExclusions: z.boolean().optional(),
  })
  .strict();

const createBoqProposalSchema = z
  .object({
    sourceType: z.literal("BOQ_REVISION"),
    boqId: z.string().uuid("A valid BOQ ID is required."),
    recipientEmail: z.string().trim().email("A valid recipient email is required.").max(255),
    recipientName: z.string().trim().min(1, "Recipient name is required.").max(255),
    expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
    settings: proposalSettingsInputSchema.optional(),
    documentIds: z.array(z.string().uuid()).min(1, "Select at least one document."),
    forceNew: z.boolean().optional(),
  })
  .strict();

const createTechnicalReportProposalSchema = z
  .object({
    sourceType: z.literal("TECHNICAL_REPORT_REVISION"),
    technicalReportId: z.string().uuid("A valid technical report ID is required."),
    recipientEmail: z.string().trim().email("A valid recipient email is required.").max(255),
    recipientName: z.string().trim().min(1, "Recipient name is required.").max(255),
    expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
    settings: proposalSettingsInputSchema.optional(),
    forceNew: z.boolean().optional(),
  })
  .strict();

export const createProposalSchema = z.discriminatedUnion("sourceType", [
  createBoqProposalSchema,
  createTechnicalReportProposalSchema,
]);

export const updateProposalSchema = z
  .object({
    recipientEmail: z.string().trim().email().max(255).optional(),
    recipientName: z.string().trim().min(1).max(255).optional(),
    expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
    settings: proposalSettingsInputSchema.optional(),
    documentIds: z.array(z.string().uuid()).optional(),
  })
  .strict();

export const previewEmailSchema = z
  .object({
    rawToken: z.string().trim().min(20).max(200),
    emailTemplateId: z.string().uuid().optional(),
  })
  .strict();

export const testSendEmailSchema = previewEmailSchema.extend({
  testRecipient: z.string().trim().email("A valid test recipient email is required."),
});

export const sendEmailSchema = z
  .object({
    rawToken: z.string().trim().min(20).max(200),
    emailTemplateId: z.string().uuid().optional(),
    cc: z.array(z.string().trim().email()).max(10).optional(),
    bcc: z.array(z.string().trim().email()).max(10).optional(),
    replyTo: z.string().trim().email().optional(),
  })
  .strict();

const emailTemplateCategorySchema = z.enum(["BOQ", "TECHNICAL_REPORT", "GENERAL"]);

export const emailTemplateCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(255),
    code: z.string().trim().min(1, "Code is required.").max(100).regex(/^[a-z0-9-]+$/, "Code may only contain lowercase letters, numbers, and dashes."),
    category: emailTemplateCategorySchema.optional(),
    subject: z.string().trim().min(1, "Subject is required.").max(500),
    bodyHtml: z.string().trim().min(1, "HTML body is required.").max(50_000),
    bodyText: z.string().trim().min(1, "Text body is required.").max(50_000),
    language: z.enum(["English", "Arabic"]).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const emailTemplateUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    code: z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
    category: emailTemplateCategorySchema.optional(),
    subject: z.string().trim().min(1).max(500).optional(),
    bodyHtml: z.string().trim().min(1).max(50_000).optional(),
    bodyText: z.string().trim().min(1).max(50_000).optional(),
    language: z.enum(["English", "Arabic"]).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

// ---------- Public portal action schemas ----------

export const publicPasscodeSchema = z.object({ passcode: z.string().trim().min(1).max(50) }).strict();

export const publicOptionSelectionSchema = z
  .object({
    boqItemId: z.string().uuid(),
    optionId: z.string().uuid().nullable(),
  })
  .strict();

export const publicCommentSchema = z
  .object({
    comment: z.string().trim().min(1, "Enter a comment before submitting.").max(4_000),
    actorName: z.string().trim().max(255).optional(),
    actorEmail: z.string().trim().email().max(255).optional(),
  })
  .strict();

export const publicRevisionRequestSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required."),
    email: z.string().trim().email("A valid email is required."),
    comment: z.string().trim().min(1, "A reason is required.").max(4_000),
  })
  .strict();

export const publicApprovalSchema = z
  .object({
    approvalName: z.string().trim().max(255).default(""),
    approvalEmail: z.string().trim().max(255).default(""),
    confirmReview: z.boolean(),
    comment: z.string().trim().max(4_000).optional(),
  })
  .strict();

export const publicRejectionSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required."),
    email: z.string().trim().email("A valid email is required."),
    reason: z.string().trim().min(1, "A reason is required.").max(4_000),
  })
  .strict();
