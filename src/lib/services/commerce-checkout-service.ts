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
 */

const SUPPORTED_CURRENCIES = new Set(["AED"]);
const SUPPORTED_INTERVALS = new Set(["ONE_TIME", "MONTH", "YEAR"]);

export type CheckoutPriceRejectionReason =
  | "PRICE_NOT_FOUND"
  | "PRODUCT_INACTIVE"
  | "PRODUCT_NOT_DIRECT_PURCHASE"
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

async function loadEligibleCommercePrice(priceCode: string) {
  const price = await prisma.commercePrice.findUnique({
    where: { code: priceCode },
    include: { product: true },
  });

  if (!price) throw new CheckoutNotEligibleError("PRICE_NOT_FOUND", "This price is not available for checkout.");
  if (!price.product.isActive) throw new CheckoutNotEligibleError("PRODUCT_INACTIVE", "This product is not currently available.");
  if (price.product.purchaseMode !== "DIRECT") {
    throw new CheckoutNotEligibleError("PRODUCT_NOT_DIRECT_PURCHASE", "This product requires contacting sales and cannot be checked out directly.");
  }
  if (!price.isActive) throw new CheckoutNotEligibleError("PRICE_INACTIVE", "This price is no longer active.");
  if (price.reviewStatus !== "APPROVED") throw new CheckoutNotEligibleError("PRICE_NOT_APPROVED", "This price has not been approved for checkout.");
  if (price.isFromPrice) throw new CheckoutNotEligibleError("PRICE_NOT_APPROVED", "This price is an indicative amount and cannot be checked out directly.");
  if (price.amountMinor <= 0) throw new CheckoutNotEligibleError("ZERO_OR_NEGATIVE_AMOUNT", "This price is not checkout-eligible.");
  if (!SUPPORTED_CURRENCIES.has(price.currency)) throw new CheckoutNotEligibleError("UNSUPPORTED_CURRENCY", "This price's currency is not supported for checkout.");
  if (!SUPPORTED_INTERVALS.has(price.billingInterval)) throw new CheckoutNotEligibleError("UNSUPPORTED_INTERVAL", "This price's billing interval is not supported for checkout.");

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
  const stripeCustomerId = await getOrCreateStripeCustomerForCompany(stripe, actor, liveMode);

  const mode: Stripe.Checkout.SessionCreateParams.Mode =
    price.billingInterval === "ONE_TIME" ? "payment" : "subscription";

  const session = await stripe.checkout.sessions.create({
    mode,
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
    ...(mode === "subscription"
      ? {
          subscription_data: {
            metadata: { quantara_company_id: actor.companyId, quantara_price_code: price.code },
          },
        }
      : {}),
  });

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
