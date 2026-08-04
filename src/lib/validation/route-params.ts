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

export const proposalIdParamsSchema = z.object({
  proposalId: z.string().uuid("A valid proposal ID is required."),
}).strict();

export const proposalTokenParamsSchema = z.object({
  token: z.string().trim().min(20, "A valid proposal token is required.").max(200),
}).strict();

export const proposalTokenDocumentParamsSchema = z.object({
  token: z.string().trim().min(20, "A valid proposal token is required.").max(200),
  documentId: z.string().uuid("A valid document ID is required."),
}).strict();

export const categoryIdParamsSchema = z.object({
  categoryId: z.string().uuid("A valid category ID is required."),
}).strict();

export const masterItemIdParamsSchema = z.object({
  itemId: z.string().uuid("A valid master item ID is required."),
}).strict();

export const packageIdParamsSchema = z.object({
  packageId: z.string().min(1, "A valid package ID is required.").max(200),
}).strict();

export const libraryItemIdParamsSchema = z.object({
  itemId: z.string().uuid("A valid company library item ID is required."),
}).strict();

export const boqIdParamsSchema = z.object({
  boqId: z.string().uuid("A valid BOQ ID is required."),
}).strict();

export const importJobIdParamsSchema = z.object({
  importJobId: z.string().uuid("A valid import job ID is required."),
}).strict();

export const importJobRowIdParamsSchema = z.object({
  importJobId: z.string().uuid("A valid import job ID is required."),
  rowId: z.string().uuid("A valid import row ID is required."),
}).strict();

export const projectFileIdParamsSchema = z.object({
  fileId: z.string().uuid("A valid file ID is required."),
}).strict();

export const extractionJobIdParamsSchema = z.object({
  jobId: z.string().uuid("A valid job ID is required."),
}).strict();

export const drawingPageIdParamsSchema = z.object({
  pageId: z.string().uuid("A valid drawing page ID is required."),
}).strict();

export const entityIdParamsSchema = z.object({
  entityId: z.string().uuid("A valid entity ID is required."),
}).strict();

export const findingIdParamsSchema = z.object({
  findingId: z.string().uuid("A valid finding ID is required."),
}).strict();

export const inspectionIdParamsSchema = z.object({
  inspectionId: z.string().uuid("A valid inspection ID is required."),
}).strict();

export const reportTemplateIdParamsSchema = z.object({
  reportTemplateId: z.string().uuid("A valid report template ID is required."),
}).strict();

export const technicalReportIdParamsSchema = z.object({
  reportId: z.string().uuid("A valid report ID is required."),
}).strict();

export const technicalReportTokenParamsSchema = z.object({
  token: z.string().trim().min(20, "A valid share token is required.").max(200),
}).strict();
