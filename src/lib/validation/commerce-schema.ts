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

// ---------------------------------------------------------------------------
// STRIPE-1C
// ---------------------------------------------------------------------------

export const commercePriceIdParamsSchema = z
  .object({
    priceId: z.string().uuid("A valid price ID is required."),
  })
  .strict();

export const commercePriceReviewUpdateSchema = z
  .object({
    reviewStatus: z.enum(["DRAFT", "REQUIRES_REVIEW", "APPROVED", "RETIRED"]),
    reviewNote: z.string().trim().max(2000).optional(),
  })
  .strict();

export const stripeSynchronizeRequestSchema = z
  .object({
    catalogueFingerprint: z.string().min(1, "A catalogue fingerprint from a recent dry run is required."),
    confirm: z.literal(true, { errorMap: () => ({ message: "Synchronization requires confirm: true." }) }),
  })
  .strict();

export const stripeHistoryQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

export type CommercePriceIdParams = z.output<typeof commercePriceIdParamsSchema>;
export type CommercePriceReviewUpdateInput = z.output<typeof commercePriceReviewUpdateSchema>;
export type StripeSynchronizeRequestInput = z.output<typeof stripeSynchronizeRequestSchema>;
export type StripeHistoryQuery = z.output<typeof stripeHistoryQuerySchema>;

// ---------------------------------------------------------------------------
// STRIPE-COMMERCIAL-2 — customer checkout. Deliberately the only field
// accepted from the browser: every other checkout fact (amount, currency,
// Stripe price ID, company identity) is resolved server-side. `.strict()`
// rejects any extra field (amount, currency, providerPriceId, companyId,
// metadata, ...) outright instead of silently ignoring it.
// ---------------------------------------------------------------------------

export const commerceCheckoutRequestSchema = z
  .object({
    priceCode: z.string().trim().min(1, "A price code is required.").max(200),
  })
  .strict();

export type CommerceCheckoutRequestInput = z.output<typeof commerceCheckoutRequestSchema>;
