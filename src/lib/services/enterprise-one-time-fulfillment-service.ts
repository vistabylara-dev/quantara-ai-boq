import type { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { resolveSoftwarePlanForCommerceProductCode } from "@/lib/entitlements/commerce-plan-mapping";

const ENTERPRISE_CODES = [
  "enterprise_core",
  "enterprise_scale",
  "enterprise_authority"
];

export async function applyEnterpriseOneTimeCheckoutSession(
  tx: Prisma.TransactionClient,
  session: Stripe.Checkout.Session,
  eventType: Stripe.Event.Type,
  stripe: Stripe
): Promise<boolean> {
  const metadata = session.metadata || {};
  if (metadata.quantara_checkout_mode !== "ENTERPRISE_ONE_TIME") {
    return false; // Not ours
  }

  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"].includes(eventType)) {
    return true;
  }

  if (eventType === "checkout.session.async_payment_failed" || eventType === "checkout.session.expired") {
    return true; 
  }

  if (session.payment_status !== "paid") {
    return true;
  }

  const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!stripeCustomerId) {
    throw new Error("No Stripe Customer on Checkout Session for Enterprise one-time purchase.");
  }

  // Use DB for tenancy, do not trust metadata companyId
  const billingCustomer = await tx.stripeBillingCustomer.findUnique({
    where: { stripeCustomerId },
  });
  if (!billingCustomer) {
    throw new Error(`Unknown Stripe customer ${stripeCustomerId} - fail closed.`);
  }
  const companyId = billingCustomer.companyId;

  // Retrieve line items
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
  if (!lineItems || lineItems.data.length === 0) {
    throw new Error("No line items found for Enterprise one-time purchase.");
  }
  const providerPriceId = lineItems.data[0].price?.id;
  if (!providerPriceId) {
    throw new Error("No provider price ID found on line item.");
  }

  // Resolve mapping
  const mapping = await tx.commerceProviderMapping.findFirst({
    where: { providerPriceId, providerObjectType: "PRICE" },
    include: { commercePrice: { include: { product: true } } }
  });
  
  if (!mapping || !mapping.commercePrice || !mapping.commercePrice.product) {
    throw new Error("No valid CommerceProviderMapping found for providerPriceId " + providerPriceId);
  }

  const product = mapping.commercePrice.product;
  const price = mapping.commercePrice;

  if (!ENTERPRISE_CODES.includes(product.code)) {
    throw new Error(`Product ${product.code} is not an Enterprise tier.`);
  }

  if (price.currency !== "AED" || price.billingInterval !== "ONE_TIME" || price.amountMinor !== session.amount_total) {
    throw new Error("Enterprise one-time financial parameters do not match exact expected values.");
  }

  // Resolve existing SoftwarePlan mapping
  const softwarePlan = await resolveSoftwarePlanForCommerceProductCode(product.code, tx);
  if (!softwarePlan) {
    throw new Error(`No mapped SoftwarePlan found for product code ${product.code}`);
  }

  // Create or update the company's CompanySoftwareSubscription
  const startsAt = new Date(); // Or session.created if we prefer, but new Date() is standard for activation.

  const existingSub = await tx.companySoftwareSubscription.findFirst({
    where: { companyId },
  });

  if (existingSub) {
    await tx.companySoftwareSubscription.update({
      where: { id: existingSub.id },
      data: {
        softwarePlanId: softwarePlan.id,
        status: "ACTIVE",
        startsAt,
        expiresAt: null,
        cancelledAt: null,
        source: "stripe_enterprise_one_time",
        externalSubscriptionId: session.id,
      }
    });
  } else {
    await tx.companySoftwareSubscription.create({
      data: {
        companyId,
        softwarePlanId: softwarePlan.id,
        status: "ACTIVE",
        startsAt,
        expiresAt: null,
        cancelledAt: null,
        source: "stripe_enterprise_one_time",
        externalSubscriptionId: session.id,
      }
    });
  }

  return true;
}
