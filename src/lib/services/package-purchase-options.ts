import { prisma } from "@/lib/db/prisma";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { getCheckoutAvailability, type CheckoutUnavailableReason } from "@/lib/services/commerce-checkout-availability-service";

/**
 * MARKETPLACE-FIX-2 — resolves, per IndustryDataPackage, the real
 * CommercePrice.code the marketplace UI must submit to POST
 * /api/commerce/checkout to buy that package. Deliberately reuses
 * getCheckoutAvailability (the same authenticated source of truth
 * settings/subscription/page.tsx already uses for software plans) rather
 * than re-deriving the eligibility rules here: that service's own docstring
 * requires it stay in lockstep with commerce-checkout-service.ts's
 * loadEligibleCommercePrice, including the existing-Stripe-subscription
 * check — createCommerceCheckoutSession blocks ANY new checkout (regardless
 * of product) while a company has a non-final Stripe software subscription,
 * so a package price must be reported unavailable in that case too, or the
 * UI would offer a "Buy" button that always 409s.
 *
 * getCheckoutAvailability's existing-subscription check is family-aware (see
 * classifyCommerceProductFamily in commerce-checkout-service.ts and the
 * matching scoping in createCommerceCheckoutSession): a company already on
 * Starter/Professional/Business/Enterprise, or already holding a DIFFERENT
 * library, can still buy this one — an existing core software subscription
 * or another library never marks a library price unavailable here. Only
 * already owning this EXACT industryPackageId does.
 *
 * A package with no backing CommerceProduct returns no entry in the map at
 * all — callers must treat a missing entry as "not yet available for
 * purchase", never as a broken/omitted purchase attempt.
 */

export type PackagePurchasePrice = {
  priceCode: string;
  billingInterval: "MONTH" | "YEAR";
  amountMinor: number;
  currency: string;
  available: boolean;
  unavailableReason: CheckoutUnavailableReason | null;
};

export type PackagePurchaseOptions = {
  available: boolean;
  prices: PackagePurchasePrice[];
};

export async function resolvePackagePurchaseOptions(
  actor: CurrentActor,
  packageIds: string[],
): Promise<Map<string, PackagePurchaseOptions>> {
  const result = new Map<string, PackagePurchaseOptions>();
  if (packageIds.length === 0) return result;

  const products = await prisma.commerceProduct.findMany({
    where: { industryPackageId: { in: packageIds } },
    select: { code: true, industryPackageId: true },
  });
  if (products.length === 0) return result;

  const availability = await getCheckoutAvailability(actor);
  const optionsByProductCode = new Map(availability.products.map((product) => [product.productCode, product]));

  for (const product of products) {
    if (!product.industryPackageId) continue;
    const option = optionsByProductCode.get(product.code);
    if (!option) continue;

    const prices: PackagePurchasePrice[] = option.prices.map((price) => ({
      priceCode: price.priceCode,
      billingInterval: price.billingInterval as "MONTH" | "YEAR",
      amountMinor: price.amountMinor,
      currency: price.currency,
      available: price.available,
      unavailableReason: price.unavailableReason,
    }));

    result.set(product.industryPackageId, {
      available: prices.some((price) => price.available),
      prices,
    });
  }

  return result;
}
