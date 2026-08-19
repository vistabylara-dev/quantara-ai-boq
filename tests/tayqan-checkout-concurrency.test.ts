import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { type CommercePriceReviewStatus, TayqanHireStatus, UserRole } from "@prisma/client";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { prisma } from "../src/lib/db/prisma";
import { ConflictError } from "../src/lib/errors/app-error";
import { createMapping } from "../src/lib/repositories/commerce-provider-mapping-repository";
import { createStripeBillingCustomer } from "../src/lib/repositories/stripe-billing-repository";
import { createTayqanCheckoutSession } from "../src/lib/services/tayqan-checkout-service";
import { processStripeWebhookEvent } from "../src/lib/services/stripe-webhook-service";
import { STRIPE_API_VERSION } from "../src/lib/payments/stripe-client";
import { TAYQAN_PRODUCT_FAMILY } from "../src/lib/tayqan/tayqan-commerce";

/**
 * TAYQAN-AUDIT-FIX-2 — closes the checkout double-charge race:
 * createTayqanCheckoutSession had no advisory lock, so two near-simultaneous
 * "hire TAYQAN" requests for the same company could both observe "no active
 * entitlement", both survive expireOtherTayqanSessions (which only checks
 * Stripe's own live session list — empty for both, since neither had
 * committed anything yet), and both create separate, both-payable Stripe
 * checkout sessions.
 */

const RUN_ID = `${Date.now()}-${process.pid}-tayqan-checkout`;

/**
 * A minimal, stateful, in-memory fake of the exact subset of the Stripe SDK
 * createTayqanCheckoutSession calls (checkout.sessions.list/create/expire).
 * Shared across concurrent calls in the same test — real network state
 * (Stripe's own session list) is what expireOtherTayqanSessions depends on
 * to detect a session another request already created; this fake models
 * that shared state honestly rather than each call getting its own isolated
 * fake, which would silently defeat the entire point of the concurrency
 * test.
 */
// Module-level, not per-store: two different fakeStripeStore() instances
// (one per test) must never mint the same session id — stripeCheckoutSessionId
// is a real, unique-constrained DB column, and a collision across two
// unrelated tests/companies would throw a genuine (if misleading here)
// tenant-mismatch error in persistPendingHire, not exercise anything real.
let globalNextSessionId = 1;

function fakeStripeStore() {
  const sessions: Array<{ id: string; url: string; status: "open" | "expired"; metadata: Record<string, string> }> = [];
  let createCallCount = 0;

  const client = {
    checkout: {
      sessions: {
        list: async () => ({
          data: sessions.filter((s) => s.status === "open"),
          has_more: false,
        }),
        create: async (params: { metadata?: Record<string, string> }) => {
          createCallCount += 1;
          const id = globalNextSessionId++;
          const session = {
            id: `cs_test_${RUN_ID}_${id}`,
            url: `https://checkout.stripe.com/test/${RUN_ID}/${id}`,
            status: "open" as const,
            metadata: params.metadata ?? {},
          };
          sessions.push(session);
          return session;
        },
        expire: async (id: string) => {
          const found = sessions.find((s) => s.id === id);
          if (found) found.status = "expired";
          return found;
        },
      },
    },
  } as unknown as Stripe;

  return { client, sessions, getCreateCallCount: () => createCallCount };
}

describe("TAYQAN-AUDIT-FIX-2: checkout double-charge race (integration, real local Postgres)", () => {
  let userId: string;
  let industryEngineId: string;
  let dayPriceId: string;
  let dayCommerceProductId: string;
  let originalDayPriceReviewStatus: CommercePriceReviewStatus;
  let createdMappingProviderProductId: string;

  function actorFor(companyId: string): CurrentActor {
    return { userId, companyId, role: UserRole.COMPANY_OWNER, fullName: "Checkout Race Owner", email: `checkout-race-${RUN_ID}@example.com` };
  }

  async function newCompanyWithStripeCustomer(label: string) {
    const slug = label.toLowerCase().replace(/\s+/g, "-");
    const company = await prisma.company.create({
      data: { legalName: `${label} ${RUN_ID}`, tradeName: label, email: `${slug}-${RUN_ID}@example.com` },
    });
    const stripeCustomerId = `cus_test_${RUN_ID}_${company.id.slice(0, 8)}`;
    await createStripeBillingCustomer(company.id, stripeCustomerId, false);

    // getProjectRecord is company-scoped — createTayqanCheckoutSession's
    // project belongs to the SAME company as the checkout actor, so each
    // test company needs its own project, not a shared cross-company one.
    const projectClient = await prisma.client.create({ data: { companyId: company.id, name: `${label} Client`, email: `${slug}-client-${RUN_ID}@example.com` } });
    const project = await prisma.project.create({
      data: {
        companyId: company.id, clientId: projectClient.id, industryEngineId,
        slug: `${slug}-${RUN_ID}`, reference: `${slug.toUpperCase()}-${RUN_ID}`, name: `${label} Project`,
      },
    });

    return { companyId: company.id, stripeCustomerId, projectId: project.id };
  }

  beforeAll(async () => {
    const industry = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    industryEngineId = industry.id;
    const bootstrapCompany = await prisma.company.create({
      data: { legalName: `Checkout Race Bootstrap ${RUN_ID}`, tradeName: "Checkout Race Bootstrap", email: `checkout-race-bootstrap-${RUN_ID}@example.com` },
    });
    const user = await prisma.user.create({
      data: {
        companyId: bootstrapCompany.id, email: `checkout-race-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash",
        fullName: "Checkout Race Owner", role: UserRole.COMPANY_OWNER, emailVerifiedAt: new Date(),
      },
    });
    userId = user.id;

    // Real, already-seeded TAYQAN commerce catalog row — approve it (default
    // REQUIRES_REVIEW) and add a TEST/STRIPE provider mapping so checkout
    // eligibility actually passes. Both restored in afterAll.
    const dayPrice = await prisma.commercePrice.findUniqueOrThrow({
      where: { code: "tayqan_day_299" },
      include: { product: true },
    });
    dayPriceId = dayPrice.id;
    dayCommerceProductId = dayPrice.productId;
    originalDayPriceReviewStatus = dayPrice.reviewStatus;
    await prisma.commercePrice.update({ where: { id: dayPriceId }, data: { reviewStatus: "APPROVED" } });

    createdMappingProviderProductId = `prod_test_checkout_race_${RUN_ID}`;
    await createMapping({
      provider: "STRIPE",
      environment: "TEST",
      commerceProductId: dayCommerceProductId,
      commercePriceId: dayPriceId,
      providerProductId: createdMappingProviderProductId,
      providerPriceId: `price_test_checkout_race_${RUN_ID}`,
      providerObjectType: "PRICE",
    });
  });

  afterAll(async () => {
    await prisma.commercePrice.update({ where: { id: dayPriceId }, data: { reviewStatus: originalDayPriceReviewStatus } });
    await prisma.commerceProviderMapping.deleteMany({ where: { providerProductId: createdMappingProviderProductId } });
    await prisma.$disconnect();
  });

  it("two near-simultaneous checkout requests for the same company never both succeed in creating two independently-payable sessions", async () => {
    const { companyId, projectId } = await newCompanyWithStripeCustomer("Race Co A");
    const { client, getCreateCallCount } = fakeStripeStore();
    const input = { priceCode: "tayqan_day_299" as const, projectId };

    const [first, second] = await Promise.all([
      createTayqanCheckoutSession(actorFor(companyId), input, client),
      createTayqanCheckoutSession(actorFor(companyId), input, client),
    ]);

    // Real Stripe was only ever asked to create ONE session — the second,
    // lock-serialized caller's fresh expireOtherTayqanSessions call saw the
    // first's already-created session and reused it, exactly like two
    // legitimate sequential requests for the same price/project would.
    expect(getCreateCallCount()).toBe(1);
    expect(first.checkoutSessionId).toBe(second.checkoutSessionId);
    expect(first.checkoutUrl).toBe(second.checkoutUrl);

    const entitlements = await prisma.tayqanHireEntitlement.findMany({ where: { companyId } });
    expect(entitlements).toHaveLength(1);
    expect(entitlements[0]?.status).toBe(TayqanHireStatus.PENDING);
    expect(entitlements[0]?.stripeCheckoutSessionId).toBe(first.checkoutSessionId);
  });

  it("a company with no active/pending TAYQAN hire can create a single checkout session normally (no regression)", async () => {
    const { companyId, projectId } = await newCompanyWithStripeCustomer("Race Co B");
    const { client, getCreateCallCount } = fakeStripeStore();
    const input = { priceCode: "tayqan_day_299" as const, projectId };

    const result = await createTayqanCheckoutSession(actorFor(companyId), input, client);

    expect(getCreateCallCount()).toBe(1);
    expect(result.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);

    const entitlements = await prisma.tayqanHireEntitlement.findMany({ where: { companyId } });
    expect(entitlements).toHaveLength(1);
    expect(entitlements[0]?.status).toBe(TayqanHireStatus.PENDING);
  });

  it("a company that already has an active TAYQAN hire is refused a new checkout (no regression)", async () => {
    const { companyId, projectId } = await newCompanyWithStripeCustomer("Race Co C");
    await prisma.tayqanHireEntitlement.create({
      data: {
        companyId, purchasedByUserId: userId, plan: "DAY", status: TayqanHireStatus.ACTIVE,
        priceCode: "tayqan_day_299", stripeCheckoutSessionId: `cs_test_${RUN_ID}_existing_active`,
        startsAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    const { client } = fakeStripeStore();
    const input = { priceCode: "tayqan_day_299" as const, projectId };

    let caught: unknown;
    try {
      await createTayqanCheckoutSession(actorFor(companyId), input, client);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ConflictError);
    expect((caught as ConflictError).code).toBe("TAYQAN_ALREADY_HIRED");
  });

  it("mission 3: a checkout.session.expired event transitions the matching PENDING entitlement, and never touches a different company's row", async () => {
    const { companyId: companyA, stripeCustomerId: customerA } = await newCompanyWithStripeCustomer("Race Co D");
    const { companyId: companyB } = await newCompanyWithStripeCustomer("Race Co E");

    const expiredSessionId = `cs_test_${RUN_ID}_expired`;
    await prisma.tayqanHireEntitlement.create({
      data: {
        companyId: companyA, purchasedByUserId: userId, plan: "DAY", status: TayqanHireStatus.PENDING,
        priceCode: "tayqan_day_299", stripeCheckoutSessionId: expiredSessionId,
      },
    });
    const untouchedSessionId = `cs_test_${RUN_ID}_untouched`;
    const untouchedEntitlement = await prisma.tayqanHireEntitlement.create({
      data: {
        companyId: companyB, purchasedByUserId: userId, plan: "DAY", status: TayqanHireStatus.PENDING,
        priceCode: "tayqan_day_299", stripeCheckoutSessionId: untouchedSessionId,
      },
    });

    const event = {
      id: `evt_test_${RUN_ID}_expired`,
      type: "checkout.session.expired",
      livemode: false,
      api_version: STRIPE_API_VERSION,
      data: {
        object: {
          id: expiredSessionId,
          customer: customerA,
          status: "expired",
          payment_status: "unpaid",
          metadata: {
            quantara_company_id: companyA,
            quantara_product_family: TAYQAN_PRODUCT_FAMILY,
            quantara_tayqan_price_code: "tayqan_day_299",
          },
        },
      },
    } as unknown as Stripe.Event;

    const result = await processStripeWebhookEvent(event);
    expect(result.outcome).toBe("processed");

    const updated = await prisma.tayqanHireEntitlement.findUnique({ where: { stripeCheckoutSessionId: expiredSessionId } });
    expect(updated?.status).toBe(TayqanHireStatus.PAYMENT_FAILED);

    const stillPending = await prisma.tayqanHireEntitlement.findUnique({ where: { id: untouchedEntitlement.id } });
    expect(stillPending?.status).toBe(TayqanHireStatus.PENDING);
  });
});
