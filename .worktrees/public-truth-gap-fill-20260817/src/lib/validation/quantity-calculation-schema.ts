import { QuantityCalculationType } from "@prisma/client";
import { z } from "zod";
import { projectIdentifierSchema } from "@/lib/validation/boq-route-schemas";

export const calculationIdParamsSchema = z.object({
  calculationId: z.string().uuid("A valid calculation ID is required."),
}).strict();

const dimensionValueInputSchema = z.object({
  key: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(200),
  unit: z.string().trim().max(20).nullable(),
  required: z.boolean(),
  value: z.number().finite().nonnegative("Dimension values must not be negative.").nullable(),
  source: z.enum(["extracted_entity", "detected_room", "manual_professional_input"]).nullable(),
  confidence: z.number().min(0).max(100).nullable(),
  reviewStatus: z.enum(["PREFILLED", "MANUAL_ENTRY", "MISSING"]),
}).strict();

export const previewCalculationSchema = z.object({
  calculationType: z.nativeEnum(QuantityCalculationType),
  dimensionValues: z.array(dimensionValueInputSchema).max(50),
}).strict();

export const prefillDimensionsQuerySchema = z.object({
  calculationType: z.nativeEnum(QuantityCalculationType),
  projectId: projectIdentifierSchema,
  extractedEntityId: z.string().uuid().optional(),
  detectedRoomId: z.string().uuid().optional(),
}).strict();

export const createCalculationSchema = z.object({
  projectId: projectIdentifierSchema,
  calculationType: z.nativeEnum(QuantityCalculationType),
  extractedEntityId: z.string().uuid().optional().nullable(),
  dimensionValues: z.array(dimensionValueInputSchema).min(1).max(50),
}).strict();

export const overrideCalculationSchema = z.object({
  resultValue: z.number().finite().nonnegative("The overridden result must not be negative."),
  reason: z.string().trim().min(1, "A reason is required to override a calculated quantity.").max(2_000),
}).strict();

export const rejectCalculationSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required.").max(2_000),
}).strict();
