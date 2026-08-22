import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import type { CommerceProviderEnvironment } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { requirePlatformCapability } from "@/lib/auth/platform-authorization";
import type { PlatformRequestMetadata } from "@/lib/repositories/platform-admin-repository";
import { findPriceMapping } from "@/lib/repositories/commerce-provider-mapping-repository";
import {
  acquireCompanyCheckoutLock,
  findAppOwnedOpenCheckoutSessions,
  getOrCreateStripeCustomerForCompanyId,
  hasBlockingStripeSubscription,
  hasNonFinalStripeSubscription,
  resolveCheckoutEnvironment,
  resolveCommercialStripeClient,
  SUPPORTED_CHECKOUT_CURRENCIES,
  validateAppBaseUrl,
} from "@/lib/services/commerce-checkout-service";

/**
 * v5 — sales-led Enterprise checkout.
 *
 * WHY THIS EXISTS (the gap it closes)
 * -----------------------------------
 * LEGACY/DEPRECATED: Enterprise Core/Scale/Authority are now `purchaseMode: "DIRECT"` and MUST use normal self-serve checkout. This legacy operator sales service now intentionally fails closed for those three DIRECT products
 * (commerce-checkout-service.ts's loadEligibleCommercePrice →
 * PRODUCT_NOT_DIRECT_PURCHASE). The previously assumed fulfillment route was
 * for an operator to hand-create a Stripe Payment Link in the Stripe
 * Dashboard. That route is NOT production-safe:
 *
 *   Enterprise customer pays a generic Payment Link
 *     → Stripe creates a BRAND NEW Stripe Customer for the payer
 *     → stripe-webhook-service.ts's applyCurrentSubscriptionState resolves
 *       tenant identity ONLY by looking that Stripe customer ID up in
 *       StripeBillingCustomer (it never trusts session/event metadata)
 *     → no StripeBillingCustomer row exists for that new customer
 *     → resolveCompanyIdForCustomer returns null, the handler returns early
 *     → THE CUSTOMER IS CHARGED AND NO ENTITLEMENT IS EVER GRANTED.
 *
 * The webhook's behavior there is correct and must not change — trusting
 * arbitrary Stripe metadata (or matching on email) for tenant identity would
 * be a cross-tenant entitlement vulnerability. The fix belongs on the
 * ISSUING side: the Checkout Session must be created server-side, already
 * bound to the company's Quantara-owned Stripe customer, so the customer
 * that ends up on the resulting subscription is one this app created and
 * recorded. Fulfillment then flows through the existing, unmodified webhook
 * path with no new trust assumptions whatsoever.
 *
 * SECURITY BOUNDARIES
 * -------------------
 *  1. Caller must be an authenticated PLATFORM_OWNER/PLATFORM_ADMIN holding
 *     `platform:operate` (PLATFORM_SUPPORT is read-only and is rejected).
 *  2. The ONLY two inputs accepted are a Quantara `companyId` (an internal
 *     UUID the operator picks from their own admin surface — same trust model
 *     as the existing owner-only refund-exception route) and a `priceCode`
 *     that must be one of exactly three literals. Amount, currency, Stripe
 *     Price ID, and Stripe Customer ID are never accepted from any caller;
 *     all four are resolved here from server-controlled database state.
 *  3. Entitlement identity is NOT carried by this session's metadata. The
 *     metadata below is written for operator traceability and to participate
 *     in the existing app-owned-session invariant only; the webhook derives
 *     the company solely from StripeBillingCustomer. Stripping or forging the
 *     metadata cannot move an entitlement to another tenant.
 *  4. Self-serve `/api/commerce/checkout` now processes these since they are DIRECT.
 */

/**
 * The exact, closed allowlist: price code → the product code that price MUST
 * belong to. Both halves are enforced, so an operator cannot point an
 * Enterprise price code at a re-parented or substituted product, and no
 * non-Enterprise price code can ever reach this path. Widening this set is a
 * deliberate, separately-reviewed commercial decision — never a side effect.
 */
export const ENTERPRISE_SALES_LED_PRICE_CODES = {
  enterprise_core_annual_aed_15000: "enterprise_core",
  enterprise_scale_annual_aed_25000: "enterprise_scale",
  enterprise_authority_annual_aed_35000: "enterprise_authority",
} as const;

export type EnterpriseSalesLedPriceCode = keyof typeof ENTERPRISE_SALES_LED_PRICE_CODES;

export const ENTERPRISE_SALES_LED_PRICE_CODE_LIST = Object.keys(
  ENTERPRISE_SALES_LED_PRICE_CODES,
) as EnterpriseSalesLedPriceCode[];

export function isEnterpriseSalesLedPriceCode(value: string): value is EnterpriseSalesLedPriceCode {
  return Object.prototype.hasOwnProperty.call(ENTERPRISE_SALES_LED_PRICE_CODES, value);
}

export type EnterpriseCheckoutRejectionReason =
  | "PRICE_CODE_NOT_ENTERPRISE"
  | "COMPANY_NOT_FOUND"
  | "PRICE_NOT_FOUND"
  | "PRICE_PRODUCT_MISMATCH"
  | "PRODUCT_INACTIVE"
  | "PRODUCT_NOT_SUBSCRIPTION"
  | "PRODUCT_NOT_SALES_LED"
  | "PRICE_INACTIVE"
  | "PRICE_NOT_APPROVED"
  | "PRICE_IS_INDICATIVE"
  | "ZERO_OR_NEGATIVE_AMOUNT"
  | "UNSUPPORTED_CURRENCY"
  | "UNSUPPORTED_INTERVAL"
  | "PROVIDER_MAPPING_MISSING"
  | "PROVIDER_MAPPING_NOT_SYNCED"
  | "PROVIDER_MAPPING_PRODUCT_MISMATCH"
  | "EXISTING_SUBSCRIPTION";

export class EnterpriseCheckoutNotEligibleError extends AppError {
  readonly reason: EnterpriseCheckoutRejectionReason;
  constructor(reason: EnterpriseCheckoutRejectionReason, message: string, status = 409) {
    super("ENTERPRISE_CHECKOUT_NOT_ELIGIBLE", message, status);
    this.name = "EnterpriseCheckoutNotEligibleError";
    this.reason = reason;
  }
}

/** Annual-prepaid only: all three Enterprise tiers are seeded with a single YEAR price and no monthly cadence. */
const ENTERPRISE_ELIGIBLE_INTERVALS = new Set(["YEAR"]);

export type CreateEnterpriseCheckoutSessionInput = {
  companyId: string;
  priceCode: string;
};

export type CreateEnterpriseCheckoutSessionResult = {
  checkoutSessionId: string;
  checkoutUrl: string;
  reusedExistingSession: boolean;
  companyId: string;
  companyLegalName: string;
  productCode: string;
  priceCode: string;
  amountMinor: number;
  currency: string;
  billingInterval: string;
  environment: CommerceProviderEnvironment;
  stripeCustomerId: string;
};

/**
 * Loads and fully re-validates the requested Enterprise price from
 * server-side state. Mirrors the shape of loadEligibleCommercePrice in
 * commerce-checkout-service.ts, but asserts the OPPOSITE purchaseMode: this
 * path is only ever valid for a product that is genuinely sales-led. If a
 * product were ever flipped to DIRECT it would belong in self-serve checkout,
 * and this operator path must fail closed rather than silently become a
 * second, less-visible way to sell the same thing.
 */
async function loadEnterpriseCommercePrice(priceCode: EnterpriseSalesLedPriceCode) {
  const expectedProductCode = ENTERPRISE_SALES_LED_PRICE_CODES[priceCode];

  const price = await prisma.commercePrice.findUnique({
    where: { code: priceCode },
    include: { product: true },
  });

  if (!price) {
    throw new EnterpriseCheckoutNotEligibleError("PRICE_NOT_FOUND", "This Enterprise price does not exist in the catalogue.", 404);
  }
  if (price.product.code !== expectedProductCode) {
    throw new EnterpriseCheckoutNotEligibleError(
      "PRICE_PRODUCT_MISMATCH",
      `Price "${priceCode}" no longer belongs to product "${expectedProductCode}". Resolve this catalogue inconsistency before issuing an Enterprise checkout.`,
    );
  }
  if (!price.product.isActive) {
    throw new EnterpriseCheckoutNotEligibleError("PRODUCT_INACTIVE", "This Enterprise product is not currently active.");
  }
  if (price.product.type !== "SUBSCRIPTION") {
    throw new EnterpriseCheckoutNotEligibleError("PRODUCT_NOT_SUBSCRIPTION", "This Enterprise product is not a subscription product.");
  }
  if (price.product.purchaseMode !== "CONTACT_SALES") {
    throw new EnterpriseCheckoutNotEligibleError(
      "PRODUCT_NOT_SALES_LED",
      "This product is no longer sales-led. A DIRECT product must be sold through normal checkout, not through the Enterprise sales path.",
    );
  }
  if (!price.isActive) {
    throw new EnterpriseCheckoutNotEligibleError("PRICE_INACTIVE", "This Enterprise price is no longer active.");
  }
  if (price.reviewStatus !== "APPROVED") {
    throw new EnterpriseCheckoutNotEligibleError(
      "PRICE_NOT_APPROVED",
      "This Enterprise price has not been approved. Approve it through the governed price-review flow before issuing a checkout link.",
    );
  }
  if (price.isFromPrice) {
    throw new EnterpriseCheckoutNotEligibleError("PRICE_IS_INDICATIVE", "This is an indicative \"from\" price and cannot be charged.");
  }
  if (price.amountMinor <= 0) {
    throw new EnterpriseCheckoutNotEligibleError("ZERO_OR_NEGATIVE_AMOUNT", "This Enterprise price has no chargeable amount.");
  }
  if (!SUPPORTED_CHECKOUT_CURRENCIES.has(price.currency)) {
    throw new EnterpriseCheckoutNotEligibleError("UNSUPPORTED_CURRENCY", "This Enterprise price's currency is not supported.");
  }
  if (!ENTERPRISE_ELIGIBLE_INTERVALS.has(price.billingInterval)) {
    throw new EnterpriseCheckoutNotEligibleError("UNSUPPORTED_INTERVAL", "Enterprise subscriptions are annual only.");
  }

  return price;
}

/**
 * Resolves the synchronized Stripe Price for this CommercePrice in the
 * environment this deployment is actually configured for.
 *
 * Deliberately `resolveCheckoutEnvironment()` (derived from STRIPE_MODE) and
 * NOT a hardcoded "LIVE". In production STRIPE_MODE=live, so this resolves
 * LIVE and reads exactly the mapping stripe-live-sync-service.ts creates for
 * these three sales-led codes — which is the intended behavior. Hardcoding
 * LIVE would be actively unsafe: stripe-webhook-service.ts resolves the
 * fulfillment mapping from `subscription.livemode`, and
 * assertWebhookModeMatches pins that to STRIPE_MODE. A checkout issued
 * against a LIVE mapping while the deployment processes TEST webhooks would
 * reintroduce the very "paid but never fulfilled" mismatch this whole change
 * exists to eliminate. Tying both sides to the same STRIPE_MODE-derived
 * environment guarantees the issuing side and the fulfilling side can never
 * disagree about which mapping table to read.
 */
async function resolveEnterpriseProviderPriceMapping(
  environment: CommerceProviderEnvironment,
  commercePriceId: string,
  commerceProductId: string,
) {
  const mapping = await findPriceMapping("STRIPE", environment, commercePriceId);
  if (!mapping || !mapping.providerPriceId) {
    throw new EnterpriseCheckoutNotEligibleError(
      "PROVIDER_MAPPING_MISSING",
      `This Enterprise price has no synchronized Stripe price in the ${environment} environment. Run the live catalogue synchronization before issuing a checkout link.`,
    );
  }
  if (!mapping.providerActive || mapping.synchronizationStatus !== "SYNCED") {
    throw new EnterpriseCheckoutNotEligibleError(
      "PROVIDER_MAPPING_NOT_SYNCED",
      "This Enterprise price's Stripe mapping is not currently synchronized.",
    );
  }
  // Defense in depth: the mapping row also records which internal product it
  // belongs to. If that ever disagrees with the price we just validated, the
  // catalogue is inconsistent and we must not charge against it.
  if (mapping.commerceProductId !== commerceProductId) {
    throw new EnterpriseCheckoutNotEligibleError(
      "PROVIDER_MAPPING_PRODUCT_MISMATCH",
      "This Enterprise price's Stripe mapping points at a different internal product. Resolve this catalogue inconsistency before issuing a checkout link.",
    );
  }
  return mapping.providerPriceId;
}

/**
 * Creates a Stripe-hosted Checkout Session for a sales-led Enterprise annual
 * subscription, bound to the target company's Quantara-owned Stripe customer.
 * The returned URL is what sales sends to that ONE specific customer.
 *
 * Fulfillment is then entirely the existing, unmodified webhook path:
 * customer pays → Stripe emits customer.subscription.created for a
 * subscription on the Quantara-owned customer → applyCurrentSubscriptionState
 * resolves the company via StripeBillingCustomer, resolves the CommercePrice
 * via CommerceProviderMapping, resolves commerce_enterprise_* via
 * commerce-plan-mapping.ts, and writes the CompanySoftwareSubscription.
 */
const MAX_STALE_ENTERPRISE_CHECKOUT_SESSIONS_TO_EXPIRE = 20;

export async function createEnterpriseSalesCheckoutSession(
  actor: PlatformActor,
  input: CreateEnterpriseCheckoutSessionInput,
  requestMetadata: PlatformRequestMetadata,
  overrideClient?: Stripe,
): Promise<CreateEnterpriseCheckoutSessionResult> {
  // PLATFORM_SUPPORT holds only platform:read and is rejected here; this is
  // an owner/admin commercial action, not a support-visible one.
  requirePlatformCapability(actor, "platform:operate");

  if (!isEnterpriseSalesLedPriceCode(input.priceCode)) {
    throw new EnterpriseCheckoutNotEligibleError(
      "PRICE_CODE_NOT_ENTERPRISE",
      "Only the three sales-led Enterprise annual price codes can be issued through this path.",
      400,
    );
  }

  const environment = resolveCheckoutEnvironment();
  const liveMode = environment === "LIVE";
  const stripe = resolveCommercialStripeClient(overrideClient);
  const baseUrl = validateAppBaseUrl(liveMode);

  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { id: true, legalName: true },
  });
  if (!company) {
    throw new NotFoundError("No company exists with that identifier.");
  }

  // Catalogue validation is company-independent, so it runs before the
  // per-company lock is taken — identical ordering to self-serve checkout.
  const price = await loadEnterpriseCommercePrice(input.priceCode);
  const providerPriceId = await resolveEnterpriseProviderPriceMapping(environment, price.id, price.productId);

  const result = await prisma.$transaction(
    async (tx) => {
      /**
       * The SAME per-company advisory lock namespace self-serve checkout
       * uses, so an operator-issued Enterprise session and a customer-issued
       * core software session for one company genuinely serialize against
       * each other. Every check below is performed strictly AFTER the lock is
       * held; nothing read before it is trusted.
       */
      await acquireCompanyCheckoutLock(tx, company.id);

      /**
       * Enterprise is CORE_SOFTWARE, and this codebase's standing invariant
       * (STRIPE-COMMERCIAL-6) is at most one non-final core software
       * subscription per company. An operator upgrading an existing paying
       * customer must cancel the current subscription first; silently issuing
       * a second one would double-bill the customer, because the webhook
       * creates a distinct CompanySoftwareSubscription row per Stripe
       * subscription ID.
       */
      if (await hasNonFinalStripeSubscription(company.id, tx)) {
        throw new EnterpriseCheckoutNotEligibleError(
          "EXISTING_SUBSCRIPTION",
          "This company already has an active or pending software subscription. Cancel or let the existing subscription end before issuing an Enterprise checkout link.",
        );
      }

      // Resolve (or create and persist) the company's Quantara-owned Stripe
      // customer. This single fact is what makes automatic fulfillment
      // possible — see this file's header.
      const stripeCustomerId = await getOrCreateStripeCustomerForCompanyId(stripe, company.id, null, liveMode, tx);

      /**
       * Closes the window the DB check above cannot: a subscription that has
       * been paid but whose webhook has not yet landed. Family-aware and
       * fail-closed, reusing self-serve checkout's exact implementation.
       */
      if (await hasBlockingStripeSubscription(stripe, stripeCustomerId, environment, { family: "CORE_SOFTWARE" })) {
        throw new EnterpriseCheckoutNotEligibleError(
          "EXISTING_SUBSCRIPTION",
          "Stripe already has a live or pending subscription for this company. Reconcile it before issuing an Enterprise checkout link.",
        );
      }

      /**
       * STRIPE-COMMERCIAL-21, applied identically here: at most ONE
       * Quantara-owned Checkout Session may be open for this company when
       * this returns. An existing open session for this EXACT Enterprise
       * price is reused (so re-issuing a link to the same customer returns
       * the same URL rather than minting a second payable session); every
       * other app-owned open session must be confirmed expired first, and a
       * failure to confirm fails the whole request closed.
       */
      const appOwnedOpenSessions = await findAppOwnedOpenCheckoutSessions(stripe, stripeCustomerId, company.id);
      const reusableIndex = appOwnedOpenSessions.findIndex(
        (session) => session.metadata?.quantara_price_code === price.code && Boolean(session.url),
      );
      const reusableSession = reusableIndex === -1 ? null : appOwnedOpenSessions[reusableIndex];
      const extraSessions = appOwnedOpenSessions.filter((_session, index) => index !== reusableIndex);

      if (extraSessions.length > 0) {
        console.warn(
          "[enterprise-sales-checkout] Stale open Checkout Session count",
          extraSessions.length,
        );
      }

      // Fail closed BEFORE making any Stripe mutations when the stale-session
      // count is abnormally high. Processing an unbounded list while the
      // advisory lock and Prisma transaction are held could exceed the
      // transaction timeout after partially expiring provider-side sessions.
      // Returning/reusing/creating a session while unprocessed stale sessions
      // remain would also violate the one-open-session invariant.
      if (extraSessions.length > MAX_STALE_ENTERPRISE_CHECKOUT_SESSIONS_TO_EXPIRE) {
        throw new AppError(
          "STRIPE_STALE_SESSION_LIMIT_EXCEEDED",
          "Too many previous checkout sessions exist for this company. Reconcile the stale sessions before issuing another Enterprise checkout link.",
          409,
        );
      }

      for (const extra of extraSessions) {
        try {
          await stripe.checkout.sessions.expire(extra.id);
        } catch (error) {
          console.error("[enterprise-sales-checkout] Failed to expire stale open Checkout Session", extra.id, error);
          throw new AppError(
            "STRIPE_STALE_SESSION_EXPIRE_FAILED",
            "Could not confirm cancellation of a previous checkout session for this company. Please try again.",
            502,
          );
        }
      }

      let session: Stripe.Checkout.Session;
      let reusedExistingSession = false;

      if (reusableSession?.url) {
        session = reusableSession;
        reusedExistingSession = true;
      } else {
        session = await stripe.checkout.sessions.create(
          {
            mode: "subscription",
            // Binds the resulting subscription to the Quantara-owned customer.
            // This, not any metadata below, is what the webhook resolves on.
            customer: stripeCustomerId,
            // Exactly the one approved, synchronized Stripe Price resolved
            // above. Never a caller-supplied price, amount, or currency.
            line_items: [{ price: providerPriceId, quantity: 1 }],
            success_url: `${baseUrl}/settings/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/settings/subscription?checkout=cancelled`,
            client_reference_id: company.id,
            /**
             * Traceability only — deliberately NOT an entitlement authority.
             * quantara_company_id additionally makes this session visible to
             * findAppOwnedOpenCheckoutSessions so it participates in the
             * one-open-session invariant. The webhook ignores all of this for
             * tenant resolution.
             */
            metadata: {
              quantara_company_id: company.id,
              quantara_price_code: price.code,
              quantara_environment: liveMode ? "live" : "test",
              quantara_checkout_channel: "sales_led_enterprise",
              quantara_issued_by_user_id: actor.userId,
            },
            subscription_data: {
              metadata: {
                quantara_company_id: company.id,
                quantara_price_code: price.code,
                quantara_checkout_channel: "sales_led_enterprise",
              },
            },
          },
          // A fresh key per genuine creation attempt — creation is already
          // serialized per company by the advisory lock above, so a bucketed
          // deterministic key would only risk replaying an expired session.
          { idempotencyKey: randomUUID() },
        );
      }

      if (!session.url) {
        throw new AppError("STRIPE_CHECKOUT_SESSION_NO_URL", "Stripe did not return a checkout URL.", 502);
      }

      /**
       * Written inside the same transaction as the rest of this operation so
       * an issued link is never absent from the operator audit trail. Records
       * the internal price code AND the resolved Stripe price/customer IDs —
       * this is an owner/admin-only audit surface used for reconciliation,
       * never a customer-facing or public one.
       *
       * Stripe API calls are not transactional, so a rollback after session
       * creation leaves an orphan open session at Stripe. That is self-
       * healing rather than dangerous: the session carries this app's own
       * quantara_company_id/quantara_price_code metadata, so the next call
       * for this company finds it via findAppOwnedOpenCheckoutSessions and
       * either reuses it (same price) or expires it (different price) before
       * anything new is created. The one-open-session invariant holds either
       * way.
       */
      await tx.platformAuditLog.create({
        data: {
          actorUserId: actor.userId,
          actorPlatformRole: actor.platformRole,
          action: "commerce_enterprise_checkout.issue_session",
          targetType: "Company",
          targetId: company.id,
          requestMetadataJson: {
            method: requestMetadata.method,
            path: requestMetadata.path,
            ...(requestMetadata.requestId ? { requestId: requestMetadata.requestId } : {}),
          },
          afterJson: {
            environment,
            productCode: price.product.code,
            priceCode: price.code,
            amountMinor: price.amountMinor,
            currency: price.currency,
            billingInterval: price.billingInterval,
            stripeCustomerId,
            stripePriceId: providerPriceId,
            checkoutSessionId: session.id,
            reusedExistingSession,
          },
        },
      });

      return {
        checkoutSessionId: session.id,
        checkoutUrl: session.url,
        reusedExistingSession,
        companyId: company.id,
        companyLegalName: company.legalName,
        productCode: price.product.code,
        priceCode: price.code,
        amountMinor: price.amountMinor,
        currency: price.currency,
        billingInterval: price.billingInterval,
        environment,
        stripeCustomerId,
      } satisfies CreateEnterpriseCheckoutSessionResult;
    },
    // Holds a per-company advisory lock while making several real Stripe API
    // calls — same generous bound as self-serve checkout.
    { maxWait: 10_000, timeout: 30_000 },
  );

  return result;
}

