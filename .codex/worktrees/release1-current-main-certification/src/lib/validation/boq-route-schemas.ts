import { z } from "zod";
import {
  boqItemSchema as backendBOQItemSchema,
  boqItemUpdateSchema,
  boqSectionSchema as backendBOQSectionSchema,
  boqUpdateSchema,
} from "@/lib/validation/backend-schemas";
import { boqSchema as frontendBOQSchema } from "@/lib/validation/boq-schema";

const ROUTE_INJECTED_UUID = "00000000-0000-4000-8000-000000000000";

export const boqIdParamsSchema = z.object({
  boqId: z.string().uuid("A valid BOQ ID is required."),
});

export const sectionIdParamsSchema = z.object({
  sectionId: z.string().uuid("A valid section ID is required."),
});

export const itemIdParamsSchema = z.object({
  itemId: z.string().uuid("A valid item ID is required."),
});

/** Accepts either a project's slug or its canonical UUID — the same identifier format getProjectRecord() resolves. */
export const projectIdentifierSchema = z.string().trim().min(1, "A project ID or slug is required.").max(120);

export const projectIdParamsSchema = z.object({
  projectId: projectIdentifierSchema,
});

export const frontendBOQUpdateSchema = frontendBOQSchema.extend({
  id: z.string().optional(),
  databaseId: z.string().uuid("A valid BOQ database ID is required.").optional(),
  projectId: z.string().optional(),
  approvedBy: boqUpdateSchema.shape.approvedByName,
  taxRate: boqUpdateSchema.shape.taxRate,
});

const sectionTemplateSchema = z.object({
  code: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(2_000).optional(),
  order: z.number().int().nonnegative().optional(),
}).strict();

export const projectBOQCreateSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  sections: z.array(sectionTemplateSchema).max(200).optional(),
}).strict();

export const actorSchema = z.object({
  actorName: z.string().trim().min(1).max(255).optional(),
}).strict();

export const sectionWriteRouteSchema = backendBOQSectionSchema
  .omit({ boqId: true })
  .extend({ sortOrder: z.number().int().nonnegative().optional() });

function injectSectionId(value: unknown, defaultSortOrder?: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const input = value as Record<string, unknown>;
  return {
    ...(defaultSortOrder === undefined ? {} : { sortOrder: defaultSortOrder }),
    ...input,
    sectionId: ROUTE_INJECTED_UUID,
  };
}

const itemCreateWithSortOrderSchema = z.preprocess(
  (value) => injectSectionId(value),
  backendBOQItemSchema,
);

const itemCreateWithoutSortOrderSchema = z
  .preprocess((value) => injectSectionId(value, 0), backendBOQItemSchema)
  .transform((value) => ({ ...value, sortOrder: undefined }));

export const itemCreateRouteSchema = z.union([
  itemCreateWithSortOrderSchema,
  itemCreateWithoutSortOrderSchema,
]);

export const itemUpdateRouteSchema = boqItemUpdateSchema;
