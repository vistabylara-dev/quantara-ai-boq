import type { Prisma, PrismaClient, RefundAction, RefundExceptionCategory, RefundRequest, RefundRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * REFUND-2 — pure Postgres access for RefundRequest, mirroring the existing
 * stripe-billing-repository.ts / commerce-provider-mapping-repository.ts
 * pattern. No Stripe API calls happen here. Rows are never deleted or
 * hard-updated outside the status-transition helpers below — the audit
 * trail (requester, approver, timestamps, Stripe references) is immutable
 * once written except for the fields each transition is explicitly for.
 */

type RefundRequestClient = Pick<PrismaClient, "refundRequest">;

/** Statuses that still represent an open, unresolved refund attempt against a payment — used to block a duplicate request for the same PaymentIntent. */
export const NON_TERMINAL_REFUND_STATUSES: readonly RefundRequestStatus[] = [
  "REQUESTED",
  "APPROVED",
  "PROCESSING",
];

export type CreateRefundRequestInput = {
  companyId: string;
  requestedByUserId: string;
  companySoftwareSubscriptionId: string | null;
  externalSubscriptionId: string;
  stripeInvoiceId: string | null;
  stripePaymentIntentId: string;
  stripeChargeId: string | null;
  originalAmountMinor: number;
  requestedAmountMinor: number;
  currency: "AED";
  reason: string;
  successfulPaymentAt: Date;
  isException: boolean;
  exceptionCategory: RefundExceptionCategory | null;
};

export async function createRefundRequest(
  input: CreateRefundRequestInput,
  client: RefundRequestClient = prisma,
): Promise<RefundRequest> {
  return client.refundRequest.create({ data: input });
}

/** Any non-terminal (REQUESTED/APPROVED/PROCESSING) row for this exact PaymentIntent — used to reject a duplicate refund request before it's created. */
export async function findNonTerminalRefundRequestForPaymentIntent(
  stripePaymentIntentId: string,
  client: RefundRequestClient = prisma,
): Promise<RefundRequest | null> {
  return client.refundRequest.findFirst({
    where: { stripePaymentIntentId, status: { in: [...NON_TERMINAL_REFUND_STATUSES] } },
  });
}

export async function findRefundRequestById(
  id: string,
  client: RefundRequestClient = prisma,
): Promise<RefundRequest | null> {
  return client.refundRequest.findUnique({ where: { id } });
}

export async function listRefundRequestsForCompany(
  companyId: string,
  client: RefundRequestClient = prisma,
): Promise<RefundRequest[]> {
  return client.refundRequest.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
}

export type RefundRequestWithCompany = RefundRequest & {
  company: { id: string; legalName: string };
  requestedByUser: { id: string; fullName: string; email: string };
};

/** Owner-facing list across every company — newest first, all statuses unless filtered. */
export async function listAllRefundRequests(
  client: Pick<PrismaClient, "refundRequest"> = prisma,
  status?: RefundRequestStatus,
): Promise<RefundRequestWithCompany[]> {
  return client.refundRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      company: { select: { id: true, legalName: true } },
      requestedByUser: { select: { id: true, fullName: true, email: true } },
    },
  });
}

export async function markRefundRequestApproved(
  id: string,
  approvedByUserId: string,
  action: RefundAction,
  tx: Pick<Prisma.TransactionClient, "refundRequest">,
): Promise<RefundRequest> {
  return tx.refundRequest.update({
    where: { id },
    data: { status: "APPROVED", approvedByUserId, action, approvedAt: new Date() },
  });
}

export async function markRefundRequestRejected(
  id: string,
  rejectedByUserId: string,
  reason: string | null,
  tx: Pick<Prisma.TransactionClient, "refundRequest">,
): Promise<RefundRequest> {
  return tx.refundRequest.update({
    where: { id },
    data: { status: "REJECTED", approvedByUserId: rejectedByUserId, rejectionReason: reason, rejectedAt: new Date() },
  });
}

export async function markRefundRequestProcessing(
  id: string,
  tx: Pick<Prisma.TransactionClient, "refundRequest">,
): Promise<RefundRequest> {
  return tx.refundRequest.update({ where: { id }, data: { status: "PROCESSING" } });
}

export async function markRefundRequestSucceeded(
  id: string,
  stripeRefundId: string,
  tx: Pick<Prisma.TransactionClient, "refundRequest"> = prisma,
): Promise<RefundRequest> {
  return tx.refundRequest.update({
    where: { id },
    data: { status: "SUCCEEDED", stripeRefundId, completedAt: new Date(), failureCode: null, failureMessage: null },
  });
}

export async function markRefundRequestFailed(
  id: string,
  failureCode: string | null,
  failureMessage: string | null,
  tx: Pick<Prisma.TransactionClient, "refundRequest"> = prisma,
): Promise<RefundRequest> {
  return tx.refundRequest.update({
    where: { id },
    data: { status: "FAILED", failureCode, failureMessage },
  });
}
