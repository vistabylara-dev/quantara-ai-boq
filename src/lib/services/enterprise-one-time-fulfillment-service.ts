import type { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { resolveSoftwarePlanForCommerceProductCode } from "@/lib/entitlements/commerce-plan-mapping";

const ENTERPRISE_PRICE_SPECS = {
  enterprise_core: { priceCode: "enterprise_core_one_time_aed_15000", amountMinor: 1_500_000 },
  enterprise_scale: { priceCode: "enterprise_scale_one_time_aed_25000", amountMinor: 2_500_000 },
  enterprise_authority: { priceCode: "enterprise_authority_one_time_aed_35000", amountMinor: 3_500_000 },
} as const;

const ENTERPRISE_CHECKOUT_EVENTS = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

export async function applyEnterpriseOneTimeCheckoutSession(
  tx: Prisma.TransactionClient,
  session: Stripe.Checkout.Session,
  eventType: Stripe.Event.Type,
  stripe: Stripe,
): Promise<boolean> {
  if (session.metadata?.quantara_checkout_mode !== "ENTERPRISE_ONE_TIME") {
    return false;
  }

  if (!ENTERPRISE_CHECKOUT_EVENTS.has(eventType)) return true;
  if (eventType === "checkout.session.async_payment_failed" || eventType === "checkout.session.expired") {
    return true;
  }
  if (session.payment_status !== "paid") return true;
  if (session.mode !== "payment") {
    throw new Error("Enterprise one-time Checkout Session must use payment mode.");
  }

  const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!stripeCustomerId) {
    throw new Error("No Stripe Customer on Checkout Session for Enterprise one-time purchase.");
  }

  // Tenant identity comes only from the app-owned StripeBillingCustomer row.
  const billingCustomer = await tx.stripeBillingCustomer.findUnique({
    where: { stripeCustomerId },
  });
  if (!billingCustomer || billingCustomer.livemode !== session.livemode) {
    throw new Error(`Unknown or mode-mismatched Stripe customer ${stripeCustomerId} - fail closed.`);
  }

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
  if (lineItems.data.length !== 1) {
    throw new Error("Enterprise one-time purchase must contain exactly one line item.");
  }
  const providerPriceId = lineItems.data[0].price?.id;
  if (!providerPriceId) {
    throw new Error("No provider price ID found on Enterprise one-time line item.");
  }

  const environment = session.livemode ? "LIVE" : "TEST";
  const mapping = await tx.commerceProviderMapping.findFirst({
    where: {
      provider: "STRIPE",
      environment,
      providerPriceId,
      providerObjectType: "PRICE",
    },
    include: { commercePrice: { include: { product: true } } },
  });
  if (!mapping?.commercePrice?.product) {
    throw new Error(`No Stripe ${environment} price mapping found for ${providerPriceId}.`);
  }

  const price = mapping.commercePrice;
  const product = price.product;
  const spec = ENTERPRISE_PRICE_SPECS[product.code as keyof typeof ENTERPRISE_PRICE_SPECS];
  if (
    !spec ||
    price.code !== spec.priceCode ||
    price.amountMinor !== spec.amountMinor ||
    price.currency !== "AED" ||
    price.billingInterval !== "ONE_TIME" ||
    session.amount_total !== spec.amountMinor ||
    session.currency?.toUpperCase() !== "AED"
  ) {
    throw new Error("Enterprise one-time financial parameters do not match the canonical package.");
  }

  const softwarePlan = await resolveSoftwarePlanForCommerceProductCode(product.code, tx);
  if (!softwarePlan) {
    throw new Error(`No mapped SoftwarePlan found for product code ${product.code}.`);
  }

  const startsAt = session.created ? new Date(session.created * 1000) : new Date();
  const existing = await tx.companySoftwareSubscription.findUnique({
    where: { externalSubscriptionId: session.id },
  });

  if (existing) {
    if (existing.companyId !== billingCustomer.companyId) {
      throw new Error(`Tenant mismatch for Enterprise Checkout Session ${session.id}.`);
    }
    await tx.companySoftwareSubscription.update({
      where: { id: existing.id },
      data: {
        softwarePlanId: softwarePlan.id,
        status: "ACTIVE",
        startsAt,
        expiresAt: null,
        cancelledAt: null,
        source: "stripe_enterprise_one_time",
      },
    });
  } else {
    await tx.companySoftwareSubscription.create({
      data: {
        companyId: billingCustomer.companyId,
        softwarePlanId: softwarePlan.id,
        status: "ACTIVE",
        startsAt,
        expiresAt: null,
        cancelledAt: null,
        source: "stripe_enterprise_one_time",
        externalSubscriptionId: session.id,
      },
    });
  }

  return true;
}
