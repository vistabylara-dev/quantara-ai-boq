import type Stripe from "stripe";
import type { CommerceProviderEnvironment, PrismaClient } from "@prisma/client";
import { Prisma, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import {
  getConfiguredStripeMode,
  getStripeCommercialClient,
  StripeInvalidKeyError,
  StripeNotConfiguredError,
} from "@/lib/payments/stripe-client";
import { mapStripeSubscriptionStatusToQuantara } from "@/lib/payments/stripe-subscription-status";
import { findMappingByProviderPriceId } from "@/lib/repositories/commerce-provider-mapping-repository";
import { recordStripeWebhookEvent } from "@/lib/repositories/stripe-billing-repository";
import { resolveSoftwarePlanForCommerceProductCode } from "@/lib/entitlements/commerce-plan-mapping";

/**
 * STRIPE-COMMERCIAL-3 — webhook processing. Stripe is the source of truth
 * for subscription state; nothing here is ever triggered from a browser
 * success page. Every state mutation happens in the same DB transaction as
 * the StripeWebhookEvent idempotency-ledger insert (see processStripeWebhookEvent):
 * a duplicate event's ledger insert throws a unique-constraint violation,
 * which rolls back the whole transaction and is caught as a safe no-op —
 * never partial application of one without the other.
 */

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function requireWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new AppError("STRIPE_WEBHOOK_SECRET_NOT_CONFIGURED", "The Stripe webhook secret is not configured.", 503);
  }
  return secret;
}

function resolveWebhookStripeClient(overrideClient?: Stripe): Stripe {
  try {
    return getStripeCommercialClient(overrideClient);
  } catch (error) {
    if (error instanceof StripeNotConfiguredError || error instanceof StripeInvalidKeyError) {
      throw new AppError("STRIPE_NOT_CONFIGURED", "Stripe is not configured.", 503);
    }
    throw error;
  }
}

/**
 * Verifies the raw request body against the Stripe-Signature header using
 * the webhook signing secret — never JSON-parses first (constructEvent needs
 * the exact raw bytes to verify the HMAC). A missing/empty signature header
 * or a verification failure both surface as the same safe 400.
 */
export async function verifyStripeWebhookEvent(
  rawBody: string,
  signatureHeader: string | null,
  overrideClient?: Stripe,
): Promise<Stripe.Event> {
  if (!signatureHeader) {
    throw new AppError("STRIPE_WEBHOOK_SIGNATURE_MISSING", "Missing Stripe-Signature header.", 400);
  }
  const secret = requireWebhookSecret();
  const stripe = resolveWebhookStripeClient(overrideClient);
  try {
    return await stripe.webhooks.constructEventAsync(rawBody, signatureHeader, secret);
  } catch {
    throw new AppError("STRIPE_WEBHOOK_SIGNATURE_INVALID", "Invalid Stripe webhook signature.", 400);
  }
}

/** live event only when STRIPE_MODE=live; test event only when STRIPE_MODE=test. A mismatch fails safely rather than silently applying a live event's state to a test setup or vice versa. */
export function assertWebhookModeMatches(event: Stripe.Event): void {
  const expectedLivemode = getConfiguredStripeMode() === "live";
  if (event.livemode !== expectedLivemode) {
    throw new AppError("STRIPE_WEBHOOK_MODE_MISMATCH", "This event's mode does not match the configured Stripe mode.", 400);
  }
}

function extractStripeCustomerId(
  value: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function resolveCompanyIdForCustomer(tx: TxClient, stripeCustomerId: string | null): Promise<string | null> {
  if (!stripeCustomerId) return null;
  const billingCustomer = await tx.stripeBillingCustomer.findUnique({ where: { stripeCustomerId } });
  return billingCustomer?.companyId ?? null;
}

/**
 * Never trusts event/session metadata for tenant identity — the Stripe
 * customer ID on the event object is cross-referenced against
 * StripeBillingCustomer (a row this app created), which is the only source
 * of company identity a webhook is allowed to act on. An event for a Stripe
 * customer this app has no record of cannot mutate any company's state.
 */
async function upsertSubscriptionFromStripe(tx: TxClient, subscription: Stripe.Subscription): Promise<void> {
  const stripeCustomerId = extractStripeCustomerId(subscription.customer);
  const companyId = await resolveCompanyIdForCustomer(tx, stripeCustomerId);
  if (!companyId) return;

  const item = subscription.items.data[0];
  const providerPriceId = item?.price?.id;
  if (!providerPriceId) return;

  const environment: CommerceProviderEnvironment = subscription.livemode ? "LIVE" : "TEST";
  const mapping = await findMappingByProviderPriceId("STRIPE", environment, providerPriceId, tx);
  if (!mapping || !mapping.commercePriceId) return;

  const commercePrice = await tx.commercePrice.findUnique({
    where: { id: mapping.commercePriceId },
    include: { product: true },
  });
  if (!commercePrice) return;

  const softwarePlan = await resolveSoftwarePlanForCommerceProductCode(commercePrice.product.code, tx);
  if (!softwarePlan) return;

  const status = mapStripeSubscriptionStatusToQuantara(subscription.status);
  const expiresAt = item?.current_period_end ? new Date(item.current_period_end * 1000) : null;
  const startsAt = item?.current_period_start ? new Date(item.current_period_start * 1000) : null;
  const cancelledAt = subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null;

  const existing = await tx.companySoftwareSubscription.findUnique({
    where: { externalSubscriptionId: subscription.id },
  });

  if (existing) {
    if (existing.companyId !== companyId) return; // defensive — never move a subscription across tenants
    await tx.companySoftwareSubscription.update({
      where: { id: existing.id },
      data: { softwarePlanId: softwarePlan.id, status, startsAt, expiresAt, cancelledAt },
    });
    return;
  }

  await tx.companySoftwareSubscription.create({
    data: {
      companyId,
      softwarePlanId: softwarePlan.id,
      status,
      startsAt,
      expiresAt,
      cancelledAt,
      externalSubscriptionId: subscription.id,
      source: "stripe",
    },
  });
}

/**
 * Loads the existing CompanySoftwareSubscription for an externalSubscriptionId
 * and verifies it belongs to the company the event's Stripe customer resolves
 * to — never trusts externalSubscriptionId alone, since that would let an
 * event carrying an unrelated Stripe customer id mutate any company's
 * subscription merely by guessing/replaying a subscription id. Returns null
 * (a safe no-op for the caller) on any mismatch or unknown customer.
 */
async function loadOwnedSubscription(
  tx: TxClient,
  externalSubscriptionId: string,
  stripeCustomerId: string | null,
) {
  const existing = await tx.companySoftwareSubscription.findUnique({ where: { externalSubscriptionId } });
  if (!existing) return null;
  const companyId = await resolveCompanyIdForCustomer(tx, stripeCustomerId);
  if (!companyId || existing.companyId !== companyId) return null;
  return existing;
}

/** customer.subscription.deleted — explicit cancellation. Removes paid entitlement by moving status to CANCELLED (isActive in entitlement-service.ts is only true for ACTIVE/TRIAL). */
async function cancelSubscriptionFromStripe(tx: TxClient, subscription: Stripe.Subscription): Promise<void> {
  const existing = await loadOwnedSubscription(tx, subscription.id, extractStripeCustomerId(subscription.customer));
  if (!existing) return;

  await tx.companySoftwareSubscription.update({
    where: { id: existing.id },
    data: {
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : new Date(),
    },
  });
}

/** Only ever raises a matched subscription to ACTIVE — never downgrades, and never acts on a subscription id this app has no record of. */
async function handleInvoicePaymentSucceeded(tx: TxClient, invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = extractInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const existing = await loadOwnedSubscription(tx, subscriptionId, extractStripeCustomerId(invoice.customer));
  if (!existing) return;
  if (existing.status === SubscriptionStatus.ACTIVE) return;

  await tx.companySoftwareSubscription.update({
    where: { id: existing.id },
    data: { status: SubscriptionStatus.ACTIVE },
  });
}

/** A failed invoice denies paid entitlement (PAST_DUE) without overwriting an explicit CANCELLED state. */
async function handleInvoicePaymentFailed(tx: TxClient, invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = extractInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const existing = await loadOwnedSubscription(tx, subscriptionId, extractStripeCustomerId(invoice.customer));
  if (!existing) return;
  if (existing.status === SubscriptionStatus.CANCELLED) return;

  await tx.companySoftwareSubscription.update({
    where: { id: existing.id },
    data: { status: SubscriptionStatus.PAST_DUE },
  });
}

/**
 * Invoice.subscription (a top-level scalar) was replaced by
 * invoice.parent.subscription_details.subscription as Stripe generalized
 * Invoice to have quote/subscription/other parents in this API version.
 */
function extractInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription;
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

async function resolveCompanyIdForEvent(tx: TxClient, event: Stripe.Event): Promise<string | null> {
  const obj = event.data.object as { customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null };
  return resolveCompanyIdForCustomer(tx, extractStripeCustomerId(obj.customer ?? null));
}

export type StripeWebhookProcessResult =
  | { outcome: "duplicate" }
  | { outcome: "processed"; eventType: string }
  | { outcome: "ignored"; eventType: string; reason: string };

const HANDLED_EVENT_TYPES = new Set<string>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]);

export async function processStripeWebhookEvent(event: Stripe.Event): Promise<StripeWebhookProcessResult> {
  assertWebhookModeMatches(event);

  if (!HANDLED_EVENT_TYPES.has(event.type)) {
    // Still record the event so a later Stripe retry of the *same* event never double-processes it if this event type becomes handled in the future.
    try {
      await prisma.$transaction(async (tx) => {
        const companyId = await resolveCompanyIdForEvent(tx, event);
        await recordStripeWebhookEvent(tx, { stripeEventId: event.id, eventType: event.type, livemode: event.livemode, companyId });
      });
    } catch (error) {
      if (isUniqueViolation(error)) return { outcome: "duplicate" };
      throw error;
    }
    return { outcome: "ignored", eventType: event.type, reason: "UNHANDLED_EVENT_TYPE" };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const companyId = await resolveCompanyIdForEvent(tx, event);
      await recordStripeWebhookEvent(tx, {
        stripeEventId: event.id,
        eventType: event.type,
        livemode: event.livemode,
        companyId,
      });

      switch (event.type) {
        case "checkout.session.completed":
          // Intentionally a no-op beyond the ledger insert above — entitlement
          // is never activated from checkout completion. The authoritative
          // state change arrives via customer.subscription.created/updated.
          break;
        case "customer.subscription.created":
        case "customer.subscription.updated":
          await upsertSubscriptionFromStripe(tx, event.data.object as Stripe.Subscription);
          break;
        case "customer.subscription.deleted":
          await cancelSubscriptionFromStripe(tx, event.data.object as Stripe.Subscription);
          break;
        case "invoice.payment_succeeded":
          await handleInvoicePaymentSucceeded(tx, event.data.object as Stripe.Invoice);
          break;
        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(tx, event.data.object as Stripe.Invoice);
          break;
      }

      return { outcome: "processed" as const, eventType: event.type };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { outcome: "duplicate" };
    throw error;
  }
}
