import type Stripe from "stripe";
import type { CommerceProviderEnvironment, PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import {
  getConfiguredStripeMode,
  getStripeCommercialClient,
  STRIPE_API_VERSION,
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
 * a duplicate event's ledger insert throws a unique-constraint violation on
 * stripeEventId specifically, which rolls back the whole transaction and is
 * caught as a safe no-op — never partial application of one without the
 * other.
 *
 * STRIPE-COMMERCIAL-5 (event-ordering hardening) — Stripe does not guarantee
 * webhook delivery order. Every subscription-affecting event (the three
 * customer.subscription.* events and both invoice.payment_* events)
 * therefore never trusts the payload's embedded snapshot for the fields
 * that determine entitlement (status, items/price, customer). Instead it
 * re-fetches the CURRENT subscription from Stripe by ID, outside the DB
 * transaction, using the correctly mode-gated commercial client, and
 * applies THAT state. A stale "updated" event delivered after a "deleted"
 * event still converges to canceled, because the fetch returns Stripe's
 * current truth regardless of which event triggered it — there is
 * deliberately only one state-application code path
 * (applyCurrentSubscriptionState) for all five event types.
 */

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/**
 * STRIPE-COMMERCIAL-6 — narrower than a blanket "any P2002 means duplicate
 * event" check. A unique-constraint violation on, say,
 * CompanySoftwareSubscription.externalSubscriptionId (a genuine data
 * conflict, e.g. two different Stripe subscriptions somehow resolving to
 * the same externalSubscriptionId) must be rethrown so the webhook returns
 * a failure and Stripe retries/alerts — swallowing it as "duplicate" would
 * silently hide a real bug.
 */
export function isStripeWebhookEventIdConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.some((field) => typeof field === "string" && field.includes("stripeEventId"));
  if (typeof target === "string") return target.includes("stripeEventId");
  return false;
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

/**
 * STRIPE-COMMERCIAL-9 — the Stripe webhook endpoint must be created (in the
 * Stripe Dashboard, or via the API) pinned to API version STRIPE_API_VERSION
 * (see stripe-client.ts). An event generated under a different API version
 * can render object shapes this code does not expect (a known example:
 * Invoice.subscription moved to Invoice.parent.subscription_details.subscription
 * across versions) — rather than silently mis-parsing such an event, this
 * fails safely with a clear, actionable error before any state mutation is
 * attempted. `event.api_version` is null only for pre-2017 API versions,
 * which this deployment can never actually receive, so a null pin is
 * treated as a mismatch, not a pass-through.
 */
export function assertWebhookApiVersionMatches(event: Stripe.Event): void {
  if (event.api_version !== STRIPE_API_VERSION) {
    throw new AppError(
      "STRIPE_WEBHOOK_API_VERSION_MISMATCH",
      `This webhook event was generated with Stripe API version "${event.api_version ?? "unknown"}", but this deployment expects "${STRIPE_API_VERSION}". Recreate the Stripe webhook endpoint pinned to ${STRIPE_API_VERSION}.`,
      400,
    );
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

async function resolveCompanyIdForEvent(tx: TxClient, event: Stripe.Event): Promise<string | null> {
  const obj = event.data.object as { customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null };
  return resolveCompanyIdForCustomer(tx, extractStripeCustomerId(obj.customer ?? null));
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

/** Which Stripe subscription ID this event is about, if any — used to fetch the CURRENT state before touching the database. Returns null for event types with no associated subscription (e.g. checkout.session.completed). */
function extractRelevantSubscriptionId(event: Stripe.Event): string | null {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return (event.data.object as Stripe.Subscription).id;
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
      return extractInvoiceSubscriptionId(event.data.object as Stripe.Invoice);
    default:
      return null;
  }
}

/**
 * STRIPE-COMMERCIAL-17 — a fixed, arbitrary int32 namespace so this app's
 * per-subscription webhook locks can never collide with any other advisory
 * lock this codebase (or a future one) might take for an unrelated purpose.
 * Combined with `hashtext(subscriptionId)` (Postgres's built-in text hash,
 * also int32) as the second key, via the two-argument
 * `pg_advisory_xact_lock(key1, key2)` overload.
 */
const STRIPE_WEBHOOK_LOCK_NAMESPACE = 875_309_417;

/**
 * Acquires a transaction-scoped Postgres advisory lock keyed on this exact
 * subscription ID, released automatically on commit or rollback — never
 * needs manual unlocking, and is enforced by Postgres itself, so it
 * serializes concurrent webhook deliveries for the SAME subscription across
 * every Node process/serverless instance, not just within one. Two
 * different subscription IDs hash to different keys (bar an astronomically
 * unlikely hashtext collision) and never block each other.
 */
async function acquireSubscriptionLock(tx: TxClient, subscriptionId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${STRIPE_WEBHOOK_LOCK_NAMESPACE}, hashtext(${subscriptionId}))`;
}

/**
 * Fetches Stripe's current view of a subscription.
 *
 * STRIPE-COMMERCIAL-10 — a retrieval failure (Stripe API/network error) MUST
 * throw rather than degrade to "no state to apply": silently swallowing it
 * would let processStripeWebhookEvent still record the StripeWebhookEvent
 * ledger row and return "processed" for an event whose state was never
 * actually applied — permanently consuming that delivery. Stripe's own
 * retry policy exists precisely to handle exactly this kind of transient
 * upstream failure, so the correct behavior is to fail the whole webhook
 * request (safe 502, no ledger row) and let Stripe redeliver.
 */
async function fetchCurrentSubscription(stripe: Stripe, subscriptionId: string): Promise<Stripe.Subscription> {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    console.error("[stripe-webhook] Failed to retrieve current subscription state for", subscriptionId, error);
    throw new AppError(
      "STRIPE_SUBSCRIPTION_RETRIEVAL_FAILED",
      "Could not retrieve the current subscription state from Stripe. This event was not recorded; Stripe should retry delivery.",
      502,
    );
  }
}

/**
 * The single state-application path for every subscription-affecting event.
 * Always applies Stripe's CURRENT subscription snapshot (never the
 * triggering event's payload), so this is safe to call from
 * customer.subscription.created/updated/deleted and both invoice.payment_*
 * handlers alike — whichever event happens to arrive, the result converges
 * to the same current truth. Never trusts event/session metadata for tenant
 * identity: the Stripe customer ID on the fetched subscription is
 * cross-referenced against StripeBillingCustomer (a row this app created),
 * the only source of company identity a webhook is allowed to act on.
 */
async function applyCurrentSubscriptionState(tx: TxClient, subscription: Stripe.Subscription): Promise<void> {
  const stripeCustomerId = extractStripeCustomerId(subscription.customer);
  const companyId = await resolveCompanyIdForCustomer(tx, stripeCustomerId);
  if (!companyId) return;

  const status = mapStripeSubscriptionStatusToQuantara(subscription.status);
  const item = subscription.items.data[0];
  const expiresAt = item?.current_period_end ? new Date(item.current_period_end * 1000) : null;
  const startsAt = item?.current_period_start ? new Date(item.current_period_start * 1000) : null;
  const cancelledAt = subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null;

  /**
   * Resolving which SoftwarePlan this subscription's price maps to is
   * best-effort here, not a precondition for applying a status change to an
   * ALREADY-EXISTING row. If the live-sync path (stripe-live-sync-service.ts)
   * later archives the provider mapping for a price a customer already
   * subscribed to, this lookup legitimately stops resolving — but a
   * cancellation/failure webhook for that customer's subscription must still
   * be able to move it to CANCELLED/PAST_DUE. Only *creating* a brand-new
   * subscription record genuinely requires knowing the plan (there is
   * nothing sensible to create otherwise).
   */
  let softwarePlanId: string | null = null;
  const providerPriceId = item?.price?.id;
  if (providerPriceId) {
    const environment: CommerceProviderEnvironment = subscription.livemode ? "LIVE" : "TEST";
    const mapping = await findMappingByProviderPriceId("STRIPE", environment, providerPriceId, tx);
    if (mapping?.commercePriceId) {
      const commercePrice = await tx.commercePrice.findUnique({
        where: { id: mapping.commercePriceId },
        include: { product: true },
      });
      if (commercePrice) {
        const softwarePlan = await resolveSoftwarePlanForCommerceProductCode(commercePrice.product.code, tx);
        softwarePlanId = softwarePlan?.id ?? null;
      }
    }
  }

  const existing = await tx.companySoftwareSubscription.findUnique({
    where: { externalSubscriptionId: subscription.id },
  });

  if (existing) {
    if (existing.companyId !== companyId) return; // defensive — never move a subscription across tenants
    await tx.companySoftwareSubscription.update({
      where: { id: existing.id },
      data: { status, startsAt, expiresAt, cancelledAt, ...(softwarePlanId ? { softwarePlanId } : {}) },
    });
    return;
  }

  if (!softwarePlanId) return; // cannot create a new subscription record without knowing its plan

  await tx.companySoftwareSubscription.create({
    data: {
      companyId,
      softwarePlanId,
      status,
      startsAt,
      expiresAt,
      cancelledAt,
      externalSubscriptionId: subscription.id,
      source: "stripe",
    },
  });
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

export async function processStripeWebhookEvent(event: Stripe.Event, overrideClient?: Stripe): Promise<StripeWebhookProcessResult> {
  assertWebhookModeMatches(event);
  assertWebhookApiVersionMatches(event);

  /**
   * A read-only precheck, not the correctness guarantee — the transaction's
   * unique-constraint insert below is what actually prevents a double-apply
   * race. This exists purely so a replayed/redelivered event that was
   * already fully processed doesn't pay for a Stripe API round-trip (and,
   * now that a retrieval failure throws instead of silently no-op'ing,
   * doesn't risk failing an already-completed delivery due to a *new*,
   * unrelated Stripe outage).
   */
  const alreadyRecorded = await prisma.stripeWebhookEvent.findUnique({
    where: { stripeEventId: event.id },
    select: { id: true },
  });
  if (alreadyRecorded) return { outcome: "duplicate" };

  if (!HANDLED_EVENT_TYPES.has(event.type)) {
    // Still record the event so a later Stripe retry of the *same* event never double-processes it if this event type becomes handled in the future.
    try {
      await prisma.$transaction(async (tx) => {
        const companyId = await resolveCompanyIdForEvent(tx, event);
        await recordStripeWebhookEvent(tx, { stripeEventId: event.id, eventType: event.type, livemode: event.livemode, companyId });
      });
    } catch (error) {
      if (isStripeWebhookEventIdConflict(error)) return { outcome: "duplicate" };
      throw error;
    }
    return { outcome: "ignored", eventType: event.type, reason: "UNHANDLED_EVENT_TYPE" };
  }

  const subscriptionId = extractRelevantSubscriptionId(event);
  const stripe = subscriptionId ? resolveWebhookStripeClient(overrideClient) : null;

  /**
   * STRIPE-COMMERCIAL-17 — the advisory lock is acquired FIRST, inside the
   * transaction, and Stripe's current state is fetched only AFTER acquiring
   * it — not before the transaction starts (see round-3 STRIPE-COMMERCIAL-10
   * history: it used to fetch outside the transaction). This ordering is
   * what makes the serialization actually work: two concurrent deliveries
   * for the same subscription both try to acquire the same lock; whichever
   * loses waits until the winner commits (releasing the lock), and only
   * then fetches — guaranteeing its fetch, and thus its write (since it
   * also commits second), reflects Stripe state at least as current as the
   * winner's. A retrieval failure still throws and rolls back the whole
   * transaction (releasing the lock), so no ledger row is written and
   * Stripe redelivers — identical safety to before, now inside the lock.
   */
  try {
    return await prisma.$transaction(
      async (tx) => {
        if (subscriptionId) {
          await acquireSubscriptionLock(tx, subscriptionId);
        }

        const currentSubscription = subscriptionId ? await fetchCurrentSubscription(stripe!, subscriptionId) : null;

        const companyId = currentSubscription
          ? await resolveCompanyIdForCustomer(tx, extractStripeCustomerId(currentSubscription.customer))
          : await resolveCompanyIdForEvent(tx, event);

        await recordStripeWebhookEvent(tx, {
          stripeEventId: event.id,
          eventType: event.type,
          livemode: event.livemode,
          companyId,
        });

        if (event.type === "checkout.session.completed") {
          // Intentionally a no-op beyond the ledger insert above — entitlement
          // is never activated from checkout completion. The authoritative
          // state change arrives via the current-subscription-state path below.
        } else if (currentSubscription) {
          await applyCurrentSubscriptionState(tx, currentSubscription);
        }
        // else: a subscription/invoice event whose subscription could not be
        // retrieved from Stripe — ledger-only, no state mutation attempted.

        return { outcome: "processed" as const, eventType: event.type };
      },
      // Generous timeout: this transaction now holds an advisory lock and
      // makes a real Stripe API round-trip while open, not just DB writes.
      { maxWait: 10_000, timeout: 30_000 },
    );
  } catch (error) {
    if (isStripeWebhookEventIdConflict(error)) return { outcome: "duplicate" };
    throw error;
  }
}
