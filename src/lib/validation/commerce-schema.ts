import { CommerceBillingInterval, CommerceProductType } from "@prisma/client";
import { z } from "zod";

export const commerceProductIdParamsSchema = z
  .object({
    productId: z.string().uuid("A valid product ID is required."),
  })
  .strict();

export const commerceProductListQuerySchema = z
  .object({
    type: z.nativeEnum(CommerceProductType).optional(),
    billingInterval: z.nativeEnum(CommerceBillingInterval).optional(),
    activeOnly: z.enum(["true", "false"]).optional(),
    publicOnly: z.enum(["true", "false"]).optional(),
  })
  .strict();

/** The only mutation surface exposed in STRIPE-1B — activate/deactivate,
 *  publish/unpublish, reorder. Never product code/type/prices/entitlements. */
export const commerceProductStateUpdateSchema = z
  .object({
    isActive: z.boolean().optional(),
    isPublic: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(100000).optional(),
  })
  .strict()
  .refine((value) => value.isActive !== undefined || value.isPublic !== undefined || value.sortOrder !== undefined, {
    message: "At least one of isActive, isPublic, or sortOrder must be provided.",
  });

export type CommerceProductIdParams = z.output<typeof commerceProductIdParamsSchema>;
export type CommerceProductListQuery = z.output<typeof commerceProductListQuerySchema>;
export type CommerceProductStateUpdateInput = z.output<typeof commerceProductStateUpdateSchema>;
