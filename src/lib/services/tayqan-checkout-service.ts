import type Stripe from "stripe";
import {
  CommerceProviderEnvironment,
  type Prisma,
  type PrismaClient,
  TayqanHirePlan,
  TayqanHireStatus,
} from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { prisma } from "@/lib/db/prisma";
import { AppError, ConflictError } from "@/lib/errors/app-error";
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
import { getProjectRecord } from "@/lib/repositories/project-repository";
import {
  getTayqanPlanByPriceCode,
  TAYQAN_PRODUCT_FAMILY,
} from "@/lib/tayqan/tayqan-commerce";
import { getActiveTayqanEntitlement } from "@/lib/services/tayqan-hire-service";
import type { TayqanCheckoutInput } from "@/lib/validation/tayqan-schema";

function resolveEnvironment(): CommerceProviderEnvironment {
  return getConfiguredStripeMode() === "live"
    ? CommerceProviderEnvironment.LIVE
    : CommerceProviderEnvironment.TEST;
}

function resolveStripe(overrideClient?: Stripe): Stripe {
  try {
    return getStripeCommercialClient(overrideClient);
  } catch (error) {
    if (error instanceof StripeNotConfiguredError || error instanceof StripeInvalidKeyError) {
      throw new AppError("STRIPE_NOT_CONFIGURED", "TAYQAN checkout is not available right now.", 503);
    }
    throw error;
  }
}

function validateBaseUrl(liveMode: boolean): string {
  const raw = process.env.APP_BASE_URL?.trim();
  if (!raw) throw new AppError("APP_BASE_URL_NOT_CONFIGURED", "The application base URL is not configured.", 500);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new AppError("APP_BASE_URL_INVALID", "The configured application base URL is invalid.", 500);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new AppError("APP_BASE_URL_INVALID", "The application base URL must use HTTP or HTTPS.", 500);
  }
  if (liveMode && parsed.protocol !== "https:") {
    throw new AppError("APP_BASE_URL_INVALID", "Live TAYQAN checkout requires HTTPS.", 500);
  }
  return raw.replace(/\/+$/, "");
}

/**
 * TAYQAN-AUDIT-FIX-2 — a per-company Postgres advisory lock around TAYQAN
 * checkout session creation, mirroring commerce-checkout-service.ts's
 * acquireCompanyCheckoutLock pattern exactly. A DISTINCT namespace constant
 * from every other advisory lock already in this codebase (CHECKOUT_LOCK_
 * NAMESPACE=419628331, REFUND_REQUEST_LOCK_NAMESPACE=552014763, LIVE_SYNC_
 * LOCK_NAMESPACE=231874509, STRIPE_WEBHOOK_LOCK_NAMESPACE=875309417) so
 * TAYQAN checkout never contends on the same lock key space as any of them
 * for the same company — two independent checkout flows for one company
 * (e.g. a TAYQAN hire and a software-plan upgrade) must never block each
 * other.
 *
 * Before this lock, two near-simultaneous "hire TAYQAN" requests for the
 * same company could both observe "no active entitlement" and both survive
 * expireOtherTayqanSessions (which only inspects Stripe's live session
 * list — with neither request having committed anything yet for the other
 * to see), then both create separate, both-payable Stripe checkout
 * sessions. Serializing on this lock — with the real eligibility check
 * (getActiveTayqanEntitlement) and expireOtherTayqanSessions both re-run
 * strictly AFTER acquiring it — closes this: whichever request acquires
 * the lock second waits for the first to fully commit (including its real
 * `stripe.checkout.sessions.create` call, which happens before commit), so
 * its own fresh expireOtherTayqanSessions call is guaranteed to see the
 * first request's now-real Stripe session and reuse or expire it instead
 * of creating a genuinely independent duplicate.
 */
const TAYQAN_CHECKOUT_LOCK_NAMESPACE = 694_213_580;

async function acquireTayqanCheckoutLock(tx: Prisma.TransactionClient, companyId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${TAYQAN_CHECKOUT_LOCK_NAMESPACE}, hashtext(${companyId}))`;
}

type TayqanHireEntitlementClient = Pick<PrismaClient, "tayqanHireEntitlement">;
type TayqanCheckoutCustomerClient = Pick<PrismaClient, "company" | "stripeBillingCustomer">;

async function getOrCreateCustomer(
  stripe: Stripe,
  actor: CurrentActor,
  livemode: boolean,
  client: TayqanCheckoutCustomerClient = prisma,
): Promise<string> {
  const existing = await findStripeBillingCustomer(actor.companyId, livemode, client);
  if (existing) return existing.stripeCustomerId;

  const company = await client.company.findUniqueOrThrow({ where: { id: actor.companyId } });
  const customer = await stripe.customers.create(
    {
      name: company.legalName,
      email: company.email || actor.email,
      metadata: { quantara_company_id: actor.companyId },
    },
    {
      idempotencyKey: `quantara:${livemode ? "live" : "test"}:customer:${actor.companyId}`,
    },
  );
  const row = await createStripeBillingCustomer(
    actor.companyId,
    customer.id,
    livemode,
    client,
  );
  return row.stripeCustomerId;
}

async function expireOtherTayqanSessions(
  stripe: Stripe,
  customerId: string,
  requestedPriceCode: string,
  projectId: string,
): Promise<Stripe.Checkout.Session | null> {
  const page = await stripe.checkout.sessions.list({
    customer: customerId,
    status: "open",
    limit: 100,
  });

  let reusable: Stripe.Checkout.Session | null = null;
  for (const session of page.data) {
    if (session.metadata?.quantara_product_family !== TAYQAN_PRODUCT_FAMILY) continue;

    const isExact =
      !reusable &&
      session.metadata?.quantara_tayqan_price_code === requestedPriceCode &&
      session.metadata?.quantara_project_id === projectId &&
      Boolean(session.url);

    if (isExact) {
      reusable = session;
      continue;
    }

    try {
      await stripe.checkout.sessions.expire(session.id);
    } catch (error) {
      console.error("[tayqan-checkout] Could not expire stale TAYQAN checkout", session.id, error);
      throw new AppError(
        "TAYQAN_STALE_CHECKOUT_EXPIRE_FAILED",
        "Could not close a previous TAYQAN checkout attempt. Please try again.",
        502,
      );
    }
  }
  return reusable;
}

async function persistPendingHire(
  actor: CurrentActor,
  session: Stripe.Checkout.Session,
  priceCode: string,
  plan: "DAY" | "WEEK" | "MONTHLY",
  client: TayqanHireEntitlementClient = prisma,
) {
  const existing = await client.tayqanHireEntitlement.findUnique({
    where: { stripeCheckoutSessionId: session.id },
  });

  if (existing) {
    if (existing.companyId !== actor.companyId) {
      throw new AppError(
        "TAYQAN_ENTITLEMENT_TENANT_MISMATCH",
        "This TAYQAN checkout belongs to a different company.",
        409,
      );
    }

    return client.tayqanHireEntitlement.update({
      where: { id: existing.id },
      data: {
        purchasedByUserId: actor.userId,
        priceCode,
        plan: TayqanHirePlan[plan],
      },
    });
  }

  return client.tayqanHireEntitlement.create({
    data: {
      companyId: actor.companyId,
      purchasedByUserId: actor.userId,
      plan: TayqanHirePlan[plan],
      status: TayqanHireStatus.PENDING,
      priceCode,
      stripeCheckoutSessionId: session.id,
    },
  });
}

export async function createTayqanCheckoutSession(
  actor: CurrentActor,
  input: TayqanCheckoutInput,
  overrideClient?: Stripe,
) {
  const plan = getTayqanPlanByPriceCode(input.priceCode);
  if (!plan) throw new AppError("TAYQAN_PRICE_NOT_FOUND", "This TAYQAN hire package is not available.", 404);

  const project = await getProjectRecord(actor.companyId, input.projectId);
  if (input.boqId) {
    const boq = await prisma.bOQ.findFirst({
      where: {
        id: input.boqId,
        companyId: actor.companyId,
        projectId: project.id,
      },
      select: { id: true },
    });
    if (!boq) throw new AppError("TAYQAN_BOQ_PROJECT_MISMATCH", "The selected BOQ does not belong to this project.", 400);
  }

  // Global catalog validation — not company-specific, so it doesn't need the
  // per-company lock below (mirrors commerce-checkout-service.ts's own
  // "global catalog validation" comment ahead of its lock). The real,
  // company-specific eligibility check (an active/pending TAYQAN hire) is
  // re-run AFTER acquiring the lock, below.
  const price = await prisma.commercePrice.findUnique({
    where: { code: plan.priceCode },
    include: { product: true },
  });
  if (!price) throw new AppError("TAYQAN_PRICE_NOT_CONFIGURED", "This TAYQAN price is not configured.", 409);

  if (
    price.product.code !== plan.productCode ||
    price.amountMinor !== plan.amountMinor ||
    price.currency !== "AED" ||
    price.billingInterval !== plan.billingInterval ||
    !price.product.isActive ||
    !price.product.isPublic ||
    price.product.purchaseMode !== "DIRECT" ||
    !price.isActive ||
    price.reviewStatus !== "APPROVED" ||
    price.isFromPrice
  ) {
    throw new AppError(
      "TAYQAN_PRICE_CONFIGURATION_MISMATCH",
      "TAYQAN checkout is blocked because the commercial configuration does not match the approved hire package.",
      409,
    );
  }

  const environment = resolveEnvironment();
  const livemode = environment === CommerceProviderEnvironment.LIVE;
  const mapping = await findPriceMapping("STRIPE", environment, price.id);
  if (!mapping?.providerPriceId || !mapping.providerActive || mapping.synchronizationStatus !== "SYNCED") {
    throw new AppError(
      "TAYQAN_PRICE_NOT_SYNCED",
      "This TAYQAN package is not yet synchronized with Stripe.",
      409,
    );
  }
  // Narrowed to a plain string here — mapping.providerPriceId's null-check
  // above doesn't survive being read from inside the nested transaction
  // closure below.
  const providerPriceId = mapping.providerPriceId;

  const stripe = resolveStripe(overrideClient);
  const baseUrl = validateBaseUrl(livemode);

  /**
   * TAYQAN-AUDIT-FIX-2 — everything from here is serialized per company by
   * acquireTayqanCheckoutLock, and the real eligibility check
   * (getActiveTayqanEntitlement) is RE-RUN after acquiring the lock, never
   * trusting a pre-lock read — this is the actual race fix (mission 2).
   */
  return prisma.$transaction(
    async (tx) => {
      await acquireTayqanCheckoutLock(tx, actor.companyId);

      const active = await getActiveTayqanEntitlement(actor.companyId);
      if (active) {
        throw new ConflictError(
          "TAYQAN_ALREADY_HIRED",
          "TAYQAN is already hired for this company. Open the TAYQAN workspace to continue.",
        );
      }

      const customerId = await getOrCreateCustomer(stripe, actor, livemode, tx);
      const reusable = await expireOtherTayqanSessions(
        stripe,
        customerId,
        plan.priceCode,
        project.id,
      );

      if (reusable?.url) {
        await persistPendingHire(actor, reusable, plan.priceCode, plan.plan, tx);
        return {
          checkoutSessionId: reusable.id,
          checkoutUrl: reusable.url,
        };
      }

      const metadata: Stripe.MetadataParam = {
        quantara_company_id: actor.companyId,
        quantara_product_family: TAYQAN_PRODUCT_FAMILY,
        quantara_tayqan_plan: plan.plan,
        quantara_tayqan_price_code: plan.priceCode,
        quantara_project_id: project.id,
        quantara_project_slug: project.slug,
        quantara_tayqan_purchased_by_user_id: actor.userId,
        ...(input.boqId ? { quantara_boq_id: input.boqId } : {}),
      };

      const common: Stripe.Checkout.SessionCreateParams = {
        mode: plan.checkoutMode,
        customer: customerId,
        line_items: [{ price: providerPriceId, quantity: 1 }],
        success_url: `${baseUrl}/projects/${encodeURIComponent(project.slug)}/tayqan?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/projects/${encodeURIComponent(project.slug)}/tayqan?checkout=cancelled`,
        client_reference_id: actor.companyId,
        metadata,
      };

      if (plan.checkoutMode === "subscription") {
        common.subscription_data = { metadata };
      } else {
        common.payment_intent_data = { metadata };
      }

      const session = await stripe.checkout.sessions.create(common);
      if (!session.url) {
        throw new AppError("TAYQAN_CHECKOUT_NO_URL", "Stripe did not return a TAYQAN checkout URL.", 502);
      }

      await persistPendingHire(actor, session, plan.priceCode, plan.plan, tx);

      return {
        checkoutSessionId: session.id,
        checkoutUrl: session.url,
      };
    },
    // Generous timeout: this transaction holds a per-company advisory lock
    // and makes several real Stripe API calls while open, not just DB
    // writes — same reasoning as commerce-checkout-service.ts's own
    // createCommerceCheckoutSession transaction.
    { maxWait: 10_000, timeout: 30_000 },
  );
}
