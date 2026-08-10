import { PlatformRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { AppError, ConflictError, PermissionDeniedError } from "@/lib/errors/app-error";
import {
  getStripeCommercialClient,
  StripeInvalidKeyError,
  StripeNotConfiguredError,
} from "@/lib/payments/stripe-client";
import { listAllCommerceProductsWithPrices } from "@/lib/repositories/commerce-product-repository";
import {
  createMapping,
  findProductMapping,
  findPriceMapping,
  listMappingsForEnvironment,
  updateMappingState,
} from "@/lib/repositories/commerce-provider-mapping-repository";
import { completeSyncRun, createSyncRun, listSyncRuns, toSyncRunDTO } from "@/lib/repositories/commerce-sync-run-repository";
import type { PlatformRequestMetadata } from "@/lib/repositories/platform-admin-repository";
import { classifyPriceEligibility, computeCatalogueFingerprint } from "@/lib/services/stripe-sync-service";
import type Stripe from "stripe";

/**
 * STRIPE-COMMERCIAL-4 — live-mode counterpart of stripe-sync-service.ts.
 *
 * A deliberately separate, smaller file rather than parameterizing the
 * existing test-mode service: the existing file (and its 26/26-passing test
 * suite) must never regress, and live catalogue synchronization warrants a
 * strictly higher bar than test sync (PLATFORM_OWNER only, everywhere,
 * including read-only verify — not the platform:read/platform:operate split
 * the test-mode service uses for PLATFORM_ADMIN/PLATFORM_SUPPORT).
 *
 * Reuses classifyPriceEligibility/computeCatalogueFingerprint (pure
 * functions, provider/environment-agnostic) and every repository function
 * (already parameterized by CommerceProviderEnvironment) from the existing
 * test-mode module — no duplicated business logic, only duplicated
 * orchestration with a different environment/role/idempotency-key
 * namespace.
 *
 * Never promotes a price's reviewStatus — classifyPriceEligibility already
 * requires APPROVED, and this file has no code path that writes
 * CommercePrice.reviewStatus at all. Never syncs a QUOTATION_REQUIRED/
 * CONTACT_SALES product as a direct-checkout price — classifyPriceEligibility
 * requires purchaseMode === DIRECT.
 */

const PROVIDER = "STRIPE" as const;
const ENVIRONMENT = "LIVE" as const;

function requestMetadataJson(metadata: PlatformRequestMetadata) {
  return {
    method: metadata.method,
    path: metadata.path,
    ...(metadata.requestId ? { requestId: metadata.requestId } : {}),
  };
}

function mapStripeError(error: unknown): { code: string; message: string } {
  const stripeError = error as { type?: string; code?: string; message?: string } | undefined;
  console.error("[stripe-live-sync] provider error", stripeError?.type, stripeError?.code, stripeError?.message);
  if (stripeError?.type === "StripeAuthenticationError") return { code: "STRIPE_INVALID_KEY", message: "Stripe rejected the configured live API key." };
  if (stripeError?.type === "StripeRateLimitError") return { code: "STRIPE_RATE_LIMITED", message: "Stripe rate-limited this request. Try again shortly." };
  if (stripeError?.type === "StripeConnectionError") return { code: "STRIPE_ACCOUNT_UNREACHABLE", message: "Could not reach Stripe." };
  return { code: "STRIPE_PROVIDER_ERROR", message: "Stripe returned an error processing this request." };
}

function requireLiveModeStripeClient(overrideClient?: Stripe): Stripe {
  try {
    return getStripeCommercialClient(overrideClient);
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) throw new AppError("STRIPE_NOT_CONFIGURED", error.message, 409);
    if (error instanceof StripeInvalidKeyError) {
      const code = error.reason === "LIVE_MODE_NOT_ALLOWED" ? "STRIPE_LIVE_MODE_NOT_ALLOWED" : "STRIPE_INVALID_KEY";
      throw new AppError(code, error.message, 409);
    }
    throw error;
  }
}

function requireOwner(actor: PlatformActor): void {
  if (actor.platformRole !== PlatformRole.PLATFORM_OWNER) {
    throw new PermissionDeniedError("Only the platform owner may operate live Stripe synchronization.");
  }
}

export type LiveSyncPlan = Awaited<ReturnType<typeof buildLiveSyncPlan>>;

/** Pure computation — reads internal DB state and existing LIVE mappings only. Zero Stripe calls, so this alone is safe even before a live key is configured. */
export async function buildLiveSyncPlan() {
  const products = await listAllCommerceProductsWithPrices();
  const mappings = await listMappingsForEnvironment(PROVIDER, ENVIRONMENT);
  const productMappingByProductId = new Map(mappings.filter((m) => m.providerObjectType === "PRODUCT").map((m) => [m.commerceProductId, m]));
  const priceMappingByPriceId = new Map(mappings.filter((m) => m.providerObjectType === "PRICE" && m.commercePriceId).map((m) => [m.commercePriceId as string, m]));

  const products_: { productId: string; code: string; action: "CREATE" | "UPDATE" | "ARCHIVE" | "UNCHANGED" }[] = [];
  const prices_: { priceId: string; code: string; productCode: string; action: "CREATE" | "ARCHIVE" | "UNCHANGED" | "BLOCKED"; blockedReason?: string }[] = [];

  for (const product of products) {
    const existingMapping = productMappingByProductId.get(product.id);
    if (product.isActive) {
      products_.push({ productId: product.id, code: product.code, action: existingMapping ? "UPDATE" : "CREATE" });
    } else if (existingMapping && existingMapping.providerActive) {
      products_.push({ productId: product.id, code: product.code, action: "ARCHIVE" });
    } else {
      products_.push({ productId: product.id, code: product.code, action: "UNCHANGED" });
    }

    for (const price of product.prices) {
      const existingPriceMapping = priceMappingByPriceId.get(price.id);
      const eligibility = classifyPriceEligibility(product, price);

      if (existingPriceMapping) {
        if (!price.isActive && existingPriceMapping.providerActive) {
          prices_.push({ priceId: price.id, code: price.code, productCode: product.code, action: "ARCHIVE" });
        } else {
          prices_.push({ priceId: price.id, code: price.code, productCode: product.code, action: "UNCHANGED" });
        }
        continue;
      }

      if (!eligibility.eligible) {
        prices_.push({ priceId: price.id, code: price.code, productCode: product.code, action: "BLOCKED", blockedReason: eligibility.reason });
        continue;
      }

      prices_.push({ priceId: price.id, code: price.code, productCode: product.code, action: "CREATE" });
    }
  }

  return {
    catalogueFingerprint: computeCatalogueFingerprint(products),
    products: products_,
    prices: prices_,
    productsToCreate: products_.filter((p) => p.action === "CREATE").length,
    productsToUpdate: products_.filter((p) => p.action === "UPDATE").length,
    productsUnchanged: products_.filter((p) => p.action === "UNCHANGED").length,
    productsToArchive: products_.filter((p) => p.action === "ARCHIVE").length,
    pricesToCreate: prices_.filter((p) => p.action === "CREATE").length,
    pricesUnchanged: prices_.filter((p) => p.action === "UNCHANGED").length,
    pricesToArchive: prices_.filter((p) => p.action === "ARCHIVE").length,
    blockedCount: prices_.filter((p) => p.action === "BLOCKED").length,
  };
}

/** Dry run — PLATFORM_OWNER only, zero Stripe calls. Safe to run even without a live key configured, so an owner can inspect what *would* sync before ever touching the live account. */
export async function runLiveDryRun(actor: PlatformActor, requestMetadata: PlatformRequestMetadata) {
  requireOwner(actor);
  const plan = await buildLiveSyncPlan();

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
      action: "commerce_stripe_live.dry_run",
      targetType: "CommerceSyncRun",
      targetId: completed.id,
      requestMetadataJson: requestMetadataJson(requestMetadata),
      afterJson: { catalogueFingerprint: plan.catalogueFingerprint, blockedCount: plan.blockedCount },
    },
  });

  return { plan, run: toSyncRunDTO(completed) };
}

export type LiveSynchronizeInput = { catalogueFingerprint: string; confirm: true };

function idempotencyKey(objectType: "PRODUCT" | "PRICE", stableInternalCode: string): string {
  return `quantara:live:${objectType}:${stableInternalCode}:create`;
}

function safeMetadata(kind: "product" | "price", code: string): Stripe.MetadataParam {
  return kind === "product" ? { quantara_product_code: code, quantara_environment: "live" } : { quantara_price_code: code, quantara_environment: "live" };
}

/**
 * The only path that mutates live Stripe. PLATFORM_OWNER only, requires a
 * fresh matching catalogueFingerprint and explicit confirm:true — identical
 * safety shape to the test-mode synchronizeCommerceCatalogue, but every
 * created object and idempotency key is namespaced `live`/`quantara:live:*`
 * so it can never collide with a test-mode object, and the mapping is
 * recorded with environment: LIVE.
 */
export async function synchronizeLiveCommerceCatalogue(
  actor: PlatformActor,
  input: LiveSynchronizeInput,
  requestMetadata: PlatformRequestMetadata,
  overrideClient?: Stripe,
) {
  requireOwner(actor);
  if (input.confirm !== true) {
    throw new AppError("CONFIRMATION_REQUIRED", "Live synchronization requires explicit confirm: true.", 400);
  }

  const stripe = requireLiveModeStripeClient(overrideClient);
  const plan = await buildLiveSyncPlan();
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
          { name: product.name, description: product.description || undefined, active: true, metadata: safeMetadata("product", product.code) },
          { idempotencyKey: idempotencyKey("PRODUCT", product.code) },
        );
        await createMapping({ provider: PROVIDER, environment: ENVIRONMENT, commerceProductId: product.id, providerProductId: stripeProduct.id, providerObjectType: "PRODUCT" });
        productsCreated += 1;
      } else if (entry.action === "UPDATE") {
        const mapping = await findProductMapping(PROVIDER, ENVIRONMENT, product.id);
        if (mapping) {
          await stripe.products.update(mapping.providerProductId, { name: product.name, description: product.description || undefined, active: true, metadata: safeMetadata("product", product.code) });
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
        const stripePrice = await stripe.prices.create(
          {
            product: productMapping.providerProductId,
            unit_amount: price.amountMinor,
            currency: price.currency.toLowerCase(),
            metadata: safeMetadata("price", price.code),
            ...(price.billingInterval === "ONE_TIME" ? {} : { recurring: { interval: price.billingInterval === "MONTH" ? "month" : "year" } }),
          },
          { idempotencyKey: idempotencyKey("PRICE", price.code) },
        );
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
      action: "commerce_stripe_live.synchronize",
      targetType: "CommerceSyncRun",
      targetId: completed.id,
      requestMetadataJson: requestMetadataJson(requestMetadata),
      afterJson: { productsCreated, productsUpdated, productsArchived, pricesCreated, pricesArchived, warningCount },
    },
  });

  return { run: toSyncRunDTO(completed), errors };
}

/** Fetches the live Stripe object for every existing LIVE mapping and reports drift. Never overwrites the internal value. PLATFORM_OWNER only — unlike the test-mode verify, which admits platform:operate. */
export async function verifyLiveStripeMapping(actor: PlatformActor, requestMetadata: PlatformRequestMetadata, overrideClient?: Stripe) {
  requireOwner(actor);
  const stripe = requireLiveModeStripeClient(overrideClient);
  const mappings = await listMappingsForEnvironment(PROVIDER, ENVIRONMENT);
  const products = await listAllCommerceProductsWithPrices();
  const productById = new Map(products.map((p) => [p.id, p]));

  let verified = 0;
  let errored = 0;
  const drift: { mappingId: string; providerObjectType: "PRODUCT" | "PRICE"; code: string; field: string; internalValue: string; providerValue: string }[] = [];

  for (const mapping of mappings) {
    try {
      if (mapping.providerObjectType === "PRODUCT") {
        const product = productById.get(mapping.commerceProductId);
        const stripeProduct = await stripe.products.retrieve(mapping.providerProductId);
        const fieldDrift: typeof drift = [];
        if (product && stripeProduct.name !== product.name) fieldDrift.push({ mappingId: mapping.id, providerObjectType: "PRODUCT", code: product.code, field: "name", internalValue: product.name, providerValue: stripeProduct.name });
        if (product && stripeProduct.active !== product.isActive) fieldDrift.push({ mappingId: mapping.id, providerObjectType: "PRODUCT", code: product.code, field: "active", internalValue: String(product.isActive), providerValue: String(stripeProduct.active) });
        drift.push(...fieldDrift);
        await updateMappingState(mapping.id, { lastVerifiedAt: new Date(), synchronizationStatus: fieldDrift.length > 0 ? "DRIFTED" : "SYNCED" });
      } else if (mapping.commercePriceId && mapping.providerPriceId) {
        const product = productById.get(mapping.commerceProductId);
        const price = product?.prices.find((p) => p.id === mapping.commercePriceId);
        const stripePrice = await stripe.prices.retrieve(mapping.providerPriceId);
        const fieldDrift: typeof drift = [];
        if (price && stripePrice.unit_amount !== price.amountMinor) fieldDrift.push({ mappingId: mapping.id, providerObjectType: "PRICE", code: price.code, field: "amount", internalValue: String(price.amountMinor), providerValue: String(stripePrice.unit_amount) });
        if (price && stripePrice.currency.toUpperCase() !== price.currency) fieldDrift.push({ mappingId: mapping.id, providerObjectType: "PRICE", code: price.code, field: "currency", internalValue: price.currency, providerValue: stripePrice.currency.toUpperCase() });
        const expectedInterval = price?.billingInterval === "ONE_TIME" ? null : price?.billingInterval === "MONTH" ? "month" : "year";
        if (price && (stripePrice.recurring?.interval ?? null) !== expectedInterval) fieldDrift.push({ mappingId: mapping.id, providerObjectType: "PRICE", code: price.code, field: "interval", internalValue: String(expectedInterval), providerValue: String(stripePrice.recurring?.interval ?? null) });
        drift.push(...fieldDrift);
        await updateMappingState(mapping.id, { lastVerifiedAt: new Date(), synchronizationStatus: fieldDrift.length > 0 ? "DRIFTED" : "SYNCED" });
      }
      verified += 1;
    } catch {
      errored += 1;
      await updateMappingState(mapping.id, { synchronizationStatus: "ERROR", lastErrorCode: "STRIPE_OBJECT_UNREACHABLE" });
    }
  }

  const run = await createSyncRun({ provider: PROVIDER, environment: ENVIRONMENT, operation: "VERIFY", initiatedByUserId: actor.userId, dryRun: false, catalogueFingerprint: computeCatalogueFingerprint(products) });
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
      action: "commerce_stripe_live.verify",
      targetType: "CommerceSyncRun",
      targetId: completed.id,
      requestMetadataJson: requestMetadataJson(requestMetadata),
      afterJson: { verified, errored, driftCount: drift.length },
    },
  });

  return { run: toSyncRunDTO(completed), verified, errored, drift };
}

export async function listLiveStripeSyncHistory(actor: PlatformActor, limit = 50) {
  requireOwner(actor);
  const rows = await listSyncRuns(PROVIDER, ENVIRONMENT, limit);
  return rows.map(toSyncRunDTO);
}
