import type Stripe from "stripe";
import type { RefundAction, RefundExceptionCategory, RefundRequest } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { AppError } from "@/lib/errors/app-error";
import { getStripeCommercialClient, StripeInvalidKeyError, StripeNotConfiguredError } from "@/lib/payments/stripe-client";
import { findStripeBillingCustomerByStripeId } from "@/lib/repositories/stripe-billing-repository";
import {
  findRefundRequestById,
  markRefundRequestApproved,
  markRefundRequestFailed,
  markRefundRequestProcessing,
  markRefundRequestRejected,
  markRefundRequestSucceeded,
} from "@/lib/repositories/refund-request-repository";
import { createRefundRequestCore, REFUND_REQUEST_REASON_MAX_LENGTH } from "@/lib/services/refund-request-service";

/**
 * REFUND-5 — owner-only refund EXECUTION. Every step re-reads authoritative
 * state immediately before acting on it rather than trusting anything read
 * earlier in the request or cached in the RefundRequest row — the same
 * "never trust a stale local snapshot for a money-moving decision" posture
 * as commerce-checkout-service.ts (STRIPE-COMMERCIAL-11) and
 * stripe-webhook-service.ts (applyCurrentSubscriptionState). This module
 * never grants or revokes entitlement directly: REFUND_AND_CANCEL cancels
 * the Stripe subscription and lets the existing
 * customer.subscription.deleted webhook (already the sole writer of
 * CompanySoftwareSubscription state) reconcile Quantara's copy, so there is
 * exactly one code path that ever changes subscription state from Stripe
 * truth.
 */

function resolveRefundStripeClient(overrideClient?: Stripe): Stripe {
  try {
    return getStripeCommercialClient(overrideClient);
  } catch (error) {
    if (error instanceof StripeNotConfiguredError || error instanceof StripeInvalidKeyError) {
      throw new AppError("STRIPE_NOT_CONFIGURED", "Refund execution is not available right now.", 503);
    }
    throw error;
  }
}

async function loadPendingRefundRequest(id: string): Promise<RefundRequest> {
  const request = await findRefundRequestById(id);
  if (!request) throw new AppError("NOT_FOUND", "This refund request was not found.", 404);
  if (request.status !== "REQUESTED") {
    throw new AppError("REFUND_REQUEST_NOT_PENDING", `This refund request is already "${request.status.toLowerCase()}" and cannot be acted on again.`, 409);
  }
  return request;
}

export async function rejectRefundRequest(
  actor: PlatformActor,
  refundRequestId: string,
  reason: string | undefined,
): Promise<RefundRequest> {
  await loadPendingRefundRequest(refundRequestId);

  return prisma.$transaction(async (tx) => {
    // Re-read under the transaction to close the window between the
    // pre-check above and this write — a concurrent approve/reject on the
    // same row is still only ever applied once, since the WHERE-guarded
    // update below only succeeds from REQUESTED.
    const fresh = await tx.refundRequest.findUnique({ where: { id: refundRequestId } });
    if (!fresh) throw new AppError("NOT_FOUND", "This refund request was not found.", 404);
    if (fresh.status !== "REQUESTED") {
      throw new AppError("REFUND_REQUEST_NOT_PENDING", `This refund request is already "${fresh.status.toLowerCase()}" and cannot be acted on again.`, 409);
    }
    return markRefundRequestRejected(refundRequestId, actor.userId, reason?.trim() || null, tx);
  });
}

/**
 * REFUND-6 — Phase A: re-verify with Stripe and transition REQUESTED ->
 * APPROVED, recording the chosen action. Does not itself call Stripe's
 * refund API — see executeApprovedRefund below, which is the only function
 * that ever calls stripe.refunds.create. Splitting approval from execution
 * means a re-verification failure here never leaves a RefundRequest in
 * PROCESSING with no corresponding Stripe attempt.
 */
export async function approveRefundRequest(
  actor: PlatformActor,
  refundRequestId: string,
  action: RefundAction,
  overrideClient?: Stripe,
): Promise<RefundRequest> {
  const request = await loadPendingRefundRequest(refundRequestId);
  const stripe = resolveRefundStripeClient(overrideClient);

  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.retrieve(request.stripePaymentIntentId, { expand: ["latest_charge"] });
  } catch {
    throw new AppError("STRIPE_SUBSCRIPTION_RETRIEVAL_FAILED", "Could not re-verify this payment with Stripe.", 502);
  }

  if (paymentIntent.status !== "succeeded" || (paymentIntent.amount_received ?? 0) <= 0) {
    throw new AppError("REFUND_NOT_ELIGIBLE", "This payment is no longer in a refundable state.", 409);
  }

  const charge = paymentIntent.latest_charge;
  if (typeof charge !== "string" && charge?.refunded) {
    throw new AppError("REFUND_ALREADY_REFUNDED", "This payment has already been fully refunded.", 409);
  }

  // Same Stripe customer/company mapping as when the request was created —
  // never approve a refund whose PaymentIntent now resolves to a different
  // company's StripeBillingCustomer than the one that requested it.
  const stripeCustomerId = typeof paymentIntent.customer === "string" ? paymentIntent.customer : paymentIntent.customer?.id;
  const billingCustomer = stripeCustomerId ? await findStripeBillingCustomerByStripeId(stripeCustomerId) : null;
  if (!billingCustomer || billingCustomer.companyId !== request.companyId) {
    throw new AppError("REFUND_TENANT_MISMATCH", "This payment no longer maps to the requesting company.", 409);
  }

  return prisma.$transaction(async (tx) => {
    const fresh = await tx.refundRequest.findUnique({ where: { id: refundRequestId } });
    if (!fresh || fresh.status !== "REQUESTED") {
      throw new AppError("REFUND_REQUEST_NOT_PENDING", "This refund request is no longer pending review.", 409);
    }
    return markRefundRequestApproved(refundRequestId, actor.userId, action, tx);
  });
}

/**
 * REFUND-7 — Phase B: the ONLY function in this codebase that calls
 * stripe.refunds.create. Requires the request to already be APPROVED (see
 * approveRefundRequest). Uses the RefundRequest's own stable ID as the
 * Stripe idempotency key, so a retried/duplicate call for the SAME approved
 * request can never create a second Stripe refund — mirroring the
 * idempotency-key pattern already used for Customer/Checkout-Session
 * creation in commerce-checkout-service.ts.
 */
export async function executeApprovedRefund(
  actor: PlatformActor,
  refundRequestId: string,
  overrideClient?: Stripe,
): Promise<RefundRequest> {
  const request = await findRefundRequestById(refundRequestId);
  if (!request) throw new AppError("NOT_FOUND", "This refund request was not found.", 404);
  if (request.status !== "APPROVED") {
    throw new AppError("REFUND_REQUEST_NOT_APPROVED", "This refund request must be approved before it can be executed.", 409);
  }

  const stripe = resolveRefundStripeClient(overrideClient);

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.refundRequest.findUnique({ where: { id: refundRequestId } });
    if (!fresh || fresh.status !== "APPROVED") {
      throw new AppError("REFUND_REQUEST_NOT_APPROVED", "This refund request must be approved before it can be executed.", 409);
    }
    await markRefundRequestProcessing(refundRequestId, tx);
  });

  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create(
      { payment_intent: request.stripePaymentIntentId, amount: request.requestedAmountMinor },
      { idempotencyKey: `quantara:refund:${refundRequestId}` },
    );
  } catch (error) {
    const stripeError = error as { code?: string; message?: string };
    await markRefundRequestFailed(refundRequestId, stripeError.code ?? null, stripeError.message ?? "Stripe refund creation failed.");
    throw new AppError("STRIPE_REFUND_FAILED", "Stripe could not process this refund. It has been marked as failed and can be reviewed again.", 502);
  }

  // Never mark SUCCEEDED merely because the API call was accepted — only a
  // genuinely succeeded refund transitions the request; anything else
  // (pending/failed/canceled) is recorded as FAILED so an owner must
  // explicitly review it, never silently treated as done.
  if (refund.status !== "succeeded") {
    await markRefundRequestFailed(refundRequestId, refund.status ?? null, `Stripe refund status: ${refund.status ?? "unknown"}.`);
    throw new AppError("REFUND_NOT_YET_SUCCEEDED", `Stripe accepted the refund but it is not yet confirmed succeeded (status: ${refund.status ?? "unknown"}). It has been recorded as failed pending review — check Stripe directly before retrying.`, 502);
  }

  const succeeded = await markRefundRequestSucceeded(refundRequestId, refund.id);

  if (succeeded.action === "REFUND_AND_CANCEL") {
    try {
      await stripe.subscriptions.cancel(succeeded.externalSubscriptionId);
    } catch (error) {
      // The refund itself already succeeded and is recorded — a cancellation
      // failure here must not roll that back or misreport it as failed. Log
      // for operator follow-up; entitlement reconciliation still happens
      // safely via the next webhook Stripe delivers for this subscription
      // once it IS cancelled (retried here or done manually).
      console.error("[refund-execution] Refund succeeded but subscription cancellation failed", succeeded.externalSubscriptionId, error);
    }
  }

  return succeeded;
}

/**
 * REFUND-21 — owner-controlled exception path: the ONLY way a refund
 * request may bypass the normal REFUND_WINDOW_DAYS deadline (see
 * requestRefund/getRefundEligibility in refund-request-service.ts, which
 * enforce it unconditionally for every customer-submitted request). Creating
 * an exception row here does NOT approve or execute anything — it lands in
 * status REQUESTED exactly like a normal request and still requires a
 * separate approveRefundRequest + executeApprovedRefund call, tagged with
 * isException/exceptionCategory so the owner's own review UI can see it was
 * a window exception and why. "Owner-controlled" both in the sense that only
 * PLATFORM_OWNER may call this (see the route's platform:refund gate) and in
 * that it still never auto-approves.
 */
export async function createExceptionRefundRequest(
  actor: PlatformActor,
  companyId: string,
  category: RefundExceptionCategory,
  reason: string,
  overrideClient?: Stripe,
): Promise<RefundRequest> {
  const trimmedReason = reason?.trim();
  if (!trimmedReason) {
    throw new AppError("VALIDATION_ERROR", "A reason is required to create an exception refund request.", 400, { reason: ["Required."] });
  }
  if (trimmedReason.length > REFUND_REQUEST_REASON_MAX_LENGTH) {
    throw new AppError("VALIDATION_ERROR", "The reason is too long.", 400, { reason: ["Too long."] });
  }

  return createRefundRequestCore({
    companyId,
    requestedByUserId: actor.userId,
    reason: trimmedReason,
    enforceWindow: false,
    isException: true,
    exceptionCategory: category,
    overrideClient,
  });
}
