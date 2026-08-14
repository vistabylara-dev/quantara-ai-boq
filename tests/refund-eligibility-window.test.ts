import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { PlatformRole } from "@prisma/client";
import { prisma } from "../src/lib/db/prisma";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { getRefundEligibility, REFUND_WINDOW_DAYS, requestRefund } from "../src/lib/services/refund-request-service";
import { approveRefundRequest, createExceptionRefundRequest, executeApprovedRefund } from "../src/lib/services/refund-execution-service";
import { createStripeBillingCustomer } from "../src/lib/repositories/stripe-billing-repository";

const RUN_ID = `${Date.now()}-${process.pid}-refund-window`;
const DAY_MS = 24 * 60 * 60 * 1000;

function actorFor(userId: string, companyId: string, email: string): CurrentActor {
  return { userId, companyId, role: "COMPANY_OWNER", fullName: "Window Test Owner", email };
}

let planId: string;
let ownerUserId: string;
let ownerCompanyId: string;
const cleanupCompanyIds: string[] = [];

function ownerActor(): PlatformActor {
  return { userId: ownerUserId, companyId: ownerCompanyId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "Platform Owner", email: `refund-window-platform-owner-${RUN_ID}@example.com` };
}

async function makeCompanyWithSubscription(label: string) {
  const company = await prisma.company.create({
    data: { legalName: `Refund Window ${label} Co ${RUN_ID}`, tradeName: `Window ${label}`, email: `refund-window-${label}-${RUN_ID}@example.com` },
  });
  cleanupCompanyIds.push(company.id);
  const user = await prisma.user.create({
    data: { companyId: company.id, email: `refund-window-${label}-owner-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Owner", role: "COMPANY_OWNER", isActive: true, emailVerifiedAt: new Date() },
  });
  const externalSubscriptionId = `sub_${RUN_ID}_${label}`;
  await prisma.companySoftwareSubscription.create({
    data: { companyId: company.id, softwarePlanId: planId, status: "ACTIVE", externalSubscriptionId, source: "stripe" },
  });
  const stripeCustomerId = `cus_${RUN_ID}_${label}`;
  await createStripeBillingCustomer(company.id, stripeCustomerId, false);
  return { company, user, externalSubscriptionId, stripeCustomerId };
}

/** paidDaysAgo: how many days before "now" Stripe reports the charge as having succeeded — the ONLY input that determines window eligibility. */
function mockStripeClientWithPaymentAge(input: {
  invoiceId: string;
  paymentIntentId: string;
  chargeId: string;
  amountReceived: number;
  paidDaysAgo: number;
  chargeRefunded?: boolean;
}) {
  const paidAtUnixSeconds = Math.floor((Date.now() - input.paidDaysAgo * DAY_MS) / 1000);
  return {
    subscriptions: {
      retrieve: async () => ({
        latest_invoice: {
          id: input.invoiceId,
          payment_intent: input.paymentIntentId,
          status_transitions: { paid_at: paidAtUnixSeconds },
        },
      }),
    },
    paymentIntents: {
      retrieve: async () => ({
        id: input.paymentIntentId,
        status: "succeeded",
        amount_received: input.amountReceived,
        latest_charge: { id: input.chargeId, refunded: input.chargeRefunded ?? false },
      }),
    },
  } as unknown as Stripe;
}

describe("Refund eligibility window (integration, real local Postgres, mocked Stripe)", () => {
  beforeAll(async () => {
    const plan = await prisma.softwarePlan.create({
      data: { key: `refund_window_plan_${RUN_ID}`, name: "Refund Window Plan", description: "test", planType: "PRO", monthlyPrice: 149, annualPrice: 1490, currency: "AED" },
    });
    planId = plan.id;
    const ownerCompany = await prisma.company.create({ data: { legalName: `Refund Window Owner Co ${RUN_ID}`, tradeName: "Owner Co", email: `refund-window-platform-${RUN_ID}@example.com` } });
    ownerCompanyId = ownerCompany.id;
    const owner = await prisma.user.create({
      data: { companyId: ownerCompanyId, email: `refund-window-platform-owner-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Platform Owner", role: "COMPANY_OWNER", platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerUserId = owner.id;
  });

  afterAll(async () => {
    await prisma.refundRequest.deleteMany({ where: { companyId: { in: [...cleanupCompanyIds, ownerCompanyId] } } });
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: { in: cleanupCompanyIds } } });
    await prisma.stripeBillingCustomer.deleteMany({ where: { companyId: { in: cleanupCompanyIds } } });
    await prisma.user.deleteMany({ where: { companyId: { in: [...cleanupCompanyIds, ownerCompanyId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [...cleanupCompanyIds, ownerCompanyId] } } });
    await prisma.softwarePlan.delete({ where: { id: planId } }).catch(() => {});
  });

  it("allows a request submitted on day 1 after payment", async () => {
    const { company, user, externalSubscriptionId } = await makeCompanyWithSubscription("day1");
    const stripe = mockStripeClientWithPaymentAge({
      invoiceId: `in_${RUN_ID}_day1`, paymentIntentId: `pi_${RUN_ID}_day1`, chargeId: `ch_${RUN_ID}_day1`, amountReceived: 14900, paidDaysAgo: 1,
    });
    void externalSubscriptionId;

    const result = await requestRefund(actorFor(user.id, company.id, user.email), { reason: "Day 1 request" }, stripe);
    expect(result.status).toBe("REQUESTED");
    expect(result.isException).toBe(false);
  });

  it("allows a request submitted just before the 7-day deadline (day 6, 23 hours)", async () => {
    const { company, user } = await makeCompanyWithSubscription("justbefore");
    const almostSevenDays = REFUND_WINDOW_DAYS - 1 / 24; // 1 hour of margin before the exact cutoff
    const stripe = mockStripeClientWithPaymentAge({
      invoiceId: `in_${RUN_ID}_justbefore`, paymentIntentId: `pi_${RUN_ID}_justbefore`, chargeId: `ch_${RUN_ID}_justbefore`, amountReceived: 14900, paidDaysAgo: almostSevenDays,
    });

    const result = await requestRefund(actorFor(user.id, company.id, user.email), { reason: "Just before deadline" }, stripe);
    expect(result.status).toBe("REQUESTED");
  });

  it("rejects a request submitted after the 7-day deadline", async () => {
    const { company, user } = await makeCompanyWithSubscription("afterdeadline");
    const stripe = mockStripeClientWithPaymentAge({
      invoiceId: `in_${RUN_ID}_after`, paymentIntentId: `pi_${RUN_ID}_after`, chargeId: `ch_${RUN_ID}_after`, amountReceived: 14900, paidDaysAgo: REFUND_WINDOW_DAYS + 1,
    });

    await expect(requestRefund(actorFor(user.id, company.id, user.email), { reason: "Too late" }, stripe)).rejects.toMatchObject({
      code: "REFUND_WINDOW_EXPIRED",
    });
  });

  it("the browser cannot falsify the payment date — requestRefund's input has no date field at all, and the deadline is computed only from Stripe's Charge.created", async () => {
    const { company, user } = await makeCompanyWithSubscription("falsify");
    // A payment that actually succeeded 30 days ago, per Stripe.
    const stripe = mockStripeClientWithPaymentAge({
      invoiceId: `in_${RUN_ID}_falsify`, paymentIntentId: `pi_${RUN_ID}_falsify`, chargeId: `ch_${RUN_ID}_falsify`, amountReceived: 14900, paidDaysAgo: 30,
    });

    // RequestRefundInput = { reason: string } — there is no successfulPaymentAt,
    // paymentDate, or any other client-suppliable timestamp to smuggle in even
    // if a malicious client tried; TypeScript itself forbids the extra field,
    // and at runtime the value is always overwritten by findEligiblePayment.
    const maliciousInput = { reason: "I promise this was paid yesterday" } as const;
    await expect(requestRefund(actorFor(user.id, company.id, user.email), maliciousInput, stripe)).rejects.toMatchObject({
      code: "REFUND_WINDOW_EXPIRED",
    });
  });

  it("lets an owner approve after the deadline when the request was submitted while still eligible", async () => {
    const { company, user } = await makeCompanyWithSubscription("lateapprove");
    // Payment was 6 days old at request time — still eligible.
    const requestStripe = mockStripeClientWithPaymentAge({
      invoiceId: `in_${RUN_ID}_lateapprove`, paymentIntentId: `pi_${RUN_ID}_lateapprove`, chargeId: `ch_for_pi_${RUN_ID}_lateapprove`, amountReceived: 14900, paidDaysAgo: 6,
    });
    const request = await requestRefund(actorFor(user.id, company.id, user.email), { reason: "Submitted in time" }, requestStripe);
    expect(request.status).toBe("REQUESTED");

    // By the time the owner reviews it, Stripe would now report the SAME
    // charge as even older (e.g. 10 days) — approval must still succeed,
    // since eligibility was already locked in at submission time and
    // approveRefundRequest never re-checks the window, only re-checks the
    // payment's live succeeded/refunded/tenant state.
    const approveStripe = {
      paymentIntents: {
        retrieve: async (id: string) => ({
          id, status: "succeeded", amount_received: 14900, customer: `cus_${RUN_ID}_lateapprove`,
          latest_charge: { id: `ch_for_pi_${RUN_ID}_lateapprove`, refunded: false },
        }),
      },
      refunds: { create: async () => ({ id: `re_${RUN_ID}_lateapprove`, status: "succeeded" }) },
    } as unknown as Stripe;

    const approved = await approveRefundRequest(ownerActor(), request.id, "REFUND_ONLY", approveStripe);
    expect(approved.status).toBe("APPROVED");
    const executed = await executeApprovedRefund(ownerActor(), request.id, approveStripe);
    expect(executed.status).toBe("SUCCEEDED");
  });

  it("getRefundEligibility reports WINDOW_EXPIRED (not a submission block on cancellation) once past the deadline — cancellation is a separate, unaffected action", async () => {
    const { company, user } = await makeCompanyWithSubscription("cancelseparate");
    const stripe = mockStripeClientWithPaymentAge({
      invoiceId: `in_${RUN_ID}_cancelseparate`, paymentIntentId: `pi_${RUN_ID}_cancelseparate`, chargeId: `ch_${RUN_ID}_cancelseparate`, amountReceived: 14900, paidDaysAgo: REFUND_WINDOW_DAYS + 3,
    });
    const actor = actorFor(user.id, company.id, user.email);

    const eligibility = await getRefundEligibility(actor, stripe);
    expect(eligibility.eligible).toBe(false);
    if (!eligibility.eligible) expect(eligibility.reason).toBe("WINDOW_EXPIRED");

    // The subscription itself is completely untouched by refund-window expiry —
    // nothing in this feature ever reads/writes CompanySoftwareSubscription.status
    // or calls stripe.subscriptions.cancel outside the explicit REFUND_AND_CANCEL
    // execution path, which was never invoked here. Billing-portal-driven
    // cancellation (a wholly separate code path — createBillingPortalSession in
    // commerce-checkout-service.ts) is therefore structurally unaffected.
    const subscription = await prisma.companySoftwareSubscription.findFirst({ where: { companyId: company.id } });
    expect(subscription?.status).toBe("ACTIVE");
    expect(subscription?.cancelledAt).toBeNull();
  });

  it("the owner-controlled exception path bypasses the window and is fully auditable", async () => {
    const { company } = await makeCompanyWithSubscription("exception");
    const stripe = mockStripeClientWithPaymentAge({
      invoiceId: `in_${RUN_ID}_exception`, paymentIntentId: `pi_${RUN_ID}_exception`, chargeId: `ch_${RUN_ID}_exception`, amountReceived: 14900, paidDaysAgo: 45,
    });

    // A normal customer request for the same payment would be rejected...
    const { user } = await prisma.user.findFirstOrThrow({ where: { companyId: company.id } }).then((u) => ({ user: u }));
    await expect(requestRefund(actorFor(user.id, company.id, user.email), { reason: "Too late, normal path" }, stripe)).rejects.toMatchObject({
      code: "REFUND_WINDOW_EXPIRED",
    });

    // ...but the owner can create an exception request for the documented categories,
    // and it is NEVER auto-approved — it lands in REQUESTED just like anything else.
    const exception = await createExceptionRefundRequest(ownerActor(), company.id, "DUPLICATE_CHARGE", "Customer was charged twice for the same period", stripe);
    expect(exception.status).toBe("REQUESTED"); // not auto-approved
    expect(exception.isException).toBe(true);
    expect(exception.exceptionCategory).toBe("DUPLICATE_CHARGE");
    expect(exception.requestedByUserId).toBe(ownerUserId); // auditable: who created it
    expect(exception.reason).toContain("charged twice"); // auditable: why

    // Rejecting a non-category value must fail at the type/validation layer —
    // covered separately by refund-authorization.test.ts's schema tests.
  });

  it("GATE 2 — FAILED PAYMENT => NO REFUND WINDOW (a declined/unsuccessful PaymentIntent never yields a successfulPaymentAt or a deadline)", async () => {
    const { company, user, stripeCustomerId } = await makeCompanyWithSubscription("declined");
    void stripeCustomerId;
    const declinedStripe = {
      subscriptions: {
        retrieve: async () => ({
          latest_invoice: {
            id: `in_${RUN_ID}_declined`,
            payment_intent: `pi_${RUN_ID}_declined`,
            status_transitions: { paid_at: null }, // Stripe never sets this for an invoice that hasn't been paid.
          },
        }),
      },
      paymentIntents: {
        retrieve: async () => ({
          id: `pi_${RUN_ID}_declined`,
          status: "requires_payment_method", // declined; never reached "succeeded"
          amount_received: 0,
          latest_charge: { id: `ch_${RUN_ID}_declined`, refunded: false },
        }),
      },
    } as unknown as Stripe;
    const actor = actorFor(user.id, company.id, user.email);

    // Neither entry point may ever compute a window/deadline for a payment
    // Stripe never reports as succeeded — both fail closed with a specific
    // "no payment" reason, not a window-expired or window-open state.
    await expect(requestRefund(actor, { reason: "Card was declined" }, declinedStripe)).rejects.toMatchObject({ code: "REFUND_NO_PAYMENT_FOUND" });

    const eligibility = await getRefundEligibility(actor, declinedStripe);
    expect(eligibility.eligible).toBe(false);
    if (!eligibility.eligible) {
      expect(eligibility.reason).toBe("NO_PAYMENT");
      expect(eligibility.deadline).toBeNull(); // no window was ever started
    }
  });

  it("GATE 2 — SUCCESSFUL PAYMENT => REFUND WINDOW STARTS (mirror case: a genuinely succeeded payment always yields a real deadline)", async () => {
    const { company, user } = await makeCompanyWithSubscription("succeeded");
    const stripe = mockStripeClientWithPaymentAge({
      invoiceId: `in_${RUN_ID}_succeeded`, paymentIntentId: `pi_${RUN_ID}_succeeded`, chargeId: `ch_${RUN_ID}_succeeded`, amountReceived: 14900, paidDaysAgo: 2,
    });
    const actor = actorFor(user.id, company.id, user.email);

    const eligibility = await getRefundEligibility(actor, stripe);
    expect(eligibility.eligible).toBe(true);
    if (eligibility.eligible) {
      expect(eligibility.deadline).not.toBeNull();
      expect(new Date(eligibility.deadline).getTime()).toBeGreaterThan(Date.now()); // still in the future (paid 2 days ago, 7-day window)
    }
  });
});
