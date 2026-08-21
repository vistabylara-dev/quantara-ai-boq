import { prisma } from "@/lib/db/prisma";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { findPriceMapping } from "@/lib/repositories/commerce-provider-mapping-repository";
import {
  CHECKOUT_ELIGIBLE_INTERVALS,
  classifyCommerceProductFamily,
  hasNonFinalStripeSubscription,
  NON_FINAL_SUBSCRIPTION_STATUSES,
  resolveCheckoutEnvironment,
  SUPPORTED_CHECKOUT_CURRENCIES,
} from "./commerce-checkout-service";

/**
 * STRIPE-COMMERCIAL-8 — the authenticated, safe source of truth for "should
 * a checkout button be enabled" that settings/subscription/page.tsx (and any
 * future checkout UI) must use instead of inferring availability from the
 * public catalogue alone. The public catalogue endpoint
 * (/api/commerce/products) reports what CommerceProduct/CommercePrice say
 * about themselves; it has no idea whether a live/test Stripe provider
 * mapping actually exists, is active, or is in sync — showing a real-payment
 * button based on that alone can present a "buy now" control that always
 * fails. This service folds in the provider-mapping check (and, for an
 * authenticated actor, the existing-subscription check) so the UI can show
 * a truthful unavailable/setup-pending state instead.
 *
 * Never returns a Stripe price ID — only CommercePrice.code, the same
 * internal identifier the checkout route already accepts.
 */

export type CheckoutUnavailableReason =
  | "PRICE_NOT_APPROVED"
  | "PROVIDER_MAPPING_MISSING"
  | "PROVIDER_MAPPING_NOT_SYNCED"
  | "EXISTING_SUBSCRIPTION";

export type CheckoutOptionPrice = {
  priceCode: string;
  billingInterval: "MONTH" | "YEAR";
  amountMinor: number;
  currency: string;
  available: boolean;
  unavailableReason: CheckoutUnavailableReason | null;
};

export type CheckoutOptionProduct = {
  productCode: string;
  name: string;
  shortDescription: string;
  prices: CheckoutOptionPrice[];
};

/**
 * item-A (Round 3 correction) — the settings/subscription/page.tsx Enterprise
 * cards' non-checkout data source. Deliberately NOT a
 * CheckoutOptionProduct/CheckoutOptionPrice — it carries no `available`/
 * `unavailableReason` fields, because "available for self-checkout" is not a
 * concept that applies to a sales-led product. `price` is null only if the
 * product has no APPROVED annual price yet (still pending owner/admin
 * approval) — the UI already renders "Pricing unavailable" for that case.
 */
export type EnterpriseAnnualPlan = {
  productCode: string;
  name: string;
  shortDescription: string;
  price: { priceCode: string; amountMinor: number; currency: string } | null;
};

export type CheckoutAvailability = {
  hasExistingSubscription: boolean;
  products: CheckoutOptionProduct[];
  
};

const ENTERPRISE_ANNUAL_PRODUCT_CODES = ["enterprise_core", "enterprise_scale", "enterprise_authority"] as const;

/**
 * item-A (Round 3 correction) — Enterprise Core/Scale/Authority are
 * `purchaseMode: "CONTACT_SALES"` (see prisma/seed-data/commerce-products.ts),
 * so they are deliberately absent from getCheckoutAvailability's DIRECT-only
 * query below — self-checkout availability must never represent a sales-led
 * product as purchasable. This is a SEPARATE, non-checkout catalogue read:
 * it exposes only the owner-approved annual amount for the settings page's
 * "Contact Sales" cards, never a Stripe price ID, and performs no
 * provider-mapping lookup at all — a LIVE mapping created for a manually
 * issued Stripe Payment Link is a fact about sales fulfillment, not about
 * self-checkout eligibility, and must never gate whether this reads.
 */
async function getEnterpriseAnnualPlans(): Promise<EnterpriseAnnualPlan[]> {
  const products = await prisma.commerceProduct.findMany({
    where: { code: { in: [...ENTERPRISE_ANNUAL_PRODUCT_CODES] }, isActive: true },
    include: {
      prices: {
        where: { isActive: true, reviewStatus: "APPROVED", billingInterval: "YEAR" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      },
    },
  });
  const byCode = new Map(products.map((product) => [product.code, product]));

  return ENTERPRISE_ANNUAL_PRODUCT_CODES.filter((code) => byCode.has(code)).map((code) => {
    const product = byCode.get(code)!;
    const price = product.prices[0];
    return {
      productCode: product.code,
      name: product.name,
      shortDescription: product.shortDescription,
      price: price ? { priceCode: price.code, amountMinor: price.amountMinor, currency: price.currency } : null,
    };
  });
}

/**
 * Applies the exact same eligibility criteria as
 * commerce-checkout-service.ts's loadEligibleCommercePrice — public, active,
 * DIRECT, SUBSCRIPTION product; active, APPROVED, non-indicative,
 * positive-amount, AED, MONTH/YEAR price — plus the provider-mapping and
 * existing-subscription facts that only this authenticated endpoint can
 * safely report.
 */
/**
 * CORRECTION-1 — every industryPackageId this company already holds a
 * non-final CompanyPackageSubscription for. Different libraries coexist
 * freely; only a repurchase of one of THESE exact packageIds is reported
 * unavailable below.
 *
 * item-C (Round 3 correction) — deliberately NOT filtered by
 * `source: "stripe"`, mirroring the same fix in
 * hasNonFinalPackageSubscription (commerce-checkout-service.ts): an
 * owner/admin-granted `platform_owner_activation` row means the company
 * already owns this library exactly as much as a Stripe-purchased one, and
 * the Buy button must reflect that — never offer to re-charge a library the
 * company already has via any source.
 */
async function getOwnedIndustryPackageIds(companyId: string): Promise<Set<string>> {
  const rows = await prisma.companyPackageSubscription.findMany({
    where: { companyId, status: { in: [...NON_FINAL_SUBSCRIPTION_STATUSES] } },
    select: { packageId: true },
  });
  return new Set(rows.map((row) => row.packageId));
}

export async function getCheckoutAvailability(actor: CurrentActor): Promise<CheckoutAvailability> {
  const environment = resolveCheckoutEnvironment();
  const hasExistingSubscription = await hasNonFinalStripeSubscription(actor.companyId);
  const ownedIndustryPackageIds = await getOwnedIndustryPackageIds(actor.companyId);
  const enterpriseProducts = await getEnterpriseAnnualPlans();

  const products = await prisma.commerceProduct.findMany({
    where: { isActive: true, isPublic: true, purchaseMode: "DIRECT", type: "SUBSCRIPTION" },
    include: { prices: { where: { isActive: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const result: CheckoutOptionProduct[] = [];

  for (const product of products) {
    const prices: CheckoutOptionPrice[] = [];
    // CORRECTION-1 — see classifyCommerceProductFamily in
    // commerce-checkout-service.ts. Three mutually exclusive families:
    //  - CORE_SOFTWARE: unavailable while hasExistingSubscription is true
    //    (at most one core software subscription per company).
    //  - INDUSTRY_LIBRARY: unavailable only if this EXACT package is already
    //    owned — an existing core subscription or a DIFFERENT library never
    //    marks it unavailable.
    //  - TAYQAN: never marked unavailable via EXISTING_SUBSCRIPTION here —
    //    it is governed entirely by its own checkout/entitlement logic and
    //    is unaffected by a company's core software or library state.
    const family = classifyCommerceProductFamily(product);

    for (const price of product.prices) {
      if (price.isFromPrice) continue;
      if (!CHECKOUT_ELIGIBLE_INTERVALS.has(price.billingInterval)) continue;
      if (price.amountMinor <= 0) continue;
      if (!SUPPORTED_CHECKOUT_CURRENCIES.has(price.currency)) continue;

      let available = true;
      let unavailableReason: CheckoutUnavailableReason | null = null;

      if (price.reviewStatus !== "APPROVED") {
        available = false;
        unavailableReason = "PRICE_NOT_APPROVED";
      } else {
        const mapping = await findPriceMapping("STRIPE", environment, price.id);
        if (!mapping || !mapping.providerPriceId) {
          available = false;
          unavailableReason = "PROVIDER_MAPPING_MISSING";
        } else if (!mapping.providerActive || mapping.synchronizationStatus !== "SYNCED") {
          available = false;
          unavailableReason = "PROVIDER_MAPPING_NOT_SYNCED";
        }
      }

      if (available) {
        if (family === "CORE_SOFTWARE" && hasExistingSubscription) {
          available = false;
          unavailableReason = "EXISTING_SUBSCRIPTION";
        } else if (family === "INDUSTRY_LIBRARY" && product.industryPackageId && ownedIndustryPackageIds.has(product.industryPackageId)) {
          available = false;
          unavailableReason = "EXISTING_SUBSCRIPTION";
        }
      }

      prices.push({
        priceCode: price.code,
        billingInterval: price.billingInterval as "MONTH" | "YEAR",
        amountMinor: price.amountMinor,
        currency: price.currency,
        available,
        unavailableReason,
      });
    }

    if (prices.length > 0) {
      result.push({
        productCode: product.code,
        name: product.name,
        shortDescription: product.shortDescription,
        prices,
      });
    }
  }

  return { hasExistingSubscription, products: result };
}
