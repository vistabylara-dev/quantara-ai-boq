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
  billingInterval: "MONTH" | "YEAR" | "ONE_TIME";
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

export type CheckoutAvailability = {
  hasExistingSubscription: boolean;
  products: CheckoutOptionProduct[];
};

const ENTERPRISE_PRODUCTS = [
  {
    productCode: "enterprise_core",
    priceCode: "enterprise_core_one_time_aed_15000",
    amountMinor: 1_500_000,
    name: "Enterprise Core",
    shortDescription: "For established contractors and consultancies needing high-volume BOQ production.",
  },
  {
    productCode: "enterprise_scale",
    priceCode: "enterprise_scale_one_time_aed_25000",
    amountMinor: 2_500_000,
    name: "Enterprise Scale",
    shortDescription: "For multi-team and multi-department companies running BOQ production at scale.",
  },
  {
    productCode: "enterprise_authority",
    priceCode: "enterprise_authority_one_time_aed_35000",
    amountMinor: 3_500_000,
    name: "Enterprise Authority",
    shortDescription: "For large groups, consultancies and institutional customers needing dedicated onboarding.",
  },
] as const;

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

  const products = await prisma.commerceProduct.findMany({
    where: { isActive: true, isPublic: true, purchaseMode: "DIRECT", type: "SUBSCRIPTION" },
    include: { prices: { where: { isActive: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const enterpriseRows = await prisma.commerceProduct.findMany({
    where: {
      code: { in: ENTERPRISE_PRODUCTS.map((item) => item.productCode) },
    },
  });
  const enterpriseByCode = new Map(enterpriseRows.map((product) => [product.code, product]));
  const enterprisePrices = await prisma.commercePrice.findMany({
    where: { code: { in: ENTERPRISE_PRODUCTS.map((item) => item.priceCode) } },
    include: { product: true },
  });
  const enterprisePriceByCode = new Map(enterprisePrices.map((price) => [price.code, price]));

  const result: CheckoutOptionProduct[] = [];

  // These three fixed business-approved offers are safe to project before
  // initialization. POST checkout performs the locked target-only bootstrap;
  // GET remains read-only and never calls Stripe or a seed helper.
  for (const spec of ENTERPRISE_PRODUCTS) {
    const product = enterpriseByCode.get(spec.productCode);
    const price = enterprisePriceByCode.get(spec.priceCode);
    const productHasDrift = Boolean(
      product &&
        (product.type !== "ONE_TIME" ||
          product.purchaseMode !== "DIRECT" ||
          !product.isActive ||
          !product.isPublic ||
          product.industryPackageId !== null),
    );
    const priceHasDrift = Boolean(
      price &&
        (price.product.code !== spec.productCode ||
          price.amountMinor !== spec.amountMinor ||
          price.currency !== "AED" ||
          price.billingInterval !== "ONE_TIME" ||
          price.isFromPrice ||
          !price.isActive),
    );
    const reviewStateCanBecomeReady =
      !price || price.reviewStatus === "REQUIRES_REVIEW" || price.reviewStatus === "APPROVED";
    let available = !productHasDrift && !priceHasDrift && reviewStateCanBecomeReady;
    let unavailableReason: CheckoutUnavailableReason | null = available ? null : "PRICE_NOT_APPROVED";
    if (hasExistingSubscription) {
      available = false;
      unavailableReason = "EXISTING_SUBSCRIPTION";
    }

    result.push({
      productCode: spec.productCode,
      name: spec.name,
      shortDescription: spec.shortDescription,
      prices: [{
        priceCode: spec.priceCode,
        billingInterval: "ONE_TIME",
        amountMinor: spec.amountMinor,
        currency: "AED",
        available,
        unavailableReason,
      }],
    });
  }

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
