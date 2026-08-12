import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors/app-error";
import { getStripeCommercialClient, getConfiguredStripeMode, StripeNotConfiguredError, StripeInvalidKeyError } from "@/lib/payments/stripe-client";
import { createStripeBillingCustomer, findStripeBillingCustomer } from "@/lib/repositories/stripe-billing-repository";
import { findPriceMapping } from "@/lib/repositories/commerce-provider-mapping-repository";
import type { CommerceProviderEnvironment } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/auth-types";
import { resolveBoqCommercialRequirements } from "@/lib/commercial/commercial-requirement-service";

export const SUPPORTED_CHECKOUT_CURRENCIES = new Set(["AED"]);
export const CHECKOUT_ELIGIBLE_INTERVALS = new Set(["MONTH", "YEAR"]);
export const NON_FINAL_SUBSCRIPTION_STATUSES = new Set([
  "PENDING",
  "ACTIVE",
  "PAST_DUE",
  "TRIALING",
  "PAUSED",
]);

export class CheckoutNotEligibleError extends AppError {
  readonly reason: string;
  constructor(reason: string, message: string) {
    super("CHECKOUT_PRICE_NOT_ELIGIBLE", message, 409);
    this.name = "CheckoutNotEligibleError";
    this.reason = reason;
  }
}

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

type CompanySubscriptionClient = Pick<Prisma.TransactionClient, "companySoftwareSubscription">;

export async function hasNonFinalStripeSubscription(companyId: string, client: CompanySubscriptionClient = prisma): Promise<boolean> {
  const existing = await client.companySoftwareSubscription.findFirst({
    where: { companyId, source: "stripe", status: { in: [...NON_FINAL_SUBSCRIPTION_STATUSES] } },
    select: { id: true },
  });
  return existing !== null;
}

async function assertNoExistingNonFinalSubscription(companyId: string, client: CompanySubscriptionClient = prisma): Promise<void> {
  if (await hasNonFinalStripeSubscription(companyId, client)) throw new ExistingSubscriptionError();
}

const NON_BLOCKING_STRIPE_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>(["canceled", "incomplete_expired"]);

async function hasBlockingStripeSubscription(stripe: Stripe, stripeCustomerId: string): Promise<boolean> {
  let startingAfter: string | undefined;
  for (;;) {
    let page: Stripe.ApiList<Stripe.Subscription>;
    try {
      page = await stripe.subscriptions.list({ customer: stripeCustomerId, status: "all", limit: 100, starting_after: startingAfter });
    } catch (error) {
      throw new AppError("STRIPE_SUBSCRIPTION_LOOKUP_FAILED", "Could not verify existing subscriptions with Stripe. Please try again.", 502);
    }
    const hasBlocking = page.data.some((sub) => !NON_BLOCKING_STRIPE_SUBSCRIPTION_STATUSES.has(sub.status));
    if (hasBlocking) return true;
    if (!page.has_more || page.data.length === 0) return false;
    startingAfter = page.data[page.data.length - 1].id;
  }
}

async function assertNoExistingStripeSubscription(stripe: Stripe, stripeCustomerId: string): Promise<void> {
  if (await hasBlockingStripeSubscription(stripe, stripeCustomerId)) throw new ExistingSubscriptionError();
}

async function acquireCompanyCheckoutLease(companyId: string): Promise<string> {
  // Use persistent lease row
  const now = new Date();
  const leaseEnd = new Date(now.getTime() + 60000); // 1 minute lease
  const lease = await prisma.commerceCheckoutLease.upsert({
    where: { companyId },
    create: { companyId, lockedAt: now, expiresAt: leaseEnd },
    update: { lockedAt: now, expiresAt: leaseEnd },
  });
  return lease.id;
}

async function getOrCreateStripeCustomerForCompany(
  stripe: Stripe,
  actor: CurrentActor,
  livemode: boolean
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

export type CreateCheckoutSessionInput = {
  intent: "LEGACY_PRICE_CODE" | "BOQ_FINAL_OUTPUT";
  priceCode?: string;
  boqId?: string;
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

  let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  let metadataMap: Record<string, string> = {
    quantara_company_id: actor.companyId,
    quantara_environment: liveMode ? "live" : "test",
  };
  let subscriptionMetadataMap: Record<string, string> = {
    quantara_company_id: actor.companyId,
  };

  if (input.intent === "LEGACY_PRICE_CODE") {
    if (!input.priceCode) throw new AppError("INVALID_INPUT", "priceCode is required for LEGACY_PRICE_CODE intent.", 400);
    const price = await loadEligibleCommercePrice(input.priceCode);
    const mapping = await resolveProviderPriceMapping(environment, price.id);

    lineItems.push({ price: mapping.providerPriceId!, quantity: 1 });
    metadataMap.quantara_price_code = price.code;
    subscriptionMetadataMap.quantara_price_code = price.code;
  } else if (input.intent === "BOQ_FINAL_OUTPUT") {
    if (!input.boqId) throw new AppError("INVALID_INPUT", "boqId is required for BOQ_FINAL_OUTPUT intent.", 400);
    const decision = await resolveBoqCommercialRequirements(actor.companyId, input.boqId);
    if (decision.status === "ALLOW") {
      throw new AppError("BOQ_ALREADY_UNLOCKED", "This BOQ requires no additional commercial unlocks.", 400);
    }

    for (const req of decision.requirements) {
       if (req.type === "PACKAGE") {
          const offer = req.offers[0];
          if (!offer || !offer.priceCode) {
             throw new CheckoutNotEligibleError("PRICE_NOT_APPROVED", "A required package is missing pricing.");
          }
          const price = await loadEligibleCommercePrice(offer.priceCode);
          const mapping = await resolveProviderPriceMapping(environment, price.id);
          lineItems.push({ price: mapping.providerPriceId!, quantity: 1 });
       } else if (req.type === "PLAN") {
          const offer = req.offers[0];
          if (!offer || !offer.priceCode) {
             throw new CheckoutNotEligibleError("PRICE_NOT_APPROVED", "A required plan upgrade is missing pricing.");
          }
          const price = await loadEligibleCommercePrice(offer.priceCode);
          const mapping = await resolveProviderPriceMapping(environment, price.id);
          lineItems.push({ price: mapping.providerPriceId!, quantity: 1 });
       }
    }
    
    metadataMap.quantara_checkout_mode = "BOQ_UNLOCK";
    metadataMap.quantara_boq_id = input.boqId;
    metadataMap.quantara_manifest_fingerprint = decision.manifestFingerprint;
  } else {
    throw new AppError("INVALID_INPUT", "Invalid intent.", 400);
  }

  // Use persistent lease row, wait for the lock. No long-lived Prisma transaction!
  await acquireCompanyCheckoutLease(actor.companyId);

  await assertNoExistingNonFinalSubscription(actor.companyId);
  const stripeCustomerId = await getOrCreateStripeCustomerForCompany(stripe, actor, liveMode);

  await assertNoExistingStripeSubscription(stripe, stripeCustomerId);

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: lineItems,
      success_url: `${baseUrl}/settings/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/settings/subscription?checkout=cancelled`,
      client_reference_id: actor.companyId,
      metadata: metadataMap,
      subscription_data: {
        metadata: subscriptionMetadataMap,
      },
    },
    { idempotencyKey: randomUUID() },
  );

  if (!session.url) {
    throw new AppError("STRIPE_CHECKOUT_SESSION_NO_URL", "Stripe did not return a checkout URL.", 502);
  }

  return { checkoutSessionId: session.id, checkoutUrl: session.url! };
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
