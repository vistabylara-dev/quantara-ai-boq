import { z } from "zod";

export const technicalReportShareCreateSchema = z
  .object({
    expiresInDays: z.number().int().min(1).max(365).optional(),
  })
  .strict();

const emailAddressList = z.array(z.string().trim().email()).max(10).optional();

export const previewTechnicalReportEmailSchema = z
  .object({
    emailTemplateId: z.string().uuid("Select an email template."),
    rawShareToken: z.string().trim().min(20).max(200).optional(),
    revision: z.string().trim().max(50).optional(),
  })
  .strict();

export const testSendTechnicalReportEmailSchema = previewTechnicalReportEmailSchema.extend({
  testRecipient: z.string().trim().email("A valid test recipient email is required."),
});

export const sendTechnicalReportEmailSchema = z
  .object({
    recipientEmail: z.string().trim().email("A valid recipient email is required."),
    recipientName: z.string().trim().min(1, "Recipient name is required.").max(200),
    emailTemplateId: z.string().uuid("Select an email template."),
    rawShareToken: z.string().trim().min(20).max(200).optional(),
    revision: z.string().trim().max(50).optional(),
    cc: emailAddressList,
    bcc: emailAddressList,
    replyTo: z.string().trim().email().optional(),
  })
  .strict();
