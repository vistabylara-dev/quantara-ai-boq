import type Stripe from "stripe";
import type { CommerceProviderEnvironment } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { AppError } from "@/lib/errors/app-error";
import {
  getConfiguredStripeMode,
  getStripeCommercialClient,
  StripeInvalidKeyError,
  StripeNotConfiguredError,
} from "@/lib/payments/stripe-client";
import { findPriceMapping } from "@/lib/repositories/commerce-provider-mapping-repository";
import {
  createStripeBillingCustomer,
  findStripeBillingCustomer,
} from "@/lib/repositories/stripe-billing-repository";

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

export function resolveCheckoutEnvironment(): CommerceProviderEnvironment {
  return getConfiguredStripeMode() === "live" ? "LIVE" : "TEST";
}

function resolveCommercialStripeClient(overrideClient?: Stripe): Stripe {
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
  if (price.product.type !== "SUBSCRIPTION") {
    throw new CheckoutNotEligibleError("PRODUCT_NOT_SUBSCRIPTION", "Only subscription products can be checked out directly right now.");
  }
  if (!price.isActive) throw new CheckoutNotEligibleError("PRICE_INACTIVE", "This price is no longer active.");
  if (price.reviewStatus !== "APPROVED") throw new CheckoutNotEligibleError("PRICE_NOT_APPROVED", "This price has not been approved for checkout.");
  if (price.isFromPrice) throw new CheckoutNotEligibleError("PRICE_NOT_APPROVED", "This price is an indicative amount and cannot be checked out directly.");
  if (price.amountMinor <= 0) throw new CheckoutNotEligibleError("ZERO_OR_NEGATIVE_AMOUNT", "This price is not checkout-eligible.");
  if (!SUPPORTED_CHECKOUT_CURRENCIES.has(price.currency)) throw new CheckoutNotEligibleError("UNSUPPORTED_CURRENCY", "This price's currency is not supported for checkout.");
  if (!CHECKOUT_ELIGIBLE_INTERVALS.has(price.billingInterval)) {
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

/** Exported so commerce-checkout-availability-service.ts can report the same "already subscribed" fact to the UI without duplicating this query. */
export async function hasNonFinalStripeSubscription(companyId: string): Promise<boolean> {
  const existing = await prisma.companySoftwareSubscription.findFirst({
    where: { companyId, source: "stripe", status: { in: [...NON_FINAL_SUBSCRIPTION_STATUSES] } },
    select: { id: true },
  });
  return existing !== null;
}

/** STRIPE-COMMERCIAL-6 — a company cannot start a second subscription checkout while a non-final Stripe subscription already exists (see NON_FINAL_SUBSCRIPTION_STATUSES). A CANCELLED/EXPIRED subscription never blocks a fresh checkout. */
async function assertNoExistingNonFinalSubscription(companyId: string): Promise<void> {
  if (await hasNonFinalStripeSubscription(companyId)) throw new ExistingSubscriptionError();
}

/**
 * STRIPE-COMMERCIAL-11 — the DB-only check above cannot protect the window
 * between a Checkout Session being created and the webhook that eventually
 * records a CompanySoftwareSubscription row for it (webhook delivery is
 * asynchronous and can lag by seconds to minutes). This asks Stripe itself,
 * which is authoritative immediately. `canceled` and `incomplete_expired`
 * are the only two genuinely terminal Stripe subscription statuses — every
 * other value (including any future status Stripe might add) is treated as
 * blocking, deliberately failing closed rather than open.
 */
const NON_BLOCKING_STRIPE_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>(["canceled", "incomplete_expired"]);

async function assertNoExistingStripeSubscription(stripe: Stripe, stripeCustomerId: string): Promise<void> {
  const subscriptions = await stripe.subscriptions.list({ customer: stripeCustomerId, status: "all", limit: 20 });
  const blocking = subscriptions.data.some((subscription) => !NON_BLOCKING_STRIPE_SUBSCRIPTION_STATUSES.has(subscription.status));
  if (blocking) throw new ExistingSubscriptionError();
}

/**
 * If this company already has an open (unpaid, not yet expired/completed)
 * Checkout Session with Stripe, reuse it instead of minting a second one —
 * e.g. the customer opened checkout in one tab, then hit "Subscribe" again
 * in another before completing payment. Scoped to sessions this app itself
 * created (quantara_company_id metadata matches), never an arbitrary open
 * session that merely happens to share the same Stripe customer.
 */
async function findExistingOpenCheckoutSession(
  stripe: Stripe,
  stripeCustomerId: string,
  companyId: string,
): Promise<Stripe.Checkout.Session | null> {
  const sessions = await stripe.checkout.sessions.list({ customer: stripeCustomerId, status: "open", limit: 20 });
  return sessions.data.find((session) => session.metadata?.quantara_company_id === companyId) ?? null;
}

/**
 * A deterministic idempotency key scoped to a short time bucket: two
 * concurrent/rapidly-repeated requests for the same company+price (a
 * double-click, a client-side retry) collapse into the same Stripe
 * idempotency key and therefore the same Checkout Session, while a later,
 * genuinely separate checkout attempt (next bucket) gets a fresh one.
 */
function checkoutIdempotencyKey(companyId: string, priceCode: string, livemode: boolean): string {
  const bucketMs = 5 * 60 * 1000;
  const bucket = Math.floor(Date.now() / bucketMs);
  return `quantara:${livemode ? "live" : "test"}:checkout:${companyId}:${priceCode}:${bucket}`;
}

/**
 * Reuses the company's existing Stripe customer for the current mode, or
 * creates one. The Stripe-side create call carries a deterministic
 * idempotency key so two concurrent requests for a company with no existing
 * customer resolve to the *same* Stripe customer object; the DB-level
 * unique(companyId, livemode) constraint (via createStripeBillingCustomer's
 * catch-and-refetch) then guarantees only one StripeBillingCustomer row
 * survives even if both requests reach the database.
 */
async function getOrCreateStripeCustomerForCompany(
  stripe: Stripe,
  actor: CurrentActor,
  livemode: boolean,
): Promise<string> {
  const existing = await findStripeBillingCustomer(actor.companyId, livemode);
  if (existing) return existing.stripeCustomerId;

  const company = await prisma.company.findUniqueOrThrow({ where: { id: actor.companyId } });
  const stripeCustomer = await stripe.customers.create(
    {
      name: company.legalName,
      email: company.email || actor.email,
      metadata: { quantara_company_id: actor.companyId },
    },
    { idempotencyKey: `quantara:${livemode ? "live" : "test"}:customer:${actor.companyId}` },
  );

  const created = await createStripeBillingCustomer(actor.companyId, stripeCustomer.id, livemode);
  return created.stripeCustomerId;
}

export type CreateCheckoutSessionInput = { priceCode: string };
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

  const price = await loadEligibleCommercePrice(input.priceCode);
  const mapping = await resolveProviderPriceMapping(environment, price.id);
  await assertNoExistingNonFinalSubscription(actor.companyId);
  const stripeCustomerId = await getOrCreateStripeCustomerForCompany(stripe, actor, liveMode);

  // Stripe-side checks close the window the DB-only check above cannot: the
  // gap between session creation and the (asynchronous) webhook that would
  // otherwise be the only thing recording a CompanySoftwareSubscription row.
  await assertNoExistingStripeSubscription(stripe, stripeCustomerId);
  const existingSession = await findExistingOpenCheckoutSession(stripe, stripeCustomerId, actor.companyId);
  if (existingSession?.url) {
    return { checkoutSessionId: existingSession.id, checkoutUrl: existingSession.url };
  }

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: mapping.providerPriceId as string, quantity: 1 }],
      success_url: `${baseUrl}/settings/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/settings/subscription?checkout=cancelled`,
      client_reference_id: actor.companyId,
      metadata: {
        quantara_company_id: actor.companyId,
        quantara_price_code: price.code,
        quantara_environment: liveMode ? "live" : "test",
      },
      subscription_data: {
        metadata: { quantara_company_id: actor.companyId, quantara_price_code: price.code },
      },
    },
    { idempotencyKey: checkoutIdempotencyKey(actor.companyId, price.code, liveMode) },
  );

  if (!session.url) {
    throw new AppError("STRIPE_CHECKOUT_SESSION_NO_URL", "Stripe did not return a checkout URL.", 502);
  }

  return { checkoutSessionId: session.id, checkoutUrl: session.url };
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
