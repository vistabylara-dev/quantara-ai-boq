import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { prisma } from "../src/lib/db/prisma";
import { processStripeWebhookEvent } from "../src/lib/services/stripe-webhook-service";
import { STRIPE_API_VERSION } from "../src/lib/payments/stripe-client";
import { createStripeBillingCustomer } from "../src/lib/repositories/stripe-billing-repository";
import { createRefundRequest } from "../src/lib/repositories/refund-request-repository";

const RUN_ID = `${Date.now()}-${process.pid}-refund-webhook`;

let planId: string;
let companyId: string;
let userId: string;
let subscriptionId: string;

function fakeChargeRefundedEvent(input: { id: string; chargeId: string; stripeCustomerId: string; refunded: boolean; latestRefundId?: string }) {
  return {
    id: input.id,
    type: "charge.refunded",
    livemode: false,
    api_version: STRIPE_API_VERSION,
    data: {
      object: {
        id: input.chargeId,
        customer: input.stripeCustomerId,
        refunded: input.refunded,
        refunds: input.latestRefundId ? { data: [{ id: input.latestRefundId }] } : { data: [] },
      },
    },
  } as unknown as Stripe.Event;
}

function mockChargeClient(charge: { id: string; customer: string; refunded: boolean; refunds?: { data: { id: string }[] } }) {
  return { charges: { retrieve: async () => charge } } as unknown as Stripe;
}

describe("Stripe webhook refund reconciliation (charge.refunded)", () => {
  beforeAll(async () => {
    const plan = await prisma.softwarePlan.create({
      data: { key: `refund_webhook_plan_${RUN_ID}`, name: "Refund Webhook Plan", description: "test", planType: "PRO", monthlyPrice: 149, annualPrice: 1490, currency: "AED" },
    });
    planId = plan.id;
    const company = await prisma.company.create({ data: { legalName: `Refund Webhook Co ${RUN_ID}`, tradeName: "Webhook Co", email: `refund-webhook-${RUN_ID}@example.com` } });
    companyId = company.id;
    const user = await prisma.user.create({
      data: { companyId, email: `refund-webhook-owner-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Owner", role: "COMPANY_OWNER", isActive: true, emailVerifiedAt: new Date() },
    });
    userId = user.id;
    const sub = await prisma.companySoftwareSubscription.create({
      data: { companyId, softwarePlanId: planId, status: "ACTIVE", externalSubscriptionId: `sub_${RUN_ID}`, source: "stripe" },
    });
    subscriptionId = sub.id;
    await createStripeBillingCustomer(companyId, `cus_${RUN_ID}`, false);
  });

  afterAll(async () => {
    await prisma.stripeWebhookEvent.deleteMany({ where: { companyId } });
    await prisma.refundRequest.deleteMany({ where: { companyId } });
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId } });
    await prisma.stripeBillingCustomer.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.softwarePlan.delete({ where: { id: planId } }).catch(() => {});
  });

  it("marks a matching PROCESSING RefundRequest SUCCEEDED when Stripe confirms the charge is refunded", async () => {
    const chargeId = `ch_${RUN_ID}_reconcile`;
    const request = await createRefundRequest({
      companyId, requestedByUserId: userId, companySoftwareSubscriptionId: subscriptionId,
      externalSubscriptionId: `sub_${RUN_ID}`, stripeInvoiceId: null, stripePaymentIntentId: `pi_${RUN_ID}_reconcile`,
      stripeChargeId: chargeId, originalAmountMinor: 14900, requestedAmountMinor: 14900, currency: "AED", reason: "test", successfulPaymentAt: new Date(), isException: false, exceptionCategory: null,
    });
    await prisma.refundRequest.update({ where: { id: request.id }, data: { status: "PROCESSING" } });

    const client = mockChargeClient({ id: chargeId, customer: `cus_${RUN_ID}`, refunded: true, refunds: { data: [{ id: `re_${RUN_ID}_webhook` }] } });
    const event = fakeChargeRefundedEvent({ id: `evt_${RUN_ID}_reconcile`, chargeId, stripeCustomerId: `cus_${RUN_ID}`, refunded: true, latestRefundId: `re_${RUN_ID}_webhook` });

    const result = await processStripeWebhookEvent(event, client);
    expect(result.outcome).toBe("processed");

    const fresh = await prisma.refundRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(fresh.status).toBe("SUCCEEDED");
    expect(fresh.stripeRefundId).toBe(`re_${RUN_ID}_webhook`);
  });

  it("is a safe no-op for a charge.refunded event with no matching RefundRequest (a refund created directly in the Stripe dashboard)", async () => {
    const client = mockChargeClient({ id: `ch_${RUN_ID}_unrelated`, customer: `cus_${RUN_ID}`, refunded: true });
    const event = fakeChargeRefundedEvent({ id: `evt_${RUN_ID}_unrelated`, chargeId: `ch_${RUN_ID}_unrelated`, stripeCustomerId: `cus_${RUN_ID}`, refunded: true });

    const result = await processStripeWebhookEvent(event, client);
    expect(result.outcome).toBe("processed"); // ledger recorded; no RefundRequest row to update, no error
  });

  it("is idempotent — redelivering the exact same event is reported as a safe duplicate, never double-applied", async () => {
    const chargeId = `ch_${RUN_ID}_dup`;
    await createRefundRequest({
      companyId, requestedByUserId: userId, companySoftwareSubscriptionId: subscriptionId,
      externalSubscriptionId: `sub_${RUN_ID}`, stripeInvoiceId: null, stripePaymentIntentId: `pi_${RUN_ID}_dup`,
      stripeChargeId: chargeId, originalAmountMinor: 14900, requestedAmountMinor: 14900, currency: "AED", reason: "test", successfulPaymentAt: new Date(), isException: false, exceptionCategory: null,
    });
    const client = mockChargeClient({ id: chargeId, customer: `cus_${RUN_ID}`, refunded: true, refunds: { data: [{ id: `re_${RUN_ID}_dup` }] } });
    const event = fakeChargeRefundedEvent({ id: `evt_${RUN_ID}_dup`, chargeId, stripeCustomerId: `cus_${RUN_ID}`, refunded: true, latestRefundId: `re_${RUN_ID}_dup` });

    const first = await processStripeWebhookEvent(event, client);
    const second = await processStripeWebhookEvent(event, client);

    expect(first.outcome).toBe("processed");
    expect(second.outcome).toBe("duplicate");
  });
});
