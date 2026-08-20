import { PlanType, type Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "@/lib/db/prisma";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { requirePlatformCapability } from "@/lib/auth/platform-authorization";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { managedCommerceSoftwarePlanKey } from "@/lib/entitlements/commerce-plan-mapping";
import {
  getStripeCommercialClient,
  getStripeCommercialConfigurationState,
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
import { setCommercePriceReview } from "@/lib/services/commerce-price-approval-service";
import {
  buildLiveSyncPlan,
  type LiveSyncPlan,
} from "@/lib/services/stripe-live-sync-service";

const SOURCE = "ADMIN_PRODUCT_MANAGER";
const PROVIDER = "STRIPE" as const;
const ENVIRONMENT = "LIVE" as const;

// Same lock namespace/key used by the proven live catalogue synchronizer.
// Product Manager holds it for its complete target-only Stripe operation.
// A catalogue sync attempting to start waits; if one is already RUNNING,
// Product Manager fails closed instead of overlapping it.
const LIVE_SYNC_LOCK_NAMESPACE = 231_874_509;

type ManagedMetadata = {
  source: typeof SOURCE;
  publicationState: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  marketplace: { enabled: boolean };
  category: string;
  slug: string;
  seo: { metaTitle: string; metaDescription: string };
  merchant: Record<string, unknown>;
  fulfillment:
    | { adapter: "NONE" }
    | {
        adapter: "SOFTWARE_PLAN";
        softwarePlanKey: string;
        planType: "PRO" | "BUSINESS" | "ENTERPRISE";
        maxUsers: number | null;
        maxProjects: number | null;
        maxActiveBoqs: number | null;
        maxDocumentsPerMonth: number | null;
      };
  checkout?: {
    state: "DISABLED" | "SYNCING" | "READY" | "ERROR";
    lastErrorCode?: string | null;
    activatedAt?: string | null;
  };
};

type TargetClient = {
  commerceProduct: typeof prisma.commerceProduct;
};

function requestMetadataJson(metadata: PlatformRequestMetadata) {
  return {
    method: metadata.method,
    path: metadata.path,
    ...(metadata.requestId ? { requestId: metadata.requestId } : {}),
  };
}

function readMetadata(value: unknown): ManagedMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.source !== SOURCE) return null;
  return candidate as unknown as ManagedMetadata;
}

async function getTarget(
  productId: string,
  client: TargetClient = prisma,
) {
  const product = await client.commerceProduct.findUnique({
    where: { id: productId },
    include: {
      prices: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!product) throw new NotFoundError("Product Manager product not found.");

  const metadata = readMetadata(product.metadataJson);
  if (!metadata) {
    throw new ConflictError(
      "PRODUCT_MANAGER_OWNERSHIP_REQUIRED",
      "This product is not managed by Product Manager.",
    );
  }

  if (
    metadata.publicationState !== "PUBLISHED" ||
    !metadata.marketplace.enabled
  ) {
    throw new ConflictError(
      "MARKETPLACE_PUBLICATION_REQUIRED",
      "Publish the product to Marketplace before activating checkout.",
    );
  }

  if (metadata.fulfillment.adapter !== "SOFTWARE_PLAN") {
    throw new ConflictError(
      "FULFILLMENT_ADAPTER_REQUIRED",
      "Direct Stripe checkout is available only for products with a verified Software Subscription fulfilment adapter.",
    );
  }

  if (product.type !== "SUBSCRIPTION" || product.purchaseMode !== "DIRECT") {
    throw new ConflictError(
      "CHECKOUT_PRODUCT_TYPE_UNSUPPORTED",
      "Only direct monthly/yearly subscription products can be activated by Product Manager.",
    );
  }

  if (product.prices.length !== 1) {
    throw new ConflictError(
      "CHECKOUT_PRICE_CONFIGURATION_INVALID",
      "Product Manager checkout requires exactly one active price.",
    );
  }

  const [price] = product.prices;
  if (price.billingInterval !== "MONTH" && price.billingInterval !== "YEAR") {
    throw new ConflictError(
      "CHECKOUT_INTERVAL_UNSUPPORTED",
      "Product Manager checkout supports monthly or yearly subscription prices only.",
    );
  }

  return { product, price, metadata };
}

function planActionMap<T extends { action: string }>(
  rows: T[],
  key: (row: T) => string,
) {
  return new Map(rows.map((row) => [key(row), row.action]));
}

function unrelatedUnsafeActions(
  plan: LiveSyncPlan,
  productId: string,
  priceId: string,
): string[] {
  const blockers: string[] = [];

  for (const row of plan.products) {
    if (row.productId === productId) continue;
    if (row.action === "CREATE" || row.action === "ARCHIVE") {
      blockers.push(`Unrelated product ${row.code} requires ${row.action}.`);
    }
  }

  for (const row of plan.prices) {
    if (row.priceId === priceId) continue;
    if (
      row.action === "CREATE" ||
      row.action === "REACTIVATE" ||
      row.action === "ARCHIVE"
    ) {
      blockers.push(`Unrelated price ${row.code} requires ${row.action}.`);
    }
  }

  return blockers;
}

function unrelatedPlanChanges(
  baseline: LiveSyncPlan,
  staged: LiveSyncPlan,
  productId: string,
  priceId: string,
): string[] {
  const blockers: string[] = [];

  const baselineProducts = planActionMap(
    baseline.products,
    (row) => row.productId,
  );

  for (const row of staged.products) {
    if (row.productId === productId) continue;
    const before = baselineProducts.get(row.productId);
    if (before !== row.action) {
      blockers.push(
        `Unrelated product ${row.code} changed plan action from ${before ?? "missing"} to ${row.action}.`,
      );
    }
  }

  const baselinePrices = planActionMap(
    baseline.prices,
    (row) => row.priceId,
  );

  for (const row of staged.prices) {
    if (row.priceId === priceId) continue;
    const before = baselinePrices.get(row.priceId);
    if (before !== row.action) {
      blockers.push(
        `Unrelated price ${row.code} changed plan action from ${before ?? "missing"} to ${row.action}.`,
      );
    }
  }

  return blockers;
}

async function buildHypotheticalStagedPlan(
  productId: string,
  priceId: string,
): Promise<LiveSyncPlan> {
  let stagedPlan: LiveSyncPlan | null = null;
  const rollback = new Error("PRODUCT_MANAGER_PREFLIGHT_ROLLBACK");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.commerceProduct.update({
        where: { id: productId },
        data: { isActive: true, isPublic: true },
      });

      await tx.commercePrice.update({
        where: { id: priceId },
        data: { reviewStatus: "APPROVED" },
      });

      stagedPlan = await buildLiveSyncPlan(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }

  if (!stagedPlan) {
    throw new AppError(
      "CHECKOUT_PREFLIGHT_FAILED",
      "Could not build the staged Stripe synchronization plan.",
      500,
    );
  }

  return stagedPlan;
}

export type ManagedCheckoutPreflight = {
  safe: boolean;
  blockers: string[];
  productAction: string | null;
  priceAction: string | null;
  baseline: {
    productsToCreate: number;
    productsToArchive: number;
    pricesToCreate: number;
    pricesToReactivate: number;
    pricesToArchive: number;
  };
};

export async function previewManagedProductCheckoutActivation(
  actor: PlatformActor,
  productId: string,
): Promise<ManagedCheckoutPreflight> {
  requirePlatformCapability(actor, "platform:operate");

  const { product, price } = await getTarget(productId);
  const baseline = await buildLiveSyncPlan();
  const staged = await buildHypotheticalStagedPlan(product.id, price.id);

  const blockers = [
    ...unrelatedUnsafeActions(baseline, product.id, price.id),
    ...unrelatedPlanChanges(baseline, staged, product.id, price.id),
  ];

  const targetProduct = staged.products.find(
    (row) => row.productId === product.id,
  );
  const targetPrice = staged.prices.find(
    (row) => row.priceId === price.id,
  );

  if (
    !targetProduct ||
    (targetProduct.action !== "CREATE" &&
      targetProduct.action !== "UPDATE")
  ) {
    blockers.push(
      `Target product is not Stripe-ready: ${targetProduct?.action ?? "missing"}.`,
    );
  }

  if (
    !targetPrice ||
    !["CREATE", "REACTIVATE", "UNCHANGED"].includes(targetPrice.action)
  ) {
    blockers.push(
      `Target price is not Stripe-ready: ${targetPrice?.action ?? "missing"}${targetPrice?.blockedReason ? ` (${targetPrice.blockedReason})` : ""}.`,
    );
  }

  return {
    safe: blockers.length === 0,
    blockers,
    productAction: targetProduct?.action ?? null,
    priceAction: targetPrice?.action ?? null,
    baseline: {
      productsToCreate: baseline.productsToCreate,
      productsToArchive: baseline.productsToArchive,
      pricesToCreate: baseline.pricesToCreate,
      pricesToReactivate: baseline.pricesToReactivate,
      pricesToArchive: baseline.pricesToArchive,
    },
  };
}

function planType(value: "PRO" | "BUSINESS" | "ENTERPRISE"): PlanType {
  if (value === "BUSINESS") return PlanType.BUSINESS;
  if (value === "ENTERPRISE") return PlanType.ENTERPRISE;
  return PlanType.PRO;
}

async function ensureManagedSoftwarePlan(
  product: Awaited<ReturnType<typeof getTarget>>["product"],
  price: Awaited<ReturnType<typeof getTarget>>["price"],
  metadata: ManagedMetadata,
) {
  if (metadata.fulfillment.adapter !== "SOFTWARE_PLAN") {
    throw new ConflictError(
      "FULFILLMENT_ADAPTER_REQUIRED",
      "SoftwarePlan fulfilment is required.",
    );
  }

  const key = managedCommerceSoftwarePlanKey(product.code);
  const monthlyPrice =
    price.billingInterval === "MONTH" ? price.amountMinor / 100 : 0;
  const annualPrice =
    price.billingInterval === "YEAR" ? price.amountMinor / 100 : 0;

  return prisma.softwarePlan.upsert({
    where: { key },
    update: {
      name: product.name,
      description: product.description,
      planType: planType(metadata.fulfillment.planType),
      monthlyPrice,
      annualPrice,
      currency: "AED",
      maxUsers: metadata.fulfillment.maxUsers,
      maxProjects: metadata.fulfillment.maxProjects,
      maxActiveBoqs: metadata.fulfillment.maxActiveBoqs,
      maxDocumentsPerMonth:
        metadata.fulfillment.maxDocumentsPerMonth,
      featuresJson: {
        source: SOURCE,
        commerceProductCode: product.code,
      },
      isActive: true,
    },
    create: {
      key,
      name: product.name,
      description: product.description,
      planType: planType(metadata.fulfillment.planType),
      monthlyPrice,
      annualPrice,
      currency: "AED",
      maxUsers: metadata.fulfillment.maxUsers,
      maxProjects: metadata.fulfillment.maxProjects,
      maxActiveBoqs: metadata.fulfillment.maxActiveBoqs,
      maxDocumentsPerMonth:
        metadata.fulfillment.maxDocumentsPerMonth,
      featuresJson: {
        source: SOURCE,
        commerceProductCode: product.code,
      },
      isActive: true,
    },
  });
}

async function updateCheckoutMetadata(
  productId: string,
  metadata: ManagedMetadata,
  checkout: NonNullable<ManagedMetadata["checkout"]>,
  flags?: { isActive?: boolean; isPublic?: boolean },
) {
  const next: ManagedMetadata = {
    ...metadata,
    checkout,
  };

  await prisma.commerceProduct.update({
    where: { id: productId },
    data: {
      ...(flags?.isActive !== undefined
        ? { isActive: flags.isActive }
        : {}),
      ...(flags?.isPublic !== undefined
        ? { isPublic: flags.isPublic }
        : {}),
      metadataJson: next as unknown as Prisma.InputJsonValue,
    },
  });

  return next;
}

function requireLiveStripeClient(): Stripe {
  const state = getStripeCommercialConfigurationState();

  if (!state.liveMode) {
    throw new AppError(
      "STRIPE_LIVE_MODE_NOT_READY",
      "Live Stripe checkout activation is unavailable because the commercial Stripe client is not configured in live mode.",
      409,
    );
  }

  try {
    return getStripeCommercialClient();
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

function providerError(error: unknown): AppError {
  const stripeError = error as
    | { type?: string; code?: string; message?: string }
    | undefined;

  console.error(
    "[product-manager-stripe] provider error",
    stripeError?.type,
    stripeError?.code,
  );

  if (stripeError?.type === "StripeAuthenticationError") {
    return new AppError(
      "STRIPE_INVALID_KEY",
      "Stripe rejected the configured live API key.",
      409,
    );
  }

  if (stripeError?.type === "StripeRateLimitError") {
    return new AppError(
      "STRIPE_RATE_LIMITED",
      "Stripe rate-limited this request. Try again shortly.",
      502,
    );
  }

  if (stripeError?.type === "StripeConnectionError") {
    return new AppError(
      "STRIPE_ACCOUNT_UNREACHABLE",
      "Could not reach Stripe.",
      502,
    );
  }

  return new AppError(
    "STRIPE_PROVIDER_ERROR",
    "Stripe returned an error while activating this product.",
    502,
  );
}

function safeMetadata(
  kind: "product" | "price",
  code: string,
): Stripe.MetadataParam {
  return kind === "product"
    ? {
        quantara_product_code: code,
        quantara_environment: "live",
      }
    : {
        quantara_price_code: code,
        quantara_environment: "live",
      };
}

function idempotencyKey(
  objectType: "PRODUCT" | "PRICE",
  code: string,
): string {
  return `quantara:live:${objectType}:${code}:create`;
}

function expectedInterval(
  billingInterval: "MONTH" | "YEAR" | "ONE_TIME",
): "month" | "year" | null {
  if (billingInterval === "MONTH") return "month";
  if (billingInterval === "YEAR") return "year";
  return null;
}

function priceMatches(
  candidate: Stripe.Price,
  providerProductId: string,
  expected: {
    amountMinor: number;
    currency: string;
    billingInterval: "MONTH" | "YEAR" | "ONE_TIME";
    code: string;
  },
): boolean {
  const candidateProductId =
    typeof candidate.product === "string"
      ? candidate.product
      : candidate.product?.id;

  return (
    candidateProductId === providerProductId &&
    candidate.unit_amount === expected.amountMinor &&
    candidate.currency.toUpperCase() === expected.currency.toUpperCase() &&
    (candidate.recurring?.interval ?? null) ===
      expectedInterval(expected.billingInterval) &&
    candidate.metadata?.quantara_price_code === expected.code &&
    candidate.metadata?.quantara_environment === "live"
  );
}

async function findRecoverableProduct(
  stripe: Stripe,
  productCode: string,
): Promise<Stripe.Product | null> {
  const candidates: Stripe.Product[] = [];
  let startingAfter: string | undefined;

  for (;;) {
    const page = await stripe.products.list(
      {
        limit: 100,
        starting_after: startingAfter,
      },
      { timeout: 8_000, maxNetworkRetries: 1 },
    );

    for (const item of page.data) {
      if (
        item.metadata?.quantara_product_code === productCode &&
        item.metadata?.quantara_environment === "live"
      ) {
        candidates.push(item);
      }
    }

    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1].id;
  }

  if (candidates.length > 1) {
    throw new ConflictError(
      "STRIPE_PRODUCT_RECOVERY_MULTIPLE_CANDIDATES",
      "Multiple live Stripe Products carry this product code. No Stripe object was selected.",
    );
  }

  return candidates[0] ?? null;
}

async function findRecoverablePrice(
  stripe: Stripe,
  providerProductId: string,
  expected: {
    amountMinor: number;
    currency: string;
    billingInterval: "MONTH" | "YEAR" | "ONE_TIME";
    code: string;
  },
): Promise<Stripe.Price | null> {
  const candidates: Stripe.Price[] = [];
  let startingAfter: string | undefined;

  for (;;) {
    const page = await stripe.prices.list(
      {
        product: providerProductId,
        limit: 100,
        starting_after: startingAfter,
      },
      { timeout: 8_000, maxNetworkRetries: 1 },
    );

    for (const item of page.data) {
      if (
        item.metadata?.quantara_price_code === expected.code &&
        item.metadata?.quantara_environment === "live"
      ) {
        candidates.push(item);
      }
    }

    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1].id;
  }

  if (candidates.length > 1) {
    throw new ConflictError(
      "STRIPE_PRICE_RECOVERY_MULTIPLE_CANDIDATES",
      "Multiple live Stripe Prices carry this price code. No Stripe object was selected.",
    );
  }

  const candidate = candidates[0] ?? null;
  if (candidate && !priceMatches(candidate, providerProductId, expected)) {
    throw new ConflictError(
      "STRIPE_PRICE_RECOVERY_DRIFT",
      "A live Stripe Price carries this price code but its product, amount, currency, interval, or trusted metadata does not match.",
    );
  }

  return candidate;
}

async function synchronizeTargetProduct(
  stripe: Stripe,
  tx: Prisma.TransactionClient,
  target: Awaited<ReturnType<typeof getTarget>>,
) {
  let mapping = await findProductMapping(
    PROVIDER,
    ENVIRONMENT,
    target.product.id,
    tx,
  );

  let stripeProduct: Stripe.Product;

  if (mapping) {
    const retrieved = await stripe.products.retrieve(
      mapping.providerProductId,
      undefined,
      { timeout: 8_000, maxNetworkRetries: 1 },
    );

    if ("deleted" in retrieved && retrieved.deleted) {
      throw new ConflictError(
        "STRIPE_MAPPED_PRODUCT_DELETED",
        "The mapped Stripe Product has been deleted. Manual review is required.",
      );
    }

    stripeProduct = retrieved as Stripe.Product;

    if (
      stripeProduct.metadata?.quantara_product_code !==
        target.product.code ||
      stripeProduct.metadata?.quantara_environment !== "live"
    ) {
      throw new ConflictError(
        "STRIPE_PRODUCT_MAPPING_METADATA_DRIFT",
        "The mapped Stripe Product does not carry the expected trusted Quantara metadata.",
      );
    }

    stripeProduct = await stripe.products.update(
      stripeProduct.id,
      {
        name: target.product.name,
        description: target.product.description || undefined,
        active: true,
        metadata: safeMetadata("product", target.product.code),
      },
      { timeout: 8_000, maxNetworkRetries: 1 },
    );
  } else {
    const recovered = await findRecoverableProduct(
      stripe,
      target.product.code,
    );

    stripeProduct = recovered
      ? await stripe.products.update(
          recovered.id,
          {
            name: target.product.name,
            description: target.product.description || undefined,
            active: true,
            metadata: safeMetadata("product", target.product.code),
          },
          { timeout: 8_000, maxNetworkRetries: 1 },
        )
      : await stripe.products.create(
          {
            name: target.product.name,
            description: target.product.description || undefined,
            active: true,
            metadata: safeMetadata("product", target.product.code),
          },
          {
            idempotencyKey: idempotencyKey(
              "PRODUCT",
              target.product.code,
            ),
            timeout: 8_000,
            maxNetworkRetries: 1,
          },
        );

    mapping = await createMapping(
      {
        provider: PROVIDER,
        environment: ENVIRONMENT,
        commerceProductId: target.product.id,
        providerProductId: stripeProduct.id,
        providerObjectType: "PRODUCT",
      },
      tx,
    );
  }

  mapping = await updateMappingState(
    mapping.id,
    {
      providerActive: true,
      synchronizationStatus: "SYNCED",
      lastSynchronizedAt: new Date(),
      lastErrorCode: null,
    },
    tx,
  );

  return { mapping, stripeProduct };
}

async function synchronizeTargetPrice(
  stripe: Stripe,
  tx: Prisma.TransactionClient,
  target: Awaited<ReturnType<typeof getTarget>>,
  providerProductId: string,
) {
  const expected = {
    amountMinor: target.price.amountMinor,
    currency: target.price.currency,
    billingInterval: target.price.billingInterval,
    code: target.price.code,
  };

  let mapping = await findPriceMapping(
    PROVIDER,
    ENVIRONMENT,
    target.price.id,
    tx,
  );

  let stripePrice: Stripe.Price;

  if (mapping) {
    if (!mapping.providerPriceId) {
      throw new ConflictError(
        "STRIPE_PRICE_MAPPING_INCOMPLETE",
        "The mapped Stripe Price is incomplete. Manual review is required.",
      );
    }

    stripePrice = await stripe.prices.retrieve(
      mapping.providerPriceId,
      undefined,
      { timeout: 8_000, maxNetworkRetries: 1 },
    );

    if (!priceMatches(stripePrice, providerProductId, expected)) {
      throw new ConflictError(
        "STRIPE_PRICE_MAPPING_DRIFT",
        "The mapped Stripe Price does not match the internal product, amount, currency, interval, or trusted metadata.",
      );
    }

    if (!stripePrice.active) {
      stripePrice = await stripe.prices.update(
        stripePrice.id,
        { active: true },
        { timeout: 8_000, maxNetworkRetries: 1 },
      );
    }
  } else {
    const recovered = await findRecoverablePrice(
      stripe,
      providerProductId,
      expected,
    );

    if (recovered) {
      stripePrice = recovered.active
        ? recovered
        : await stripe.prices.update(
            recovered.id,
            { active: true },
            { timeout: 8_000, maxNetworkRetries: 1 },
          );
    } else {
      stripePrice = await stripe.prices.create(
        {
          product: providerProductId,
          unit_amount: target.price.amountMinor,
          currency: target.price.currency.toLowerCase(),
          metadata: safeMetadata("price", target.price.code),
          recurring: {
            interval:
              target.price.billingInterval === "MONTH"
                ? "month"
                : "year",
          },
        },
        {
          idempotencyKey: idempotencyKey(
            "PRICE",
            target.price.code,
          ),
          timeout: 8_000,
          maxNetworkRetries: 1,
        },
      );
    }

    mapping = await createMapping(
      {
        provider: PROVIDER,
        environment: ENVIRONMENT,
        commerceProductId: target.product.id,
        commercePriceId: target.price.id,
        providerProductId,
        providerPriceId: stripePrice.id,
        providerObjectType: "PRICE",
      },
      tx,
    );
  }

  mapping = await updateMappingState(
    mapping.id,
    {
      providerActive: true,
      synchronizationStatus: "SYNCED",
      lastSynchronizedAt: new Date(),
      lastErrorCode: null,
    },
    tx,
  );

  return { mapping, stripePrice };
}

async function verifyTargetOnly(
  stripe: Stripe,
  tx: Prisma.TransactionClient,
  target: Awaited<ReturnType<typeof getTarget>>,
  productMapping: Awaited<ReturnType<typeof findProductMapping>> & {},
  priceMapping: Awaited<ReturnType<typeof findPriceMapping>> & {},
) {
  if (!priceMapping.providerPriceId) {
    throw new AppError(
      "STRIPE_TARGET_MAPPING_NOT_READY",
      "The target Stripe Price mapping is incomplete.",
      502,
    );
  }

  const retrievedProduct = await stripe.products.retrieve(
    productMapping.providerProductId,
    undefined,
    { timeout: 8_000, maxNetworkRetries: 1 },
  );

  if ("deleted" in retrievedProduct && retrievedProduct.deleted) {
    throw new AppError(
      "STRIPE_TARGET_VERIFY_FAILED",
      "The target Stripe Product was deleted during verification.",
      502,
    );
  }

  const stripeProduct = retrievedProduct as Stripe.Product;
  const stripePrice = await stripe.prices.retrieve(
    priceMapping.providerPriceId,
    undefined,
    { timeout: 8_000, maxNetworkRetries: 1 },
  );

  if (
    !stripeProduct.active ||
    stripeProduct.name !== target.product.name ||
    stripeProduct.metadata?.quantara_product_code !==
      target.product.code ||
    stripeProduct.metadata?.quantara_environment !== "live"
  ) {
    throw new AppError(
      "STRIPE_TARGET_PRODUCT_VERIFY_FAILED",
      "The target Stripe Product did not verify against the internal Product Manager record.",
      502,
    );
  }

  if (
    !stripePrice.active ||
    !priceMatches(stripePrice, stripeProduct.id, {
      amountMinor: target.price.amountMinor,
      currency: target.price.currency,
      billingInterval: target.price.billingInterval,
      code: target.price.code,
    })
  ) {
    throw new AppError(
      "STRIPE_TARGET_PRICE_VERIFY_FAILED",
      "The target Stripe Price did not verify against the internal Product Manager record.",
      502,
    );
  }

  const verifiedAt = new Date();

  await updateMappingState(
    productMapping.id,
    {
      providerActive: true,
      synchronizationStatus: "SYNCED",
      lastVerifiedAt: verifiedAt,
      lastErrorCode: null,
    },
    tx,
  );

  await updateMappingState(
    priceMapping.id,
    {
      providerActive: true,
      synchronizationStatus: "SYNCED",
      lastVerifiedAt: verifiedAt,
      lastErrorCode: null,
    },
    tx,
  );
}

async function acquireLiveSyncLock(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      ${LIVE_SYNC_LOCK_NAMESPACE},
      hashtext('STRIPE:LIVE')
    )
  `;
}

async function activateTargetOnly(
  actor: PlatformActor,
  productId: string,
  requestMetadata: PlatformRequestMetadata,
) {
  const stripe = requireLiveStripeClient();

  try {
    return await prisma.$transaction(
      async (tx) => {
        await acquireLiveSyncLock(tx);

        const runningGlobalSync = await tx.commerceSyncRun.findFirst({
          where: {
            provider: PROVIDER,
            environment: ENVIRONMENT,
            operation: "SYNCHRONIZE",
            status: "RUNNING",
          },
          select: { id: true, startedAt: true },
        });

        if (runningGlobalSync) {
          throw new ConflictError(
            "STRIPE_SYNC_IN_PROGRESS",
            "A live Stripe catalogue synchronization is already in progress. Product activation was not started.",
          );
        }

        const target = await getTarget(productId, tx);

        if (target.price.reviewStatus !== "APPROVED") {
          throw new ConflictError(
            "PRICE_NOT_APPROVED",
            "The target price must be approved before Stripe activation.",
          );
        }

        const syncingMetadata: ManagedMetadata = {
          ...target.metadata,
          checkout: {
            state: "SYNCING",
            lastErrorCode: null,
            activatedAt: null,
          },
        };

        // Keep the Commerce product fail-closed during all provider work.
        // Existing checkout/public-commerce cannot see it yet.
        await tx.commerceProduct.update({
          where: { id: target.product.id },
          data: {
            isActive: false,
            isPublic: false,
            metadataJson:
              syncingMetadata as unknown as Prisma.InputJsonValue,
          },
        });

        const productResult = await synchronizeTargetProduct(
          stripe,
          tx,
          target,
        );

        const priceResult = await synchronizeTargetPrice(
          stripe,
          tx,
          target,
          productResult.stripeProduct.id,
        );

        await verifyTargetOnly(
          stripe,
          tx,
          target,
          productResult.mapping,
          priceResult.mapping,
        );

        const readyMetadata: ManagedMetadata = {
          ...syncingMetadata,
          checkout: {
            state: "READY",
            lastErrorCode: null,
            activatedAt: new Date().toISOString(),
          },
        };

        // Only now — after exact target verification — can the proven
        // checkout-availability service see this product.
        await tx.commerceProduct.update({
          where: { id: target.product.id },
          data: {
            isActive: true,
            isPublic: true,
            metadataJson:
              readyMetadata as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.platformAuditLog.create({
          data: {
            actorUserId: actor.userId,
            actorPlatformRole: actor.platformRole,
            action:
              "commerce_product_manager.checkout_ready_target_only",
            targetType: "CommerceProduct",
            targetId: target.product.id,
            requestMetadataJson:
              requestMetadataJson(requestMetadata),
            afterJson: {
              productCode: target.product.code,
              priceCode: target.price.code,
              checkoutState: "READY",
              provider: PROVIDER,
              environment: ENVIRONMENT,
              synchronizationScope: "TARGET_ONLY",
            },
          },
        });

        return {
          checkoutState: "READY" as const,
          synchronizationScope: "TARGET_ONLY" as const,
        };
      },
      {
        maxWait: 10_000,
        timeout: 90_000,
      },
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw providerError(error);
  }
}

export async function activateManagedProductCheckout(
  actor: PlatformActor,
  productId: string,
  requestMetadata: PlatformRequestMetadata,
) {
  requirePlatformCapability(actor, "platform:operate");

  const target = await getTarget(productId);
  const preflight =
    await previewManagedProductCheckoutActivation(actor, productId);

  if (!preflight.safe) {
    throw new ConflictError(
      "STRIPE_PREFLIGHT_BLOCKED",
      `Stripe activation was blocked: ${preflight.blockers.join(" ")}`,
    );
  }

  if (target.metadata.checkout?.state === "READY") {
    const existingProductMapping = await findProductMapping(
      PROVIDER,
      ENVIRONMENT,
      target.product.id,
    );
    const existingPriceMapping = await findPriceMapping(
      PROVIDER,
      ENVIRONMENT,
      target.price.id,
    );

    if (
      existingProductMapping?.providerActive &&
      existingProductMapping.synchronizationStatus === "SYNCED" &&
      existingPriceMapping?.providerActive &&
      existingPriceMapping.synchronizationStatus === "SYNCED"
    ) {
      return {
        checkoutState: "READY" as const,
        synchronizationScope: "TARGET_ONLY" as const,
        preflight,
        alreadyReady: true,
      };
    }
  }

  const previousReviewStatus = target.price.reviewStatus;
  let reviewChanged = false;

  try {
    await ensureManagedSoftwarePlan(
      target.product,
      target.price,
      target.metadata,
    );

    if (previousReviewStatus !== "APPROVED") {
      await setCommercePriceReview(
        actor,
        target.price.id,
        {
          reviewStatus: "APPROVED",
          reviewNote:
            "Approved by Product Manager guarded target-only Stripe activation.",
        },
        requestMetadata,
      );
      reviewChanged = true;
    }

    const activation = await activateTargetOnly(
      actor,
      productId,
      requestMetadata,
    );

    return {
      ...activation,
      preflight,
      alreadyReady: false,
    };
  } catch (error) {
    const errorCode =
      error instanceof AppError
        ? error.code
        : "CHECKOUT_ACTIVATION_FAILED";

    try {
      await updateCheckoutMetadata(
        target.product.id,
        target.metadata,
        {
          state: "ERROR",
          lastErrorCode: errorCode,
          activatedAt: null,
        },
        { isActive: false, isPublic: false },
      );
    } catch {
      // Provider/activation failure remains fail-closed even if recording
      // the safe error state also fails: Product Manager publication did
      // not make the product Commerce-active before this operation.
    }

    if (reviewChanged) {
      try {
        await setCommercePriceReview(
          actor,
          target.price.id,
          {
            reviewStatus: previousReviewStatus,
            reviewNote:
              "Restored after failed Product Manager target-only Stripe activation.",
          },
          requestMetadata,
        );
      } catch {
        // Product flags are forced false above, so checkout remains blocked
        // even if review-status restoration cannot be recorded.
      }
    }

    throw error;
  }
}
