import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/db/prisma";
import {
  isStripeWebhookEventIdConflict,
  processStripeWebhookEvent,
  verifyStripeWebhookEvent,
} from "../src/lib/services/stripe-webhook-service";
import { mapStripeSubscriptionStatusToQuantara, stripeStatusGrantsEntitlement } from "../src/lib/payments/stripe-subscription-status";
import { STRIPE_API_VERSION } from "../src/lib/payments/stripe-client";
import { upsertCommercePrice } from "../src/lib/repositories/commerce-product-repository";
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

/** A fake Stripe.Event envelope — event.data.object is only ever used to extract the subscription/invoice ID; the actual state applied always comes from the mocked subscriptions.retrieve() below (see stripe-webhook-service.ts's fetch-current-state design). */
function fakeEvent(input: {
  id: string;
  type: string;
  livemode: boolean;
  object: Record<string, unknown>;
  apiVersion?: string | null;
}) {
  return {
    id: input.id,
    type: input.type,
    livemode: input.livemode,
    api_version: input.apiVersion === undefined ? STRIPE_API_VERSION : input.apiVersion,
    data: { object: input.object },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function fakeSubscriptionEventEnvelope(input: {
  id: string;
  livemode: boolean;
  stripeCustomerId: string;
  subscriptionId: string;
  type?: string;
  apiVersion?: string | null;
}) {
  return fakeEvent({
    id: input.id,
    type: input.type ?? "customer.subscription.updated",
    livemode: input.livemode,
    apiVersion: input.apiVersion,
    object: { id: input.subscriptionId, customer: input.stripeCustomerId },
  });
}

function fakeInvoiceEventEnvelope(input: {
  id: string;
  livemode: boolean;
  stripeCustomerId: string;
  subscriptionId: string;
  type: "invoice.payment_succeeded" | "invoice.payment_failed";
}) {
  return fakeEvent({
    id: input.id,
    type: input.type,
    livemode: input.livemode,
    object: {
      customer: input.stripeCustomerId,
      parent: { subscription_details: { subscription: input.subscriptionId } },
    },
  });
}

/** The object returned by the mocked stripe.subscriptions.retrieve() call — this, not the event payload, is what stripe-webhook-service.ts actually applies. */
function fakeCurrentSubscription(input: {
  id: string;
  livemode: boolean;
  status: string;
  stripeCustomerId: string;
  providerPriceId: string;
  canceledAt?: number | null;
}) {
  return {
    id: input.id,
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
  };
}

/**
 * The webhook processor's plan resolution (resolveSoftwarePlanForCommerceProductCode)
 * only recognizes the fixed starter/professional/business commerce product
 * codes — a synthetic test-only product code never resolves to a plan, which
 * would make applyCurrentSubscriptionState's create path legitimately no-op.
 * This helper reuses a real seeded "starter" product if one already exists
 * (read-only — never mutates it) or creates a minimal one if the DB has no
 * seed data (as is the case for a fresh migrations-only test database) —
 * either way it never touches an existing row's fields.
 */
async function getOrCreateRealCommerceProduct(code: string) {
  const existing = await prisma.commerceProduct.findUnique({ where: { code } });
  if (existing) return existing;
  return prisma.commerceProduct.create({ data: { code, type: "SUBSCRIPTION", name: code, purchaseMode: "DIRECT", isActive: true, isPublic: true } });
}

function mockClientReturningSubscription(subscription: unknown) {
  return {
    subscriptions: { retrieve: vi.fn(async () => subscription) },
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

describe("isStripeWebhookEventIdConflict (pure) — FIX 3", () => {
  it("returns true only for a P2002 whose target includes stripeEventId", () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["stripeEventId"] },
    });
    expect(isStripeWebhookEventIdConflict(conflict)).toBe(true);
  });

  it("returns false for a P2002 on a different unique constraint (e.g. externalSubscriptionId) — this must be rethrown, not treated as a duplicate webhook", () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["externalSubscriptionId"] },
    });
    expect(isStripeWebhookEventIdConflict(conflict)).toBe(false);
  });

  it("returns false for a non-P2002 error and for a P2002 with no target metadata", () => {
    const wrongCode = new Prisma.PrismaClientKnownRequestError("Foreign key failed", { code: "P2003", clientVersion: "test" });
    expect(isStripeWebhookEventIdConflict(wrongCode)).toBe(false);
    const noTarget = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
    expect(isStripeWebhookEventIdConflict(noTarget)).toBe(false);
    expect(isStripeWebhookEventIdConflict(new Error("plain error"))).toBe(false);
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
    const fakeStripeEvent = { id: "evt_1", type: "checkout.session.completed" };
    const client = mockConstructingStripeClient("ok", fakeStripeEvent);
    const event = await verifyStripeWebhookEvent("{}", "t=1,v1=good", client);
    expect(event).toBe(fakeStripeEvent);
  });
});

describe("processStripeWebhookEvent (integration, real local Postgres)", () => {
  let companyId: string;
  let otherCompanyId: string;
  let softwarePlanId: string;
  let providerPriceId: string;
  const originalMode = process.env.STRIPE_MODE;
  const originalKey = process.env.STRIPE_SECRET_KEY;

  beforeAll(async () => {
    const company = await prisma.company.create({ data: { legalName: `Webhook Co ${RUN_ID}`, tradeName: "Webhook Co", email: `webhook-${RUN_ID}@example.com` } });
    companyId = company.id;
    const otherCompany = await prisma.company.create({ data: { legalName: `Webhook Other Co ${RUN_ID}`, tradeName: "Webhook Other Co", email: `webhook-other-${RUN_ID}@example.com` } });
    otherCompanyId = otherCompany.id;

    await createStripeBillingCustomer(companyId, `cus_${RUN_ID}`, false);

    const product = await getOrCreateRealCommerceProduct("starter");
    const { price } = await upsertCommercePrice({ productId: product.id, code: `test_webhook_price_${RUN_ID}`, amountMinor: 14900, billingInterval: "MONTH" });
    await prisma.commercePrice.update({ where: { id: price.id }, data: { reviewStatus: "APPROVED" } });
    providerPriceId = `price_test_webhook_${RUN_ID}`;
    await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: price.id, providerProductId: `prod_test_webhook_${RUN_ID}`, providerPriceId, providerObjectType: "PRICE" });

    const plan = await prisma.softwarePlan.create({ data: { key: `test_webhook_plan_${RUN_ID}`, name: "Webhook Test Plan", planType: "PRO", maxProjects: 3 } });
    softwarePlanId = plan.id;
    void softwarePlanId;
  });

  beforeEach(() => {
    delete process.env.STRIPE_MODE; // defaults to test
    process.env.STRIPE_SECRET_KEY = "sk_test_fixture_key_not_real";
  });

  afterEach(() => {
    if (originalMode === undefined) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = originalMode;
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  });

  afterAll(async () => {
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
    await prisma.stripeWebhookEvent.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
    await prisma.stripeBillingCustomer.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
    await prisma.commercePrice.deleteMany({ where: { code: { contains: RUN_ID } } }); // cascades to its CommerceProviderMapping; never deletes the "starter" product itself
    await prisma.softwarePlan.deleteMany({ where: { key: { contains: RUN_ID } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
    await prisma.$disconnect();
  });

  it("rejects a live event while configured for test mode", async () => {
    const event = fakeSubscriptionEventEnvelope({ id: `evt_mode_${RUN_ID}`, livemode: true, stripeCustomerId: `cus_${RUN_ID}`, subscriptionId: `sub_mode_${RUN_ID}` });
    await expect(processStripeWebhookEvent(event)).rejects.toMatchObject({ code: "STRIPE_WEBHOOK_MODE_MISMATCH" });
  });

  it("rejects an event whose api_version does not match the pinned STRIPE_API_VERSION — FIX 9", async () => {
    const event = fakeSubscriptionEventEnvelope({ id: `evt_apiver_${RUN_ID}`, livemode: false, stripeCustomerId: `cus_${RUN_ID}`, subscriptionId: `sub_apiver_${RUN_ID}`, apiVersion: "2019-01-01" });
    await expect(processStripeWebhookEvent(event)).rejects.toMatchObject({ code: "STRIPE_WEBHOOK_API_VERSION_MISMATCH" });
    const ledgerCount = await prisma.stripeWebhookEvent.count({ where: { stripeEventId: event.id } });
    expect(ledgerCount).toBe(0);
  });

  it("no-ops safely for an unknown Stripe customer (never mutates any tenant's state)", async () => {
    const current = fakeCurrentSubscription({ id: `sub_unknown_${RUN_ID}`, livemode: false, status: "active", stripeCustomerId: `cus_unknown_${RUN_ID}`, providerPriceId });
    const client = mockClientReturningSubscription(current);
    const event = fakeSubscriptionEventEnvelope({ id: `evt_unknown_${RUN_ID}`, livemode: false, stripeCustomerId: `cus_unknown_${RUN_ID}`, subscriptionId: current.id });
    const result = await processStripeWebhookEvent(event, client);
    expect(result.outcome).toBe("processed");
    const subs = await prisma.companySoftwareSubscription.findMany({ where: { externalSubscriptionId: current.id } });
    expect(subs).toHaveLength(0);
  });

  it("records the event exactly once and treats a replayed event id as a safe no-op", async () => {
    const subscriptionId = `sub_dup_${RUN_ID}`;
    const current = fakeCurrentSubscription({ id: subscriptionId, livemode: false, status: "active", stripeCustomerId: `cus_${RUN_ID}`, providerPriceId });
    const client = mockClientReturningSubscription(current);
    const event = fakeSubscriptionEventEnvelope({ id: `evt_dup_${RUN_ID}`, livemode: false, stripeCustomerId: `cus_${RUN_ID}`, subscriptionId });
    const first = await processStripeWebhookEvent(event, client);
    expect(first.outcome).toBe("processed");
    const second = await processStripeWebhookEvent(event, client);
    expect(second.outcome).toBe("duplicate");
    const ledgerCount = await prisma.stripeWebhookEvent.count({ where: { stripeEventId: event.id } });
    expect(ledgerCount).toBe(1);
  });

  it("applies Stripe's CURRENT subscription state, not the event payload — a subscription.updated event whose current fetch reads canceled results in CANCELLED", async () => {
    const subscriptionId = `sub_current_cancel_${RUN_ID}`;
    const current = fakeCurrentSubscription({ id: subscriptionId, livemode: false, status: "canceled", stripeCustomerId: `cus_${RUN_ID}`, providerPriceId, canceledAt: Math.floor(Date.now() / 1000) });
    const client = mockClientReturningSubscription(current);
    // The event TYPE is "updated", but the mocked current fetch says canceled — the applied state must follow the fetch, not the event type/payload.
    const event = fakeSubscriptionEventEnvelope({ id: `evt_current_cancel_${RUN_ID}`, livemode: false, stripeCustomerId: `cus_${RUN_ID}`, subscriptionId, type: "customer.subscription.updated" });
    await processStripeWebhookEvent(event, client);
    const sub = await prisma.companySoftwareSubscription.findUnique({ where: { externalSubscriptionId: subscriptionId } });
    expect(sub?.status).toBe("CANCELLED");
  });

  it("out-of-order 1: a stale customer.subscription.updated delivered after the deletion still reads canceled from the current fetch and remains canceled", async () => {
    const subscriptionId = `sub_ooo1_${RUN_ID}`;
    // Stripe's current truth is canceled by the time either event is actually processed.
    const cancelledNow = fakeCurrentSubscription({ id: subscriptionId, livemode: false, status: "canceled", stripeCustomerId: `cus_${RUN_ID}`, providerPriceId, canceledAt: Math.floor(Date.now() / 1000) });
    const client = mockClientReturningSubscription(cancelledNow);

    const deletedEvent = fakeSubscriptionEventEnvelope({ id: `evt_ooo1_deleted_${RUN_ID}`, livemode: false, stripeCustomerId: `cus_${RUN_ID}`, subscriptionId, type: "customer.subscription.deleted" });
    await processStripeWebhookEvent(deletedEvent, client);

    let sub = await prisma.companySoftwareSubscription.findUnique({ where: { externalSubscriptionId: subscriptionId } });
    expect(sub?.status).toBe("CANCELLED");

    // A stale "updated" event for the same subscription arrives afterward (out of order). Its payload is irrelevant — the current fetch still says canceled.
    const staleUpdatedEvent = fakeSubscriptionEventEnvelope({ id: `evt_ooo1_stale_updated_${RUN_ID}`, livemode: false, stripeCustomerId: `cus_${RUN_ID}`, subscriptionId, type: "customer.subscription.updated" });
    await processStripeWebhookEvent(staleUpdatedEvent, client);

    sub = await prisma.companySoftwareSubscription.findUnique({ where: { externalSubscriptionId: subscriptionId } });
    expect(sub?.status).toBe("CANCELLED");
  });

  it("out-of-order 2: invoice.payment_failed delivered before subscription-created converges to Stripe's actual current status (active), not a hardcoded PAST_DUE", async () => {
    const subscriptionId = `sub_ooo2_${RUN_ID}`;
    // By the time this webhook is actually processed, Stripe's real current state has already recovered to active.
    const currentlyActive = fakeCurrentSubscription({ id: subscriptionId, livemode: false, status: "active", stripeCustomerId: `cus_${RUN_ID}`, providerPriceId });
    const client = mockClientReturningSubscription(currentlyActive);

    const invoiceFailedEvent = fakeInvoiceEventEnvelope({ id: `evt_ooo2_invoice_failed_${RUN_ID}`, livemode: false, stripeCustomerId: `cus_${RUN_ID}`, subscriptionId, type: "invoice.payment_failed" });
    await processStripeWebhookEvent(invoiceFailedEvent, client);

    const sub = await prisma.companySoftwareSubscription.findUnique({ where: { externalSubscriptionId: subscriptionId } });
    expect(sub?.status).toBe("ACTIVE");
  });

  it("out-of-order 3: a stale active subscription.updated arriving after a newer cancellation cannot restore entitlement", async () => {
    const subscriptionId = `sub_ooo3_${RUN_ID}`;
    const cancelledNow = fakeCurrentSubscription({ id: subscriptionId, livemode: false, status: "canceled", stripeCustomerId: `cus_${RUN_ID}`, providerPriceId, canceledAt: Math.floor(Date.now() / 1000) });
    const client = mockClientReturningSubscription(cancelledNow);

    const deletedEvent = fakeSubscriptionEventEnvelope({ id: `evt_ooo3_deleted_${RUN_ID}`, livemode: false, stripeCustomerId: `cus_${RUN_ID}`, subscriptionId, type: "customer.subscription.deleted" });
    await processStripeWebhookEvent(deletedEvent, client);

    // A stale event claiming (in its payload, which is ignored) that the subscription is active again — the current fetch is still canceled.
    const staleActiveEvent = fakeSubscriptionEventEnvelope({ id: `evt_ooo3_stale_active_${RUN_ID}`, livemode: false, stripeCustomerId: `cus_${RUN_ID}`, subscriptionId, type: "customer.subscription.updated" });
    await processStripeWebhookEvent(staleActiveEvent, client);

    const sub = await prisma.companySoftwareSubscription.findUnique({ where: { externalSubscriptionId: subscriptionId } });
    expect(sub?.status).toBe("CANCELLED");
  });

  it("invoice.payment_succeeded does not blindly activate a subscription whose current Stripe state is actually canceled/suspended", async () => {
    const subscriptionId = `sub_invoice_succeeded_stale_${RUN_ID}`;
    const currentlySuspended = fakeCurrentSubscription({ id: subscriptionId, livemode: false, status: "paused", stripeCustomerId: `cus_${RUN_ID}`, providerPriceId });
    const client = mockClientReturningSubscription(currentlySuspended);

    const invoiceSucceededEvent = fakeInvoiceEventEnvelope({ id: `evt_invoice_succeeded_stale_${RUN_ID}`, livemode: false, stripeCustomerId: `cus_${RUN_ID}`, subscriptionId, type: "invoice.payment_succeeded" });
    await processStripeWebhookEvent(invoiceSucceededEvent, client);

    const sub = await prisma.companySoftwareSubscription.findUnique({ where: { externalSubscriptionId: subscriptionId } });
    expect(sub?.status).toBe("SUSPENDED");
  });

  it("never lets a subscription.deleted event for company A's Stripe customer cancel company B's subscription", async () => {
    const subscriptionId = `sub_tenant_cancel_${RUN_ID}`;
    await prisma.companySoftwareSubscription.create({
      data: { companyId: otherCompanyId, softwarePlanId, status: "ACTIVE", externalSubscriptionId: subscriptionId, source: "stripe" },
    });
    // Current fetch resolves to company A's customer, but this externalSubscriptionId belongs to company B.
    const current = fakeCurrentSubscription({ id: subscriptionId, livemode: false, status: "canceled", stripeCustomerId: `cus_${RUN_ID}`, providerPriceId, canceledAt: Math.floor(Date.now() / 1000) });
    const client = mockClientReturningSubscription(current);
    const event = fakeSubscriptionEventEnvelope({ id: `evt_tenant_cancel_${RUN_ID}`, livemode: false, stripeCustomerId: `cus_${RUN_ID}`, subscriptionId, type: "customer.subscription.deleted" });
    await processStripeWebhookEvent(event, client);
    const sub = await prisma.companySoftwareSubscription.findUnique({ where: { externalSubscriptionId: subscriptionId } });
    expect(sub?.companyId).toBe(otherCompanyId);
    expect(sub?.status).toBe("ACTIVE");
  });

  it("never lets an event for company A's Stripe customer mutate company B's subscription (customer.subscription.updated)", async () => {
    const subscriptionId = `sub_tenant_${RUN_ID}`;
    await prisma.companySoftwareSubscription.create({
      data: { companyId: otherCompanyId, softwarePlanId, status: "ACTIVE", externalSubscriptionId: subscriptionId, source: "stripe" },
    });
    const current = fakeCurrentSubscription({ id: subscriptionId, livemode: false, status: "active", stripeCustomerId: `cus_${RUN_ID}`, providerPriceId });
    const client = mockClientReturningSubscription(current);
    const event = fakeSubscriptionEventEnvelope({ id: `evt_tenant_${RUN_ID}`, livemode: false, stripeCustomerId: `cus_${RUN_ID}`, subscriptionId });
    await processStripeWebhookEvent(event, client);
    const sub = await prisma.companySoftwareSubscription.findUnique({ where: { externalSubscriptionId: subscriptionId } });
    expect(sub?.companyId).toBe(otherCompanyId);
    expect(sub?.status).toBe("ACTIVE");
  });

  it("a subscription retrieval failure degrades to a ledger-only no-op rather than crashing the webhook", async () => {
    const subscriptionId = `sub_retrieve_fail_${RUN_ID}`;
    const client = {
      subscriptions: { retrieve: vi.fn(async () => { throw new Error("network error"); }) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const event = fakeSubscriptionEventEnvelope({ id: `evt_retrieve_fail_${RUN_ID}`, livemode: false, stripeCustomerId: `cus_${RUN_ID}`, subscriptionId });
    const result = await processStripeWebhookEvent(event, client);
    expect(result.outcome).toBe("processed");
    const ledgerCount = await prisma.stripeWebhookEvent.count({ where: { stripeEventId: event.id } });
    expect(ledgerCount).toBe(1);
    const sub = await prisma.companySoftwareSubscription.findUnique({ where: { externalSubscriptionId: subscriptionId } });
    expect(sub).toBeNull();
  });
});
