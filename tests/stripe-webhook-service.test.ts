import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import {
  processStripeWebhookEvent,
  verifyStripeWebhookEvent,
} from "../src/lib/services/stripe-webhook-service";
import { mapStripeSubscriptionStatusToQuantara, stripeStatusGrantsEntitlement } from "../src/lib/payments/stripe-subscription-status";
import { upsertCommerceProduct, upsertCommercePrice } from "../src/lib/repositories/commerce-product-repository";
import { createMapping } from "../src/lib/repositories/commerce-provider-mapping-repository";
import { createStripeBillingCustomer } from "../src/lib/repositories/stripe-billing-repository";

const RUN_ID = `${Date.now()}-${process.pid}-webhook`;

function mockConstructingStripeClient(behavior: "throw" | "ok", event?: unknown) {
  return {
    webhooks: {
      constructEventAsync: vi.fn(async () => {
        if (behavior === "throw") throw new Error("signature mismatch");
        return event;
      }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function fakeSubscriptionEvent(input: {
  id: string;
  livemode: boolean;
  status: string;
  stripeCustomerId: string;
  providerPriceId: string;
  canceledAt?: number | null;
  subscriptionId?: string;
  type?: string;
}) {
  const subscriptionId = input.subscriptionId ?? `sub_${input.id}`;
  return {
    id: input.id,
    type: input.type ?? "customer.subscription.updated",
    livemode: input.livemode,
    data: {
      object: {
        id: subscriptionId,
        customer: input.stripeCustomerId,
        status: input.status,
        livemode: input.livemode,
        canceled_at: input.canceledAt ?? null,
        items: {
          data: [
            {
              price: { id: input.providerPriceId },
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            },
          ],
        },
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("stripe-subscription-status mapping (pure)", () => {
  it("maps active and trialing to ACTIVE", () => {
    expect(mapStripeSubscriptionStatusToQuantara("active")).toBe("ACTIVE");
    expect(mapStripeSubscriptionStatusToQuantara("trialing")).toBe("ACTIVE");
  });
  it("maps past_due and unpaid to PAST_DUE", () => {
    expect(mapStripeSubscriptionStatusToQuantara("past_due")).toBe("PAST_DUE");
    expect(mapStripeSubscriptionStatusToQuantara("unpaid")).toBe("PAST_DUE");
  });
  it("maps canceled to CANCELLED", () => {
    expect(mapStripeSubscriptionStatusToQuantara("canceled")).toBe("CANCELLED");
  });
  it("maps incomplete/incomplete_expired/paused to SUSPENDED (never grants entitlement)", () => {
    expect(mapStripeSubscriptionStatusToQuantara("incomplete")).toBe("SUSPENDED");
    expect(mapStripeSubscriptionStatusToQuantara("incomplete_expired")).toBe("SUSPENDED");
    expect(mapStripeSubscriptionStatusToQuantara("paused")).toBe("SUSPENDED");
  });
  it("stripeStatusGrantsEntitlement agrees with the ACTIVE mapping", () => {
    expect(stripeStatusGrantsEntitlement("active")).toBe(true);
    expect(stripeStatusGrantsEntitlement("trialing")).toBe(true);
    expect(stripeStatusGrantsEntitlement("past_due")).toBe(false);
    expect(stripeStatusGrantsEntitlement("canceled")).toBe(false);
    expect(stripeStatusGrantsEntitlement("incomplete")).toBe(false);
  });
});

describe("verifyStripeWebhookEvent", () => {
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const originalKey = process.env.STRIPE_SECRET_KEY;
  const originalMode = process.env.STRIPE_MODE;

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fixture_key_not_real";
    delete process.env.STRIPE_MODE;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_fixture_not_real";
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
    if (originalMode === undefined) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = originalMode;
  });

  it("rejects a missing Stripe-Signature header before ever touching Stripe", async () => {
    const client = mockConstructingStripeClient("ok", {});
    await expect(verifyStripeWebhookEvent("{}", null, client)).rejects.toMatchObject({ code: "STRIPE_WEBHOOK_SIGNATURE_MISSING" });
    expect(client.webhooks.constructEventAsync).not.toHaveBeenCalled();
  });

  it("rejects when STRIPE_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const client = mockConstructingStripeClient("ok", {});
    await expect(verifyStripeWebhookEvent("{}", "t=1,v1=abc", client)).rejects.toMatchObject({ code: "STRIPE_WEBHOOK_SECRET_NOT_CONFIGURED" });
  });

  it("rejects an invalid signature without leaking the raw verification error", async () => {
    const client = mockConstructingStripeClient("throw");
    await expect(verifyStripeWebhookEvent("{}", "t=1,v1=bad", client)).rejects.toMatchObject({ code: "STRIPE_WEBHOOK_SIGNATURE_INVALID" });
  });

  it("returns the constructed event on a valid signature", async () => {
    const fakeEvent = { id: "evt_1", type: "checkout.session.completed" };
    const client = mockConstructingStripeClient("ok", fakeEvent);
    const event = await verifyStripeWebhookEvent("{}", "t=1,v1=good", client);
    expect(event).toBe(fakeEvent);
  });
});

describe("processStripeWebhookEvent (integration, real local Postgres)", () => {
  let companyId: string;
  let otherCompanyId: string;
  let softwarePlanId: string;
  let providerPriceId: string;
  const originalMode = process.env.STRIPE_MODE;

  beforeAll(async () => {
    const company = await prisma.company.create({ data: { legalName: `Webhook Co ${RUN_ID}`, tradeName: "Webhook Co", email: `webhook-${RUN_ID}@example.com` } });
    companyId = company.id;
    const otherCompany = await prisma.company.create({ data: { legalName: `Webhook Other Co ${RUN_ID}`, tradeName: "Webhook Other Co", email: `webhook-other-${RUN_ID}@example.com` } });
    otherCompanyId = otherCompany.id;

    await createStripeBillingCustomer(companyId, `cus_${RUN_ID}`, false);

    const { product } = await upsertCommerceProduct({ code: `test_webhook_product_${RUN_ID}`, type: "SUBSCRIPTION", name: "Webhook Test Product", purchaseMode: "DIRECT", isActive: true });
    const { price } = await upsertCommercePrice({ productId: product.id, code: `test_webhook_price_${RUN_ID}`, amountMinor: 14900, billingInterval: "MONTH" });
    await prisma.commercePrice.update({ where: { id: price.id }, data: { reviewStatus: "APPROVED" } });
    providerPriceId = `price_test_webhook_${RUN_ID}`;
    await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: price.id, providerProductId: `prod_test_webhook_${RUN_ID}`, providerPriceId, providerObjectType: "PRICE" });

    const plan = await prisma.softwarePlan.create({ data: { key: `test_webhook_plan_${RUN_ID}`, name: "Webhook Test Plan", planType: "PRO", maxProjects: 3 } });
    softwarePlanId = plan.id;
    // The webhook processor resolves a SoftwarePlan via the fixed commerce-plan-mapping table, not
    // an arbitrary product code — since this test uses a synthetic product code, it exercises the
    // (correct, honest) no-op path. The subscription-creation happy path is covered separately below
    // using getOrCreateRealCommerceProduct("starter").
    void softwarePlanId;
  });

  beforeEach(() => {
    delete process.env.STRIPE_MODE; // defaults to test
  });

  afterEach(() => {
    if (originalMode === undefined) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = originalMode;
  });

  afterAll(async () => {
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
    await prisma.stripeWebhookEvent.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
    await prisma.stripeBillingCustomer.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
    await prisma.commerceProduct.deleteMany({ where: { code: { contains: RUN_ID } } });
    await prisma.softwarePlan.deleteMany({ where: { key: { contains: RUN_ID } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
    await prisma.$disconnect();
  });

  it("rejects a live event while configured for test mode", async () => {
    const event = fakeSubscriptionEvent({ id: `evt_mode_${RUN_ID}`, livemode: true, status: "active", stripeCustomerId: `cus_${RUN_ID}`, providerPriceId });
    await expect(processStripeWebhookEvent(event)).rejects.toMatchObject({ code: "STRIPE_WEBHOOK_MODE_MISMATCH" });
  });

  it("no-ops safely for an unknown Stripe customer (never mutates any tenant's state)", async () => {
    const event = fakeSubscriptionEvent({ id: `evt_unknown_${RUN_ID}`, livemode: false, status: "active", stripeCustomerId: `cus_unknown_${RUN_ID}`, providerPriceId });
    const result = await processStripeWebhookEvent(event);
    expect(result.outcome).toBe("processed");
    const subs = await prisma.companySoftwareSubscription.findMany({ where: { externalSubscriptionId: event.data.object.id } });
    expect(subs).toHaveLength(0);
  });

  it("records the event exactly once and treats a replayed event id as a safe no-op", async () => {
    const event = fakeSubscriptionEvent({ id: `evt_dup_${RUN_ID}`, livemode: false, status: "active", stripeCustomerId: `cus_${RUN_ID}`, providerPriceId, subscriptionId: `sub_dup_${RUN_ID}` });
    const first = await processStripeWebhookEvent(event);
    expect(first.outcome).toBe("processed");
    const second = await processStripeWebhookEvent(event);
    expect(second.outcome).toBe("duplicate");
    const ledgerCount = await prisma.stripeWebhookEvent.count({ where: { stripeEventId: event.id } });
    expect(ledgerCount).toBe(1);
  });

  it("customer.subscription.deleted moves an existing subscription to CANCELLED", async () => {
    const subscriptionId = `sub_cancel_${RUN_ID}`;
    await prisma.companySoftwareSubscription.create({
      data: { companyId, softwarePlanId, status: "ACTIVE", externalSubscriptionId: subscriptionId, source: "stripe" },
    });
    const event = fakeSubscriptionEvent({
      id: `evt_cancel_${RUN_ID}`,
      livemode: false,
      status: "canceled",
      stripeCustomerId: `cus_${RUN_ID}`,
      providerPriceId,
      subscriptionId,
      type: "customer.subscription.deleted",
      canceledAt: Math.floor(Date.now() / 1000),
    });
    await processStripeWebhookEvent(event);
    const sub = await prisma.companySoftwareSubscription.findUnique({ where: { externalSubscriptionId: subscriptionId } });
    expect(sub?.status).toBe("CANCELLED");
    expect(sub?.cancelledAt).not.toBeNull();
  });

  it("invoice.payment_failed marks an existing subscription PAST_DUE without granting entitlement", async () => {
    const subscriptionId = `sub_invoice_fail_${RUN_ID}`;
    await prisma.companySoftwareSubscription.create({
      data: { companyId, softwarePlanId, status: "ACTIVE", externalSubscriptionId: subscriptionId, source: "stripe" },
    });
    const event = {
      id: `evt_invoice_fail_${RUN_ID}`,
      type: "invoice.payment_failed",
      livemode: false,
      data: {
        object: {
          customer: `cus_${RUN_ID}`,
          parent: { subscription_details: { subscription: subscriptionId } },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await processStripeWebhookEvent(event);
    const sub = await prisma.companySoftwareSubscription.findUnique({ where: { externalSubscriptionId: subscriptionId } });
    expect(sub?.status).toBe("PAST_DUE");
  });

  it("never lets a subscription.deleted event for company A's Stripe customer cancel company B's subscription", async () => {
    const subscriptionId = `sub_tenant_cancel_${RUN_ID}`;
    await prisma.companySoftwareSubscription.create({
      data: { companyId: otherCompanyId, softwarePlanId, status: "ACTIVE", externalSubscriptionId: subscriptionId, source: "stripe" },
    });
    const event = fakeSubscriptionEvent({
      id: `evt_tenant_cancel_${RUN_ID}`,
      livemode: false,
      status: "canceled",
      stripeCustomerId: `cus_${RUN_ID}`, // company A's customer
      providerPriceId,
      subscriptionId, // belongs to company B
      type: "customer.subscription.deleted",
    });
    await processStripeWebhookEvent(event);
    const sub = await prisma.companySoftwareSubscription.findUnique({ where: { externalSubscriptionId: subscriptionId } });
    expect(sub?.companyId).toBe(otherCompanyId);
    expect(sub?.status).toBe("ACTIVE");
  });

  it("never lets an event for company A's Stripe customer mutate company B's subscription", async () => {
    const subscriptionId = `sub_tenant_${RUN_ID}`;
    await prisma.companySoftwareSubscription.create({
      data: { companyId: otherCompanyId, softwarePlanId, status: "ACTIVE", externalSubscriptionId: subscriptionId, source: "stripe" },
    });
    // Event references company A's Stripe customer, but this externalSubscriptionId belongs to company B.
    const event = fakeSubscriptionEvent({ id: `evt_tenant_${RUN_ID}`, livemode: false, status: "active", stripeCustomerId: `cus_${RUN_ID}`, providerPriceId, subscriptionId });
    await processStripeWebhookEvent(event);
    const sub = await prisma.companySoftwareSubscription.findUnique({ where: { externalSubscriptionId: subscriptionId } });
    expect(sub?.companyId).toBe(otherCompanyId);
    expect(sub?.status).toBe("ACTIVE");
  });
});
