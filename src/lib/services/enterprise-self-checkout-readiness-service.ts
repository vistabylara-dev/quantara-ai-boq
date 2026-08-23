import { prisma } from "@/lib/db/prisma";
import { resolveCheckoutEnvironment } from "./commerce-checkout-service";
import { resolveCommercialStripeClient } from "./commerce-checkout-service";
import type Stripe from "stripe";
import { findProductMapping, findPriceMapping } from "@/lib/repositories/commerce-provider-mapping-repository";
import { seedEnterpriseCommerceProducts } from "../../../prisma/seed-data/commerce-products";

const ENTERPRISE_PRICE_SPECS = {
  enterprise_core_one_time_aed_15000: { productCode: "enterprise_core", amountMinor: 1_500_000 },
  enterprise_scale_one_time_aed_25000: { productCode: "enterprise_scale", amountMinor: 2_500_000 },
  enterprise_authority_one_time_aed_35000: { productCode: "enterprise_authority", amountMinor: 3_500_000 },
} as const;
const ENTERPRISE_CATALOGUE_LOCK_KEY = "enterprise_one_time_catalogue";

function isEnterpriseSelfCheckoutPriceCode(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(ENTERPRISE_PRICE_SPECS, code);
}

function assertCanonicalEnterpriseProduct(product: {
  code: string;
  type: string;
  purchaseMode: string;
  isActive: boolean;
  isPublic: boolean;
  industryPackageId: string | null;
}): void {
  const isAllowlistedProduct = Object.values(ENTERPRISE_PRICE_SPECS).some(
    (spec) => spec.productCode === product.code,
  );
  if (
    !isAllowlistedProduct ||
    product.type !== "ONE_TIME" ||
    product.purchaseMode !== "DIRECT" ||
    !product.isActive ||
    !product.isPublic ||
    product.industryPackageId !== null
  ) {
    throw new Error("Financial or product parameters are not valid for Enterprise self-checkout.");
  }
}

function assertCanonicalEnterprisePrice(price: {
  code: string;
  amountMinor: number;
  currency: string;
  billingInterval: string;
  isFromPrice: boolean;
  isActive: boolean;
  product: {
    code: string;
    type: string;
    purchaseMode: string;
    isActive: boolean;
    isPublic: boolean;
    industryPackageId: string | null;
  };
}): void {
  const spec = ENTERPRISE_PRICE_SPECS[price.code as keyof typeof ENTERPRISE_PRICE_SPECS];
  assertCanonicalEnterpriseProduct(price.product);
  if (
    !spec ||
    price.product.code !== spec.productCode ||
    price.amountMinor !== spec.amountMinor ||
    price.currency !== "AED" ||
    price.billingInterval !== "ONE_TIME" ||
    price.isFromPrice ||
    !price.isActive
  ) {
    throw new Error("Financial or product parameters are not valid for Enterprise self-checkout.");
  }
}

function safeMetadata(type: "product" | "price", code: string, env: string) {
  return {
    [`quantara_${type}_code`]: code,
    quantara_environment: env,
    quantara_created_by: "enterprise_readiness_service",
  };
}

function idempotencyKey(type: "PRODUCT" | "PRICE", code: string, env: string) {
  return `quantara:${env}:enterprise_readiness:${type}:${code}:create`;
}

type ProductRecoveryDecision = { decision: "create" } | { decision: "adopt"; product: Stripe.Product } | { decision: "fail"; code: string; message: string };

async function resolveExistingProduct(stripe: Stripe, productCode: string, env: string): Promise<ProductRecoveryDecision> {
  const candidates: Stripe.Product[] = [];
  let startingAfter: string | undefined;
  try {
    for (;;) {
      const page = await stripe.products.list({ limit: 100, starting_after: startingAfter });
      for (const item of page.data) {
        if (item.metadata?.quantara_product_code === productCode && item.metadata?.quantara_environment === env) {
          candidates.push(item);
        }
      }
      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
  } catch (error) {
    return { decision: "fail", code: "STRIPE_PRODUCT_RECOVERY_LIST_FAILED", message: "Could not confirm whether a Stripe Product already exists." };
  }
  if (candidates.length === 0) return { decision: "create" };
  if (candidates.length > 1) return { decision: "fail", code: "STRIPE_PRODUCT_RECOVERY_AMBIGUOUS", message: "Multiple Stripe Products carry this metadata." };
  if (!candidates[0].active) {
    return { decision: "fail", code: "STRIPE_PRODUCT_RECOVERY_INACTIVE", message: "The matching Stripe Product is inactive." };
  }
  return { decision: "adopt", product: candidates[0] };
}

type PriceRecoveryDecision = { decision: "create" } | { decision: "adopt"; price: Stripe.Price } | { decision: "fail"; code: string; message: string };

async function resolveExistingPrice(
  stripe: Stripe,
  priceCode: string,
  providerProductId: string,
  expected: { amountMinor: number; currency: string; billingInterval: "ONE_TIME" },
  env: string
): Promise<PriceRecoveryDecision> {
  const candidates: Stripe.Price[] = [];
  let startingAfter: string | undefined;
  try {
    for (;;) {
      const page = await stripe.prices.list({ limit: 100, starting_after: startingAfter });
      for (const item of page.data) {
        if (item.metadata?.quantara_price_code === priceCode && item.metadata?.quantara_environment === env) {
          candidates.push(item);
        }
      }
      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
  } catch (error) {
    return { decision: "fail", code: "STRIPE_PRICE_RECOVERY_LIST_FAILED", message: "Failed to list Stripe Prices." };
  }
  if (candidates.length === 0) return { decision: "create" };
  if (candidates.length > 1) return { decision: "fail", code: "STRIPE_PRICE_RECOVERY_AMBIGUOUS", message: "Multiple Prices found." };
  const candidate = candidates[0];
  if (
    candidate.product !== providerProductId ||
    candidate.unit_amount !== expected.amountMinor ||
    candidate.currency !== expected.currency.toLowerCase() ||
    candidate.type !== "one_time" ||
    !candidate.active
  ) {
    return { decision: "fail", code: "STRIPE_PRICE_RECOVERY_DRIFT", message: "Price drift detected." };
  }
  return { decision: "adopt", price: candidate };
}

export async function ensureEnterpriseSelfCheckoutPriceReady(priceCode: string, overrideClient?: Stripe): Promise<void> {
  if (!isEnterpriseSelfCheckoutPriceCode(priceCode)) return;

  const environment = resolveCheckoutEnvironment();
  const stripe = resolveCommercialStripeClient(overrideClient);
  const envStr = environment.toLowerCase();

  const fastPrice = await prisma.commercePrice.findUnique({ where: { code: priceCode }, include: { product: true } });
  if (fastPrice) assertCanonicalEnterprisePrice(fastPrice);
  if (fastPrice?.reviewStatus === "APPROVED") {
    const fastMapping = await findPriceMapping("STRIPE", environment, fastPrice.id);
    if (fastMapping?.providerPriceId && fastMapping.providerActive && fastMapping.synchronizationStatus === "SYNCED") return;
  }

  await prisma.$transaction(async (tx) => {
    // The target-only seed creates all three fixed Enterprise rows. One shared
    // lock prevents simultaneous cold Core/Scale/Authority requests from
    // racing on the same unique product and price codes.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1144, hashtext(${ENTERPRISE_CATALOGUE_LOCK_KEY}))`;

    let price = await tx.commercePrice.findUnique({ where: { code: priceCode }, include: { product: true } });
    if (!price) {
      // The existing three-tier seed is an upsert. Validate every existing
      // allowlisted row first so it can never archive or rewrite stored drift
      // while initializing a different missing Enterprise tier.
      const existingPrices = await tx.commercePrice.findMany({
        where: { code: { in: Object.keys(ENTERPRISE_PRICE_SPECS) } },
        include: { product: true },
      });
      const existingProducts = await tx.commerceProduct.findMany({
        where: {
          code: { in: Object.values(ENTERPRISE_PRICE_SPECS).map((spec) => spec.productCode) },
        },
      });
      for (const existingProduct of existingProducts) {
        assertCanonicalEnterpriseProduct(existingProduct);
      }
      for (const existingPrice of existingPrices) {
        assertCanonicalEnterprisePrice(existingPrice);
      }
      await seedEnterpriseCommerceProducts(tx);
      price = await tx.commercePrice.findUnique({ where: { code: priceCode }, include: { product: true } });
    }
    if (!price) throw new Error("Enterprise self-checkout price could not be initialized.");

    assertCanonicalEnterprisePrice(price);
    if (price.reviewStatus === "REQUIRES_REVIEW") {
      price = await tx.commercePrice.update({
        where: { id: price.id },
        data: {
          reviewStatus: "APPROVED",
          reviewedAt: new Date(),
          reviewedByUserId: null,
          reviewNote: "System-approved fixed Enterprise one-time catalogue price",
        },
        include: { product: true },
      });
    }
    if (price.reviewStatus !== "APPROVED") {
      throw new Error("Enterprise self-checkout price is not in a system-approvable review state.");
    }
    const product = price.product;

    let productMapping = await findProductMapping("STRIPE", environment, product.id, tx);
    if (!productMapping || !productMapping.providerActive || productMapping.synchronizationStatus !== "SYNCED") {
      const prodRecovery = await resolveExistingProduct(stripe, product.code, envStr);
      if (prodRecovery.decision === "fail") throw new Error(prodRecovery.message);
      const stripeProduct = prodRecovery.decision === "adopt" ? prodRecovery.product : await stripe.products.create({
        name: product.name,
        description: product.description || undefined,
        active: true,
        metadata: safeMetadata("product", product.code, envStr)
      }, { idempotencyKey: idempotencyKey("PRODUCT", product.code, envStr) });
      if (!productMapping) {
        productMapping = await tx.commerceProviderMapping.create({ data: {  provider: "STRIPE", environment, commerceProductId: product.id, providerProductId: stripeProduct.id, providerObjectType: "PRODUCT"  } });
      } else {
        productMapping = await tx.commerceProviderMapping.update({ where: { id: productMapping.id }, data: {  providerProductId: stripeProduct.id, providerActive: true, synchronizationStatus: "SYNCED"  } });
      }
    }

    let priceMapping = await findPriceMapping("STRIPE", environment, price.id, tx);
    if (!priceMapping?.providerPriceId || !priceMapping.providerActive || priceMapping.synchronizationStatus !== "SYNCED") {
      const priceRecovery = await resolveExistingPrice(stripe, price.code, productMapping.providerProductId, { amountMinor: price.amountMinor, currency: price.currency, billingInterval: "ONE_TIME" }, envStr);
      if (priceRecovery.decision === "fail") throw new Error(priceRecovery.message);
      const stripePrice = priceRecovery.decision === "adopt" ? priceRecovery.price : await stripe.prices.create({
        product: productMapping.providerProductId,
        unit_amount: price.amountMinor,
        currency: price.currency.toLowerCase(),
        metadata: safeMetadata("price", price.code, envStr) as any,
      }, { idempotencyKey: idempotencyKey("PRICE", price.code, envStr) });
      if (!priceMapping) {
        priceMapping = await tx.commerceProviderMapping.create({ data: {  provider: "STRIPE", environment, commerceProductId: product.id, commercePriceId: price.id, providerProductId: productMapping.providerProductId, providerPriceId: stripePrice.id, providerObjectType: "PRICE"  } });
      } else {
        await tx.commerceProviderMapping.update({ where: { id: priceMapping.id }, data: {  providerPriceId: stripePrice.id, providerActive: true, synchronizationStatus: "SYNCED"  } });
      }
    }
  }, { timeout: 20000, maxWait: 20000 });
}
