import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { PlatformRole } from "@prisma/client";
import { prisma } from "../src/lib/db/prisma";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { approveRefundRequest, executeApprovedRefund, rejectRefundRequest } from "../src/lib/services/refund-execution-service";
import { createStripeBillingCustomer } from "../src/lib/repositories/stripe-billing-repository";
import { createRefundRequest } from "../src/lib/repositories/refund-request-repository";

const RUN_ID = `${Date.now()}-${process.pid}-refund-exec`;

let planId: string;
let ownerUserId: string;
let ownerCompanyId: string;
const cleanupCompanyIds: string[] = [];

function ownerActor(): PlatformActor {
  return { userId: ownerUserId, companyId: ownerCompanyId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "Refund Exec Owner", email: `refund-exec-owner-${RUN_ID}@example.com` };
}

async function makeCompanyWithSubscriptionAndCustomer(label: string, externalSubscriptionId: string, stripeCustomerId: string) {
  const company = await prisma.company.create({
    data: { legalName: `Refund Exec ${label} Co ${RUN_ID}`, tradeName: `Exec ${label}`, email: `refund-exec-${label}-${RUN_ID}@example.com` },
  });
  cleanupCompanyIds.push(company.id);
  const subscription = await prisma.companySoftwareSubscription.create({
    data: { companyId: company.id, softwarePlanId: planId, status: "ACTIVE", externalSubscriptionId, source: "stripe" },
  });
  await createStripeBillingCustomer(company.id, stripeCustomerId, false);
  const user = await prisma.user.create({
    data: { companyId: company.id, email: `refund-exec-${label}-owner-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Company Owner", role: "COMPANY_OWNER", isActive: true, emailVerifiedAt: new Date() },
  });
  return { company, subscription, user };
}

async function makeRefundRequest(input: {
  companyId: string;
  requestedByUserId: string;
  companySoftwareSubscriptionId: string;
  externalSubscriptionId: string;
  stripePaymentIntentId: string;
  stripeChargeId: string;
  amountMinor: number;
}) {
  return createRefundRequest({
    companyId: input.companyId,
    requestedByUserId: input.requestedByUserId,
    companySoftwareSubscriptionId: input.companySoftwareSubscriptionId,
    externalSubscriptionId: input.externalSubscriptionId,
    stripeInvoiceId: null,
    stripePaymentIntentId: input.stripePaymentIntentId,
    stripeChargeId: input.stripeChargeId,
    originalAmountMinor: input.amountMinor,
    requestedAmountMinor: input.amountMinor,
    successfulPaymentAt: new Date(),
    isException: false,
    exceptionCategory: null,
    currency: "AED",
    reason: "Test reason",
  });
}

type MockOptions = {
  paymentIntentStatus?: Stripe.PaymentIntent.Status;
  amountReceived?: number;
  chargeRefunded?: boolean;
  stripeCustomerId?: string;
  refundStatus?: string;
  refundError?: Error;
};

function mockExecutionStripeClient(opts: MockOptions = {}) {
  const cancelCalls: string[] = [];
  const refundCalls: unknown[] = [];
  const client = {
    paymentIntents: {
      retrieve: async (id: string) => ({
        id,
        status: opts.paymentIntentStatus ?? "succeeded",
        amount_received: opts.amountReceived ?? 14900,
        customer: opts.stripeCustomerId,
        latest_charge: { id: `ch_for_${id}`, refunded: opts.chargeRefunded ?? false },
      }),
    },
    refunds: {
      create: async (params: unknown) => {
        refundCalls.push(params);
        if (opts.refundError) throw opts.refundError;
        return { id: `re_${RUN_ID}_${refundCalls.length}`, status: opts.refundStatus ?? "succeeded" };
      },
    },
    subscriptions: {
      cancel: async (id: string) => {
        cancelCalls.push(id);
        return { id, status: "canceled" };
      },
    },
  } as unknown as Stripe;
  return { client, cancelCalls, refundCalls };
}

describe("Refund execution service (integration, real local Postgres, mocked Stripe)", () => {
  beforeAll(async () => {
    const plan = await prisma.softwarePlan.create({
      data: { key: `refund_exec_plan_${RUN_ID}`, name: "Refund Exec Plan", description: "test", planType: "PRO", monthlyPrice: 149, annualPrice: 1490, currency: "AED" },
    });
    planId = plan.id;
    const ownerCompany = await prisma.company.create({ data: { legalName: `Refund Exec Owner Co ${RUN_ID}`, tradeName: "Owner Co", email: `refund-exec-platform-owner-${RUN_ID}@example.com` } });
    ownerCompanyId = ownerCompany.id;
    const owner = await prisma.user.create({
      data: { companyId: ownerCompanyId, email: `refund-exec-owner-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Platform Owner", role: "COMPANY_OWNER", platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() },
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

  it("approves and executes a REFUND_ONLY request end to end", async () => {
    const { company, subscription, user } = await makeCompanyWithSubscriptionAndCustomer("only", `sub_${RUN_ID}_only`, `cus_${RUN_ID}_only`);
    const request = await makeRefundRequest({
      companyId: company.id, requestedByUserId: user.id, companySoftwareSubscriptionId: subscription.id,
      externalSubscriptionId: `sub_${RUN_ID}_only`, stripePaymentIntentId: `pi_${RUN_ID}_only`, stripeChargeId: `ch_for_pi_${RUN_ID}_only`, amountMinor: 14900,
    });
    const { client, cancelCalls } = mockExecutionStripeClient({ stripeCustomerId: `cus_${RUN_ID}_only` });

    await approveRefundRequest(ownerActor(), request.id, "REFUND_ONLY", client);
    const result = await executeApprovedRefund(ownerActor(), request.id, client);

    expect(result.status).toBe("SUCCEEDED");
    expect(result.stripeRefundId).toMatch(/^re_/);
    expect(result.completedAt).not.toBeNull();
    expect(cancelCalls).toHaveLength(0); // refund-only never cancels the subscription
  });

  it("approves and executes REFUND_AND_CANCEL, cancelling the exact subscription", async () => {
    const { company, subscription, user } = await makeCompanyWithSubscriptionAndCustomer("cancel", `sub_${RUN_ID}_cancel`, `cus_${RUN_ID}_cancel`);
    const request = await makeRefundRequest({
      companyId: company.id, requestedByUserId: user.id, companySoftwareSubscriptionId: subscription.id,
      externalSubscriptionId: `sub_${RUN_ID}_cancel`, stripePaymentIntentId: `pi_${RUN_ID}_cancel`, stripeChargeId: `ch_for_pi_${RUN_ID}_cancel`, amountMinor: 39900,
    });
    const { client, cancelCalls } = mockExecutionStripeClient({ stripeCustomerId: `cus_${RUN_ID}_cancel` });

    await approveRefundRequest(ownerActor(), request.id, "REFUND_AND_CANCEL", client);
    const result = await executeApprovedRefund(ownerActor(), request.id, client);

    expect(result.status).toBe("SUCCEEDED");
    expect(cancelCalls).toEqual([`sub_${RUN_ID}_cancel`]); // cancels exactly this subscription, nothing else
  });

  it("rejects a pending request without ever calling Stripe", async () => {
    const { company, subscription, user } = await makeCompanyWithSubscriptionAndCustomer("reject", `sub_${RUN_ID}_reject`, `cus_${RUN_ID}_reject`);
    const request = await makeRefundRequest({
      companyId: company.id, requestedByUserId: user.id, companySoftwareSubscriptionId: subscription.id,
      externalSubscriptionId: `sub_${RUN_ID}_reject`, stripePaymentIntentId: `pi_${RUN_ID}_reject`, stripeChargeId: `ch_for_pi_${RUN_ID}_reject`, amountMinor: 14900,
    });

    const result = await rejectRefundRequest(ownerActor(), request.id, "Not eligible");
    expect(result.status).toBe("REJECTED");
    expect(result.rejectionReason).toBe("Not eligible");
    expect(result.approvedByUserId).toBe(ownerUserId);
  });

  it("blocks approval when the payment intent's Stripe customer no longer maps to the requesting company (cross-tenant protection)", async () => {
    const { company, subscription, user } = await makeCompanyWithSubscriptionAndCustomer("mismatch", `sub_${RUN_ID}_mismatch`, `cus_${RUN_ID}_mismatch`);
    const request = await makeRefundRequest({
      companyId: company.id, requestedByUserId: user.id, companySoftwareSubscriptionId: subscription.id,
      externalSubscriptionId: `sub_${RUN_ID}_mismatch`, stripePaymentIntentId: `pi_${RUN_ID}_mismatch`, stripeChargeId: `ch_for_pi_${RUN_ID}_mismatch`, amountMinor: 14900,
    });
    // Stripe now reports a DIFFERENT customer than the one on file for this company.
    const { client } = mockExecutionStripeClient({ stripeCustomerId: `cus_${RUN_ID}_someone_else_entirely` });

    await expect(approveRefundRequest(ownerActor(), request.id, "REFUND_ONLY", client)).rejects.toMatchObject({ code: "REFUND_TENANT_MISMATCH" });
  });

  it("blocks approval when Stripe now reports the payment already fully refunded", async () => {
    const { company, subscription, user } = await makeCompanyWithSubscriptionAndCustomer("alreadyref", `sub_${RUN_ID}_alreadyref`, `cus_${RUN_ID}_alreadyref`);
    const request = await makeRefundRequest({
      companyId: company.id, requestedByUserId: user.id, companySoftwareSubscriptionId: subscription.id,
      externalSubscriptionId: `sub_${RUN_ID}_alreadyref`, stripePaymentIntentId: `pi_${RUN_ID}_alreadyref`, stripeChargeId: `ch_for_pi_${RUN_ID}_alreadyref`, amountMinor: 14900,
    });
    const { client } = mockExecutionStripeClient({ stripeCustomerId: `cus_${RUN_ID}_alreadyref`, chargeRefunded: true });

    await expect(approveRefundRequest(ownerActor(), request.id, "REFUND_ONLY", client)).rejects.toMatchObject({ code: "REFUND_ALREADY_REFUNDED" });
  });

  it("cannot approve or execute the same request twice (duplicate-approval protection)", async () => {
    const { company, subscription, user } = await makeCompanyWithSubscriptionAndCustomer("noduplicate", `sub_${RUN_ID}_noduplicate`, `cus_${RUN_ID}_noduplicate`);
    const request = await makeRefundRequest({
      companyId: company.id, requestedByUserId: user.id, companySoftwareSubscriptionId: subscription.id,
      externalSubscriptionId: `sub_${RUN_ID}_noduplicate`, stripePaymentIntentId: `pi_${RUN_ID}_noduplicate`, stripeChargeId: `ch_for_pi_${RUN_ID}_noduplicate`, amountMinor: 14900,
    });
    const { client, refundCalls } = mockExecutionStripeClient({ stripeCustomerId: `cus_${RUN_ID}_noduplicate` });

    await approveRefundRequest(ownerActor(), request.id, "REFUND_ONLY", client);
    await executeApprovedRefund(ownerActor(), request.id, client);
    expect(refundCalls).toHaveLength(1);

    // A second approve attempt on the now-SUCCEEDED request must fail, not silently re-run.
    await expect(approveRefundRequest(ownerActor(), request.id, "REFUND_ONLY", client)).rejects.toMatchObject({ code: "REFUND_REQUEST_NOT_PENDING" });
    // A second execute attempt (e.g. a retried click) must also fail, never create a second Stripe refund.
    await expect(executeApprovedRefund(ownerActor(), request.id, client)).rejects.toMatchObject({ code: "REFUND_REQUEST_NOT_APPROVED" });
    expect(refundCalls).toHaveLength(1); // still exactly one Stripe refund ever created
  });

  it("never marks SUCCEEDED when Stripe reports a non-succeeded refund status — records FAILED instead", async () => {
    const { company, subscription, user } = await makeCompanyWithSubscriptionAndCustomer("pending", `sub_${RUN_ID}_pending`, `cus_${RUN_ID}_pending`);
    const request = await makeRefundRequest({
      companyId: company.id, requestedByUserId: user.id, companySoftwareSubscriptionId: subscription.id,
      externalSubscriptionId: `sub_${RUN_ID}_pending`, stripePaymentIntentId: `pi_${RUN_ID}_pending`, stripeChargeId: `ch_for_pi_${RUN_ID}_pending`, amountMinor: 14900,
    });
    const { client } = mockExecutionStripeClient({ stripeCustomerId: `cus_${RUN_ID}_pending`, refundStatus: "pending" });

    await approveRefundRequest(ownerActor(), request.id, "REFUND_ONLY", client);
    await expect(executeApprovedRefund(ownerActor(), request.id, client)).rejects.toMatchObject({ code: "REFUND_NOT_YET_SUCCEEDED" });

    const fresh = await prisma.refundRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(fresh.status).toBe("FAILED");
  });

  it("records FAILED, not SUCCEEDED, when Stripe's refund API call itself errors", async () => {
    const { company, subscription, user } = await makeCompanyWithSubscriptionAndCustomer("apierror", `sub_${RUN_ID}_apierror`, `cus_${RUN_ID}_apierror`);
    const request = await makeRefundRequest({
      companyId: company.id, requestedByUserId: user.id, companySoftwareSubscriptionId: subscription.id,
      externalSubscriptionId: `sub_${RUN_ID}_apierror`, stripePaymentIntentId: `pi_${RUN_ID}_apierror`, stripeChargeId: `ch_for_pi_${RUN_ID}_apierror`, amountMinor: 14900,
    });
    const apiError = Object.assign(new Error("card issuer declined the refund"), { code: "refund_failed" });
    const { client } = mockExecutionStripeClient({ stripeCustomerId: `cus_${RUN_ID}_apierror`, refundError: apiError });

    await approveRefundRequest(ownerActor(), request.id, "REFUND_ONLY", client);
    await expect(executeApprovedRefund(ownerActor(), request.id, client)).rejects.toMatchObject({ code: "STRIPE_REFUND_FAILED" });

    const fresh = await prisma.refundRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(fresh.status).toBe("FAILED");
    expect(fresh.failureCode).toBe("refund_failed");
  });

  it("uses a stable, RefundRequest-ID-based Stripe idempotency key for every refund creation call", async () => {
    const { company, subscription, user } = await makeCompanyWithSubscriptionAndCustomer("idem", `sub_${RUN_ID}_idem`, `cus_${RUN_ID}_idem`);
    const request = await makeRefundRequest({
      companyId: company.id, requestedByUserId: user.id, companySoftwareSubscriptionId: subscription.id,
      externalSubscriptionId: `sub_${RUN_ID}_idem`, stripePaymentIntentId: `pi_${RUN_ID}_idem`, stripeChargeId: `ch_for_pi_${RUN_ID}_idem`, amountMinor: 14900,
    });
    let capturedOptions: { idempotencyKey?: string } | undefined;
    const client = {
      paymentIntents: { retrieve: async (id: string) => ({ id, status: "succeeded", amount_received: 14900, customer: `cus_${RUN_ID}_idem`, latest_charge: { id: `ch_for_${id}`, refunded: false } }) },
      refunds: {
        create: async (_params: unknown, options: { idempotencyKey?: string }) => {
          capturedOptions = options;
          return { id: `re_${RUN_ID}_idem`, status: "succeeded" };
        },
      },
    } as unknown as Stripe;

    await approveRefundRequest(ownerActor(), request.id, "REFUND_ONLY", client);
    await executeApprovedRefund(ownerActor(), request.id, client);

    expect(capturedOptions?.idempotencyKey).toBe(`quantara:refund:${request.id}`);
  });
});
