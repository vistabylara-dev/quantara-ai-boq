import { z } from "zod";

export const boqItemOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  rate: z.number().min(0),
  selected: z.boolean(),
  specification: z.string(),
});

export const boqItemSchema = z.object({
  id: z.string(),
  itemNumber: z.number().min(1),
  itemCode: z.string().trim().max(100),
  category: z.string().trim().max(255),
  description: z.string().trim().max(2_000),
  specification: z.string().trim().max(5_000).optional(),
  quantity: z.number().finite().min(0),
  unit: z.string().trim().max(50),
  unitCost: z.number().finite().min(0),
  freightCost: z.number().finite().min(0).optional(),
  installationCost: z.number().finite().min(0).optional(),
  additionalCost: z.number().finite().min(0).optional(),
  landedCost: z.number().finite().min(0),
  marginMode: z.enum(["markup", "gross_margin", "MARKUP", "GROSS_MARGIN"]).optional(),
  marginPercentage: z.number().finite().min(0),
  sellingRate: z.number().finite().min(0),
  totalAmount: z.number().finite().min(0),
  wastagePercentage: z.number().finite().min(0),
  taxApplicable: z.boolean(),
  sourceReference: z.string().trim().max(500),
  roomOrZone: z.string().trim().max(500),
  drawingReference: z.string().trim().max(500),
  confidenceScore: z.number().finite().min(0).max(100),
  status: z.string(),
  notes: z.string().optional(),
  options: z.array(boqItemOptionSchema),
});

export const boqSectionSchema = z.object({
  id: z.string(),
  code: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  order: z.number().min(0),
  items: z.array(boqItemSchema),
  collapsed: z.boolean().optional(),
});

export const boqTotalsSchema = z.object({
  directCost: z.number().min(0),
  landedCost: z.number().min(0),
  grossProfit: z.number(),
  grossMarginPercentage: z.number().min(0),
  subtotal: z.number().min(0),
  discountPercentage: z.number().min(0),
  discountAmount: z.number().min(0),
  taxableAmount: z.number().min(0),
  taxAmount: z.number().min(0),
  grandTotal: z.number().min(0),
});

export const boqSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string().min(1),
  revision: z.string().min(1),
  status: z.enum(["draft", "locked", "approved"]),
  pricingMode: z.enum(["PRICED", "UNPRICED"]).default("PRICED"),
  sections: z.array(boqSectionSchema),
  totals: boqTotalsSchema,
  taxRate: z.number().finite().min(0).max(100).optional(),
  isLocked: z.boolean().optional(),
  createdAt: z.string(),
  lockedAt: z.string().optional(),
  approvedBy: z.string().optional(),
});

export type BoqSchemaType = z.infer<typeof boqSchema>;
