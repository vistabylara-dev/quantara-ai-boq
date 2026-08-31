import { z } from "zod";
import { FURNITURE_ORDER_CATEGORIES } from "@/lib/furniture/calculations";

const optionalTrimmed = z.string().trim().min(1).max(250).optional();
const optionalNullableTrimmed = z.string().trim().min(1).max(250).nullable().optional();
const optionalDimension = z.number().finite().positive().max(100_000).nullable().optional();

const edgeBandingSchema = z.object({
  raw: z.string().max(500),
  mode: z.enum(["NONE", "FRONT", "ALL_FOUR", "UNRESOLVED"]),
  selectedEdges: z.array(z.object({
    dimension: z.enum(["WIDTH", "HEIGHT"]),
    count: z.union([z.literal(1), z.literal(2)]),
  }).strict()).max(4),
  orientation: z.enum(["EXPLICIT", "ASSUMED", "UNRESOLVED"]),
}).strict();

export const furnitureCorrectionSchema = z.object({
  room: optionalTrimmed,
  elevationReference: optionalTrimmed,
  assembly: optionalTrimmed,
  part: optionalTrimmed,
  quantity: z.number().finite().positive().max(1_000_000).nullable().optional(),
  dimensions: z.object({
    width: optionalDimension,
    height: optionalDimension,
    depth: optionalDimension,
    thickness: optionalDimension,
  }).strict().optional(),
  materialName: optionalTrimmed,
  finish: optionalNullableTrimmed,
  edgeBanding: edgeBandingSchema.optional(),
  grainDirection: optionalNullableTrimmed,
  hardwareNotes: z.array(z.string().trim().min(1).max(500)).max(100).optional(),
  notes: z.string().trim().max(2_000).nullable().optional(),
  reason: z.string().trim().min(3).max(1_000),
}).strict();

export const furnitureApprovalSchema = z.object({
  acknowledgedIssueCodes: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
}).strict();

export const furnitureBoqGenerationSchema = z.object({
  boqId: z.string().uuid(),
  wastagePercentage: z.number().finite().min(0).max(100),
}).strict();

export const furnitureOrderItemCorrectionSchema = z.object({
  description: optionalTrimmed,
  quantity: z.number().finite().positive().max(1_000_000).nullable().optional(),
  unit: z.string().trim().min(1).max(50).nullable().optional(),
  category: z.enum(FURNITURE_ORDER_CATEGORIES).optional(),
  suppliedByOthers: z.boolean().optional(),
  notes: z.string().trim().max(2_000).nullable().optional(),
  reason: z.string().trim().min(3).max(1_000),
}).strict();

export const furnitureCandidateParamsSchema = z.object({
  projectId: z.string().trim().min(1).max(100),
  candidateId: z.string().uuid(),
}).strict();

export const furnitureProjectParamsSchema = z.object({
  projectId: z.string().trim().min(1).max(100),
}).strict();
