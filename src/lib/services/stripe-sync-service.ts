import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { PlatformRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { requirePlatformCapability } from "@/lib/auth/platform-authorization";
import { AppError, ConflictError, PermissionDeniedError } from "@/lib/errors/app-error";
import {
  getStripeClient,
  getStripeConfigurationState,
  StripeInvalidKeyError,
  StripeNotConfiguredError,
} from "@/lib/payments/stripe-client";
import {
  listAllCommerceProductsWithPrices,
  type CommerceProductRecord,
} from "@/lib/repositories/commerce-product-repository";
import {
  createMapping,
  findPriceMapping,
  findProductMapping,
  listMappingsForEnvironment,
  updateMappingState,
} from "@/lib/repositories/commerce-provider-mapping-repository";
import {
  completeSyncRun,
  createSyncRun,
  listSyncRuns,
  toSyncRunDTO,
} from "@/lib/repositories/commerce-sync-run-repository";
import type { PlatformRequestMetadata } from "@/lib/repositories/platform-admin-repository";

const PROVIDER = "STRIPE" as const;
const ENVIRONMENT = "TEST" as const;
const SUPPORTED_CURRENCIES = new Set(["AED"]);
const SUPPORTED_INTERVALS = new Set(["ONE_TIME", "MONTH", "YEAR"]);

function requestMetadataJson(metadata: PlatformRequestMetadata) {
  return {
    method: metadata.method,
    path: metadata.path,
    ...(metadata.requestId ? { requestId: metadata.requestId } : {}),
  };
}

function mapStripeError(error: unknown): { code: string; message: string } {
  const stripeError = error as { type?: string; code?: string; message?: string } | undefined;
  console.error("[stripe-sync] provider error", stripeError?.type, stripeError?.code, stripeError?.message);
  if (stripeError?.type === "StripeAuthenticationError") return { code: "STRIPE_INVALID_KEY", message: "Stripe rejected the configured API key." };
  if (stripeError?.type === "StripeRateLimitError") return { code: "STRIPE_RATE_LIMITED", message: "Stripe rate-limited this request. Try again shortly." };
  if (stripeError?.type === "StripeConnectionError") return { code: "STRIPE_ACCOUNT_UNREACHABLE", message: "Could not reach Stripe." };
  return { code: "STRIPE_PROVIDER_ERROR", message: "Stripe returned an error processing this request." };
}

/** Throws a safe AppError if Stripe isn't configured in test mode. Never includes the key. */
function requireTestModeStripeClient(overrideClient?: Stripe): Stripe {
  try {
    return getStripeClient(overrideClient);
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) throw new AppError("STRIPE_NOT_CONFIGURED", error.message, 409);
    if (error instanceof StripeInvalidKeyError) {
      const code = error.reason === "LIVE_MODE_NOT_ALLOWED" ? "STRIPE_LIVE_MODE_NOT_ALLOWED" : "STRIPE_INVALID_KEY";
      throw new AppError(code, error.message, 409);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Configuration status
// ---------------------------------------------------------------------------

export type StripeConfigurationStatus = {
  configured: boolean;
  mode: "test" | "unset" | "invalid";
  testMode: boolean;
  accountReachable: boolean;
  lastVerifiedAt: string | null;
  synchronizationEnabled: boolean;
  productMappings: number;
  priceMappings: number;
  approvedPriceCount: number;
  reviewRequiredCount: number;
};

/** Safe booleans/state only — never the key, never full account details. Makes one lightweight read call when configured. */
export async function inspectStripeConfiguration(overrideClient?: Stripe): Promise<StripeConfigurationStatus> {
  const state = getStripeConfigurationState();
  const [productMappings, priceMappings, approvedPriceCount, reviewRequiredCount] = await Promise.all([
    prisma.commerceProviderMapping.count({ where: { provider: PROVIDER, environment: ENVIRONMENT, providerObjectType: "PRODUCT" } }),
    prisma.commerceProviderMapping.count({ where: { provider: PROVIDER, environment: ENVIRONMENT, providerObjectType: "PRICE" } }),
    prisma.commercePrice.count({ where: { reviewStatus: "APPROVED" } }),
    prisma.commercePrice.count({ where: { reviewStatus: "REQUIRES_REVIEW" } }),
  ]);

  const base = {
    productMappings,
    priceMappings,
    approvedPriceCount,
    reviewRequiredCount,
  };

  if (!state.configured) {
    return {
      ...base,
      configured: false,
      mode: state.classification === "unset" ? "unset" : "invalid",
      testMode: false,
      accountReachable: false,
      lastVerifiedAt: null,
      synchronizationEnabled: false,
    };
  }

  try {
    const stripe = requireTestModeStripeClient(overrideClient);
    // A lightweight, key-scoped read (no account ID required) that also
    // confirms Stripe's own view of livemode matches our key-prefix check —
    // belt-and-braces against a misclassified or restricted key.
    const balance = await stripe.balance.retrieve();
    if (balance.livemode) throw new AppError("STRIPE_LIVE_MODE_NOT_ALLOWED", "Stripe reports this key as livemode.", 409);
    return {
      ...base,
      configured: true,
      mode: "test",
      testMode: true,
      accountReachable: true,
      lastVerifiedAt: new Date().toISOString(),
      synchronizationEnabled: true,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    return {
      ...base,
      configured: true,
      mode: "test",
      testMode: true,
      accountReachable: false,
      lastVerifiedAt: null,
      synchronizationEnabled: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Eligibility + plan
// ---------------------------------------------------------------------------

export type PriceBlockedReason =
  | "PRODUCT_INACTIVE"
  | "PRICE_INACTIVE"
  | "PRICE_NOT_APPROVED"
  | "ZERO_OR_NEGATIVE_AMOUNT"
  | "UNSUPPORTED_CURRENCY"
  | "UNSUPPORTED_INTERVAL"
  | "PURCHASE_MODE_NOT_DIRECT";

/**
 * item-A (Round 3 correction) — `options.allowNonDirectPurchaseMode` exists
 * ONLY so stripe-live-sync-service.ts can grant a narrow, exact-product-code
 * LIVE-only exception to the three sales-led Enterprise annual prices (see
 * SALES_LED_LIVE_SYNC_PRODUCT_CODES there) without weakening this shared,
 * provider/environment-agnostic function for every other caller. Every
 * existing call site (this file's own buildSyncPlan/TEST-mode sync, and any
 * call omitting the third argument) keeps the exact original behavior —
 * purchaseMode !== "DIRECT" still blocks with PURCHASE_MODE_NOT_DIRECT.
 * Never call this with allowNonDirectPurchaseMode: true outside that one,
 * narrowly-scoped LIVE call site.
 */
export function classifyPriceEligibility(
  product: CommerceProductRecord,
  price: CommerceProductRecord["prices"][number],
  options?: { allowNonDirectPurchaseMode?: boolean },
): { eligible: boolean; reason?: PriceBlockedReason } {
  if (!product.isActive) return { eligible: false, reason: "PRODUCT_INACTIVE" };
  if (!price.isActive) return { eligible: false, reason: "PRICE_INACTIVE" };
  if (price.reviewStatus !== "APPROVED") return { eligible: false, reason: "PRICE_NOT_APPROVED" };
  if (price.amountMinor <= 0) return { eligible: false, reason: "ZERO_OR_NEGATIVE_AMOUNT" };
  if (!SUPPORTED_CURRENCIES.has(price.currency)) return { eligible: false, reason: "UNSUPPORTED_CURRENCY" };
  if (!SUPPORTED_INTERVALS.has(price.billingInterval)) return { eligible: false, reason: "UNSUPPORTED_INTERVAL" };
  if (product.purchaseMode !== "DIRECT" && !options?.allowNonDirectPurchaseMode) {
    return { eligible: false, reason: "PURCHASE_MODE_NOT_DIRECT" };
  }
  return { eligible: true };
}

/** Deterministic hash over the exact fields that matter for sync decisions — sorted so field order never changes the fingerprint. */
export function computeCatalogueFingerprint(products: CommerceProductRecord[]): string {
  const sorted = [...products].sort((a, b) => a.code.localeCompare(b.code));
  const slice = sorted.map((product) => ({
    code: product.code,
    type: product.type,
    purchaseMode: product.purchaseMode,
    isActive: product.isActive,
    name: product.name,
    description: product.description,
    prices: [...product.prices]
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((price) => ({
        code: price.code,
        amountMinor: price.amountMinor,
        currency: price.currency,
        billingInterval: price.billingInterval,
        isFromPrice: price.isFromPrice,
        isActive: price.isActive,
        reviewStatus: price.reviewStatus,
      })),
  }));
  return createHash("sha256").update(JSON.stringify(slice)).digest("hex");
}

export type SyncPlanProductEntry = { productId: string; code: string; action: "CREATE" | "UPDATE" | "ARCHIVE" | "UNCHANGED" };
export type SyncPlanPriceEntry = {
  priceId: string;
  code: string;
  productCode: string;
  action: "CREATE" | "ARCHIVE" | "UNCHANGED" | "BLOCKED";
  blockedReason?: PriceBlockedReason;
};

export type SyncPlan = {
  catalogueFingerprint: string;
  productCount: number;
  eligibleProductCount: number;
  ineligibleProductCount: number;
  approvedPriceCount: number;
  reviewRequiredPriceCount: number;
  products: SyncPlanProductEntry[];
  prices: SyncPlanPriceEntry[];
  productsToCreate: number;
  productsToUpdate: number;
  productsUnchanged: number;
  productsToArchive: number;
  pricesToCreate: number;
  pricesUnchanged: number;
  pricesToArchive: number;
  blockedCount: number;
};

/** Pure computation — reads internal DB state and existing mappings only. Makes zero Stripe calls. */
export async function buildSyncPlan(): Promise<SyncPlan> {
  const products = await listAllCommerceProductsWithPrices();
  const mappings = await listMappingsForEnvironment(PROVIDER, ENVIRONMENT);
  const productMappingByProductId = new Map(mappings.filter((m) => m.providerObjectType === "PRODUCT").map((m) => [m.commerceProductId, m]));
  const priceMappingByPriceId = new Map(mappings.filter((m) => m.providerObjectType === "PRICE" && m.commercePriceId).map((m) => [m.commercePriceId as string, m]));

  const productEntries: SyncPlanProductEntry[] = [];
  const priceEntries: SyncPlanPriceEntry[] = [];
  let approvedPriceCount = 0;
  let reviewRequiredPriceCount = 0;

  for (const product of products) {
    const existingMapping = productMappingByProductId.get(product.id);
    if (product.isActive) {
      productEntries.push({ productId: product.id, code: product.code, action: existingMapping ? "UPDATE" : "CREATE" });
    } else if (existingMapping && existingMapping.providerActive) {
      productEntries.push({ productId: product.id, code: product.code, action: "ARCHIVE" });
    } else {
      productEntries.push({ productId: product.id, code: product.code, action: "UNCHANGED" });
    }

    for (const price of product.prices) {
      if (price.reviewStatus === "APPROVED") approvedPriceCount += 1;
      if (price.reviewStatus === "REQUIRES_REVIEW") reviewRequiredPriceCount += 1;

      const existingPriceMapping = priceMappingByPriceId.get(price.id);
      const eligibility = classifyPriceEligibility(product, price);

      if (existingPriceMapping) {
        if (!price.isActive && existingPriceMapping.providerActive) {
          priceEntries.push({ priceId: price.id, code: price.code, productCode: product.code, action: "ARCHIVE" });
        } else {
          priceEntries.push({ priceId: price.id, code: price.code, productCode: product.code, action: "UNCHANGED" });
        }
        continue;
      }

      if (!eligibility.eligible) {
        priceEntries.push({ priceId: price.id, code: price.code, productCode: product.code, action: "BLOCKED", blockedReason: eligibility.reason });
        continue;
      }

      priceEntries.push({ priceId: price.id, code: price.code, productCode: product.code, action: "CREATE" });
    }
  }

  return {
    catalogueFingerprint: computeCatalogueFingerprint(products),
    productCount: products.length,
    eligibleProductCount: productEntries.filter((p) => p.action !== "UNCHANGED" || productMappingByProductId.has(p.productId)).length,
    ineligibleProductCount: productEntries.filter((p) => !p.action).length,
    approvedPriceCount,
    reviewRequiredPriceCount,
    products: productEntries,
    prices: priceEntries,
    productsToCreate: productEntries.filter((p) => p.action === "CREATE").length,
    productsToUpdate: productEntries.filter((p) => p.action === "UPDATE").length,
    productsUnchanged: productEntries.filter((p) => p.action === "UNCHANGED").length,
    productsToArchive: productEntries.filter((p) => p.action === "ARCHIVE").length,
    pricesToCreate: priceEntries.filter((p) => p.action === "CREATE").length,
    pricesUnchanged: priceEntries.filter((p) => p.action === "UNCHANGED").length,
    pricesToArchive: priceEntries.filter((p) => p.action === "ARCHIVE").length,
    blockedCount: priceEntries.filter((p) => p.action === "BLOCKED").length,
  };
}

/** Dry run — computes the plan and persists it as a CommerceSyncRun history entry. Makes zero Stripe mutation calls. */
export async function runDryRun(actor: PlatformActor, requestMetadata: PlatformRequestMetadata, overrideClient?: Stripe) {
  requirePlatformCapability(actor, "platform:read");
  const configuration = await inspectStripeConfiguration(overrideClient);
  const plan = await buildSyncPlan();

  const run = await createSyncRun({
    provider: PROVIDER,
    environment: ENVIRONMENT,
    operation: "DRY_RUN",
    initiatedByUserId: actor.userId,
    dryRun: true,
    catalogueFingerprint: plan.catalogueFingerprint,
  });
  const completed = await completeSyncRun(run.id, {
    status: "COMPLETED",
    productsCreated: 0,
    productsUpdated: 0,
    productsUnchanged: plan.productsUnchanged,
    productsArchived: 0,
    pricesCreated: 0,
    pricesUnchanged: plan.pricesUnchanged,
    pricesArchived: 0,
    blockedCount: plan.blockedCount,
    warningCount: 0,
  });

  await prisma.platformAuditLog.create({
    data: {
      actorUserId: actor.userId,
      actorPlatformRole: actor.platformRole,
      action: "commerce_stripe.dry_run",
      targetType: "CommerceSyncRun",
      targetId: completed.id,
      requestMetadataJson: requestMetadataJson(requestMetadata),
      afterJson: { catalogueFingerprint: plan.catalogueFingerprint, blockedCount: plan.blockedCount },
    },
  });

  return { configuration, plan, run: toSyncRunDTO(completed) };
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export type SynchronizeInput = {
  catalogueFingerprint: string;
  confirm: true;
};

function idempotencyKey(objectType: "PRODUCT" | "PRICE", stableInternalCode: string): string {
  return `quantara:test:${objectType}:${stableInternalCode}:create`;
}

function safeProductMetadata(code: string): Stripe.MetadataParam {
  return { quantara_product_code: code, quantara_environment: "test" };
}

function safePriceMetadata(code: string): Stripe.MetadataParam {
  return { quantara_price_code: code, quantara_environment: "test" };
}

/**
 * The only path that mutates Stripe. Requires PLATFORM_OWNER specifically
 * (stricter than dry run's platform:operate, which also admits
 * PLATFORM_ADMIN), a fresh matching catalogueFingerprint (rejects a stale
 * plan — the caller must re-run the dry run if the catalogue changed),
 * and explicit confirm:true. Every Stripe create call uses a deterministic
 * idempotency key derived from the internal stable code, never a random one.
 */
export async function synchronizeCommerceCatalogue(
  actor: PlatformActor,
  input: SynchronizeInput,
  requestMetadata: PlatformRequestMetadata,
  overrideClient?: Stripe,
) {
  if (actor.platformRole !== PlatformRole.PLATFORM_OWNER) {
    throw new PermissionDeniedError("Only the platform owner may execute a Stripe synchronization.");
  }
  if (input.confirm !== true) {
    throw new AppError("CONFIRMATION_REQUIRED", "Synchronization requires explicit confirm: true.", 400);
  }

  const stripe = requireTestModeStripeClient(overrideClient);
  const plan = await buildSyncPlan();
  if (plan.catalogueFingerprint !== input.catalogueFingerprint) {
    throw new ConflictError("STALE_SYNC_PLAN", "The catalogue changed since this plan was built. Run a new dry run and retry.");
  }

  const products = await listAllCommerceProductsWithPrices();
  const productById = new Map(products.map((p) => [p.id, p]));

  const run = await createSyncRun({
    provider: PROVIDER,
    environment: ENVIRONMENT,
    operation: "SYNCHRONIZE",
    initiatedByUserId: actor.userId,
    dryRun: false,
    catalogueFingerprint: plan.catalogueFingerprint,
  });

  let productsCreated = 0;
  let productsUpdated = 0;
  let productsArchived = 0;
  let pricesCreated = 0;
  let pricesArchived = 0;
  let warningCount = 0;
  const errors: string[] = [];

  for (const entry of plan.products) {
    const product = productById.get(entry.productId);
    if (!product) continue;
    try {
      if (entry.action === "CREATE") {
        const stripeProduct = await stripe.products.create(
          { name: product.name, description: product.description || undefined, active: true, metadata: safeProductMetadata(product.code) },
          { idempotencyKey: idempotencyKey("PRODUCT", product.code) },
        );
        await createMapping({
          provider: PROVIDER,
          environment: ENVIRONMENT,
          commerceProductId: product.id,
          providerProductId: stripeProduct.id,
          providerObjectType: "PRODUCT",
        });
        productsCreated += 1;
      } else if (entry.action === "UPDATE") {
        const mapping = await findProductMapping(PROVIDER, ENVIRONMENT, product.id);
        if (mapping) {
          await stripe.products.update(mapping.providerProductId, {
            name: product.name,
            description: product.description || undefined,
            active: true,
            metadata: safeProductMetadata(product.code),
          });
          await updateMappingState(mapping.id, { providerActive: true, synchronizationStatus: "SYNCED", lastSynchronizedAt: new Date() });
          productsUpdated += 1;
        }
      } else if (entry.action === "ARCHIVE") {
        const mapping = await findProductMapping(PROVIDER, ENVIRONMENT, product.id);
        if (mapping) {
          await stripe.products.update(mapping.providerProductId, { active: false });
          await updateMappingState(mapping.id, { providerActive: false, synchronizationStatus: "ARCHIVED", lastSynchronizedAt: new Date() });
          productsArchived += 1;
        }
      }
    } catch (error) {
      const safe = mapStripeError(error);
      errors.push(`${entry.code}: ${safe.code}`);
      warningCount += 1;
    }
  }

  for (const entry of plan.prices) {
    if (entry.action !== "CREATE" && entry.action !== "ARCHIVE") continue;
    const product = products.find((p) => p.code === entry.productCode);
    const price = product?.prices.find((p) => p.id === entry.priceId);
    if (!product || !price) continue;

    try {
      if (entry.action === "CREATE") {
        const productMapping = await findProductMapping(PROVIDER, ENVIRONMENT, product.id);
        if (!productMapping) {
          errors.push(`${entry.code}: PRODUCT_MAPPING_MISSING`);
          warningCount += 1;
          continue;
        }
        const priceParams: Stripe.PriceCreateParams = {
          product: productMapping.providerProductId,
          unit_amount: price.amountMinor,
          currency: price.currency.toLowerCase(),
          metadata: safePriceMetadata(price.code),
          ...(price.billingInterval === "ONE_TIME"
            ? {}
            : { recurring: { interval: price.billingInterval === "MONTH" ? "month" : "year" } }),
        };
        const stripePrice = await stripe.prices.create(priceParams, { idempotencyKey: idempotencyKey("PRICE", price.code) });
        await createMapping({
          provider: PROVIDER,
          environment: ENVIRONMENT,
          commerceProductId: product.id,
          commercePriceId: price.id,
          providerProductId: productMapping.providerProductId,
          providerPriceId: stripePrice.id,
          providerObjectType: "PRICE",
        });
        pricesCreated += 1;
      } else if (entry.action === "ARCHIVE") {
        const mapping = await findPriceMapping(PROVIDER, ENVIRONMENT, price.id);
        if (mapping?.providerPriceId) {
          await stripe.prices.update(mapping.providerPriceId, { active: false });
          await updateMappingState(mapping.id, { providerActive: false, synchronizationStatus: "ARCHIVED", lastSynchronizedAt: new Date() });
          pricesArchived += 1;
        }
      }
    } catch (error) {
      const safe = mapStripeError(error);
      errors.push(`${entry.code}: ${safe.code}`);
      warningCount += 1;
    }
  }

  const status = errors.length === 0 ? "COMPLETED" : "COMPLETED_WITH_WARNINGS";
  const completed = await completeSyncRun(run.id, {
    status,
    productsCreated,
    productsUpdated,
    productsUnchanged: plan.productsUnchanged,
    productsArchived,
    pricesCreated,
    pricesUnchanged: plan.pricesUnchanged,
    pricesArchived,
    blockedCount: plan.blockedCount,
    warningCount,
    safeErrorCode: errors.length > 0 ? "PARTIAL_SYNC_FAILURES" : null,
  });

  await prisma.platformAuditLog.create({
    data: {
      actorUserId: actor.userId,
      actorPlatformRole: actor.platformRole,
      action: "commerce_stripe.synchronize",
      targetType: "CommerceSyncRun",
      targetId: completed.id,
      requestMetadataJson: requestMetadataJson(requestMetadata),
      afterJson: { productsCreated, productsUpdated, productsArchived, pricesCreated, pricesArchived, warningCount },
    },
  });

  return { run: toSyncRunDTO(completed), errors };
}

// ---------------------------------------------------------------------------
// Verification / drift detection
// ---------------------------------------------------------------------------

export type DriftEntry = {
  mappingId: string;
  providerObjectType: "PRODUCT" | "PRICE";
  code: string;
  field: string;
  internalValue: string;
  providerValue: string;
};

/**
 * Fetches the live Stripe object for every existing mapping and compares it
 * to the internal record. Never overwrites the internal value — drift is
 * reported for owner review only. A missing/deleted Stripe object marks the
 * mapping ERROR, not DRIFTED (nothing to compare against).
 */
export async function verifyStripeMapping(actor: PlatformActor, requestMetadata: PlatformRequestMetadata, overrideClient?: Stripe) {
  requirePlatformCapability(actor, "platform:operate");
  const stripe = requireTestModeStripeClient(overrideClient);
  const mappings = await listMappingsForEnvironment(PROVIDER, ENVIRONMENT);
  const products = await listAllCommerceProductsWithPrices();
  const productById = new Map(products.map((p) => [p.id, p]));

  const drift: DriftEntry[] = [];
  let verified = 0;
  let errored = 0;

  for (const mapping of mappings) {
    try {
      if (mapping.providerObjectType === "PRODUCT") {
        const product = productById.get(mapping.commerceProductId);
        const stripeProduct = await stripe.products.retrieve(mapping.providerProductId);
        const fieldDrift: DriftEntry[] = [];
        if (product && stripeProduct.name !== product.name) {
          fieldDrift.push({ mappingId: mapping.id, providerObjectType: "PRODUCT", code: product.code, field: "name", internalValue: product.name, providerValue: stripeProduct.name });
        }
        if (product && stripeProduct.active !== product.isActive) {
          fieldDrift.push({ mappingId: mapping.id, providerObjectType: "PRODUCT", code: product.code, field: "active", internalValue: String(product.isActive), providerValue: String(stripeProduct.active) });
        }
        drift.push(...fieldDrift);
        await updateMappingState(mapping.id, {
          lastVerifiedAt: new Date(),
          synchronizationStatus: fieldDrift.length > 0 ? "DRIFTED" : "SYNCED",
        });
      } else if (mapping.commercePriceId && mapping.providerPriceId) {
        const product = productById.get(mapping.commerceProductId);
        const price = product?.prices.find((p) => p.id === mapping.commercePriceId);
        const stripePrice = await stripe.prices.retrieve(mapping.providerPriceId);
        const fieldDrift: DriftEntry[] = [];
        if (price && stripePrice.unit_amount !== price.amountMinor) {
          fieldDrift.push({ mappingId: mapping.id, providerObjectType: "PRICE", code: price.code, field: "amount", internalValue: String(price.amountMinor), providerValue: String(stripePrice.unit_amount) });
        }
        if (price && stripePrice.currency.toUpperCase() !== price.currency) {
          fieldDrift.push({ mappingId: mapping.id, providerObjectType: "PRICE", code: price.code, field: "currency", internalValue: price.currency, providerValue: stripePrice.currency.toUpperCase() });
        }
        const expectedInterval = price?.billingInterval === "ONE_TIME" ? null : price?.billingInterval === "MONTH" ? "month" : "year";
        if (price && (stripePrice.recurring?.interval ?? null) !== expectedInterval) {
          fieldDrift.push({ mappingId: mapping.id, providerObjectType: "PRICE", code: price.code, field: "interval", internalValue: String(expectedInterval), providerValue: String(stripePrice.recurring?.interval ?? null) });
        }
        drift.push(...fieldDrift);
        await updateMappingState(mapping.id, {
          lastVerifiedAt: new Date(),
          synchronizationStatus: fieldDrift.length > 0 ? "DRIFTED" : "SYNCED",
        });
      }
      verified += 1;
    } catch {
      errored += 1;
      await updateMappingState(mapping.id, { synchronizationStatus: "ERROR", lastErrorCode: "STRIPE_OBJECT_UNREACHABLE" });
    }
  }

  const run = await createSyncRun({
    provider: PROVIDER,
    environment: ENVIRONMENT,
    operation: "VERIFY",
    initiatedByUserId: actor.userId,
    dryRun: false,
    catalogueFingerprint: computeCatalogueFingerprint(products),
  });
  const completed = await completeSyncRun(run.id, {
    status: errored > 0 ? "COMPLETED_WITH_WARNINGS" : "COMPLETED",
    productsCreated: 0,
    productsUpdated: 0,
    productsUnchanged: verified,
    productsArchived: 0,
    pricesCreated: 0,
    pricesUnchanged: 0,
    pricesArchived: 0,
    blockedCount: 0,
    warningCount: errored,
  });

  await prisma.platformAuditLog.create({
    data: {
      actorUserId: actor.userId,
      actorPlatformRole: actor.platformRole,
      action: "commerce_stripe.verify",
      targetType: "CommerceSyncRun",
      targetId: completed.id,
      requestMetadataJson: requestMetadataJson(requestMetadata),
      afterJson: { verified, errored, driftCount: drift.length },
    },
  });

  return { run: toSyncRunDTO(completed), verified, errored, drift };
}

export const detectStripeDrift = verifyStripeMapping;

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export async function listStripeSyncHistory(actor: PlatformActor, limit = 50) {
  requirePlatformCapability(actor, "platform:read");
  const rows = await listSyncRuns(PROVIDER, ENVIRONMENT, limit);
  return rows.map(toSyncRunDTO);
}
