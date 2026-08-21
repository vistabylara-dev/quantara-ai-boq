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
    checkoutMode: z.enum(["SUBSCRIPTION", "BOQ_UNLOCK"]).default("SUBSCRIPTION"),
    priceCode: z.string().trim().max(200).optional(),
    boqId: z.string().trim().optional(),
    revisionNumber: z.number().int().optional(),
    billingInterval: z.enum(["MONTH", "YEAR"]).default("YEAR"),
  })
  .refine(
    (data) => {
      if (data.checkoutMode === "SUBSCRIPTION") return !!data.priceCode;
      if (data.checkoutMode === "BOQ_UNLOCK") return !!data.boqId && data.revisionNumber !== undefined;
      return false;
    },
    { message: "Invalid payload for the chosen checkout mode." }
  );

export type CommerceCheckoutRequestInput = z.output<typeof commerceCheckoutRequestSchema>;

// ---------------------------------------------------------------------------
// v5 — sales-led Enterprise checkout (owner/admin only).
//
// Deliberately just two fields, both trusted internal identifiers chosen by a
// platform operator from their own admin surface — never a customer-facing
// input, and never a Stripe object ID. `.strict()` rejects any extra field
// (amount, currency, providerPriceId, stripeCustomerId, metadata, ...)
// outright rather than silently ignoring it. `priceCode` is additionally
// re-validated server-side against the closed three-code allowlist in
// enterprise-sales-checkout-service.ts; this enum is the first of the two
// gates, not the only one.
// ---------------------------------------------------------------------------

export const enterpriseCheckoutRequestSchema = z
  .object({
    companyId: z.string().uuid("A valid company ID is required."),
    priceCode: z.enum([
      "enterprise_core_annual_aed_15000",
      "enterprise_scale_annual_aed_25000",
      "enterprise_authority_annual_aed_35000",
    ]),
  })
  .strict();

export type EnterpriseCheckoutRequestInput = z.output<typeof enterpriseCheckoutRequestSchema>;

// REFUND-8 — deliberately just `reason`. The customer never supplies an
// amount, currency, or any Stripe object ID — see refund-request-service.ts.
export const refundRequestSchema = z
  .object({
    reason: z.string().trim().min(1, "A reason is required.").max(2000, "The reason is too long."),
  })
  .strict();

export type RefundRequestInput = z.output<typeof refundRequestSchema>;

export const refundRequestIdParamsSchema = z
  .object({
    id: z.string().uuid("A valid refund request ID is required."),
  })
  .strict();

export const refundApproveRequestSchema = z
  .object({
    action: z.enum(["REFUND_ONLY", "REFUND_AND_CANCEL"]),
  })
  .strict();

export const refundRejectRequestSchema = z
  .object({
    reason: z.string().trim().max(2000).optional(),
  })
  .strict();

// REFUND-22 — owner-only, bypasses the normal 7-day window. companyId is a
// trusted internal ID chosen by the owner from their own admin UI (never
// derived from any customer-facing input), not an "arbitrary Stripe ID" —
// it is still never a Stripe object ID.
export const refundExceptionRequestSchema = z
  .object({
    companyId: z.string().uuid("A valid company ID is required."),
    category: z.enum(["DUPLICATE_CHARGE", "INCORRECT_BILLING", "PROVIDER_ERROR", "LEGAL_REMEDY"]),
    reason: z.string().trim().min(1, "A reason is required.").max(2000, "The reason is too long."),
  })
  .strict();
