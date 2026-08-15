import { createHash } from "node:crypto";
import { PlatformRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
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
import { classifyPriceEligibility, computeCatalogueFingerprint, type PriceBlockedReason } from "@/lib/services/stripe-sync-service";
import type { CommerceProductRecord } from "@/lib/repositories/commerce-product-repository";
import type Stripe from "stripe";
import { isTayqanOneTimeProductCode } from "@/lib/tayqan/tayqan-commerce";

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
 * test-mode module — no duplicated business logic for the shared checks;
 * classifyLiveCheckoutEligibility below only adds the *stricter* checks
 * genuine self-checkout requires (public, SUBSCRIPTION, MONTH/YEAR) on top
 * of it, rather than duplicating the DIRECT/APPROVED/active/amount/currency
 * checks it already performs.
 *
 * Never promotes a price's reviewStatus — classifyPriceEligibility already
 * requires APPROVED, and this file has no code path that writes
 * CommercePrice.reviewStatus at all. Never syncs a QUOTATION_REQUIRED/
 * CONTACT_SALES product as a direct-checkout price — classifyPriceEligibility
 * requires purchaseMode === DIRECT. A CommerceProduct is only ever
 * represented as a live Stripe Product while it has at least one currently
 * eligible price (see buildLiveSyncPlan) — an ADD_ON/ENTERPRISE/private
 * product, or a SUBSCRIPTION product none of whose prices are eligible, is
 * never live-synced at all, and a product that loses its last eligible
 * price is archived on the next run.
 */

export type LivePriceBlockedReason =
  | PriceBlockedReason
  | "PRODUCT_NOT_PUBLIC"
  | "PRODUCT_NOT_SUBSCRIPTION"
  | "UNSUPPORTED_LIVE_INTERVAL"
  | "INDICATIVE_FROM_PRICE";

/**
 * STRIPE-COMMERCIAL-7/8 — the eligibility bar for genuine customer
 * self-checkout, stricter than the shared test-mode classifyPriceEligibility:
 * additionally requires the product to be public (never make a hidden/
 * private product purchasable merely by knowing its price code) and a
 * SUBSCRIPTION-type product (one-time fulfillment does not exist yet — see
 * commerce-checkout-service.ts), with a MONTH/YEAR billing interval only,
 * and never an indicative "from AED X" price (isFromPrice) — mirrors the
 * exact same check commerce-checkout-service.ts's loadEligibleCommercePrice
 * and commerce-checkout-availability-service.ts already apply for customer
 * checkout; a "from" price was never meant to be an exact purchasable
 * amount and must never become a live, chargeable Stripe Price.
 */
export function classifyLiveCheckoutEligibility(
  product: CommerceProductRecord,
  price: CommerceProductRecord["prices"][number],
): { eligible: boolean; reason?: LivePriceBlockedReason } {
  if (!product.isPublic) return { eligible: false, reason: "PRODUCT_NOT_PUBLIC" };
  if (price.isFromPrice) return { eligible: false, reason: "INDICATIVE_FROM_PRICE" };

  // TAYQAN-HIRE-1: Day/Week are the only live one-time products with a
  // verified fulfillment path. Every unrelated ONE_TIME catalogue product
  // remains blocked exactly as before.
  if (isTayqanOneTimeProductCode(product.code)) {
    if (product.type !== "ONE_TIME" || price.billingInterval !== "ONE_TIME") {
      return { eligible: false, reason: "UNSUPPORTED_LIVE_INTERVAL" };
    }
    return classifyPriceEligibility(product, price);
  }

  if (product.type !== "SUBSCRIPTION") return { eligible: false, reason: "PRODUCT_NOT_SUBSCRIPTION" };
  if (price.billingInterval === "ONE_TIME") return { eligible: false, reason: "UNSUPPORTED_LIVE_INTERVAL" };
  return classifyPriceEligibility(product, price);
}

/** True if at least one of this product's prices currently passes classifyLiveCheckoutEligibility — the same signal buildLiveSyncPlan uses to decide whether a product should be represented as a live Stripe Product at all. Shared with verifyLiveStripeMapping so "desired active state" is computed identically in both places. */
function productHasEligibleLivePrice(product: CommerceProductRecord): boolean {
  return product.prices.some((price) => classifyLiveCheckoutEligibility(product, price).eligible);
}

/**
 * STRIPE-COMMERCIAL-12 — unlike computeCatalogueFingerprint (shared with the
 * test-mode sync, which does not consider isPublic at all since test-mode
 * eligibility never depends on it), live checkout eligibility depends on
 * CommerceProduct.isPublic. A confirmation built against a plan that omitted
 * isPublic could apply a stale plan after isPublic flipped without the
 * fingerprint changing. This layers an isPublic-sensitive hash on top of the
 * shared fingerprint rather than modifying computeCatalogueFingerprint
 * itself, so the existing 26/26 test-mode sync suite (which asserts on the
 * shared fingerprint's exact behavior) is never touched.
 */
function computeLiveCatalogueFingerprint(products: CommerceProductRecord[]): string {
  const base = computeCatalogueFingerprint(products);
  const publicFlags = [...products]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((product) => ({ code: product.code, isPublic: product.isPublic }));
  return createHash("sha256").update(`${base}:${JSON.stringify(publicFlags)}`).digest("hex");
}

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

/**
 * Pure computation — reads internal DB state and existing LIVE mappings
 * only. Zero Stripe calls, so this alone is safe even before a live key is
 * configured.
 *
 * STRIPE-COMMERCIAL-8 — unlike the test-mode plan (which syncs every
 * active CommerceProduct as a Stripe Product regardless of purchase mode),
 * a CommerceProduct here is only ever CREATE/UPDATE'd while it currently
 * has at least one price passing classifyLiveCheckoutEligibility. A product
 * with zero eligible prices (never had one, or its last one just became
 * ineligible) is ARCHIVEd if it was previously mapped, or simply never
 * synced (UNCHANGED) if it never was. This is evaluated fresh on every
 * call, so a price that becomes ineligible after being synced (review
 * revoked, product turned private/non-DIRECT, ...) is archived — never left
 * representing itself as checkout-ready.
 */
type LiveSyncPlanClient = { commerceProduct: typeof prisma.commerceProduct; commerceProviderMapping: typeof prisma.commerceProviderMapping };

export async function buildLiveSyncPlan(client: LiveSyncPlanClient = prisma) {
  const products = await listAllCommerceProductsWithPrices(client);
  const mappings = await listMappingsForEnvironment(PROVIDER, ENVIRONMENT, client);
  const productMappingByProductId = new Map(mappings.filter((m) => m.providerObjectType === "PRODUCT").map((m) => [m.commerceProductId, m]));
  const priceMappingByPriceId = new Map(mappings.filter((m) => m.providerObjectType === "PRICE" && m.commercePriceId).map((m) => [m.commercePriceId as string, m]));

  const products_: { productId: string; code: string; action: "CREATE" | "UPDATE" | "ARCHIVE" | "UNCHANGED" }[] = [];
  const prices_: { priceId: string; code: string; productCode: string; action: "CREATE" | "REACTIVATE" | "ARCHIVE" | "UNCHANGED" | "BLOCKED"; blockedReason?: string }[] = [];

  for (const product of products) {
    const priceEntries: typeof prices_ = [];
    let hasCurrentlyEligiblePrice = false;

    for (const price of product.prices) {
      const existingPriceMapping = priceMappingByPriceId.get(price.id);
      const eligibility = classifyLiveCheckoutEligibility(product, price);
      if (eligibility.eligible) hasCurrentlyEligiblePrice = true;

      if (existingPriceMapping) {
        if (!eligibility.eligible && existingPriceMapping.providerActive) {
          priceEntries.push({ priceId: price.id, code: price.code, productCode: product.code, action: "ARCHIVE" });
        } else if (eligibility.eligible && !existingPriceMapping.providerActive) {
          // STRIPE-COMMERCIAL-13 — a price that was archived (e.g. its product
          // went private, then public again) must be able to become
          // checkout-ready again rather than being stuck UNCHANGED forever.
          priceEntries.push({ priceId: price.id, code: price.code, productCode: product.code, action: "REACTIVATE" });
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

    const existingProductMapping = productMappingByProductId.get(product.id);
    if (product.isActive && hasCurrentlyEligiblePrice) {
      products_.push({ productId: product.id, code: product.code, action: existingProductMapping ? "UPDATE" : "CREATE" });
    } else if (existingProductMapping && existingProductMapping.providerActive) {
      products_.push({ productId: product.id, code: product.code, action: "ARCHIVE" });
    } else {
      products_.push({ productId: product.id, code: product.code, action: "UNCHANGED" });
    }

    prices_.push(...priceEntries);
  }

  return {
    catalogueFingerprint: computeLiveCatalogueFingerprint(products),
    products: products_,
    prices: prices_,
    productsToCreate: products_.filter((p) => p.action === "CREATE").length,
    productsToUpdate: products_.filter((p) => p.action === "UPDATE").length,
    productsUnchanged: products_.filter((p) => p.action === "UNCHANGED").length,
    productsToArchive: products_.filter((p) => p.action === "ARCHIVE").length,
    pricesToCreate: prices_.filter((p) => p.action === "CREATE").length,
    pricesToReactivate: prices_.filter((p) => p.action === "REACTIVATE").length,
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
 * STRIPE-COMMERCIAL-22 — orphan-object recovery. `stripe.products.create`/
 * `stripe.prices.create` can succeed while the process fails before
 * `createMapping` persists the row (crash, connection drop, ...). The next
 * run's plan then finds no mapping, still sees the price/product as eligible,
 * and re-emits CREATE — minting a second live, chargeable Stripe object. The
 * idempotency key above only protects a single request; Stripe idempotency
 * keys are not retained indefinitely, so a retry made well after the first
 * attempt is not guaranteed to be deduplicated by the key alone.
 *
 * Deliberately does NOT use Stripe's Search API for this decision. Stripe
 * documents that Search indexing can lag behind writes (and can fall
 * further behind — "up to an hour" — during outages), so an empty or
 * failed Search result is not proof nothing exists, and a Search HIT can't
 * prove nothing else ALSO exists (needed to detect and fail closed on a
 * genuine duplicate). Both of those are load-bearing for this decision, so
 * Search cannot safely replace it — the resolvers below always walk a
 * complete, paginated Stripe LIST and match on trusted quantara_* metadata,
 * which is the only source that can conclusively answer "zero", "exactly
 * one", or "more than one".
 */
type ProductRecoveryDecision =
  | { decision: "create" }
  | { decision: "adopt"; product: Stripe.Product }
  | { decision: "fail"; code: string; message: string };

async function resolveExistingLiveProduct(stripe: Stripe, productCode: string): Promise<ProductRecoveryDecision> {
  const candidates: Stripe.Product[] = [];
  let startingAfter: string | undefined;
  try {
    for (;;) {
      const page = await stripe.products.list({ limit: 100, starting_after: startingAfter });
      for (const item of page.data) {
        if (item.metadata?.quantara_product_code === productCode && item.metadata?.quantara_environment === "live") {
          candidates.push(item);
        }
      }
      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
  } catch (error) {
    console.error("[stripe-live-sync] authoritative product recovery LIST failed", productCode, error);
    return {
      decision: "fail",
      code: "STRIPE_PRODUCT_RECOVERY_LIST_FAILED",
      message: "Could not confirm whether a live Stripe Product already exists for this product before creating one. No object was created.",
    };
  }

  if (candidates.length === 0) return { decision: "create" };
  if (candidates.length > 1) {
    return {
      decision: "fail",
      code: "STRIPE_PRODUCT_RECOVERY_MULTIPLE_CANDIDATES",
      message: "Multiple live Stripe Products carry this product's quantara_product_code metadata. Manual review is required — no object was created.",
    };
  }
  return { decision: "adopt", product: candidates[0] };
}

type PriceRecoveryDecision =
  | { decision: "create" }
  | { decision: "adopt"; price: Stripe.Price }
  | { decision: "fail"; code: string; message: string };

/**
 * A recovered Price is adopted only when it matches the internal record on
 * every financially-meaningful field, not merely on quantara_price_code — a
 * code match with a different amount/currency/interval/product is far more
 * likely to indicate stale or corrupted metadata than a genuine orphan, and
 * silently adopting it would let the wrong amount go live.
 */
async function resolveExistingLivePrice(
  stripe: Stripe,
  priceCode: string,
  providerProductId: string,
  expected: { amountMinor: number; currency: string; billingInterval: "MONTH" | "YEAR" | "ONE_TIME" },
): Promise<PriceRecoveryDecision> {
  const candidates: Stripe.Price[] = [];
  let startingAfter: string | undefined;
  try {
    for (;;) {
      const page = await stripe.prices.list({ product: providerProductId, limit: 100, starting_after: startingAfter });
      for (const item of page.data) {
        if (item.metadata?.quantara_price_code === priceCode && item.metadata?.quantara_environment === "live") {
          candidates.push(item);
        }
      }
      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
  } catch (error) {
    console.error("[stripe-live-sync] authoritative price recovery LIST failed", priceCode, error);
    return {
      decision: "fail",
      code: "STRIPE_PRICE_RECOVERY_LIST_FAILED",
      message: "Could not confirm whether a live Stripe Price already exists for this price before creating one. No object was created.",
    };
  }

  if (candidates.length === 0) return { decision: "create" };
  if (candidates.length > 1) {
    return {
      decision: "fail",
      code: "STRIPE_PRICE_RECOVERY_MULTIPLE_CANDIDATES",
      message: "Multiple live Stripe Prices carry this price's quantara_price_code metadata. Manual review is required — no object was created.",
    };
  }

  const [candidate] = candidates;
  const candidateProductId = typeof candidate.product === "string" ? candidate.product : candidate.product?.id;
  const expectedInterval = expected.billingInterval === "ONE_TIME" ? null : expected.billingInterval === "MONTH" ? "month" : "year";
  const matchesExactly =
    candidateProductId === providerProductId &&
    candidate.unit_amount === expected.amountMinor &&
    candidate.currency.toUpperCase() === expected.currency.toUpperCase() &&
    (candidate.recurring?.interval ?? null) === expectedInterval;

  if (!matchesExactly) {
    return {
      decision: "fail",
      code: "STRIPE_PRICE_RECOVERY_DRIFT",
      message: "A live Stripe Price carrying this price's metadata was found, but its product/amount/currency/interval does not match the internal record. Manual review is required — no object was created or adopted.",
    };
  }

  return { decision: "adopt", price: candidate };
}

/**
 * STRIPE-COMMERCIAL-23 — a single global lock, not per-entity: two
 * PLATFORM_OWNER requests both starting a live synchronization must never
 * run concurrently, since both would pass the same-instant fingerprint
 * check and then both apply the same CREATE/UPDATE/ARCHIVE actions against
 * the live Stripe account. Distinct from CHECKOUT_LOCK_NAMESPACE (checkout
 * creation, per-company) and STRIPE_WEBHOOK_LOCK_NAMESPACE (webhook
 * processing, per-subscription) in the other two services, so none of the
 * three lock domains can ever collide with each other.
 */
const LIVE_SYNC_LOCK_NAMESPACE = 231_874_509;

async function acquireLiveSyncLock(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LIVE_SYNC_LOCK_NAMESPACE}, hashtext('STRIPE:LIVE'))`;
}

/**
 * The only path that mutates live Stripe. PLATFORM_OWNER only, requires a
 * fresh matching catalogueFingerprint and explicit confirm:true — identical
 * safety shape to the test-mode synchronizeCommerceCatalogue, but every
 * created object and idempotency key is namespaced `live`/`quantara:live:*`
 * so it can never collide with a test-mode object, and the mapping is
 * recorded with environment: LIVE.
 *
 * The plan/fingerprint re-check, the entire apply loop, and the completion
 * write all run inside one transaction holding the STRIPE:LIVE advisory
 * lock, so a second concurrent request always waits for the first to fully
 * commit before it re-reads state — it can never re-derive and apply the
 * same stale plan. Unrelated operations (checkout creation, webhook
 * processing, a dry run) never contend for this lock.
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

  // SHORT DB CLAIM
  const { plan, run } = await prisma.$transaction(
    async (tx) => {
      await acquireLiveSyncLock(tx);

      const plan = await buildLiveSyncPlan(tx);
      if (plan.catalogueFingerprint !== input.catalogueFingerprint) {
        throw new ConflictError("STALE_SYNC_PLAN", "The catalogue changed since this plan was built. Run a new dry run and retry.");
      }

      const active = await tx.commerceSyncRun.findFirst({
        where: { provider: PROVIDER, environment: ENVIRONMENT, operation: "SYNCHRONIZE", status: "RUNNING" },
      });
      if (active) {
        if (Date.now() - active.startedAt.getTime() > 15 * 60 * 1000) {
          await completeSyncRun(active.id, { status: "FAILED", lastErrorCode: "SYNC_STALLED" } as any, tx);
        } else {
          throw new ConflictError("SYNC_IN_PROGRESS", "A live synchronization is already in progress.");
        }
      }

      const run = await createSyncRun(
        {
          provider: PROVIDER,
          environment: ENVIRONMENT,
          operation: "SYNCHRONIZE",
          initiatedByUserId: actor.userId,
          dryRun: false,
          catalogueFingerprint: plan.catalogueFingerprint,
        },
        tx,
      );

      return { plan, run };
    },
    { maxWait: 10_000, timeout: 15_000 },
  );

  const products = await listAllCommerceProductsWithPrices();
  const productById = new Map(products.map((p) => [p.id, p]));

  let productsCreated = 0;
  let productsUpdated = 0;
  let productsArchived = 0;
  let pricesCreated = 0;
  let pricesReactivated = 0;
  let pricesArchived = 0;
  let warningCount = 0;
  const errors: string[] = [];

  const persistChanges = async <T>(action: (tx: Prisma.TransactionClient) => Promise<T>) => {
    return prisma.$transaction(async (tx) => {
      // Lease ownership recheck
      const currentRun = await tx.commerceSyncRun.findUnique({ where: { id: run.id } });
      if (currentRun?.status !== "RUNNING") {
        throw new ConflictError("SYNC_ABORTED", "Sync run was aborted or timed out.");
      }

      // Fingerprint recheck
      const currentPlan = await buildLiveSyncPlan(tx);
      if (currentPlan.catalogueFingerprint !== plan.catalogueFingerprint) {
        await completeSyncRun(run.id, { status: "FAILED", lastErrorCode: "STALE_SYNC_PLAN" } as any, tx);
        throw new ConflictError("SYNC_ABORTED", "Catalogue fingerprint changed during sync.");
      }

      return action(tx);
    });
  };

  for (const entry of plan.products) {
    const product = productById.get(entry.productId);
    if (!product) continue;
    try {
      if (entry.action === "CREATE") {
        const recovery = await resolveExistingLiveProduct(stripe, product.code);
        if (recovery.decision === "fail") {
          errors.push(`${entry.code}: ${recovery.code}`);
          warningCount += 1;
          continue;
        }
        const stripeProduct = recovery.decision === "adopt"
          ? recovery.product
          : await stripe.products.create(
              { name: product.name, description: product.description || undefined, active: true, metadata: safeMetadata("product", product.code) },
              { idempotencyKey: idempotencyKey("PRODUCT", product.code) },
            );

        await persistChanges(async (tx) => {
          await createMapping({ provider: PROVIDER, environment: ENVIRONMENT, commerceProductId: product.id, providerProductId: stripeProduct.id, providerObjectType: "PRODUCT" }, tx);
        });
        productsCreated += 1;
      } else if (entry.action === "UPDATE") {
        const mapping = await prisma.commerceProviderMapping.findFirst({ where: { provider: PROVIDER, environment: ENVIRONMENT, commerceProductId: product.id } });
        if (mapping) {
          await stripe.products.update(mapping.providerProductId, { name: product.name, description: product.description || undefined, active: true, metadata: safeMetadata("product", product.code) });
          await persistChanges(async (tx) => {
            await updateMappingState(mapping.id, { providerActive: true, synchronizationStatus: "SYNCED", lastSynchronizedAt: new Date() }, tx);
          });
          productsUpdated += 1;
        }
      } else if (entry.action === "ARCHIVE") {
        const mapping = await prisma.commerceProviderMapping.findFirst({ where: { provider: PROVIDER, environment: ENVIRONMENT, commerceProductId: product.id } });
        if (mapping) {
          await stripe.products.update(mapping.providerProductId, { active: false });
          await persistChanges(async (tx) => {
            await updateMappingState(mapping.id, { providerActive: false, synchronizationStatus: "ARCHIVED", lastSynchronizedAt: new Date() }, tx);
          });
          productsArchived += 1;
        }
      }
    } catch (error) {
      if (error instanceof ConflictError && error.code === "SYNC_ABORTED") throw error;
      const safe = mapStripeError(error);
      errors.push(`${entry.code}: ${safe.code}`);
      warningCount += 1;
    }
  }

  for (const entry of plan.prices) {
    if (entry.action !== "CREATE" && entry.action !== "REACTIVATE" && entry.action !== "ARCHIVE") continue;
    const product = products.find((p) => p.code === entry.productCode);
    const price = product?.prices.find((p) => p.id === entry.priceId);
    if (!product || !price) continue;

    try {
      if (entry.action === "CREATE") {
        const productMapping = await prisma.commerceProviderMapping.findFirst({ where: { provider: PROVIDER, environment: ENVIRONMENT, commerceProductId: product.id } });
        if (!productMapping) {
          errors.push(`${entry.code}: PRODUCT_MAPPING_MISSING`);
          warningCount += 1;
          continue;
        }
        const recovery = await resolveExistingLivePrice(stripe, price.code, productMapping.providerProductId, {
          amountMinor: price.amountMinor,
          currency: price.currency,
          billingInterval: price.billingInterval,
        });
        if (recovery.decision === "fail") {
          errors.push(`${entry.code}: ${recovery.code}`);
          warningCount += 1;
          continue;
        }
        const stripePrice = recovery.decision === "adopt"
          ? recovery.price
          : await stripe.prices.create(
              {
                product: productMapping.providerProductId,
                unit_amount: price.amountMinor,
                currency: price.currency.toLowerCase(),
                metadata: safeMetadata("price", price.code),
                ...(price.billingInterval === "ONE_TIME" ? {} : { recurring: { interval: price.billingInterval === "MONTH" ? "month" : "year" } }),
              },
              { idempotencyKey: idempotencyKey("PRICE", price.code) },
            );

        await persistChanges(async (tx) => {
          await createMapping(
            {
              provider: PROVIDER,
              environment: ENVIRONMENT,
              commerceProductId: product.id,
              commercePriceId: price.id,
              providerProductId: productMapping.providerProductId,
              providerPriceId: stripePrice.id,
              providerObjectType: "PRICE",
            },
            tx,
          );
        });
        pricesCreated += 1;
      } else if (entry.action === "REACTIVATE") {
        const mapping = await prisma.commerceProviderMapping.findFirst({ where: { provider: PROVIDER, environment: ENVIRONMENT, commercePriceId: price.id } });
        if (mapping?.providerPriceId) {
          await stripe.prices.update(mapping.providerPriceId, { active: true });
          await persistChanges(async (tx) => {
            await updateMappingState(mapping.id, { providerActive: true, synchronizationStatus: "SYNCED", lastSynchronizedAt: new Date() }, tx);
          });
          pricesReactivated += 1;
        }
      } else if (entry.action === "ARCHIVE") {
        const mapping = await prisma.commerceProviderMapping.findFirst({ where: { provider: PROVIDER, environment: ENVIRONMENT, commercePriceId: price.id } });
        if (mapping?.providerPriceId) {
          await stripe.prices.update(mapping.providerPriceId, { active: false });
          await persistChanges(async (tx) => {
            await updateMappingState(mapping.id, { providerActive: false, synchronizationStatus: "ARCHIVED", lastSynchronizedAt: new Date() }, tx);
          });
          pricesArchived += 1;
        }
      }
    } catch (error) {
      if (error instanceof ConflictError && error.code === "SYNC_ABORTED") throw error;
      const safe = mapStripeError(error);
      errors.push(`${entry.code}: ${safe.code}`);
      warningCount += 1;
    }
  }

  const status = errors.length === 0 ? "COMPLETED" : "COMPLETED_WITH_WARNINGS";

  const completed = await persistChanges(async (tx) => {
    return completeSyncRun(
      run.id,
      {
        status,
        productsCreated,
        productsUpdated,
        productsUnchanged: plan.productsUnchanged,
        productsArchived,
        pricesCreated: pricesCreated + pricesReactivated,
        pricesUnchanged: plan.pricesUnchanged,
        pricesArchived,
        blockedCount: plan.blockedCount,
        warningCount,
        safeErrorCode: errors.length > 0 ? "PARTIAL_SYNC_FAILURES" : null,
      },
      tx,
    );
  });

  await prisma.platformAuditLog.create({
    data: {
      actorUserId: actor.userId,
      actorPlatformRole: actor.platformRole,
      action: "commerce_stripe_live.synchronize",
      targetType: "CommerceSyncRun",
      targetId: completed.id,
      requestMetadataJson: requestMetadataJson(requestMetadata),
      afterJson: { productsCreated, productsUpdated, productsArchived, pricesCreated, pricesReactivated, pricesArchived, warningCount },
    },
  });

  return { run: toSyncRunDTO(completed), pricesReactivated, errors };
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
  let skipped = 0;
  const drift: { mappingId: string; providerObjectType: "PRODUCT" | "PRICE"; code: string; field: string; internalValue: string; providerValue: string }[] = [];

  for (const mapping of mappings) {
    try {
      if (mapping.providerObjectType === "PRODUCT") {
        const product = productById.get(mapping.commerceProductId);
        const stripeProduct = await stripe.products.retrieve(mapping.providerProductId);
        const fieldDrift: typeof drift = [];
        if (product && stripeProduct.name !== product.name) fieldDrift.push({ mappingId: mapping.id, providerObjectType: "PRODUCT", code: product.code, field: "name", internalValue: product.name, providerValue: stripeProduct.name });
        // STRIPE-COMMERCIAL-14 — "desired" active state is not raw
        // CommerceProduct.isActive; a product with zero currently-eligible
        // live prices should be represented as inactive in Stripe even if
        // isActive itself is still true (mirrors buildLiveSyncPlan's own
        // CREATE/UPDATE-vs-ARCHIVE decision, computed identically here via
        // productHasEligibleLivePrice so the two can never disagree).
        if (product) {
          const desiredActive = product.isActive && productHasEligibleLivePrice(product);
          if (stripeProduct.active !== desiredActive) {
            fieldDrift.push({ mappingId: mapping.id, providerObjectType: "PRODUCT", code: product.code, field: "active", internalValue: String(desiredActive), providerValue: String(stripeProduct.active) });
          }
        }
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
        // STRIPE-COMMERCIAL-14 — a manually deactivated Stripe Price (e.g.
        // toggled off directly in the Stripe Dashboard) must never verify as
        // SYNCED just because amount/currency/interval still match; a
        // checkout-options caller relies on synchronizationStatus === SYNCED
        // to decide whether the "Subscribe" button is real.
        if (product && price) {
          const desiredActive = classifyLiveCheckoutEligibility(product, price).eligible;
          if (stripePrice.active !== desiredActive) {
            fieldDrift.push({ mappingId: mapping.id, providerObjectType: "PRICE", code: price.code, field: "active", internalValue: String(desiredActive), providerValue: String(stripePrice.active) });
          }
        }
        drift.push(...fieldDrift);
        await updateMappingState(mapping.id, { lastVerifiedAt: new Date(), synchronizationStatus: fieldDrift.length > 0 ? "DRIFTED" : "SYNCED" });
      } else {
        // A PRICE mapping missing commercePriceId or providerPriceId cannot
        // be checked against Stripe at all — never count it as verified, and
        // record it as an explicit error state rather than leaving it
        // silently stale, so its lastVerifiedAt/synchronizationStatus never
        // read as "checked and fine".
        skipped += 1;
        await updateMappingState(mapping.id, { lastVerifiedAt: new Date(), synchronizationStatus: "ERROR", lastErrorCode: "PRICE_MAPPING_INCOMPLETE" });
        continue;
      }
      verified += 1;
    } catch {
      errored += 1;
      await updateMappingState(mapping.id, { synchronizationStatus: "ERROR", lastErrorCode: "STRIPE_OBJECT_UNREACHABLE" });
    }
  }

  const run = await createSyncRun({ provider: PROVIDER, environment: ENVIRONMENT, operation: "VERIFY", initiatedByUserId: actor.userId, dryRun: false, catalogueFingerprint: computeLiveCatalogueFingerprint(products) });
  const completed = await completeSyncRun(run.id, {
    status: errored > 0 || skipped > 0 ? "COMPLETED_WITH_WARNINGS" : "COMPLETED",
    productsCreated: 0,
    productsUpdated: 0,
    productsUnchanged: verified,
    productsArchived: 0,
    pricesCreated: 0,
    pricesUnchanged: 0,
    pricesArchived: 0,
    blockedCount: 0,
    warningCount: errored + skipped,
  });

  await prisma.platformAuditLog.create({
    data: {
      actorUserId: actor.userId,
      actorPlatformRole: actor.platformRole,
      action: "commerce_stripe_live.verify",
      targetType: "CommerceSyncRun",
      targetId: completed.id,
      requestMetadataJson: requestMetadataJson(requestMetadata),
      afterJson: { verified, errored, skipped, driftCount: drift.length },
    },
  });

  return { run: toSyncRunDTO(completed), verified, errored, skipped, drift };
}

export async function listLiveStripeSyncHistory(actor: PlatformActor, limit = 50) {
  requireOwner(actor);
  const rows = await listSyncRuns(PROVIDER, ENVIRONMENT, limit);
  return rows.map(toSyncRunDTO);
}
