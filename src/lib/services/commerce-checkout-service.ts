import { ensureEnterpriseSelfCheckoutPriceReady } from "@/lib/services/enterprise-self-checkout-readiness-service";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import type { CommerceProviderEnvironment, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { AppError } from "@/lib/errors/app-error";
import {
  getConfiguredStripeMode,
  getStripeCommercialClient,
  StripeInvalidKeyError,
  StripeNotConfiguredError,
} from "@/lib/payments/stripe-client";
import { findMappingByProviderPriceId, findPriceMapping } from "@/lib/repositories/commerce-provider-mapping-repository";
import { generateBoqCommercialManifest } from "@/lib/services/commercial-entitlement-service";
import {
  createStripeBillingCustomer,
  findStripeBillingCustomer,
} from "@/lib/repositories/stripe-billing-repository";
import { isTayqanProductCode, TAYQAN_PRODUCT_FAMILY } from "@/lib/tayqan/tayqan-commerce";

/**
 * STRIPE-COMMERCIAL-2 — server-side checkout. The browser sends only a
 * trusted internal `priceCode`; every other fact (amount, currency, Stripe
 * price ID, company identity) is resolved here from server-controlled state.
 * Never accept amount/currency/providerPriceId/companyId/metadata from the
 * request body — see createCommerceCheckoutSession's single input field.
 *
 * STRIPE-COMMERCIAL-7 — one-time fulfillment (BOQ/report export unlocks, AI
 * credit packs, bundles, ...) is not implemented anywhere in this codebase:
 * no webhook path grants a one-time entitlement, no ledger consumes an AI
 * credit. Until that genuinely exists, self-checkout accepts SUBSCRIPTION
 * products with a MONTH/YEAR price only — a customer must never be charged
 * for a one-time product that nothing will ever fulfill.
 */

export const SUPPORTED_CHECKOUT_CURRENCIES = new Set(["AED"]);
/** Deliberately MONTH/YEAR only — see the STRIPE-COMMERCIAL-7 note above. Exported so commerce-checkout-availability-service.ts applies the identical filter when reporting availability to the UI. */
export const CHECKOUT_ELIGIBLE_INTERVALS = new Set(["MONTH", "YEAR"]);
/** Non-final CompanySoftwareSubscription statuses — a company with one of these already has a live-or-pending Stripe subscription and must use the billing portal, not start a second checkout. Only CANCELLED/EXPIRED subscriptions may be superseded by a fresh checkout. */
export const NON_FINAL_SUBSCRIPTION_STATUSES = ["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED"] as const;

const ENTERPRISE_ONE_TIME_PRICE_SPECS = {
  enterprise_core_one_time_aed_15000: { productCode: "enterprise_core", amountMinor: 1_500_000 },
  enterprise_scale_one_time_aed_25000: { productCode: "enterprise_scale", amountMinor: 2_500_000 },
  enterprise_authority_one_time_aed_35000: { productCode: "enterprise_authority", amountMinor: 3_500_000 },
} as const;

function isEnterpriseOneTimePrice(price: {
  code: string;
  amountMinor: number;
  currency: string;
  billingInterval: string;
  isFromPrice: boolean;
  product: { code: string; type: string };
}): boolean {
  const spec = ENTERPRISE_ONE_TIME_PRICE_SPECS[
    price.code as keyof typeof ENTERPRISE_ONE_TIME_PRICE_SPECS
  ];
  return Boolean(
    spec &&
      price.product.code === spec.productCode &&
      price.product.type === "ONE_TIME" &&
      price.amountMinor === spec.amountMinor &&
      price.currency === "AED" &&
      price.billingInterval === "ONE_TIME" &&
      !price.isFromPrice,
  );
}

export type CheckoutPriceRejectionReason =
  | "PRICE_NOT_FOUND"
  | "PRODUCT_INACTIVE"
  | "PRODUCT_NOT_PUBLIC"
  | "PRODUCT_NOT_DIRECT_PURCHASE"
  | "PRODUCT_NOT_SUBSCRIPTION"
  | "PRICE_INACTIVE"
  | "PRICE_NOT_APPROVED"
  | "ZERO_OR_NEGATIVE_AMOUNT"
  | "UNSUPPORTED_CURRENCY"
  | "UNSUPPORTED_INTERVAL"
  | "PROVIDER_MAPPING_MISSING"
  | "PROVIDER_MAPPING_NOT_SYNCED";

export class CheckoutNotEligibleError extends AppError {
  readonly reason: CheckoutPriceRejectionReason;
  constructor(reason: CheckoutPriceRejectionReason, message: string) {
    super("CHECKOUT_PRICE_NOT_ELIGIBLE", message, 409);
    this.name = "CheckoutNotEligibleError";
    this.reason = reason;
  }
}

/** STRIPE-COMMERCIAL-6 — a company must not be able to pay for two subscriptions simultaneously (e.g. Starter + Professional). Thrown before a Checkout Session is created; the route surfaces this as a safe, machine-readable code the UI maps to "Manage Billing" instead of a generic failure. */
export class ExistingSubscriptionError extends AppError {
  constructor() {
    super(
      "CHECKOUT_EXISTING_SUBSCRIPTION",
      "This company already has an active or pending subscription. Manage it from the billing portal instead of starting a new checkout.",
      409,
    );
    this.name = "ExistingSubscriptionError";
  }
}

/**
 * CORRECTION-1 — distinct from ExistingSubscriptionError: thrown only when
 * the company already owns THIS EXACT Industry Library package. A different
 * library, a core software subscription, or a TAYQAN hire never triggers
 * this — see classifyCommerceProductFamily and its call sites below.
 */
export class DuplicatePackageSubscriptionError extends AppError {
  constructor() {
    super(
      "CHECKOUT_ALREADY_OWNS_PACKAGE",
      "This company already has an active or pending subscription to this library. Manage it from the billing portal instead of starting a new checkout.",
      409,
    );
    this.name = "DuplicatePackageSubscriptionError";
  }
}

/**
 * CORRECTION-1 — the three mutually-exclusive commercial "families" a
 * CommerceProduct belongs to, replacing the old binary
 * "industryPackageId === null means core software" check. That binary check
 * was correct for library-vs-core, but silently misclassified every TAYQAN
 * product (tayqan_monthly is `type: "SUBSCRIPTION"`, `purchaseMode:
 * "DIRECT"`, and — like every core software tier — has no industryPackageId)
 * as CORE_SOFTWARE. TAYQAN is governed entirely by its own checkout/
 * entitlement logic (tayqan-checkout-service.ts) and must never be treated
 * as interchangeable with a core software subscription by this file's
 * existing-subscription rules in either direction.
 *
 * Intended coexistence rules (see createCommerceCheckoutSession and
 * getCheckoutAvailability, which both branch on this classification):
 *  - CORE_SOFTWARE: at most ONE active/pending core software subscription
 *    per company (Starter/Professional/Business/Enterprise Core/Scale/
 *    Authority — never TAYQAN, never a library).
 *  - INDUSTRY_LIBRARY: any number of DIFFERENT libraries may coexist with
 *    each other, with a core software subscription, and with TAYQAN — but
 *    the SAME library must never be purchased twice.
 *  - TAYQAN: a separate product family entirely; never blocked by, and
 *    never blocks, a core software or library purchase through this file.
 */
export type CommerceProductFamily = "CORE_SOFTWARE" | "INDUSTRY_LIBRARY" | "TAYQAN";

export function classifyCommerceProductFamily(product: { code: string; industryPackageId: string | null }): CommerceProductFamily {
  if (product.industryPackageId) return "INDUSTRY_LIBRARY";
  if (isTayqanProductCode(product.code)) return "TAYQAN";
  return "CORE_SOFTWARE";
}

export function resolveCheckoutEnvironment(): CommerceProviderEnvironment {
  return getConfiguredStripeMode() === "live" ? "LIVE" : "TEST";
}

/** v5 — exported (behavior unchanged) so the sales-led Enterprise checkout path resolves the commercial Stripe client through the identical mode/key-validated entry point, including the same safe 503 on a misconfigured key. */
export function resolveCommercialStripeClient(overrideClient?: Stripe): Stripe {
  try {
    return getStripeCommercialClient(overrideClient);
  } catch (error) {
    if (error instanceof StripeNotConfiguredError || error instanceof StripeInvalidKeyError) {
      throw new AppError("STRIPE_NOT_CONFIGURED", "Checkout is not available right now.", 503);
    }
    throw error;
  }
}

/** Absolute, http(s), and https-only when this checkout is live-mode. Never trusts a request header for the base URL. */
export function validateAppBaseUrl(liveMode: boolean): string {
  const raw = process.env.APP_BASE_URL?.trim();
  if (!raw) {
    throw new AppError("APP_BASE_URL_NOT_CONFIGURED", "The application base URL is not configured.", 500);
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new AppError("APP_BASE_URL_INVALID", "The configured application base URL is not a valid absolute URL.", 500);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AppError("APP_BASE_URL_INVALID", "The configured application base URL must use http or https.", 500);
  }
  if (liveMode && parsed.protocol !== "https:") {
    throw new AppError("APP_BASE_URL_INVALID", "The configured application base URL must use https for live checkout.", 500);
  }

  return raw.replace(/\/+$/, "");
}

/**
 * Every check a price/product must pass before a customer can self-checkout
 * it. Mirrors (and must stay in lockstep with) the availability logic in
 * commerce-checkout-availability-service.ts, which reports these same facts
 * to the UI without exposing Stripe price IDs.
 */
async function loadEligibleCommercePrice(priceCode: string) {
  const price = await prisma.commercePrice.findUnique({
    where: { code: priceCode },
    include: { product: true },
  });

  if (!price) throw new CheckoutNotEligibleError("PRICE_NOT_FOUND", "This price is not available for checkout.");
  if (!price.product.isActive) throw new CheckoutNotEligibleError("PRODUCT_INACTIVE", "This product is not currently available.");
  if (!price.product.isPublic) throw new CheckoutNotEligibleError("PRODUCT_NOT_PUBLIC", "This product is not available for self-checkout.");
  if (price.product.purchaseMode !== "DIRECT") {
    throw new CheckoutNotEligibleError("PRODUCT_NOT_DIRECT_PURCHASE", "This product requires contacting sales and cannot be checked out directly.");
  }
  const isEnterprise = isEnterpriseOneTimePrice(price);
  if (price.product.type !== "SUBSCRIPTION" && !isEnterprise) {
    throw new CheckoutNotEligibleError("PRODUCT_NOT_SUBSCRIPTION", "Only subscription products can be checked out directly right now.");
  }
  if (!price.isActive) throw new CheckoutNotEligibleError("PRICE_INACTIVE", "This price is no longer active.");
  if (price.reviewStatus !== "APPROVED") throw new CheckoutNotEligibleError("PRICE_NOT_APPROVED", "This price has not been approved for checkout.");
  if (price.isFromPrice) throw new CheckoutNotEligibleError("PRICE_NOT_APPROVED", "This price is an indicative amount and cannot be checked out directly.");
  if (price.amountMinor <= 0) throw new CheckoutNotEligibleError("ZERO_OR_NEGATIVE_AMOUNT", "This price is not checkout-eligible.");
  if (!SUPPORTED_CHECKOUT_CURRENCIES.has(price.currency)) throw new CheckoutNotEligibleError("UNSUPPORTED_CURRENCY", "This price's currency is not supported for checkout.");
  if (!isEnterprise && !CHECKOUT_ELIGIBLE_INTERVALS.has(price.billingInterval)) {
    throw new CheckoutNotEligibleError("UNSUPPORTED_INTERVAL", "One-time purchases are not yet available for checkout.");
  }

  return price;
}

async function resolveProviderPriceMapping(environment: CommerceProviderEnvironment, commercePriceId: string) {
  const mapping = await findPriceMapping("STRIPE", environment, commercePriceId);
  if (!mapping || !mapping.providerPriceId) {
    throw new CheckoutNotEligibleError("PROVIDER_MAPPING_MISSING", "This price is not yet available for checkout.");
  }
  if (!mapping.providerActive || mapping.synchronizationStatus !== "SYNCED") {
    throw new CheckoutNotEligibleError("PROVIDER_MAPPING_NOT_SYNCED", "This price is not currently available for checkout.");
  }
  return mapping;
}

type CompanySubscriptionClient = Pick<Prisma.TransactionClient, "companySoftwareSubscription">;
type CompanyPackageSubscriptionClient = Pick<Prisma.TransactionClient, "companyPackageSubscription">;

/** Exported so commerce-checkout-availability-service.ts can report the same "already subscribed" fact to the UI without duplicating this query. Accepts an optional transaction client so the per-company-lock recheck in createCommerceCheckoutSession reads through the SAME transaction, not a separate connection. Inherently CORE_SOFTWARE-only: the webhook (stripe-webhook-service.ts's applyCurrentSubscriptionState) only ever writes a CompanySoftwareSubscription row for a product with no industryPackageId AND a resolvable commerce-plan-mapping.ts entry — TAYQAN products have no such entry, so this never fires for TAYQAN either. */
export async function hasNonFinalStripeSubscription(companyId: string, client: CompanySubscriptionClient = prisma): Promise<boolean> {
  const existing = await client.companySoftwareSubscription.findFirst({
    where: {
      companyId,
      source: { in: ["stripe", "stripe_enterprise_one_time"] },
      status: { in: [...NON_FINAL_SUBSCRIPTION_STATUSES] },
    },
    select: { id: true },
  });
  return existing !== null;
}

/** STRIPE-COMMERCIAL-6 — a company cannot start a second CORE_SOFTWARE subscription checkout while a non-final Stripe subscription already exists (see NON_FINAL_SUBSCRIPTION_STATUSES). A CANCELLED/EXPIRED subscription never blocks a fresh checkout. */
async function assertNoExistingNonFinalSubscription(companyId: string, client: CompanySubscriptionClient = prisma): Promise<void> {
  if (await hasNonFinalStripeSubscription(companyId, client)) throw new ExistingSubscriptionError();
}

/**
 * CORRECTION-1 — the INDUSTRY_LIBRARY equivalent of hasNonFinalStripeSubscription
 * above, scoped to one exact package: a company may hold any number of
 * DIFFERENT non-final CompanyPackageSubscription rows at once (different
 * libraries coexist freely), so this only blocks a repurchase of the SAME
 * industryPackageId, never a different one.
 *
 * item-C (Round 3 correction) — deliberately NOT filtered by
 * `source: "stripe"`. "Already owns this package" must be true regardless
 * of HOW the entitlement was granted — an owner/admin-granted
 * `platform_owner_activation` row (see master-catalogue-activation-service.ts)
 * means the company owns this library exactly as much as a Stripe-purchased
 * one does, and must block a duplicate Stripe charge for the same
 * industryPackageId. Any non-final status for this exact packageId, from any
 * source, is blocking.
 */
async function hasNonFinalPackageSubscription(
  companyId: string,
  industryPackageId: string,
  client: CompanyPackageSubscriptionClient = prisma,
): Promise<boolean> {
  const existing = await client.companyPackageSubscription.findFirst({
    where: { companyId, packageId: industryPackageId, status: { in: [...NON_FINAL_SUBSCRIPTION_STATUSES] } },
    select: { id: true },
  });
  return existing !== null;
}

/** CORRECTION-1 — blocks only a repurchase of the SAME library a company already holds; a different library, a core software subscription, or TAYQAN never trips this. */
async function assertNoExistingNonFinalPackageSubscription(
  companyId: string,
  industryPackageId: string,
  client: CompanyPackageSubscriptionClient = prisma,
): Promise<void> {
  if (await hasNonFinalPackageSubscription(companyId, industryPackageId, client)) throw new DuplicatePackageSubscriptionError();
}

/**
 * STRIPE-COMMERCIAL-11 — the DB-only check above cannot protect the window
 * between a Checkout Session being created and the webhook that eventually
 * records a CompanySoftwareSubscription/CompanyPackageSubscription row for
 * it (webhook delivery is asynchronous and can lag by seconds to minutes).
 * This asks Stripe itself, which is authoritative immediately. `canceled`
 * and `incomplete_expired` are the only two genuinely terminal Stripe
 * subscription statuses — every other value (including any future status
 * Stripe might add) is treated as blocking, deliberately failing closed
 * rather than open.
 *
 * STRIPE-COMMERCIAL-16 — walks every page of the customer's subscriptions
 * rather than inspecting only the first (a customer with a long history of
 * canceled subscriptions could otherwise push a genuinely blocking one past
 * page 1). A provider/network error mid-pagination fails closed — treated
 * as "cannot rule out an existing subscription", never as "none found".
 *
 * CORRECTION-1 — this used to treat ANY non-terminal Stripe subscription on
 * the customer as blocking, regardless of what product it was for. That
 * meant an existing Industry Library (or TAYQAN Monthly) Stripe subscription
 * could block a company from ever completing a CORE_SOFTWARE checkout, and
 * vice versa — the Stripe-side check was not family-aware even after the
 * DB-side check (assertNoExistingNonFinalSubscription) was scoped correctly.
 * classifySubscriptionForBlocking below resolves each subscription's
 * item(s) back to their CommerceProduct via the same provider-mapping table
 * the webhook uses, then hasBlockingStripeSubscription only counts a
 * subscription as blocking when it matches the REQUESTED purchase's target
 * family (and, for a library purchase, the exact industryPackageId).
 * A subscription whose price cannot be resolved (no mapping, deleted
 * product, etc.) is treated as CORE_SOFTWARE for blocking purposes — failing
 * closed exactly as before this fix for a CORE_SOFTWARE request — but is
 * NEVER treated as a match for a specific library, so an unclassifiable
 * subscription can never incorrectly block a library purchase (the one
 * failure mode that actually caused customer-facing bugs).
 */
const NON_BLOCKING_STRIPE_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>(["canceled", "incomplete_expired"]);

export type CheckoutSubscriptionTarget =
  | { family: "CORE_SOFTWARE" }
  | { family: "INDUSTRY_LIBRARY"; industryPackageId: string };

type SubscriptionBlockingClassification = {
  /** True if any item on this subscription is CORE_SOFTWARE, or could not be classified at all (fail closed). */
  matchesCoreSoftware: boolean;
  /** industryPackageId(s) this subscription's items resolve to, if any. */
  libraryPackageIds: Set<string>;
};

type ResolvedSubscriptionPriceProduct = {
  code: string;
  industryPackageId: string | null;
} | null;

async function classifySubscriptionForBlocking(
  environment: CommerceProviderEnvironment,
  subscription: Pick<Stripe.Subscription, "items">,
  resolvedProductCache: Map<string, ResolvedSubscriptionPriceProduct>,
): Promise<SubscriptionBlockingClassification> {
  const items = subscription.items?.data ?? [];
  if (items.length === 0) {
    // No item data to classify (e.g. a status-only subscription object) —
    // fail closed for a CORE_SOFTWARE request, exactly as this function's
    // predecessor did unconditionally; never treated as a library match.
    return { matchesCoreSoftware: true, libraryPackageIds: new Set() };
  }

  let matchesCoreSoftware = false;
  const libraryPackageIds = new Set<string>();

  for (const item of items) {
    const providerPriceId = item.price?.id;
    if (!providerPriceId) {
      matchesCoreSoftware = true;
      continue;
    }

    let resolvedProduct: ResolvedSubscriptionPriceProduct;

    if (resolvedProductCache.has(providerPriceId)) {
      // `has` distinguishes a cached unresolved/null result from a cache miss.
      resolvedProduct = resolvedProductCache.get(providerPriceId) ?? null;
    } else {
      const mapping = await findMappingByProviderPriceId("STRIPE", environment, providerPriceId);
      const commercePrice = mapping?.commercePriceId
        ? await prisma.commercePrice.findUnique({
            where: { id: mapping.commercePriceId },
            select: {
              product: {
                select: {
                  code: true,
                  industryPackageId: true,
                },
              },
            },
          })
        : null;

      resolvedProduct = commercePrice?.product ?? null;

      // Cache both successful resolutions and unresolved/null results so a
      // customer with repeated subscription items on the same Stripe price
      // does not repeat database lookups while the checkout transaction and
      // per-company advisory lock are held.
      resolvedProductCache.set(providerPriceId, resolvedProduct);
    }

    if (!resolvedProduct) {
      matchesCoreSoftware = true; // unmapped/unresolvable — fail closed as core-blocking, never as a library match.
      continue;
    }

    const family = classifyCommerceProductFamily(resolvedProduct);
    if (family === "CORE_SOFTWARE") {
      matchesCoreSoftware = true;
    } else if (family === "INDUSTRY_LIBRARY" && resolvedProduct.industryPackageId) {
      libraryPackageIds.add(resolvedProduct.industryPackageId);
    }
    // TAYQAN family items are neither core-blocking nor library-blocking — deliberately ignored.
  }

  return { matchesCoreSoftware, libraryPackageIds };
}

/**
 * v5 — exported (behavior unchanged) so the sales-led Enterprise checkout
 * path (enterprise-sales-checkout-service.ts) reuses this exact, already-
 * hardened, family-aware, fail-closed Stripe-side check instead of
 * reimplementing it. Enterprise is CORE_SOFTWARE (no industryPackageId, not
 * a TAYQAN code — see classifyCommerceProductFamily), so it passes
 * `{ family: "CORE_SOFTWARE" }` exactly as self-serve core checkout does.
 */
export async function hasBlockingStripeSubscription(
  stripe: Stripe,
  stripeCustomerId: string,
  environment: CommerceProviderEnvironment,
  target: CheckoutSubscriptionTarget,
): Promise<boolean> {
  const resolvedProductCache = new Map<string, ResolvedSubscriptionPriceProduct>();
  let startingAfter: string | undefined;
  for (;;) {
    let page: Stripe.ApiList<Stripe.Subscription>;
    try {
      page = await stripe.subscriptions.list({ customer: stripeCustomerId, status: "all", limit: 100, starting_after: startingAfter });
    } catch (error) {
      throw new AppError("STRIPE_SUBSCRIPTION_LOOKUP_FAILED", "Could not verify existing subscriptions with Stripe. Please try again.", 502);
    }
    for (const subscription of page.data) {
      if (NON_BLOCKING_STRIPE_SUBSCRIPTION_STATUSES.has(subscription.status)) continue;
      const classification = await classifySubscriptionForBlocking(environment, subscription, resolvedProductCache);
      if (target.family === "CORE_SOFTWARE") {
        if (classification.matchesCoreSoftware) return true;
      } else if (classification.libraryPackageIds.has(target.industryPackageId)) {
        return true;
      }
    }
    if (!page.has_more || page.data.length === 0) return false;
    startingAfter = page.data[page.data.length - 1].id;
  }
}

async function assertNoExistingStripeSubscription(
  stripe: Stripe,
  stripeCustomerId: string,
  environment: CommerceProviderEnvironment,
  target: CheckoutSubscriptionTarget,
): Promise<void> {
  if (await hasBlockingStripeSubscription(stripe, stripeCustomerId, environment, target)) {
    throw target.family === "CORE_SOFTWARE" ? new ExistingSubscriptionError() : new DuplicatePackageSubscriptionError();
  }
}

/**
 * Lists Checkout Sessions this app created for the company, optionally
 * limited to open sessions. The unfiltered form gives core checkout one
 * provider snapshot in which an existing session is either open or complete,
 * so an open-to-complete transition cannot fall between two filtered calls.
 * Paginated and fail-closed on provider errors.
 *
 * item-B (Round 3 correction) — explicitly EXCLUDES TAYQAN-owned sessions
 * (quantara_product_family === TAYQAN_PRODUCT_FAMILY, set by
 * tayqan-checkout-service.ts's createTayqanCheckoutSession alongside its own
 * quantara_company_id). TAYQAN checkout sessions are only ever created,
 * reused, and expired by tayqan-checkout-service.ts's own
 * expireOtherTayqanSessions — a general commerce (core software / Industry
 * Library) checkout for the same company must never expire or reuse one.
 * Before this fix, a core/library checkout would see a TAYQAN session as
 * just another app-owned open session and expire it as "stale."
 */
async function findAppOwnedCheckoutSessions(
  stripe: Stripe,
  stripeCustomerId: string,
  companyId: string,
  status?: "open",
): Promise<Stripe.Checkout.Session[]> {
  const matches: Stripe.Checkout.Session[] = [];
  let startingAfter: string | undefined;
  for (;;) {
    let page: Stripe.ApiList<Stripe.Checkout.Session>;
    try {
      page = await stripe.checkout.sessions.list({
        customer: stripeCustomerId,
        ...(status ? { status } : { expand: ["data.payment_intent"] }),
        limit: 100,
        starting_after: startingAfter,
      });
    } catch (error) {
      throw new AppError("STRIPE_CHECKOUT_SESSION_LOOKUP_FAILED", "Could not verify existing checkout sessions with Stripe. Please try again.", 502);
    }
    for (const session of page.data) {
      if (session.metadata?.quantara_product_family === TAYQAN_PRODUCT_FAMILY) continue;
      if (session.metadata?.quantara_company_id === companyId) matches.push(session);
    }
    if (!page.has_more || page.data.length === 0) return matches;
    startingAfter = page.data[page.data.length - 1].id;
  }
}

export async function findAppOwnedOpenCheckoutSessions(
  stripe: Stripe,
  stripeCustomerId: string,
  companyId: string,
): Promise<Stripe.Checkout.Session[]> {
  return findAppOwnedCheckoutSessions(stripe, stripeCustomerId, companyId, "open");
}

/**
 * Closes the payment-to-webhook gap for Enterprise one-time purchases. A
 * completed paid (or still-processing delayed-method) Checkout Session is
 * already a financial commitment even if its entitlement webhook has not
 * committed yet. Terminally failed PaymentIntents do not block a retry.
 */
function hasBlockingEnterpriseCheckoutSession(sessions: Stripe.Checkout.Session[]): boolean {
  return sessions.some((session) => {
    const priceCode = session.metadata?.quantara_price_code;
    if (
      session.status !== "complete" ||
      session.mode !== "payment" ||
      session.metadata?.quantara_checkout_mode !== "ENTERPRISE_ONE_TIME" ||
      !priceCode ||
      !Object.prototype.hasOwnProperty.call(ENTERPRISE_ONE_TIME_PRICE_SPECS, priceCode)
    ) {
      return false;
    }
    if (session.payment_status === "paid") return true;

    const paymentIntent = typeof session.payment_intent === "object" ? session.payment_intent : null;
    return !paymentIntent || (paymentIntent.status !== "canceled" && paymentIntent.status !== "requires_payment_method");
  });
}

/**
 * STRIPE-COMMERCIAL-18 — a fixed, arbitrary int32 namespace, distinct from
 * STRIPE_WEBHOOK_LOCK_NAMESPACE in stripe-webhook-service.ts, so this app's
 * per-company checkout-creation lock can never collide with the
 * per-subscription webhook lock or any other advisory lock this codebase
 * might take. Combined with `hashtext(companyId)` via the two-argument
 * `pg_advisory_xact_lock(key1, key2)` overload.
 *
 * Serializes the entire "resolve customer, recheck for an existing
 * subscription/open session, reuse-or-expire-or-create" sequence for ONE
 * company, across every concurrent Node process/serverless instance — not
 * just within one. Two simultaneous requests for the SAME company (even for
 * two different prices, e.g. Starter + Professional) can never both pass
 * the checks before either session exists: whichever acquires the lock
 * second waits for the first to fully commit (create its session, or
 * discover and reuse an existing one) before it re-reads any state,
 * guaranteeing its recheck sees the first's result.
 */
const CHECKOUT_LOCK_NAMESPACE = 419_628_331;

/**
 * v5 — exported (behavior unchanged) so the sales-led Enterprise checkout
 * path takes the SAME per-company lock, on the SAME namespace, as self-serve
 * checkout. Using a distinct namespace (as TAYQAN deliberately does) would
 * defeat the purpose here: an operator-issued Enterprise session and a
 * customer-issued core software session for one company MUST contend, so
 * neither can pass its existing-subscription/open-session checks while the
 * other is mid-flight.
 */
export async function acquireCompanyCheckoutLock(tx: Prisma.TransactionClient, companyId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CHECKOUT_LOCK_NAMESPACE}, hashtext(${companyId}))`;
}

/**
 * Reuses the company's existing Stripe customer for the current mode, or
 * creates one. The Stripe-side create call still carries a deterministic
 * idempotency key (customer identity is a stable, permanent fact about a
 * company+mode, unlike a one-shot Checkout Session — see the note on
 * randomUUID() at the call site below) so a request racing this one before
 * the per-company lock existed, or a raw network retry, resolves to the
 * *same* Stripe customer object; the DB-level unique(companyId, livemode)
 * constraint (via createStripeBillingCustomer's catch-and-refetch) then
 * guarantees only one StripeBillingCustomer row survives regardless.
 */
/**
 * v5 — the company-scoped form of the customer resolution below, extracted
 * verbatim (no logic change) and exported so the sales-led Enterprise
 * checkout path resolves/creates the SAME single Quantara-owned
 * StripeBillingCustomer row this app has always used, rather than
 * reimplementing customer creation a third time.
 *
 * This is the ONLY reason a manually issued Enterprise checkout can be
 * fulfilled automatically: stripe-webhook-service.ts's
 * applyCurrentSubscriptionState resolves tenant identity exclusively by
 * looking the subscription's Stripe customer ID up in StripeBillingCustomer.
 * A Stripe-Dashboard-created Payment Link that mints its own new Customer
 * has no such row, so its payment can never be attributed to a company — the
 * exact "customer paid, entitlement never granted" gap this path closes.
 *
 * `fallbackEmail` is the acting user's email for self-serve checkout (where a
 * real human is present) and null for the operator-issued Enterprise path,
 * where attaching the platform operator's own address to the CUSTOMER'S
 * Stripe customer record would be wrong. Email is only ever a display field
 * on the Stripe customer here — it is never used to match, resolve, or
 * authorize a tenant anywhere in this codebase.
 */
export async function getOrCreateStripeCustomerForCompanyId(
  stripe: Stripe,
  companyId: string,
  fallbackEmail: string | null,
  livemode: boolean,
  tx: Prisma.TransactionClient,
): Promise<string> {
  const existing = await findStripeBillingCustomer(companyId, livemode, tx);
  if (existing) return existing.stripeCustomerId;

  const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
  const stripeCustomer = await stripe.customers.create(
    {
      name: company.legalName,
      email: company.email || fallbackEmail || undefined,
      metadata: { quantara_company_id: companyId },
    },
    { idempotencyKey: `quantara:${livemode ? "live" : "test"}:customer:${companyId}` },
  );

  const created = await createStripeBillingCustomer(companyId, stripeCustomer.id, livemode, tx);
  return created.stripeCustomerId;
}

async function getOrCreateStripeCustomerForCompany(
  stripe: Stripe,
  actor: CurrentActor,
  livemode: boolean,
  tx: Prisma.TransactionClient,
): Promise<string> {
  return getOrCreateStripeCustomerForCompanyId(stripe, actor.companyId, actor.email, livemode, tx);
}

export type CreateCheckoutSessionInput = {
  checkoutMode?: "SUBSCRIPTION" | "BOQ_UNLOCK";
  priceCode?: string;
  boqId?: string;
  revisionNumber?: number;
  billingInterval?: "MONTH" | "YEAR";
};
export type CreateCheckoutSessionResult = { checkoutSessionId: string; checkoutUrl: string };

export async function createCommerceCheckoutSession(
  actor: CurrentActor,
  input: CreateCheckoutSessionInput,
  overrideClient?: Stripe,
): Promise<CreateCheckoutSessionResult> {
  const environment = resolveCheckoutEnvironment();
  const liveMode = environment === "LIVE";
  const stripe = resolveCommercialStripeClient(overrideClient);
  const baseUrl = validateAppBaseUrl(liveMode);

  /**
   * MARKETPLACE-FIX-3 — checkoutMode defaults to "SUBSCRIPTION" in the
   * request schema (commerce-schema.ts), never inferred from boqId's
   * presence, so this checks the field explicitly. Dispatched before the
   * SUBSCRIPTION-only eligibility checks below (loadEligibleCommercePrice/
   * resolveProviderPriceMapping) — those must never run for a BOQ_UNLOCK
   * request, which has no priceCode at all.
   */
  if (input.checkoutMode === "BOQ_UNLOCK") {
    return handleBoqUnlockCheckoutSession(actor, input, stripe, environment, liveMode, baseUrl);
  }

  // Global catalog validation — not company-specific, so it doesn't need the
  // per-company lock below. Never trusts client-supplied amount/currency/
  // providerPriceId; both are resolved purely from the trusted priceCode.
  const price = await loadEligibleCommercePrice(input.priceCode!);
  // Eligibility and governed approval are checked before readiness performs
  // any Stripe or provider-mapping write.
  await ensureEnterpriseSelfCheckoutPriceReady(price.code, stripe);
  const purchaseFamily = classifyCommerceProductFamily(price.product);
  const isEnterprise = isEnterpriseOneTimePrice(price);

  // TAYQAN has its own governed checkout and entitlement lifecycle.
  // Never allow a TAYQAN product through the generic commerce checkout.
  if (purchaseFamily === "TAYQAN") {
    throw new CheckoutNotEligibleError(
      "PRODUCT_NOT_DIRECT_PURCHASE",
      "TAYQAN hires use their dedicated checkout path and cannot be purchased through general commerce checkout.",
    );
  }

  const mapping = await resolveProviderPriceMapping(environment, price.id);

  /**
   * STRIPE-COMMERCIAL-18 — everything from here on is serialized per company
   * by acquireCompanyCheckoutLock, and every check is RE-DONE after
   * acquiring the lock (never trusts a pre-lock read): two concurrent
   * requests for the same company — even for two different prices, e.g.
   * Starter and Professional, or monthly and annual — can no longer both
   * pass the subscription/session checks before either session exists.
   * Whichever request acquires the lock second waits for the first's
   * transaction to fully commit, then re-reads Stripe/DB state that already
   * reflects the first's outcome.
   */
  /**
   * CORRECTION-1 — STRIPE-COMMERCIAL-6's "no two simultaneous subscriptions"
   * rule was written with only core software tiers in mind (its own comment
   * says "e.g. Starter + Professional") but the DB/Stripe checks below
   * originally ran unconditionally for every SUBSCRIPTION-typed price —
   * which also matches every Industry Library add-on and TAYQAN Monthly
   * (all `type: "SUBSCRIPTION"`). classifyCommerceProductFamily resolves
   * the REQUESTED purchase's family once here, and every check below is
   * scoped to that family:
   *  - CORE_SOFTWARE: blocked by an existing non-final core subscription
   *    (DB row or Stripe-side, family-aware) — unchanged rule, now correctly
   *    excludes TAYQAN and library subscriptions from ever triggering it.
   *  - INDUSTRY_LIBRARY: never blocked by a core subscription or a
   *    DIFFERENT library; blocked only by an existing non-final subscription
   *    for the SAME industryPackageId (DB row, or a Stripe-side subscription
   *    for that same package still awaiting its webhook).
   *  - TAYQAN never reaches this function (createTayqanCheckoutSession is
   *    an entirely separate code path) — no case is needed, but the target
   *    resolution below leaves it uncheck-ed rather than silently matching
   *    CORE_SOFTWARE, in case that ever changes.
   */
  const checkoutTarget: CheckoutSubscriptionTarget =
    purchaseFamily === "CORE_SOFTWARE"
      ? { family: "CORE_SOFTWARE" }
      : { family: "INDUSTRY_LIBRARY", industryPackageId: price.product.industryPackageId! };

  return prisma.$transaction(
    async (tx) => {
      await acquireCompanyCheckoutLock(tx, actor.companyId);

      if (checkoutTarget.family === "CORE_SOFTWARE") {
        await assertNoExistingNonFinalSubscription(actor.companyId, tx);
      } else {
        await assertNoExistingNonFinalPackageSubscription(actor.companyId, checkoutTarget.industryPackageId, tx);
      }
      const stripeCustomerId = await getOrCreateStripeCustomerForCompany(stripe, actor, liveMode, tx);

      // Stripe-side checks close the window the DB-only check above cannot: the
      // gap between session creation and the (asynchronous) webhook that would
      // otherwise be the only thing recording a CompanySoftwareSubscription/
      // CompanyPackageSubscription row. Family-aware and scoped identically to
      // the DB-only check above.
      await assertNoExistingStripeSubscription(stripe, stripeCustomerId, environment, checkoutTarget);

      const appOwnedSessions = checkoutTarget.family === "CORE_SOFTWARE"
        ? await findAppOwnedCheckoutSessions(stripe, stripeCustomerId, actor.companyId)
        : await findAppOwnedOpenCheckoutSessions(stripe, stripeCustomerId, actor.companyId);
      if (checkoutTarget.family === "CORE_SOFTWARE" && hasBlockingEnterpriseCheckoutSession(appOwnedSessions)) {
        throw new ExistingSubscriptionError();
      }
      const appOwnedOpenSessions = appOwnedSessions.filter(
        (session) => session.status === "open" || typeof session.status === "undefined",
      );

      /**
       * STRIPE-COMMERCIAL-21 — invariant: after this function returns
       * successfully, at most ONE Quantara-owned Checkout Session may be
       * open for this company. An app-owned open session is only ever a
       * reuse CANDIDATE when it is for THIS EXACT price (quantara_price_code
       * matches too, not just the company) and carries a URL — a Starter
       * session must never be handed back to a customer now requesting
       * Professional, or a monthly session to an annual request. At most one
       * candidate is chosen as the survivor; every OTHER app-owned open
       * session — whether a different price/interval, or a duplicate open
       * session for the SAME price — must be confirmed expired before this
       * function returns or creates anything. Never touches a session
       * lacking Quantara's own metadata — see findAppOwnedOpenCheckoutSessions.
       */
      const reusableIndex = appOwnedOpenSessions.findIndex(
        (session) => session.metadata?.quantara_price_code === price.code && Boolean(session.url),
      );
      const reusableSession = reusableIndex === -1 ? null : appOwnedOpenSessions[reusableIndex];
      const extraSessions = appOwnedOpenSessions.filter((_session, index) => index !== reusableIndex);

      /**
       * STRIPE-COMMERCIAL-19/21 — every extra open session (stale
       * different-price attempts AND duplicate same-price attempts beyond
       * the one chosen survivor) must be confirmed expired before either the
       * survivor is returned or a new session is created — never left open
       * to be discovered by a later request. If ANY expiry cannot be
       * confirmed, this fails closed: neither the survivor is returned nor a
       * new Checkout Session is created, and the caller must retry. The
       * alternative (returning/creating anyway) would risk leaving two
       * simultaneously-payable open sessions for the same company.
       */
      for (const extra of extraSessions) {
        try {
          await stripe.checkout.sessions.expire(extra.id);
        } catch (error) {
          console.error("[commerce-checkout] Failed to expire stale open Checkout Session", extra.id, error);
          throw new AppError(
            "STRIPE_STALE_SESSION_EXPIRE_FAILED",
            "Could not confirm cancellation of a previous checkout attempt. Please try again.",
            502,
          );
        }
      }

      if (reusableSession?.url) {
        return { checkoutSessionId: reusableSession.id, checkoutUrl: reusableSession.url };
      }

      const session = await stripe.checkout.sessions.create(
        {
          mode: isEnterprise ? "payment" : "subscription",
          customer: stripeCustomerId,
          line_items: [{ price: mapping.providerPriceId as string, quantity: 1 }],
          success_url: `${baseUrl}/settings/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl}/settings/subscription?checkout=cancelled`,
          client_reference_id: actor.companyId,
          metadata: {
              ...(isEnterprise ? { quantara_checkout_mode: "ENTERPRISE_ONE_TIME" } : {}),
            quantara_company_id: actor.companyId,
            quantara_price_code: price.code,
            quantara_environment: liveMode ? "live" : "test",
          },
          ...(isEnterprise ? { payment_intent_data: { metadata: { quantara_company_id: actor.companyId, quantara_price_code: price.code, quantara_checkout_mode: "ENTERPRISE_ONE_TIME" } } } : {
              subscription_data: {
                metadata: { quantara_company_id: actor.companyId, quantara_price_code: price.code },
              },
            }),
          },
        // STRIPE-COMMERCIAL-20 — a fresh, high-entropy key per genuine new
        // Checkout Session creation attempt, generated once for this
        // invocation and reused only if Stripe's own SDK internally retries
        // this exact request (a transport-level retry of the same call,
        // never a separate later attempt). Checkout creation is now
        // serialized per company above, so the old 5-minute-bucket
        // deterministic key is no longer needed to prevent a duplicate
        // session — and reusing a bucketed key across genuinely separate
        // attempts risked Stripe replaying an already-expired session
        // instead of creating the newly requested one.
        { idempotencyKey: randomUUID() },
      );

      if (!session.url) {
        throw new AppError("STRIPE_CHECKOUT_SESSION_NO_URL", "Stripe did not return a checkout URL.", 502);
      }

      return { checkoutSessionId: session.id, checkoutUrl: session.url! };
    },
    // Generous timeout: this transaction holds a per-company advisory lock
    // and makes several real Stripe API calls while open, not just DB writes.
    { maxWait: 10_000, timeout: 30_000 },
  );
}

export type CreateBillingPortalSessionResult = { portalUrl: string };

export async function createBillingPortalSession(
  actor: CurrentActor,
  overrideClient?: Stripe,
): Promise<CreateBillingPortalSessionResult> {
  const liveMode = resolveCheckoutEnvironment() === "LIVE";
  const stripe = resolveCommercialStripeClient(overrideClient);
  const baseUrl = validateAppBaseUrl(liveMode);

  const customer = await findStripeBillingCustomer(actor.companyId, liveMode);
  if (!customer) {
    throw new AppError("STRIPE_CUSTOMER_NOT_FOUND", "No billing record exists for this company yet.", 404);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.stripeCustomerId,
    return_url: `${baseUrl}/settings/subscription`,
  });

  return { portalUrl: session.url };
}


async function handleBoqUnlockCheckoutSession(
  actor: CurrentActor,
  input: CreateCheckoutSessionInput,
  stripe: Stripe,
  environment: CommerceProviderEnvironment,
  liveMode: boolean,
  baseUrl: string,
): Promise<CreateCheckoutSessionResult> {
  const { boqId, revisionNumber, billingInterval = "YEAR" } = input;
  if (!boqId || revisionNumber === undefined) {
    throw new AppError("INVALID_INPUT", "boqId and revisionNumber are required for BOQ unlocks.", 400);
  }

  const boq = await prisma.bOQ.findUnique({ where: { id: boqId } });
  if (!boq) throw new AppError("NOT_FOUND", "BOQ not found.", 404);

  const manifest = await generateBoqCommercialManifest(
    actor.companyId,
    boq.projectId,
    boq.id,
    revisionNumber,
    "BOQ",
    "PDF"
  );

  const unsatisfiedPackages = manifest.packageRequirements.filter((r) => !r.isSatisfied);
  if (unsatisfiedPackages.length === 0) {
    throw new AppError("BOQ_ALREADY_UNLOCKED", "This BOQ requires no additional commercial unlocks.", 400);
  }

  const packageIds = unsatisfiedPackages.map((p) => p.packageId);

  const products = await prisma.commerceProduct.findMany({
    where: { industryPackageId: { in: packageIds }, isActive: true, isPublic: true },
    include: { prices: { where: { isActive: true } } }
  });

  if (products.length !== packageIds.length) {
    throw new CheckoutNotEligibleError("PRODUCT_NOT_PUBLIC", "One or more required packages are not available for purchase.");
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const metadataMap: Record<string, string> = {
    quantara_checkout_mode: "BOQ_UNLOCK",
    quantara_boq_id: boqId,
    quantara_revision_number: revisionNumber.toString()
  };

  for (const product of products) {
    const price = product.prices.find((p) => p.billingInterval === billingInterval) || product.prices[0];
    if (!price) {
      throw new CheckoutNotEligibleError("PRICE_NOT_APPROVED", "PRICE SETUP PENDING: A required package is missing an approved price.");
    }
    const mapping = await prisma.commerceProviderMapping.findFirst({
      where: { environment, commercePriceId: price.id, providerObjectType: "PRICE" }
    });
    if (!mapping || mapping.synchronizationStatus !== "SYNCED") {
       throw new CheckoutNotEligibleError("PROVIDER_MAPPING_MISSING", "PRICE SETUP PENDING: Price not synced with Stripe.");
    }
    lineItems.push({ price: mapping.providerPriceId!, quantity: 1 });
  }

  return prisma.$transaction(async (tx) => {
    await acquireCompanyCheckoutLock(tx, actor.companyId);

    const stripeCustomerId = await getOrCreateStripeCustomerForCompany(stripe, actor, liveMode, tx);

    const appOwnedOpenSessions = await findAppOwnedOpenCheckoutSessions(stripe, stripeCustomerId, actor.companyId);
    for (const session of appOwnedOpenSessions) {
      try {
        await stripe.checkout.sessions.expire(session.id);
      } catch (e) {
        console.error("[commerce-checkout] Failed to expire stale open Checkout Session", session.id, e);
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: lineItems,
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout/cancel?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        quantara_company_id: actor.companyId,
        ...metadataMap
      }
    });

    // MARKETPLACE-FIX-3 — the sibling SUBSCRIPTION path explicitly checks
    // this before using session.url; this path was force-asserting it with
    // `!` instead, which would have silently returned checkoutUrl: undefined
    // (cast as string) on the documented, real edge case where Stripe
    // returns no URL.
    if (!session.url) {
      throw new AppError("STRIPE_CHECKOUT_SESSION_NO_URL", "Stripe did not return a checkout URL.", 502);
    }

    return { checkoutSessionId: session.id, checkoutUrl: session.url };
  },
  // MARKETPLACE-FIX-3 — this transaction holds the same per-company advisory
  // lock and makes several real Stripe API calls (session list, an expire
  // per stale session, then a create) while open, same as the SUBSCRIPTION
  // path above — it was missing the same generous timeout override, and
  // could plausibly exceed Prisma's 5s default with more than a couple of
  // stale sessions to expire.
  { maxWait: 10_000, timeout: 30_000 });
}
