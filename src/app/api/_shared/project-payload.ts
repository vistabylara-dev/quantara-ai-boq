import { z } from "zod";
import {
  clientSchema,
  projectSchema,
  projectStatusSchema,
  projectUpdateSchema,
} from "@/lib/validation/backend-schemas";
import {
  FURNITURE_JOINERY_INDUSTRY_KEY,
  FurnitureDiscipline,
} from "@/lib/furniture/types";

const frontendStatusAliases: Record<string, string> = {
  REVIEW: "NEEDS_REVIEW",
  APPROVED: "INTERNALLY_APPROVED",
  COMPLETED: "ARCHIVED",
};

const projectStatusInputSchema = z.string().trim().transform((value, context) => {
  const normalized = value.toUpperCase().replace(/[\s-]+/g, "_");
  const parsed = projectStatusSchema.safeParse(frontendStatusAliases[normalized] ?? normalized);
  if (!parsed.success) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Project status is invalid.",
    });
    return z.NEVER;
  }
  return parsed.data;
});

const industryKeySchema = z.string().trim().min(1, "Industry engine is required.").max(120);
const ignoredTimestampSchema = z.string().optional();

export const projectCreateRequestSchema = z
  .object({
    id: projectSchema.shape.slug.optional(),
    slug: projectSchema.shape.slug.optional(),
    clientId: projectSchema.shape.clientId.optional(),
    clientName: clientSchema.shape.name.optional(),
    clientEmail: clientSchema.shape.email.optional(),
    industryEngineId: projectSchema.shape.industryEngineId.optional(),
    industryId: industryKeySchema.optional(),
    discipline: z.nativeEnum(FurnitureDiscipline).optional(),
    reference: projectSchema.shape.reference,
    name: projectSchema.shape.name,
    description: projectSchema.shape.description,
    location: projectSchema.shape.location,
    currency: projectSchema.shape.currency,
    taxRate: projectSchema.shape.taxRate,
    language: projectSchema.shape.language,
    status: projectStatusInputSchema.default("DRAFT"),
    currentRevisionNumber: projectSchema.shape.currentRevisionNumber.optional(),
    currentRevision: z.string().optional(),
    createdAt: ignoredTimestampSchema,
    updatedAt: ignoredTimestampSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.clientId && !value.clientName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clientName"],
        message: "Provide clientId or clientName.",
      });
    }
    if (!value.industryEngineId && !value.industryId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["industryId"],
        message: "Provide industryEngineId or industryId.",
      });
    }
    // industryEngineId is a database UUID, so only the explicit key alias can
    // be checked here. UUID callers are validated after tenant-scoped industry
    // resolution in createProjectWithDefaultBoq.
    const industryKey = value.industryId;
    if (industryKey === FURNITURE_JOINERY_INDUSTRY_KEY && !value.discipline) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discipline"],
        message: "Select Furniture or Joinery & Cabinetry.",
      });
    }
    if (industryKey && industryKey !== FURNITURE_JOINERY_INDUSTRY_KEY && value.discipline) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discipline"],
        message: "Furniture disciplines are not valid for this industry.",
      });
    }
  })
  .transform((value) => ({
    clientId: value.clientId,
    clientName: value.clientName,
    clientEmail: value.clientEmail,
    industryEngineId: value.industryEngineId ?? value.industryId!,
    discipline: value.discipline,
    slug: value.slug ?? value.id,
    reference: value.reference,
    name: value.name,
    description: value.description,
    location: value.location,
    currency: value.currency,
    taxRate: value.taxRate,
    language: value.language,
    status: value.status,
  }));

export const projectUpdateRequestSchema = z
  .object({
    id: projectSchema.shape.slug.optional(),
    slug: projectUpdateSchema.shape.slug,
    clientId: projectUpdateSchema.shape.clientId,
    clientName: clientSchema.shape.name.optional(),
    clientEmail: clientSchema.shape.email.optional(),
    industryEngineId: projectUpdateSchema.shape.industryEngineId,
    industryId: industryKeySchema.optional(),
    reference: projectUpdateSchema.shape.reference,
    name: projectUpdateSchema.shape.name,
    description: projectUpdateSchema.shape.description,
    location: projectUpdateSchema.shape.location,
    currency: projectUpdateSchema.shape.currency,
    taxRate: projectUpdateSchema.shape.taxRate,
    language: projectUpdateSchema.shape.language,
    status: projectStatusInputSchema.optional(),
    currentRevision: z.string().optional(),
    createdAt: ignoredTimestampSchema,
    updatedAt: ignoredTimestampSchema,
  })
  .strict()
  .transform((value) => ({
    clientId: value.clientId,
    clientName: value.clientName,
    clientEmail: value.clientEmail,
    industryEngineId: value.industryEngineId ?? value.industryId,
    reference: value.reference,
    name: value.name,
    description: value.description,
    location: value.location,
    currency: value.currency,
    taxRate: value.taxRate,
    language: value.language,
    status: value.status,
  }));

export type ProjectCreateRequest = z.output<typeof projectCreateRequestSchema>;
export type ProjectUpdateRequest = z.output<typeof projectUpdateRequestSchema>;
