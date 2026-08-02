import { z } from "zod";

export const clientIdParamsSchema = z.object({
  clientId: z.string().uuid("A valid client ID is required."),
}).strict();

export const catalogueItemIdParamsSchema = z.object({
  itemId: z.string().uuid("A valid catalogue item ID is required."),
}).strict();

export const verificationBOQIdParamsSchema = z.object({
  boqId: z.string().uuid("A valid BOQ ID is required."),
}).strict();

export const verificationExceptionIdParamsSchema = z.object({
  exceptionId: z.string().uuid("A valid verification exception ID is required."),
}).strict();

export const documentIdParamsSchema = z.object({
  documentId: z.string().uuid("A valid document ID is required."),
}).strict();

export const templateIdParamsSchema = z.object({
  templateId: z.string().uuid("A valid template ID is required."),
}).strict();
