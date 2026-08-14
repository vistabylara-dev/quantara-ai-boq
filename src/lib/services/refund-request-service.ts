import type Stripe from "stripe";
import type { Prisma, RefundExceptionCategory, RefundRequest } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { AppError } from "@/lib/errors/app-error";
import { getStripeCommercialClient, StripeInvalidKeyError, StripeNotConfiguredError } from "@/lib/payments/stripe-client";
import { findStripeBillingCustomer } from "@/lib/repositories/stripe-billing-repository";
import {
  createRefundRequest,
  findNonTerminalRefundRequestForPaymentIntent,
  listRefundRequestsForCompany,
} from "@/lib/repositories/refund-request-repository";
import { resolveCheckoutEnvironment } from "@/lib/services/commerce-checkout-service";

/**
 * REFUND-3 — customer-facing refund REQUEST creation. This never executes a
 * Stripe refund and never accepts a provider ID, amount, or currency from
 * the caller — every fact here is derived from the company's own trusted
 * CompanySoftwareSubscription + StripeBillingCustomer state, then
 * cross-checked directly against Stripe (read-only) so the persisted
 * evidence reflects Stripe's own current truth, not a stale local snapshot.
 * Full refund only for initial launch — see REFUND_REQUEST_REASON_MAX_LENGTH
 * and the single `reason` input field below.
 */

export const REFUND_REQUEST_REASON_MAX_LENGTH = 2000;
/** REFUND-18 — a normal customer request must be SUBMITTED within this many calendar days of the payment succeeding (per Stripe, never per the browser). See requestRefund/getRefundEligibility below. */
export const REFUND_WINDOW_DAYS = 7;

export type RequestRefundInput = { reason: string };

function resolveRefundStripeClient(overrideClient?: Stripe): Stripe {
  try {
    return getStripeCommercialClient(overrideClient);
  } catch (error) {
    if (error instanceof StripeNotConfiguredError || error instanceof StripeInvalidKeyError) {
      throw new AppError("STRIPE_NOT_CONFIGURED", "Refunds are not available right now.", 503);
    }
    throw error;
  }
}

/**
 * Which CompanySoftwareSubscription (if any) is eligible for a refund
 * request: must be a genuine Stripe-sourced subscription (never a
 * development/manual grant) with a real externalSubscriptionId. A CANCELLED
 * or EXPIRED subscription may still have an eligible past payment, so status
 * is not filtered here — eligibility is really about "was this ever a real
 * Stripe payment", decided next by what Stripe itself reports for the
 * subscription's most recent invoice.
 */
async function findRefundableSubscription(companyId: string) {
  return prisma.companySoftwareSubscription.findFirst({
    where: { companyId, source: "stripe", externalSubscriptionId: { not: null } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Extracts the PaymentIntent ID from an Invoice defensively — real Stripe
 * API versions have moved payment linkage around before (see
 * extractInvoiceSubscriptionId in stripe-webhook-service.ts for the same
 * class of shift on `.subscription`). Tries the classic scalar field first,
 * then the newer nested `payments` list shape, so this keeps working across
 * either shape without needing to know in advance which one API version
 * 2026-07-29.dahlia actually returns for this account.
 */
function extractInvoicePaymentIntentId(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as unknown as { payment_intent?: string | { id: string } | null }).payment_intent;
  if (legacy) return typeof legacy === "string" ? legacy : legacy.id;

  const nested = (
    invoice as unknown as {
      payments?: { data?: Array<{ payment?: { payment_intent?: string | { id: string } | null } }> };
    }
  ).payments?.data?.[0]?.payment?.payment_intent;
  if (nested) return typeof nested === "string" ? nested : nested.id;

  return null;
}

export type EligiblePayment = {
  invoiceId: string;
  paymentIntentId: string;
  chargeId: string | null;
  amountMinor: number;
  /** REFUND-18 — from Stripe Charge.created (authoritative, server/provider-side). Never derived from a client-supplied date or the browser clock. */
  successfulPaymentAt: Date;
};

/**
 * Reads Stripe's CURRENT view of the subscription's most recent invoice and
 * payment — never trusts anything cached locally for the amount/IDs that
 * become immutable RefundRequest evidence. Read-only: no mutation, no
 * refund, no charge created. Throws a safe, specific error for every way
 * this can fail to find a genuinely paid, refundable charge.
 */
async function findEligiblePayment(stripe: Stripe, externalSubscriptionId: string): Promise<EligiblePayment> {
  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(externalSubscriptionId, {
      expand: ["latest_invoice", "latest_invoice.payments.data.payment.payment_intent"],
    });
  } catch {
    throw new AppError("STRIPE_SUBSCRIPTION_RETRIEVAL_FAILED", "Could not retrieve this subscription from Stripe.", 502);
  }

  const invoice = subscription.latest_invoice;
  if (!invoice || typeof invoice === "string") {
    throw new AppError("REFUND_NO_PAYMENT_FOUND", "No payment was found for this subscription.", 409);
  }

  const paymentIntentId = extractInvoicePaymentIntentId(invoice);
  if (!paymentIntentId) {
    throw new AppError("REFUND_NO_PAYMENT_FOUND", "No completed payment was found for this subscription.", 409);
  }

  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
  } catch {
    throw new AppError("STRIPE_SUBSCRIPTION_RETRIEVAL_FAILED", "Could not retrieve this payment from Stripe.", 502);
  }

  if (paymentIntent.status !== "succeeded" || (paymentIntent.amount_received ?? 0) <= 0) {
    throw new AppError("REFUND_NO_PAYMENT_FOUND", "No successful payment was found for this subscription.", 409);
  }

  const charge = paymentIntent.latest_charge;
  if (!charge || typeof charge === "string") {
    // Expanded above — a string here means Stripe didn't return the object we asked for.
    throw new AppError("REFUND_NO_PAYMENT_FOUND", "No completed charge was found for this payment.", 409);
  }
  if (charge.refunded) {
    throw new AppError("REFUND_ALREADY_REFUNDED", "This payment has already been fully refunded.", 409);
  }

  /**
   * REFUND-18b — invoice.status_transitions.paid_at (not Charge.created) is
   * the refund-window start. For a subscription invoice, this is Stripe's
   * own authoritative record of the moment the INVOICE — the actual billing
   * event the customer is being refunded for — transitioned to "paid."
   * Charge.created merely timestamps when the underlying charge attempt
   * object was created, one implementation layer removed from that business
   * fact; for the synchronous card payments this app accepts the two are
   * normally within the same second, but paid_at is the semantically
   * correct source, not a proxy for it. Deliberately no silent fallback to
   * Charge.created if paid_at is ever null — for a genuinely succeeded
   * invoice (already confirmed by the PaymentIntent/amount_received checks
   * above) this should never happen, and guessing at a refund-eligibility
   * deadline from a less authoritative timestamp is worse than failing
   * closed with a clear, specific error.
   */
  const paidAt = invoice.status_transitions?.paid_at;
  if (!paidAt) {
    throw new AppError(
      "REFUND_PAYMENT_TIMESTAMP_UNAVAILABLE",
      "Stripe did not report an authoritative paid timestamp for this invoice.",
      502,
    );
  }

  return {
    invoiceId: invoice.id ?? "",
    paymentIntentId,
    chargeId: charge.id,
    amountMinor: paymentIntent.amount_received,
    // Unix seconds -> Date. Never the RefundRequest row's own createdAt
    // (that's when the REQUEST was made, a different fact), never Checkout
    // Session creation time, and never anything the client could influence.
    successfulPaymentAt: new Date(paidAt * 1000),
  };
}

export function refundWindowDeadline(successfulPaymentAt: Date): Date {
  return new Date(successfulPaymentAt.getTime() + REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * REFUND-4 — reuses the same advisory-lock-then-recheck shape as
 * createCommerceCheckoutSession (STRIPE-COMMERCIAL-18): the lock is keyed on
 * the PaymentIntent ID rather than the company, since the actual invariant
 * to protect is "at most one non-terminal RefundRequest per payment," and a
 * company will only ever have one refundable payment at a time in this
 * launch (full refund only, one active subscription per company).
 */
const REFUND_REQUEST_LOCK_NAMESPACE = 552_014_763;

async function acquirePaymentIntentLock(tx: Prisma.TransactionClient, stripePaymentIntentId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${REFUND_REQUEST_LOCK_NAMESPACE}, hashtext(${stripePaymentIntentId}))`;
}

/**
 * REFUND-19 — the one function that actually resolves eligibility, persists
 * a RefundRequest, and locks out duplicates. Shared by the normal customer
 * path (requestRefund, enforceWindow: true) and the owner-only exception
 * path (createExceptionRefundRequest in refund-execution-service.ts,
 * enforceWindow: false) so the duplicate-prevention/locking/evidence-capture
 * logic can never drift between the two — only the window check and the
 * exception metadata differ.
 */
export async function createRefundRequestCore(input: {
  companyId: string;
  requestedByUserId: string;
  reason: string;
  enforceWindow: boolean;
  isException: boolean;
  exceptionCategory: RefundExceptionCategory | null;
  overrideClient?: Stripe;
}): Promise<RefundRequest> {
  const subscription = await findRefundableSubscription(input.companyId);
  if (!subscription || !subscription.externalSubscriptionId) {
    throw new AppError("REFUND_NOT_ELIGIBLE", "No paid subscription was found for this company.", 409);
  }

  const environment = resolveCheckoutEnvironment();
  const livemode = environment === "LIVE";
  const billingCustomer = await findStripeBillingCustomer(input.companyId, livemode);
  if (!billingCustomer) {
    throw new AppError("REFUND_NOT_ELIGIBLE", "No billing record was found for this company.", 409);
  }

  const stripe = resolveRefundStripeClient(input.overrideClient);
  const payment = await findEligiblePayment(stripe, subscription.externalSubscriptionId);

  if (input.enforceWindow) {
    const deadline = refundWindowDeadline(payment.successfulPaymentAt);
    if (new Date() > deadline) {
      throw new AppError(
        "REFUND_WINDOW_EXPIRED",
        `The ${REFUND_WINDOW_DAYS}-day refund window for this payment ended on ${deadline.toISOString()}. Please contact support if you believe there is a billing error.`,
        409,
      );
    }
  }

  return prisma.$transaction(
    async (tx) => {
      await acquirePaymentIntentLock(tx, payment.paymentIntentId);

      const existing = await findNonTerminalRefundRequestForPaymentIntent(payment.paymentIntentId, tx);
      if (existing) {
        throw new AppError("REFUND_ALREADY_REQUESTED", "A refund request for this payment is already pending review.", 409);
      }

      return createRefundRequest(
        {
          companyId: input.companyId,
          requestedByUserId: input.requestedByUserId,
          companySoftwareSubscriptionId: subscription.id,
          externalSubscriptionId: subscription.externalSubscriptionId!,
          stripeInvoiceId: payment.invoiceId || null,
          stripePaymentIntentId: payment.paymentIntentId,
          stripeChargeId: payment.chargeId,
          originalAmountMinor: payment.amountMinor,
          requestedAmountMinor: payment.amountMinor,
          currency: "AED",
          reason: input.reason,
          successfulPaymentAt: payment.successfulPaymentAt,
          isException: input.isException,
          exceptionCategory: input.exceptionCategory,
        },
        tx,
      );
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
}

export async function requestRefund(
  actor: CurrentActor,
  input: RequestRefundInput,
  overrideClient?: Stripe,
): Promise<RefundRequest> {
  const reason = input.reason?.trim();
  if (!reason) {
    throw new AppError("VALIDATION_ERROR", "A reason is required to request a refund.", 400, { reason: ["Required."] });
  }
  if (reason.length > REFUND_REQUEST_REASON_MAX_LENGTH) {
    throw new AppError("VALIDATION_ERROR", "The reason is too long.", 400, { reason: ["Too long."] });
  }

  return createRefundRequestCore({
    companyId: actor.companyId,
    requestedByUserId: actor.userId,
    reason,
    enforceWindow: true,
    isException: false,
    exceptionCategory: null,
    overrideClient,
  });
}

export async function listOwnRefundRequests(actor: CurrentActor): Promise<RefundRequest[]> {
  return listRefundRequestsForCompany(actor.companyId);
}

export type RefundEligibility =
  | { eligible: true; deadline: string; successfulPaymentAt: string }
  | { eligible: false; deadline: string | null; reason: "NO_SUBSCRIPTION" | "NO_PAYMENT" | "ALREADY_REFUNDED" | "WINDOW_EXPIRED" | "ALREADY_REQUESTED" };

/**
 * REFUND-20 — read-only. Lets the UI show "Refund available until <date>" (or
 * the expired/unavailable state) BEFORE the customer ever attempts to
 * submit, without duplicating the eligibility logic client-side — the exact
 * same findEligiblePayment + window calculation requestRefund itself uses.
 */
export async function getRefundEligibility(actor: CurrentActor, overrideClient?: Stripe): Promise<RefundEligibility> {
  const subscription = await findRefundableSubscription(actor.companyId);
  if (!subscription || !subscription.externalSubscriptionId) {
    return { eligible: false, deadline: null, reason: "NO_SUBSCRIPTION" };
  }

  const environment = resolveCheckoutEnvironment();
  const billingCustomer = await findStripeBillingCustomer(actor.companyId, environment === "LIVE");
  if (!billingCustomer) {
    return { eligible: false, deadline: null, reason: "NO_SUBSCRIPTION" };
  }

  const stripe = resolveRefundStripeClient(overrideClient);
  let payment: EligiblePayment;
  try {
    payment = await findEligiblePayment(stripe, subscription.externalSubscriptionId);
  } catch (error) {
    if (error instanceof AppError && error.code === "REFUND_ALREADY_REFUNDED") {
      return { eligible: false, deadline: null, reason: "ALREADY_REFUNDED" };
    }
    return { eligible: false, deadline: null, reason: "NO_PAYMENT" };
  }

  const existingNonTerminal = await findNonTerminalRefundRequestForPaymentIntent(payment.paymentIntentId);
  const deadline = refundWindowDeadline(payment.successfulPaymentAt);

  if (existingNonTerminal) {
    return { eligible: false, deadline: deadline.toISOString(), reason: "ALREADY_REQUESTED" };
  }
  if (new Date() > deadline) {
    return { eligible: false, deadline: deadline.toISOString(), reason: "WINDOW_EXPIRED" };
  }

  return { eligible: true, deadline: deadline.toISOString(), successfulPaymentAt: payment.successfulPaymentAt.toISOString() };
}
