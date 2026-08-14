import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { prisma } from "../src/lib/db/prisma";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { requestRefund } from "../src/lib/services/refund-request-service";
import { createStripeBillingCustomer } from "../src/lib/repositories/stripe-billing-repository";

const RUN_ID = `${Date.now()}-${process.pid}-refund-req`;

function actorFor(userId: string, companyId: string, email: string): CurrentActor {
  return { userId, companyId, role: "COMPANY_OWNER", fullName: "Refund Test Owner", email };
}

let planId: string;
const cleanupCompanyIds: string[] = [];

async function makeCompanyWithSubscription(label: string, externalSubscriptionId: string) {
  const company = await prisma.company.create({
    data: { legalName: `Refund ${label} Co ${RUN_ID}`, tradeName: `Refund ${label}`, email: `refund-${label}-${RUN_ID}@example.com` },
  });
  cleanupCompanyIds.push(company.id);
  const user = await prisma.user.create({
    data: { companyId: company.id, email: `refund-${label}-owner-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Owner", role: "COMPANY_OWNER", isActive: true, emailVerifiedAt: new Date() },
  });
  await prisma.companySoftwareSubscription.create({
    data: { companyId: company.id, softwarePlanId: planId, status: "ACTIVE", externalSubscriptionId, source: "stripe" },
  });
  await createStripeBillingCustomer(company.id, `cus_test_${RUN_ID}_${label}`, false);
  return { company, user };
}

/** Mocked Stripe client answering the subscription -> invoice -> payment_intent -> charge chain findEligiblePayment walks. */
function mockRefundStripeClient(input: {
  invoiceId: string;
  paymentIntentId: string;
  chargeId: string;
  amountReceived: number;
  paymentIntentStatus?: Stripe.PaymentIntent.Status;
  chargeRefunded?: boolean;
}) {
  return {
    subscriptions: {
      retrieve: async () => ({
        latest_invoice: {
          id: input.invoiceId,
          status_transitions: { paid_at: Math.floor(Date.now() / 1000) - 3600 },
          payments: {
            data: [
              {
                object: "invoice_payment",
                status: "paid",
                amount_paid: input.amountReceived,
                payment: { type: "payment_intent", payment_intent: input.paymentIntentId },
              },
            ],
          },
        },
      }),
    },
    paymentIntents: {
      retrieve: async () => ({
        id: input.paymentIntentId,
        status: input.paymentIntentStatus ?? "succeeded",
        amount_received: input.amountReceived,
        latest_charge: { id: input.chargeId, refunded: input.chargeRefunded ?? false },
      }),
    },
  } as unknown as Stripe;
}

describe("Refund request service (integration, real local Postgres, mocked Stripe)", () => {
  beforeAll(async () => {
    const plan = await prisma.softwarePlan.create({
      data: { key: `refund_test_plan_${RUN_ID}`, name: "Refund Test Plan", description: "test", planType: "PRO", monthlyPrice: 149, annualPrice: 1490, currency: "AED" },
    });
    planId = plan.id;
  });

  afterAll(async () => {
    await prisma.refundRequest.deleteMany({ where: { companyId: { in: cleanupCompanyIds } } });
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: { in: cleanupCompanyIds } } });
    await prisma.stripeBillingCustomer.deleteMany({ where: { companyId: { in: cleanupCompanyIds } } });
    await prisma.user.deleteMany({ where: { companyId: { in: cleanupCompanyIds } } });
    await prisma.company.deleteMany({ where: { id: { in: cleanupCompanyIds } } });
    await prisma.softwarePlan.delete({ where: { id: planId } }).catch(() => {});
  });

  it("lets a customer request a refund for their own company's payment", async () => {
    const { company, user } = await makeCompanyWithSubscription("own", `sub_test_${RUN_ID}_own`);
    const stripe = mockRefundStripeClient({ invoiceId: `in_${RUN_ID}_own`, paymentIntentId: `pi_${RUN_ID}_own`, chargeId: `ch_${RUN_ID}_own`, amountReceived: 14900 });

    const result = await requestRefund(actorFor(user.id, company.id, user.email), { reason: "Changed my mind" }, stripe);

    expect(result.companyId).toBe(company.id);
    expect(result.status).toBe("REQUESTED");
    expect(result.originalAmountMinor).toBe(14900);
    expect(result.requestedAmountMinor).toBe(14900);
    expect(result.stripePaymentIntentId).toBe(`pi_${RUN_ID}_own`);
    expect(result.stripeChargeId).toBe(`ch_${RUN_ID}_own`);
    expect(result.currency).toBe("AED");
  });

  it("scopes every request to the actor's own company — never derives from a caller-supplied ID", async () => {
    const a = await makeCompanyWithSubscription("tenantA", `sub_test_${RUN_ID}_tenantA`);
    const b = await makeCompanyWithSubscription("tenantB", `sub_test_${RUN_ID}_tenantB`);
    const stripeA = mockRefundStripeClient({ invoiceId: `in_${RUN_ID}_a`, paymentIntentId: `pi_${RUN_ID}_a`, chargeId: `ch_${RUN_ID}_a`, amountReceived: 14900 });
    const stripeB = mockRefundStripeClient({ invoiceId: `in_${RUN_ID}_b`, paymentIntentId: `pi_${RUN_ID}_b`, chargeId: `ch_${RUN_ID}_b`, amountReceived: 39900 });

    const resultA = await requestRefund(actorFor(a.user.id, a.company.id, a.user.email), { reason: "A's reason" }, stripeA);
    const resultB = await requestRefund(actorFor(b.user.id, b.company.id, b.user.email), { reason: "B's reason" }, stripeB);

    expect(resultA.companyId).toBe(a.company.id);
    expect(resultB.companyId).toBe(b.company.id);
    expect(resultA.stripePaymentIntentId).not.toBe(resultB.stripePaymentIntentId);
    // The service's input type has no field for supplying a provider ID — this is a
    // structural guarantee, not just a runtime check: RequestRefundInput = { reason: string }.
  });

  it("rejects a duplicate refund request while one is already pending for the same payment", async () => {
    const { company, user } = await makeCompanyWithSubscription("dup", `sub_test_${RUN_ID}_dup`);
    const stripe = mockRefundStripeClient({ invoiceId: `in_${RUN_ID}_dup`, paymentIntentId: `pi_${RUN_ID}_dup`, chargeId: `ch_${RUN_ID}_dup`, amountReceived: 14900 });
    const actor = actorFor(user.id, company.id, user.email);

    await requestRefund(actor, { reason: "First request" }, stripe);
    await expect(requestRefund(actor, { reason: "Second request" }, stripe)).rejects.toMatchObject({ code: "REFUND_ALREADY_REQUESTED" });
  });

  it("refuses to create a request for a payment Stripe already reports as fully refunded", async () => {
    const { company, user } = await makeCompanyWithSubscription("refunded", `sub_test_${RUN_ID}_refunded`);
    const stripe = mockRefundStripeClient({
      invoiceId: `in_${RUN_ID}_refunded`,
      paymentIntentId: `pi_${RUN_ID}_refunded`,
      chargeId: `ch_${RUN_ID}_refunded`,
      amountReceived: 14900,
      chargeRefunded: true,
    });

    await expect(requestRefund(actorFor(user.id, company.id, user.email), { reason: "Already refunded" }, stripe)).rejects.toMatchObject({
      code: "REFUND_ALREADY_REFUNDED",
    });
  });

  it("refuses to create a request when Stripe reports the payment did not succeed", async () => {
    const { company, user } = await makeCompanyWithSubscription("unpaid", `sub_test_${RUN_ID}_unpaid`);
    const stripe = mockRefundStripeClient({
      invoiceId: `in_${RUN_ID}_unpaid`,
      paymentIntentId: `pi_${RUN_ID}_unpaid`,
      chargeId: `ch_${RUN_ID}_unpaid`,
      amountReceived: 0,
      paymentIntentStatus: "requires_payment_method",
    });

    await expect(requestRefund(actorFor(user.id, company.id, user.email), { reason: "Never paid" }, stripe)).rejects.toMatchObject({
      code: "REFUND_NO_PAYMENT_FOUND",
    });
  });

  it("rejects an empty reason", async () => {
    const { company, user } = await makeCompanyWithSubscription("emptyreason", `sub_test_${RUN_ID}_emptyreason`);
    const stripe = mockRefundStripeClient({ invoiceId: `in_${RUN_ID}_er`, paymentIntentId: `pi_${RUN_ID}_er`, chargeId: `ch_${RUN_ID}_er`, amountReceived: 14900 });

    await expect(requestRefund(actorFor(user.id, company.id, user.email), { reason: "   " }, stripe)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("refuses a company with no Stripe-sourced subscription at all", async () => {
    const company = await prisma.company.create({ data: { legalName: `Refund NoSub Co ${RUN_ID}`, tradeName: "No Sub", email: `refund-nosub-${RUN_ID}@example.com` } });
    cleanupCompanyIds.push(company.id);
    const user = await prisma.user.create({
      data: { companyId: company.id, email: `refund-nosub-owner-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Owner", role: "COMPANY_OWNER", isActive: true, emailVerifiedAt: new Date() },
    });

    await expect(requestRefund(actorFor(user.id, company.id, user.email), { reason: "No subscription" })).rejects.toMatchObject({
      code: "REFUND_NOT_ELIGIBLE",
    });
  });
});
