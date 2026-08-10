import type { PrismaClient, StripeBillingCustomer, StripeWebhookEvent } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Data access for StripeBillingCustomer (customer identity, test/live split
 * via `livemode`) and StripeWebhookEvent (idempotency ledger). No Stripe API
 * calls happen here — this is pure Postgres access, mirroring the existing
 * commerce-provider-mapping-repository.ts pattern.
 */

type StripeBillingCustomerClient = Pick<PrismaClient, "stripeBillingCustomer">;

export async function findStripeBillingCustomer(
  companyId: string,
  livemode: boolean,
  client: StripeBillingCustomerClient = prisma,
): Promise<StripeBillingCustomer | null> {
  return client.stripeBillingCustomer.findUnique({
    where: { companyId_livemode: { companyId, livemode } },
  });
}

export async function findStripeBillingCustomerByStripeId(
  stripeCustomerId: string,
): Promise<StripeBillingCustomer | null> {
  return prisma.stripeBillingCustomer.findUnique({ where: { stripeCustomerId } });
}

function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Creates a StripeBillingCustomer row, or returns the row that already won a
 * concurrent race. The unique(companyId, livemode) constraint is the actual
 * guarantee against a duplicate Stripe customer per company/mode; this
 * catch-and-refetch is the application-level mirror of it, matching
 * createMapping()'s pattern in commerce-provider-mapping-repository.ts.
 */
export async function createStripeBillingCustomer(
  companyId: string,
  stripeCustomerId: string,
  livemode: boolean,
  client: StripeBillingCustomerClient = prisma,
): Promise<StripeBillingCustomer> {
  try {
    return await client.stripeBillingCustomer.create({
      data: { companyId, stripeCustomerId, livemode },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await findStripeBillingCustomer(companyId, livemode, client);
    if (existing) return existing;
    throw error;
  }
}

export async function findStripeWebhookEvent(stripeEventId: string): Promise<StripeWebhookEvent | null> {
  return prisma.stripeWebhookEvent.findUnique({ where: { stripeEventId } });
}

export type RecordStripeWebhookEventInput = {
  stripeEventId: string;
  eventType: string;
  livemode: boolean;
  companyId: string | null;
};

/**
 * Must be called with a transaction client (`tx`), in the same transaction
 * as the state mutation the event protects — never with the module-level
 * `prisma` singleton. A duplicate stripeEventId throws (unique constraint),
 * which the caller relies on to abort the whole transaction and treat the
 * event as an idempotent no-op.
 */
export async function recordStripeWebhookEvent(
  tx: Pick<PrismaClient, "stripeWebhookEvent">,
  input: RecordStripeWebhookEventInput,
): Promise<StripeWebhookEvent> {
  return tx.stripeWebhookEvent.create({
    data: {
      stripeEventId: input.stripeEventId,
      eventType: input.eventType,
      livemode: input.livemode,
      companyId: input.companyId,
    },
  });
}
