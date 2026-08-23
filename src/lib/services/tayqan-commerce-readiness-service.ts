import { PlatformRole, Prisma, type CommerceProviderMapping } from "@prisma/client";
import type Stripe from "stripe";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { prisma } from "@/lib/db/prisma";
import { AppError, PermissionDeniedError } from "@/lib/errors/app-error";
import {
  getConfiguredStripeMode,
  getStripeCommercialClient,
  StripeInvalidKeyError,
  StripeNotConfiguredError,
} from "@/lib/payments/stripe-client";
import {
  createMapping,
  findPriceMapping,
  findProductMapping,
  updateMappingState,
} from "@/lib/repositories/commerce-provider-mapping-repository";
import type { PlatformRequestMetadata } from "@/lib/repositories/platform-admin-repository";
import { TAYQAN_HIRE_PLANS } from "@/lib/tayqan/tayqan-commerce";

const PROVIDER = "STRIPE" as const;
const ENVIRONMENT = "LIVE" as const;
const STRIPE_ENVIRONMENT_METADATA = "live" as const;
const LIVE_SYNC_LOCK_NAMESPACE = 231_874_509;
const TAYQAN_READINESS_LOCK_NAMESPACE = 823_202_603;
const TAYQAN_READINESS_LOCK_KEY = "tayqan_fixed_commerce_readiness";
const SYSTEM_APPROVAL_NOTE = "System-approved fixed TAYQAN hire catalogue price";

const FIXED_TAYQAN_CODES = [
  { productCode: "tayqan_day", priceCode: "tayqan_day_299" },
  { productCode: "tayqan_week", priceCode: "tayqan_week_999" },
  { productCode: "tayqan_monthly", priceCode: "tayqan_monthly_2499" },
] as const;

type TayqanPlan = (typeof TAYQAN_HIRE_PLANS)[number];

type CatalogueProduct = {
  id: string;
  code: string;
  type: string;
  name: string;
  description: string;
  purchaseMode: string;
  isActive: boolean;
  isPublic: boolean;
  industryPackageId: string | null;
};

type CataloguePrice = {
  id: string;
  productId: string;
  code: string;
  amountMinor: number;
  currency: string;
  billingInterval: string;
  isFromPrice: boolean;
  isActive: boolean;
  reviewStatus: string;
};

type CanonicalCatalogueEntry = {
  plan: TayqanPlan;
  product: CatalogueProduct;
  price: CataloguePrice;
};

function readinessPlans(): TayqanPlan[] {
  return FIXED_TAYQAN_CODES.map((fixed) => {
    const matches = TAYQAN_HIRE_PLANS.filter((plan) => (
      plan.productCode === fixed.productCode && plan.priceCode === fixed.priceCode
    ));
    if (matches.length !== 1) {
      throw new AppError(
        "TAYQAN_READINESS_CONFIGURATION_INVALID",
        "The fixed TAYQAN readiness allowlist does not match its canonical plan source.",
        500,
      );
    }
    return matches[0];
  });
}

type ProductResolution =
  | { action: "CREATE"; mapping: null; stripeProduct: null }
  | { action: "ADOPTED"; mapping: null; stripeProduct: Stripe.Product }
  | { action: "REUSED"; mapping: CommerceProviderMapping; stripeProduct: Stripe.Product };

type PriceResolution =
  | { action: "CREATE"; mapping: null; stripePrice: null }
  | { action: "ADOPTED"; mapping: null; stripePrice: Stripe.Price }
  | { action: "REUSED"; mapping: CommerceProviderMapping; stripePrice: Stripe.Price };

export type TayqanCommerceReadinessItem = {
  productCode: TayqanPlan["productCode"];
  priceCode: TayqanPlan["priceCode"];
  alreadyReady: boolean;
  priceApproval: "APPROVED" | "ALREADY_APPROVED";
  stripeProduct: "CREATED" | "ADOPTED" | "REUSED";
  stripePrice: "CREATED" | "ADOPTED" | "REUSED";
  productMapping: "CREATED" | "REUSED";
  priceMapping: "CREATED" | "REUSED";
};

export type TayqanCommerceReadinessReport = {
  ready: true;
  environment: "LIVE";
  items: TayqanCommerceReadinessItem[];
};

function requireOwner(actor: PlatformActor): void {
  if (actor.platformRole !== PlatformRole.PLATFORM_OWNER) {
    throw new PermissionDeniedError("Only the platform owner may initialize the TAYQAN live catalogue.");
  }
}

function requireLiveStripeClient(overrideClient?: Stripe): Stripe {
  if (getConfiguredStripeMode() !== "live") {
    throw new AppError(
      "STRIPE_LIVE_MODE_REQUIRED",
      "TAYQAN commerce readiness requires Stripe live mode.",
      409,
    );
  }

  try {
    return getStripeCommercialClient(overrideClient);
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      throw new AppError("STRIPE_NOT_CONFIGURED", error.message, 409);
    }
    if (error instanceof StripeInvalidKeyError) {
      throw new AppError("STRIPE_INVALID_KEY", error.message, 409);
    }
    throw error;
  }
}

function stripeProviderError(error: unknown, operation: string): AppError {
  const providerError = error as { type?: unknown; code?: unknown } | undefined;
  const type = typeof providerError?.type === "string" ? providerError.type : "unknown";
  const code = typeof providerError?.code === "string" ? providerError.code : "unknown";
  console.error("[tayqan-commerce-readiness] Stripe operation failed", { operation, type, code });

  if (type === "StripeAuthenticationError") {
    return new AppError("STRIPE_INVALID_KEY", "Stripe rejected the configured live API key.", 409);
  }
  if (type === "StripeRateLimitError") {
    return new AppError("STRIPE_RATE_LIMITED", "Stripe rate-limited the readiness request. Try again shortly.", 503);
  }
  if (type === "StripeConnectionError") {
    return new AppError("STRIPE_ACCOUNT_UNREACHABLE", "Could not reach Stripe.", 503);
  }
  return new AppError("STRIPE_PROVIDER_ERROR", "Stripe could not complete the readiness request.", 502);
}

async function callStripe<T>(operation: string, callback: () => Promise<T>): Promise<T> {
  try {
    return await callback();
  } catch (error) {
    throw stripeProviderError(error, operation);
  }
}

function catalogueDrift(message: string): never {
  throw new AppError("TAYQAN_CATALOGUE_DRIFT", message, 409);
}

function expectedProductType(plan: TayqanPlan): "ONE_TIME" | "SUBSCRIPTION" {
  return plan.billingInterval === "ONE_TIME" ? "ONE_TIME" : "SUBSCRIPTION";
}

function validateProduct(plan: TayqanPlan, product: CatalogueProduct): void {
  if (
    product.code !== plan.productCode
    || product.type !== expectedProductType(plan)
    || product.purchaseMode !== "DIRECT"
    || !product.isActive
    || !product.isPublic
    || product.industryPackageId !== null
  ) {
    catalogueDrift(`Stored product definition is not canonical for ${plan.productCode}.`);
  }
}

function validatePrice(plan: TayqanPlan, product: CatalogueProduct, price: CataloguePrice): void {
  if (
    price.code !== plan.priceCode
    || price.productId !== product.id
    || price.amountMinor !== plan.amountMinor
    || price.currency !== plan.currency
    || price.billingInterval !== plan.billingInterval
    || price.isFromPrice
    || !price.isActive
  ) {
    catalogueDrift(`Stored price definition is not canonical for ${plan.priceCode}.`);
  }

  if (price.reviewStatus !== "REQUIRES_REVIEW" && price.reviewStatus !== "APPROVED") {
    throw new AppError(
      "TAYQAN_PRICE_REVIEW_STATE_INVALID",
      `The fixed TAYQAN price ${plan.priceCode} is not in a system-approvable review state.`,
      409,
    );
  }
}

function validateCatalogueRows(
  plans: TayqanPlan[],
  products: CatalogueProduct[],
  prices: CataloguePrice[],
): CanonicalCatalogueEntry[] {
  const productByCode = new Map(products.map((product) => [product.code, product]));
  const priceByCode = new Map(prices.map((price) => [price.code, price]));

  if (products.length !== plans.length || prices.length !== plans.length) {
    throw new AppError(
      "TAYQAN_CATALOGUE_INCOMPLETE",
      "The fixed TAYQAN commerce catalogue is incomplete. Restore the canonical rows before readiness.",
      409,
    );
  }

  return plans.map((plan) => {
    const product = productByCode.get(plan.productCode);
    const price = priceByCode.get(plan.priceCode);
    if (!product || !price) {
      throw new AppError(
        "TAYQAN_CATALOGUE_INCOMPLETE",
        "The fixed TAYQAN commerce catalogue is incomplete. Restore the canonical rows before readiness.",
        409,
      );
    }

    validateProduct(plan, product);
    validatePrice(plan, product, price);
    return { plan, product, price };
  });
}

function productMetadata(code: string): Stripe.MetadataParam {
  return {
    quantara_product_code: code,
    quantara_environment: STRIPE_ENVIRONMENT_METADATA,
    quantara_created_by: "tayqan_readiness_service",
  };
}

function priceMetadata(code: string): Stripe.MetadataParam {
  return {
    quantara_price_code: code,
    quantara_environment: STRIPE_ENVIRONMENT_METADATA,
    quantara_created_by: "tayqan_readiness_service",
  };
}

function idempotencyKey(type: "PRODUCT" | "PRICE", code: string): string {
  return `quantara:live:tayqan_readiness:${type}:${code}:create`;
}

async function listAllStripeProducts(stripe: Stripe): Promise<Stripe.Product[]> {
  const products: Stripe.Product[] = [];
  let startingAfter: string | undefined;

  for (;;) {
    const page = await callStripe("products.list", () => stripe.products.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    }));
    products.push(...page.data);
    if (!page.has_more) return products;
    if (page.data.length === 0) {
      throw new AppError("STRIPE_PRODUCT_LIST_INVALID", "Stripe returned an invalid Product page.", 502);
    }
    startingAfter = page.data[page.data.length - 1].id;
  }
}

async function listAllStripePrices(stripe: Stripe): Promise<Stripe.Price[]> {
  const prices: Stripe.Price[] = [];
  let startingAfter: string | undefined;

  for (;;) {
    const page = await callStripe("prices.list", () => stripe.prices.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    }));
    prices.push(...page.data);
    if (!page.has_more) return prices;
    if (page.data.length === 0) {
      throw new AppError("STRIPE_PRICE_LIST_INVALID", "Stripe returned an invalid Price page.", 502);
    }
    startingAfter = page.data[page.data.length - 1].id;
  }
}

function matchingProducts(products: Stripe.Product[], productCode: string): Stripe.Product[] {
  return products.filter((product) => (
    product.metadata?.quantara_product_code === productCode
    && product.metadata?.quantara_environment === STRIPE_ENVIRONMENT_METADATA
  ));
}

function matchingPrices(prices: Stripe.Price[], priceCode: string): Stripe.Price[] {
  return prices.filter((price) => (
    price.metadata?.quantara_price_code === priceCode
    && price.metadata?.quantara_environment === STRIPE_ENVIRONMENT_METADATA
  ));
}

function assertStripeProduct(product: Stripe.Product, catalogueProduct: CatalogueProduct): void {
  const expectedDescription = catalogueProduct.description || null;
  if (
    !product.livemode
    || !product.active
    || product.metadata?.quantara_product_code !== catalogueProduct.code
    || product.metadata?.quantara_environment !== STRIPE_ENVIRONMENT_METADATA
    || product.name !== catalogueProduct.name
    || (product.description ?? null) !== expectedDescription
  ) {
    throw new AppError(
      "TAYQAN_STRIPE_PRODUCT_DRIFT",
      `The live Stripe Product for ${catalogueProduct.code} is inactive or drifted.`,
      409,
    );
  }
}

function providerProductId(price: Stripe.Price): string {
  return typeof price.product === "string" ? price.product : price.product.id;
}

function assertStripePrice(price: Stripe.Price, entry: CanonicalCatalogueEntry, expectedProductId: string): void {
  const isOneTime = entry.plan.billingInterval === "ONE_TIME";
  const intervalMatches = isOneTime
    ? price.type === "one_time" && price.recurring == null
    : price.type === "recurring"
      && price.recurring?.interval === "month"
      && price.recurring.interval_count === 1;

  if (
    !price.livemode
    || !price.active
    || price.metadata?.quantara_price_code !== entry.price.code
    || price.metadata?.quantara_environment !== STRIPE_ENVIRONMENT_METADATA
    || providerProductId(price) !== expectedProductId
    || price.unit_amount !== entry.price.amountMinor
    || price.currency.toLowerCase() !== entry.price.currency.toLowerCase()
    || !intervalMatches
  ) {
    throw new AppError(
      "TAYQAN_STRIPE_PRICE_DRIFT",
      `The live Stripe Price for ${entry.price.code} is inactive or drifted.`,
      409,
    );
  }
}

function assertProductMappingShape(mapping: CommerceProviderMapping, entry: CanonicalCatalogueEntry): void {
  if (
    mapping.provider !== PROVIDER
    || mapping.environment !== ENVIRONMENT
    || mapping.providerObjectType !== "PRODUCT"
    || mapping.commerceProductId !== entry.product.id
    || mapping.commercePriceId !== null
    || mapping.providerPriceId !== null
    || !mapping.providerProductId
  ) {
    throw new AppError(
      "TAYQAN_PROVIDER_MAPPING_DRIFT",
      `The live provider Product mapping for ${entry.product.code} is inconsistent.`,
      409,
    );
  }
}

function assertPriceMappingShape(
  mapping: CommerceProviderMapping,
  entry: CanonicalCatalogueEntry,
  expectedProductId: string,
): void {
  if (
    mapping.provider !== PROVIDER
    || mapping.environment !== ENVIRONMENT
    || mapping.providerObjectType !== "PRICE"
    || mapping.commerceProductId !== entry.product.id
    || mapping.commercePriceId !== entry.price.id
    || mapping.providerProductId !== expectedProductId
    || !mapping.providerPriceId
  ) {
    throw new AppError(
      "TAYQAN_PROVIDER_MAPPING_DRIFT",
      `The live provider Price mapping for ${entry.price.code} is inconsistent.`,
      409,
    );
  }
}

function mappingIsReady(mapping: CommerceProviderMapping): boolean {
  return mapping.providerActive
    && mapping.synchronizationStatus === "SYNCED"
    && mapping.lastErrorCode === null;
}

async function resolveProduct(
  stripe: Stripe,
  entry: CanonicalCatalogueEntry,
  candidates: Stripe.Product[],
  mapping: CommerceProviderMapping | null,
): Promise<ProductResolution> {
  if (candidates.length > 1) {
    throw new AppError(
      "TAYQAN_STRIPE_PRODUCT_AMBIGUOUS",
      `Multiple live Stripe Products carry metadata for ${entry.product.code}.`,
      409,
    );
  }

  if (!mapping) {
    if (candidates.length === 0) return { action: "CREATE", mapping: null, stripeProduct: null };
    assertStripeProduct(candidates[0], entry.product);
    return { action: "ADOPTED", mapping: null, stripeProduct: candidates[0] };
  }

  assertProductMappingShape(mapping, entry);
  if (candidates.length !== 1 || candidates[0].id !== mapping.providerProductId) {
    throw new AppError(
      "TAYQAN_PROVIDER_MAPPING_DRIFT",
      `The mapped live Stripe Product for ${entry.product.code} does not match its canonical metadata.`,
      409,
    );
  }

  const retrieved = await callStripe("products.retrieve", () => stripe.products.retrieve(mapping.providerProductId));
  if ("deleted" in retrieved && retrieved.deleted) {
    throw new AppError(
      "TAYQAN_STRIPE_PRODUCT_DRIFT",
      `The mapped live Stripe Product for ${entry.product.code} was deleted.`,
      409,
    );
  }
  const stripeProduct = retrieved as Stripe.Product;
  assertStripeProduct(stripeProduct, entry.product);
  return { action: "REUSED", mapping, stripeProduct };
}

async function resolvePrice(
  stripe: Stripe,
  entry: CanonicalCatalogueEntry,
  candidates: Stripe.Price[],
  mapping: CommerceProviderMapping | null,
  productResolution: ProductResolution,
): Promise<PriceResolution> {
  if (candidates.length > 1) {
    throw new AppError(
      "TAYQAN_STRIPE_PRICE_AMBIGUOUS",
      `Multiple live Stripe Prices carry metadata for ${entry.price.code}.`,
      409,
    );
  }

  const expectedProductId = productResolution.stripeProduct?.id ?? null;
  if (mapping && !expectedProductId) {
    throw new AppError(
      "TAYQAN_PROVIDER_MAPPING_DRIFT",
      `The live Price mapping for ${entry.price.code} has no canonical Product mapping.`,
      409,
    );
  }

  if (!mapping) {
    if (candidates.length === 0) return { action: "CREATE", mapping: null, stripePrice: null };
    if (!expectedProductId) {
      throw new AppError(
        "TAYQAN_STRIPE_PRICE_DRIFT",
        `The live Stripe Price for ${entry.price.code} belongs to a non-canonical Product.`,
        409,
      );
    }
    assertStripePrice(candidates[0], entry, expectedProductId);
    return { action: "ADOPTED", mapping: null, stripePrice: candidates[0] };
  }

  assertPriceMappingShape(mapping, entry, expectedProductId as string);
  if (candidates.length !== 1 || candidates[0].id !== mapping.providerPriceId) {
    throw new AppError(
      "TAYQAN_PROVIDER_MAPPING_DRIFT",
      `The mapped live Stripe Price for ${entry.price.code} does not match its canonical metadata.`,
      409,
    );
  }

  const stripePrice = await callStripe("prices.retrieve", () => stripe.prices.retrieve(mapping.providerPriceId as string));
  assertStripePrice(stripePrice, entry, expectedProductId as string);
  return { action: "REUSED", mapping, stripePrice };
}

function safeRequestMetadata(metadata: PlatformRequestMetadata): Prisma.InputJsonObject {
  return {
    method: metadata.method.slice(0, 12),
    path: metadata.path.slice(0, 500),
    ...(metadata.requestId ? { requestId: metadata.requestId.slice(0, 128) } : {}),
  };
}

/**
 * One-time, owner-only readiness for the three fixed TAYQAN Marketplace
 * offers. This does not participate in customer checkout: customers continue
 * to use POST /api/tayqan/checkout after selecting a project.
 */
export async function ensureTayqanCommerceReady(
  actor: PlatformActor,
  requestMetadata: PlatformRequestMetadata,
  overrideClient?: Stripe,
): Promise<TayqanCommerceReadinessReport> {
  requireOwner(actor);
  const stripe = requireLiveStripeClient(overrideClient);
  const plans = readinessPlans();
  const productCodes = plans.map((plan) => plan.productCode);
  const priceCodes = plans.map((plan) => plan.priceCode);

  return prisma.$transaction(async (tx) => {
    // Serialize against the existing global LIVE Stripe synchronization claim
    // before taking the narrower TAYQAN lock. A currently-running global sync
    // has already released this advisory lock, so its durable RUNNING lease is
    // checked while the lock prevents another one from starting.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LIVE_SYNC_LOCK_NAMESPACE}, hashtext('STRIPE:LIVE'))`;
    const activeLiveSync = await tx.commerceSyncRun.findFirst({
      where: {
        provider: PROVIDER,
        environment: ENVIRONMENT,
        operation: "SYNCHRONIZE",
        status: "RUNNING",
      },
      select: { id: true },
    });
    if (activeLiveSync) {
      throw new AppError(
        "STRIPE_LIVE_SYNC_IN_PROGRESS",
        "A live Stripe catalogue synchronization is already in progress.",
        409,
      );
    }
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${TAYQAN_READINESS_LOCK_NAMESPACE}, hashtext(${TAYQAN_READINESS_LOCK_KEY}))`;

    // The advisory locks coordinate readiness/sync operations. Row locks also
    // prevent an unrelated catalogue admin write from changing any financial
    // or review field after validation but before the system approval.
    await tx.$queryRaw(Prisma.sql`
      SELECT "id"
      FROM "CommerceProduct"
      WHERE "code" IN (${Prisma.join(productCodes)})
      ORDER BY "code"
      FOR UPDATE
    `);
    await tx.$queryRaw(Prisma.sql`
      SELECT "id"
      FROM "CommercePrice"
      WHERE "code" IN (${Prisma.join(priceCodes)})
      ORDER BY "code"
      FOR UPDATE
    `);

    const [products, prices] = await Promise.all([
      tx.commerceProduct.findMany({ where: { code: { in: productCodes } } }),
      tx.commercePrice.findMany({ where: { code: { in: priceCodes } } }),
    ]);
    const catalogue = validateCatalogueRows(plans, products, prices);

    // A full paginated inventory is authoritative for orphan recovery and
    // duplicate detection. Never use Stripe Search here: its index can lag.
    const [stripeProducts, stripePrices] = await Promise.all([
      listAllStripeProducts(stripe),
      listAllStripePrices(stripe),
    ]);

    const planned = [] as Array<{
      entry: CanonicalCatalogueEntry;
      productResolution: ProductResolution;
      priceResolution: PriceResolution;
    }>;

    // Resolve and validate all six existing Stripe/mapping states before any
    // DB approval or external Stripe creation is attempted.
    for (const entry of catalogue) {
      const productMapping = await findProductMapping(PROVIDER, ENVIRONMENT, entry.product.id, tx);
      const priceMapping = await findPriceMapping(PROVIDER, ENVIRONMENT, entry.price.id, tx);
      const productResolution = await resolveProduct(
        stripe,
        entry,
        matchingProducts(stripeProducts, entry.product.code),
        productMapping,
      );
      const priceResolution = await resolvePrice(
        stripe,
        entry,
        matchingPrices(stripePrices, entry.price.code),
        priceMapping,
        productResolution,
      );
      planned.push({ entry, productResolution, priceResolution });
    }

    const now = new Date();
    const reports: TayqanCommerceReadinessItem[] = [];

    for (const item of planned) {
      const { entry } = item;
      const priceWasApproved = entry.price.reviewStatus === "APPROVED";
      if (!priceWasApproved) {
        await tx.commercePrice.update({
          where: { id: entry.price.id },
          data: {
            reviewStatus: "APPROVED",
            reviewedAt: now,
            reviewedByUserId: null,
            reviewNote: SYSTEM_APPROVAL_NOTE,
          },
        });
      }

      let stripeProduct = item.productResolution.stripeProduct;
      if (item.productResolution.action === "CREATE") {
        stripeProduct = await callStripe("products.create", () => stripe.products.create(
          {
            name: entry.product.name,
            description: entry.product.description || undefined,
            active: true,
            metadata: productMetadata(entry.product.code),
          },
          { idempotencyKey: idempotencyKey("PRODUCT", entry.product.code) },
        ));
        assertStripeProduct(stripeProduct, entry.product);
      }
      if (!stripeProduct) {
        throw new AppError("TAYQAN_READINESS_INTERNAL_ERROR", "TAYQAN Product resolution failed.", 500);
      }

      let productMapping = item.productResolution.mapping;
      if (!productMapping) {
        productMapping = await createMapping({
          provider: PROVIDER,
          environment: ENVIRONMENT,
          commerceProductId: entry.product.id,
          providerProductId: stripeProduct.id,
          providerObjectType: "PRODUCT",
        }, tx);
        assertProductMappingShape(productMapping, entry);
        if (productMapping.providerProductId !== stripeProduct.id) {
          throw new AppError(
            "TAYQAN_PROVIDER_MAPPING_CONFLICT",
            `The live Product mapping for ${entry.product.code} conflicts with another readiness operation.`,
            409,
          );
        }
        productMapping = await updateMappingState(productMapping.id, {
          providerActive: true,
          synchronizationStatus: "SYNCED",
          lastSynchronizedAt: now,
          lastVerifiedAt: now,
          lastErrorCode: null,
        }, tx);
      } else if (!mappingIsReady(productMapping)) {
        productMapping = await updateMappingState(productMapping.id, {
          providerActive: true,
          synchronizationStatus: "SYNCED",
          lastSynchronizedAt: now,
          lastVerifiedAt: now,
          lastErrorCode: null,
        }, tx);
      } else {
        productMapping = await updateMappingState(productMapping.id, {
          lastVerifiedAt: now,
        }, tx);
      }

      let stripePrice = item.priceResolution.stripePrice;
      if (item.priceResolution.action === "CREATE") {
        const createParams: Stripe.PriceCreateParams = {
          product: stripeProduct.id,
          unit_amount: entry.price.amountMinor,
          currency: entry.price.currency.toLowerCase(),
          metadata: priceMetadata(entry.price.code),
          ...(entry.plan.billingInterval === "MONTH"
            ? { recurring: { interval: "month" as const } }
            : {}),
        };
        stripePrice = await callStripe("prices.create", () => stripe.prices.create(
          createParams,
          { idempotencyKey: idempotencyKey("PRICE", entry.price.code) },
        ));
        assertStripePrice(stripePrice, entry, stripeProduct.id);
      }
      if (!stripePrice) {
        throw new AppError("TAYQAN_READINESS_INTERNAL_ERROR", "TAYQAN Price resolution failed.", 500);
      }

      let priceMapping = item.priceResolution.mapping;
      if (!priceMapping) {
        priceMapping = await createMapping({
          provider: PROVIDER,
          environment: ENVIRONMENT,
          commerceProductId: entry.product.id,
          commercePriceId: entry.price.id,
          providerProductId: stripeProduct.id,
          providerPriceId: stripePrice.id,
          providerObjectType: "PRICE",
        }, tx);
        assertPriceMappingShape(priceMapping, entry, stripeProduct.id);
        if (priceMapping.providerPriceId !== stripePrice.id) {
          throw new AppError(
            "TAYQAN_PROVIDER_MAPPING_CONFLICT",
            `The live Price mapping for ${entry.price.code} conflicts with another readiness operation.`,
            409,
          );
        }
        priceMapping = await updateMappingState(priceMapping.id, {
          providerActive: true,
          synchronizationStatus: "SYNCED",
          lastSynchronizedAt: now,
          lastVerifiedAt: now,
          lastErrorCode: null,
        }, tx);
      } else if (!mappingIsReady(priceMapping)) {
        priceMapping = await updateMappingState(priceMapping.id, {
          providerActive: true,
          synchronizationStatus: "SYNCED",
          lastSynchronizedAt: now,
          lastVerifiedAt: now,
          lastErrorCode: null,
        }, tx);
      } else {
        priceMapping = await updateMappingState(priceMapping.id, {
          lastVerifiedAt: now,
        }, tx);
      }

      reports.push({
        productCode: entry.plan.productCode,
        priceCode: entry.plan.priceCode,
        alreadyReady: priceWasApproved
          && item.productResolution.action === "REUSED"
          && item.priceResolution.action === "REUSED"
          && mappingIsReady(item.productResolution.mapping)
          && mappingIsReady(item.priceResolution.mapping),
        priceApproval: priceWasApproved ? "ALREADY_APPROVED" : "APPROVED",
        stripeProduct: item.productResolution.action === "CREATE" ? "CREATED" : item.productResolution.action,
        stripePrice: item.priceResolution.action === "CREATE" ? "CREATED" : item.priceResolution.action,
        productMapping: item.productResolution.mapping ? "REUSED" : "CREATED",
        priceMapping: item.priceResolution.mapping ? "REUSED" : "CREATED",
      });
    }

    const report: TayqanCommerceReadinessReport = {
      ready: true,
      environment: ENVIRONMENT,
      items: reports,
    };

    await tx.platformAuditLog.create({
      data: {
        actorUserId: actor.userId,
        actorPlatformRole: actor.platformRole,
        action: "commerce_tayqan.ready",
        targetType: "TayqanCommerceCatalogue",
        requestMetadataJson: safeRequestMetadata(requestMetadata),
        afterJson: report as unknown as Prisma.InputJsonObject,
      },
    });

    return report;
  }, { maxWait: 120_000, timeout: 120_000 });
}
