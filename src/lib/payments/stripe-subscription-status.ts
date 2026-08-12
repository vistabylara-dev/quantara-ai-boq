import { SubscriptionStatus } from "@prisma/client";
import type Stripe from "stripe";

/**
 * Deliberate, explicit mapping from Stripe's subscription status vocabulary
 * to Quantara's SubscriptionStatus enum (TRIAL | ACTIVE | PAST_DUE |
 * CANCELLED | EXPIRED | SUSPENDED — see prisma/schema.prisma). Audited
 * against the real enum rather than guessed.
 *
 * - active / trialing -> ACTIVE. Quantara's own TRIAL status is reserved for
 *   the internal 3-day promotional trial (trialStartedAt/trialExpiresAt/
 *   TRIAL_LIMITS in entitlement-service.ts) and does not apply to a real
 *   Stripe billing subscription — a Stripe "trialing" subscription already
 *   grants product access (that's what it's for), so it maps to ACTIVE, not
 *   TRIAL.
 * - past_due / unpaid -> PAST_DUE. An exact 1:1 match already exists in the
 *   enum; no need to fall back to a coarser status.
 * - canceled -> CANCELLED.
 * - incomplete / incomplete_expired -> SUSPENDED. The subscription never
 *   became active (first payment failed/expired) — SUSPENDED denies paid
 *   entitlement without misrepresenting it as an explicit customer
 *   cancellation (CANCELLED) or a natural time-based expiry (EXPIRED).
 * - paused -> SUSPENDED. Must not grant active entitlement.
 * - anything else -> SUSPENDED. Stripe's own type (`Stripe.Subscription.Status`)
 *   includes a forward-compatibility `OtherString` member for status values
 *   Stripe may introduce later, so this can never be a real TypeScript
 *   exhaustiveness check. Failing safe (deny entitlement) for a status this
 *   mapping doesn't yet recognize is deliberate — the alternative, throwing
 *   and aborting the whole webhook transaction, would also fail to log the
 *   event and could be replayed by Stripe indefinitely.
 */
export function mapStripeSubscriptionStatusToQuantara(
  stripeStatus: Stripe.Subscription.Status,
): SubscriptionStatus {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return SubscriptionStatus.ACTIVE;
    case "past_due":
    case "unpaid":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
      return SubscriptionStatus.CANCELLED;
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return SubscriptionStatus.SUSPENDED;
    default:
      console.warn(`[stripe-subscription-status] Unrecognized Stripe subscription status "${String(stripeStatus)}" — treating as SUSPENDED (no entitlement).`);
      return SubscriptionStatus.SUSPENDED;
  }
}

/** True only for the Stripe statuses that do grant paid entitlement (`active`, `trialing`). Used as a defensive double-check at the call site, not a substitute for the mapping above. */
export function stripeStatusGrantsEntitlement(stripeStatus: Stripe.Subscription.Status): boolean {
  return stripeStatus === "active" || stripeStatus === "trialing";
}
