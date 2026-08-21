import type Stripe from "stripe";
import {
  CommerceProviderEnvironment,
  Prisma,
  TayqanHirePlan,
  TayqanHireStatus,
} from "@prisma/client";
import { AppError } from "@/lib/errors/app-error";
import { findMappingByProviderPriceId } from "@/lib/repositories/commerce-provider-mapping-repository";
import {
  getTayqanPlanByPriceCode,
  isTayqanMonthlyProductCode,
  TAYQAN_PRODUCT_FAMILY,
} from "@/lib/tayqan/tayqan-commerce";

function objectId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function companyIdFromCustomer(
  tx: Prisma.TransactionClient,
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): Promise<string | null> {
  const customerId = objectId(customer);
  if (!customerId) return null;
  const row = await tx.stripeBillingCustomer.findUnique({
    where: { stripeCustomerId: customerId },
    select: { companyId: true },
  });
  return row?.companyId ?? null;
}

async function validPurchaser(
  tx: Prisma.TransactionClient,
  companyId: string,
  userId: string | undefined,
): Promise<string | null> {
  if (!userId) return null;
  const user = await tx.user.findFirst({
    where: { id: userId, companyId },
    select: { id: true },
  });
  return user?.id ?? null;
}

function requireMetadataCompanyMatch(companyId: string, metadata: Stripe.Metadata | null): void {
  const metadataCompanyId = metadata?.quantara_company_id;
  if (metadataCompanyId && metadataCompanyId !== companyId) {
    throw new AppError(
      "TAYQAN_STRIPE_TENANT_MISMATCH",
      "Stripe TAYQAN payment metadata does not match the billing customer.",
      409,
    );
  }
}

function requireEntitlementCompanyMatch(
  companyId: string,
  entitlement: { companyId: string } | null,
): void {
  if (entitlement && entitlement.companyId !== companyId) {
    throw new AppError(
      "TAYQAN_ENTITLEMENT_TENANT_MISMATCH",
      "TAYQAN Stripe identifiers are already linked to a different company.",
      409,
    );
  }
}

function oneTimeStatus(
  session: Stripe.Checkout.Session,
  eventType?: string,
): TayqanHireStatus {
  if (session.payment_status === "paid") return TayqanHireStatus.ACTIVE;
  if (eventType === "checkout.session.async_payment_failed" || session.status === "expired") {
    return TayqanHireStatus.PAYMENT_FAILED;
  }
  return TayqanHireStatus.PENDING;
}

function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  return objectId(session.payment_intent as string | Stripe.PaymentIntent | null);
}

function subscriptionId(session: Stripe.Checkout.Session): string | null {
  return objectId(session.subscription as string | Stripe.Subscription | null);
}

function periodStatus(status: Stripe.Subscription.Status): TayqanHireStatus {
  switch (status) {
    case "active":
    case "trialing":
      return TayqanHireStatus.ACTIVE;
    case "canceled":
      return TayqanHireStatus.CANCELLED;
    case "incomplete_expired":
      return TayqanHireStatus.EXPIRED;
    case "incomplete":
    case "past_due":
    case "paused":
    case "unpaid":
      return TayqanHireStatus.PAYMENT_FAILED;
    default:
      return TayqanHireStatus.PAYMENT_FAILED;
  }
}

export function isTayqanCheckoutSession(session: Stripe.Checkout.Session): boolean {
  return session.metadata?.quantara_product_family === TAYQAN_PRODUCT_FAMILY;
}

async function reconcileMonthlyCheckoutRow(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    purchasedByUserId: string | null;
    sessionId: string;
    stripeSubscriptionId: string | null;
    priceCode: string;
  },
) {
  const sessionRow = await tx.tayqanHireEntitlement.findUnique({
    where: { stripeCheckoutSessionId: input.sessionId },
  });
  const subscriptionRow = input.stripeSubscriptionId
    ? await tx.tayqanHireEntitlement.findUnique({
        where: { stripeSubscriptionId: input.stripeSubscriptionId },
      })
    : null;

  requireEntitlementCompanyMatch(input.companyId, sessionRow);
  requireEntitlementCompanyMatch(input.companyId, subscriptionRow);

  if (sessionRow && subscriptionRow && sessionRow.id !== subscriptionRow.id) {
    if (sessionRow.status === TayqanHireStatus.PENDING) {
      await tx.tayqanHireEntitlement.delete({ where: { id: sessionRow.id } });
      return tx.tayqanHireEntitlement.update({
        where: { id: subscriptionRow.id },
        data: {
          stripeCheckoutSessionId: input.sessionId,
          purchasedByUserId: input.purchasedByUserId ?? subscriptionRow.purchasedByUserId,
        },
      });
    }
    throw new AppError(
      "TAYQAN_ENTITLEMENT_CONFLICT",
      "TAYQAN billing state contains conflicting Stripe identifiers.",
      409,
    );
  }

  if (sessionRow) {
    return tx.tayqanHireEntitlement.update({
      where: { id: sessionRow.id },
      data: {
        stripeSubscriptionId: input.stripeSubscriptionId ?? sessionRow.stripeSubscriptionId,
        purchasedByUserId: input.purchasedByUserId ?? sessionRow.purchasedByUserId,
      },
    });
  }

  if (subscriptionRow) {
    return tx.tayqanHireEntitlement.update({
      where: { id: subscriptionRow.id },
      data: {
        stripeCheckoutSessionId: input.sessionId,
        purchasedByUserId: input.purchasedByUserId ?? subscriptionRow.purchasedByUserId,
      },
    });
  }

  return tx.tayqanHireEntitlement.create({
    data: {
      companyId: input.companyId,
      purchasedByUserId: input.purchasedByUserId,
      plan: TayqanHirePlan.MONTHLY,
      status: TayqanHireStatus.PENDING,
      priceCode: input.priceCode,
      stripeCheckoutSessionId: input.sessionId,
      stripeSubscriptionId: input.stripeSubscriptionId,
    },
  });
}

export async function applyTayqanCheckoutSession(
  tx: Prisma.TransactionClient,
  session: Stripe.Checkout.Session,
  eventType?: string,
): Promise<boolean> {
  if (!isTayqanCheckoutSession(session)) return false;

  const companyId = await companyIdFromCustomer(tx, session.customer);
  if (!companyId) return true;
  requireMetadataCompanyMatch(companyId, session.metadata);

  const priceCode = session.metadata?.quantara_tayqan_price_code;
  if (!priceCode) {
    throw new AppError("TAYQAN_PRICE_METADATA_MISSING", "TAYQAN Stripe checkout is missing its trusted price code.", 409);
  }
  const plan = getTayqanPlanByPriceCode(priceCode);
  if (!plan) {
    throw new AppError("TAYQAN_PRICE_METADATA_INVALID", "TAYQAN Stripe checkout contains an unknown price code.", 409);
  }

  const purchasedByUserId = await validPurchaser(
    tx,
    companyId,
    session.metadata?.quantara_tayqan_purchased_by_user_id,
  );

  if (plan.plan === "MONTHLY") {
    await reconcileMonthlyCheckoutRow(tx, {
      companyId,
      purchasedByUserId,
      sessionId: session.id,
      stripeSubscriptionId: subscriptionId(session),
      priceCode,
    });
    return true;
  }

  const status = oneTimeStatus(session, eventType);
  const startsAt = status === TayqanHireStatus.ACTIVE ? new Date() : null;
  const expiresAt =
    startsAt && plan.durationHours
      ? new Date(startsAt.getTime() + plan.durationHours * 60 * 60 * 1000)
      : null;

  const existing = await tx.tayqanHireEntitlement.findUnique({
    where: { stripeCheckoutSessionId: session.id },
  });

  if (existing) {
    requireEntitlementCompanyMatch(companyId, existing);

    const nextStatus =
      existing.status === TayqanHireStatus.ACTIVE ||
      status === TayqanHireStatus.ACTIVE
        ? TayqanHireStatus.ACTIVE
        : existing.status === TayqanHireStatus.PAYMENT_FAILED
          ? TayqanHireStatus.PAYMENT_FAILED
          : status;

    await tx.tayqanHireEntitlement.update({
      where: { id: existing.id },
      data: {
        purchasedByUserId: purchasedByUserId ?? existing.purchasedByUserId,
        status: nextStatus,
        startsAt:
          existing.status === TayqanHireStatus.ACTIVE
            ? existing.startsAt
            : startsAt,
        expiresAt:
          existing.status === TayqanHireStatus.ACTIVE
            ? existing.expiresAt
            : expiresAt,
        stripePaymentIntentId:
          paymentIntentId(session) ?? existing.stripePaymentIntentId,
      },
    });
  } else {
    await tx.tayqanHireEntitlement.create({
      data: {
        companyId,
        purchasedByUserId,
        plan: plan.plan === "DAY" ? TayqanHirePlan.DAY : TayqanHirePlan.WEEK,
        status,
        priceCode,
        startsAt,
        expiresAt,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId(session),
      },
    });
  }
  return true;
}

export async function applyTayqanMonthlySubscriptionIfPresent(
  tx: Prisma.TransactionClient,
  subscription: Stripe.Subscription,
): Promise<boolean> {
  const environment = subscription.livemode
    ? CommerceProviderEnvironment.LIVE
    : CommerceProviderEnvironment.TEST;
  const companyId = await companyIdFromCustomer(tx, subscription.customer);
  if (!companyId) return false;

  for (const item of subscription.items.data) {
    const providerPriceId = item.price?.id;
    if (!providerPriceId) continue;

    const mapping = await findMappingByProviderPriceId(
      "STRIPE",
      environment,
      providerPriceId,
      tx,
    );
    if (!mapping?.commercePriceId) continue;

    const commercePrice = await tx.commercePrice.findUnique({
      where: { id: mapping.commercePriceId },
      include: { product: true },
    });
    if (!commercePrice || !isTayqanMonthlyProductCode(commercePrice.product.code)) continue;

    const purchasedByUserId = await validPurchaser(
      tx,
      companyId,
      subscription.metadata?.quantara_tayqan_purchased_by_user_id,
    );
    requireMetadataCompanyMatch(companyId, subscription.metadata);

    const status = periodStatus(subscription.status);
    const startsAt = item.current_period_start
      ? new Date(item.current_period_start * 1000)
      : null;
    const expiresAt = item.current_period_end
      ? new Date(item.current_period_end * 1000)
      : null;

    const existing = await tx.tayqanHireEntitlement.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (existing) {
      requireEntitlementCompanyMatch(companyId, existing);

      await tx.tayqanHireEntitlement.update({
        where: { id: existing.id },
        data: {
          purchasedByUserId: purchasedByUserId ?? existing.purchasedByUserId,
          status,
          startsAt,
          expiresAt,
          priceCode: commercePrice.code,
        },
      });
      return true;
    }

    const pending = await tx.tayqanHireEntitlement.findFirst({
      where: {
        companyId,
        plan: TayqanHirePlan.MONTHLY,
        status: TayqanHireStatus.PENDING,
        priceCode: commercePrice.code,
      },
      orderBy: { createdAt: "desc" },
    });
    if (pending) {
      await tx.tayqanHireEntitlement.update({
        where: { id: pending.id },
        data: {
          stripeSubscriptionId: subscription.id,
          purchasedByUserId: purchasedByUserId ?? pending.purchasedByUserId,
          status,
          startsAt,
          expiresAt,
        },
      });
      return true;
    }

    await tx.tayqanHireEntitlement.create({
      data: {
        companyId,
        purchasedByUserId,
        plan: TayqanHirePlan.MONTHLY,
        status,
        priceCode: commercePrice.code,
        startsAt,
        expiresAt,
        stripeSubscriptionId: subscription.id,
      },
    });
    return true;
  }

  return false;
}
