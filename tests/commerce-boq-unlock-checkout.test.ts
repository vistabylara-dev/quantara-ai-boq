import { UserRole } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { createCommerceCheckoutSession } from "../src/lib/services/commerce-checkout-service";
import { upsertCommerceProduct, upsertCommercePrice } from "../src/lib/repositories/commerce-product-repository";
import { createMapping } from "../src/lib/repositories/commerce-provider-mapping-repository";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { addBoqItemFromSource } from "../src/lib/services/boq-item-source-service";
import { assertIsolatedLocalTestDatabase } from "./helpers/isolated-database-guard";

/**
 * AUDIT-FIXABLE-NOW mission item 4 — proves the BOQ_UNLOCK dispatch branch
 * wired into createCommerceCheckoutSession actually produces a correct
 * Checkout Session for a real unsatisfied package requirement, respects the
 * BOQ_ALREADY_UNLOCKED guard, and still goes through the same per-company
 * advisory lock as the SUBSCRIPTION path (STRIPE-COMMERCIAL-18) even when
 * the two modes race for the same company. No UI caller sends
 * checkoutMode: "BOQ_UNLOCK" yet (see the PR description) — these tests
 * exercise the service directly, the same way the sibling
 * SUBSCRIPTION-mode suite in commerce-checkout-service.test.ts does.
 */

const RUN_ID = Date.now();

function actorFor(userId: string, companyId: string, email: string): CurrentActor {
  return { userId, companyId, role: UserRole.COMPANY_OWNER, fullName: "BOQ Unlock Test Owner", email };
}

let globalCustomerCounter = 0;
let globalSessionCounter = 0;

function mockStripeClient() {
  return {
    customers: {
      create: vi.fn(async () => ({ id: `cus_boqunlock_${RUN_ID}_${++globalCustomerCounter}` })),
    },
    subscriptions: {
      list: vi.fn(async () => ({ data: [], has_more: false })),
    },
    checkout: {
      sessions: {
        create: vi.fn(async () => ({
          id: `cs_boqunlock_${RUN_ID}_${++globalSessionCounter}`,
          url: `https://checkout.stripe.com/test/boqunlock_${RUN_ID}_${globalSessionCounter}`,
        })),
        list: vi.fn(async () => ({ data: [], has_more: false })),
        expire: vi.fn(async (id: string) => ({ id, status: "expired" })),
      },
    },
    billingPortal: {
      sessions: { create: vi.fn(async () => ({ url: `https://billing.stripe.com/test/${RUN_ID}` })) },
    },
  } as any;
}

let globalStatefulCustomerCounter = 0;
let globalStatefulSessionCounter = 0;

type StatefulSession = {
  id: string;
  url: string;
  status: "open" | "expired" | "complete";
  metadata: Record<string, string>;
  customer: string;
};

/** Same rationale as commerce-checkout-service.test.ts's makeStatefulStripeClient — real shared
 * state in a Map so two calls racing against the REAL Postgres advisory lock produce a genuinely
 * observable final state instead of each independently believing it's the only one. */
function makeStatefulStripeClient() {
  const sessions = new Map<string, StatefulSession>();

  const client = {
    customers: {
      create: vi.fn(async () => ({ id: `cus_boqunlock_stateful_${RUN_ID}_${++globalStatefulCustomerCounter}` })),
    },
    subscriptions: {
      list: vi.fn(async () => ({ data: [], has_more: false })),
    },
    checkout: {
      sessions: {
        create: vi.fn(async (params: { customer: string; metadata?: Record<string, string> }) => {
          const id = `cs_boqunlock_stateful_${RUN_ID}_${++globalStatefulSessionCounter}`;
          const url = `https://checkout.stripe.com/test/boqunlock_stateful_${RUN_ID}_${globalStatefulSessionCounter}`;
          sessions.set(id, { id, url, status: "open", metadata: params.metadata ?? {}, customer: params.customer });
          return { id, url };
        }),
        list: vi.fn(async (params: { customer: string; status?: string }) => {
          const data = Array.from(sessions.values()).filter(
            (session) => session.customer === params.customer && (!params.status || session.status === params.status),
          );
          return { data, has_more: false };
        }),
        expire: vi.fn(async (id: string) => {
          const session = sessions.get(id);
          if (!session) throw new Error(`stateful mock: no such session ${id}`);
          session.status = "expired";
          return { id, status: "expired" };
        }),
      },
    },
    billingPortal: {
      sessions: { create: vi.fn(async () => ({ url: `https://billing.stripe.com/test/${RUN_ID}` })) },
    },
  } as any;

  return { client, sessions };
}

describe("commerce-checkout-service: BOQ_UNLOCK dispatch (integration, real local Postgres, mocked Stripe)", () => {
  const cleanupCompanyIds: string[] = [];
  const originalKey = process.env.STRIPE_SECRET_KEY;
  const originalMode = process.env.STRIPE_MODE;
  const originalBaseUrl = process.env.APP_BASE_URL;

  beforeAll(() => {
    assertIsolatedLocalTestDatabase("commerce-boq-unlock-checkout test setup");
  });

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fixture_key_not_real";
    delete process.env.STRIPE_MODE;
    process.env.APP_BASE_URL = "http://localhost:3000";
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
    if (originalMode === undefined) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = originalMode;
    if (originalBaseUrl === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = originalBaseUrl;
  });

  afterAll(async () => {
    for (const companyId of cleanupCompanyIds) {
      await prisma.stripeBillingCustomer.deleteMany({ where: { companyId } });
      await prisma.companyPackageSubscription.deleteMany({ where: { companyId } });
      await prisma.bOQItem.deleteMany({ where: { companyId } });
      await prisma.bOQSection.deleteMany({ where: { companyId } });
      await prisma.bOQ.deleteMany({ where: { companyId } });
      await prisma.project.deleteMany({ where: { companyId } });
      await prisma.client.deleteMany({ where: { companyId } });
      await prisma.companyIndustryEngine.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
    }
    await prisma.commerceProduct.deleteMany({ where: { code: { contains: `boqunlock_${RUN_ID}` } } });
    await prisma.industryDataPackageItem.deleteMany({ where: { package: { key: { contains: `boqunlock-${RUN_ID}` } } } });
    await prisma.masterItem.deleteMany({ where: { itemCode: { contains: `BOQUNLOCK-${RUN_ID}` } } });
    await prisma.industryDataPackage.deleteMany({ where: { key: { contains: `boqunlock-${RUN_ID}` } } });
    await prisma.$disconnect();
  }, 30_000);

  /**
   * Self-contained fixture (never depends on a specific pre-seeded governed
   * package existing in whatever database this happens to run against — same
   * rationale as the "no-product" fixture in commercial-requirement-service.test.ts):
   * a fresh company, a premium MasterItem, an IndustryDataPackage that item
   * belongs to, a default-BOQ'd project with that item added as a line, and
   * a real CommerceProduct/CommercePrice/CommerceProviderMapping selling
   * access to that package.
   */
  async function buildUnsatisfiedBoqFixture(label: string) {
    const company = await prisma.company.create({
      data: {
        legalName: `BOQ Unlock Test Co ${label} ${RUN_ID}`,
        tradeName: `BOQ Unlock ${label}`,
        email: `boqunlock-${label}-${RUN_ID}@example.com`,
        address: "Dubai, UAE",
        country: "UAE",
        taxRegistrationNumber: "100000000000003",
      },
    });
    cleanupCompanyIds.push(company.id);

    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    await prisma.companyIndustryEngine.create({ data: { companyId: company.id, industryEngineId: construction.id, enabled: true } });
    const client = await createClient(company.id, { name: `Client ${label}`, email: `boqunlock-client-${label}-${RUN_ID}@example.com` });
    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        email: `boqunlock-owner-${label}-${RUN_ID}@example.com`,
        passwordHash: "test-fixture-not-a-real-hash",
        fullName: "Test Actor",
        role: UserRole.COMPANY_OWNER,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });

    const discipline = await prisma.masterDiscipline.findFirstOrThrow();
    const category = await prisma.masterCategory.findFirstOrThrow({ where: { disciplineId: discipline.id } });
    const pkg = await prisma.industryDataPackage.create({
      data: {
        key: `boqunlock-${RUN_ID}-${label}`,
        name: `BOQ Unlock Test Package ${label}`,
        disciplineId: discipline.id,
        packageType: "SPECIALIST",
        monthlyPrice: 0,
      },
    });
    const masterItem = await prisma.masterItem.create({
      data: {
        disciplineId: discipline.id,
        categoryId: category.id,
        itemCode: `BOQUNLOCK-${RUN_ID}-${label}`,
        name: `BOQ Unlock Test Item ${label}`,
        defaultUnit: "nos",
        isPremium: true,
        status: "ACTIVE",
      },
    });
    await prisma.industryDataPackageItem.create({ data: { packageId: pkg.id, masterItemId: masterItem.id, sortOrder: 0 } });

    const actor = actorFor(user.id, company.id, user.email);
    const { boq } = await createProjectWithDefaultBoq(actor, {
      clientId: client.id,
      industryEngineId: "construction",
      reference: `BOQUNLOCK-${RUN_ID}-${label}`,
      name: `BOQ Unlock Test ${label}`,
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    await addBoqItemFromSource(actor, boq.id, {
      sourceType: "MASTER_ITEM",
      sourceId: masterItem.id,
      sectionId: boq.sections[0].id,
      itemNumber: 1,
      quantity: "1",
    });

    const { product } = await upsertCommerceProduct({
      code: `test_boqunlock_${RUN_ID}_product_${label}`,
      type: "SUBSCRIPTION",
      name: `BOQ Unlock Test Product ${label}`,
      purchaseMode: "DIRECT",
      isActive: true,
      isPublic: true,
      industryPackageId: pkg.id,
    });
    const { price } = await upsertCommercePrice({
      productId: product.id,
      code: `test_boqunlock_${RUN_ID}_price_${label}`,
      amountMinor: 29900,
      billingInterval: "YEAR",
      isActive: true,
    });
    await prisma.commercePrice.update({ where: { id: price.id }, data: { reviewStatus: "APPROVED" } });
    const providerPriceId = `price_boqunlock_test_${RUN_ID}_${label}`;
    await createMapping({
      provider: "STRIPE",
      environment: "TEST",
      commerceProductId: product.id,
      commercePriceId: price.id,
      providerProductId: `prod_boqunlock_test_${RUN_ID}_${label}`,
      providerPriceId,
      providerObjectType: "PRICE",
    });

    return { company, user, actor, boq, masterItem, pkg, product, price, providerPriceId };
  }

  it("(a) a BOQ_UNLOCK request for a BOQ with an unsatisfied package requirement creates a real Checkout Session with the correct line items", async () => {
    const fixture = await buildUnsatisfiedBoqFixture("a");
    const stripe = mockStripeClient();

    const result = await createCommerceCheckoutSession(
      fixture.actor,
      { checkoutMode: "BOQ_UNLOCK", boqId: fixture.boq.id, revisionNumber: fixture.boq.revisionNumber },
      stripe,
    );

    expect(result.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com/);
    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    const callArgs = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(callArgs.line_items).toEqual([{ price: fixture.providerPriceId, quantity: 1 }]);
    expect(callArgs.metadata.quantara_checkout_mode).toBe("BOQ_UNLOCK");
    expect(callArgs.metadata.quantara_boq_id).toBe(fixture.boq.id);
    expect(callArgs.metadata.quantara_company_id).toBe(fixture.company.id);

    const billingCustomer = await prisma.stripeBillingCustomer.findUnique({
      where: { companyId_livemode: { companyId: fixture.company.id, livemode: false } },
    });
    expect(billingCustomer).not.toBeNull();
  });

  it("(b) a BOQ_UNLOCK request for a BOQ that is already fully unlocked throws BOQ_ALREADY_UNLOCKED and never calls Stripe", async () => {
    const fixture = await buildUnsatisfiedBoqFixture("b");
    await prisma.companyPackageSubscription.create({
      data: {
        companyId: fixture.company.id,
        packageId: fixture.pkg.id,
        status: "ACTIVE",
        startsAt: new Date(),
        expiresAt: null,
        source: "test-fixture",
      },
    });
    const stripe = mockStripeClient();

    await expect(
      createCommerceCheckoutSession(
        fixture.actor,
        { checkoutMode: "BOQ_UNLOCK", boqId: fixture.boq.id, revisionNumber: fixture.boq.revisionNumber },
        stripe,
      ),
    ).rejects.toMatchObject({ code: "BOQ_ALREADY_UNLOCKED" });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("(c) a BOQ_UNLOCK request still goes through the per-company advisory lock: concurrent BOQ_UNLOCK + SUBSCRIPTION requests for the same company never leave two open Checkout Sessions or two Stripe customers", async () => {
    const fixture = await buildUnsatisfiedBoqFixture("c");

    // A SUBSCRIPTION-eligible price unrelated to the package, for the SAME company.
    const { product: subProduct } = await upsertCommerceProduct({
      code: `test_boqunlock_${RUN_ID}_c_subscription_product`,
      type: "SUBSCRIPTION",
      name: "BOQ Unlock Test Subscription Product",
      purchaseMode: "DIRECT",
      isActive: true,
      isPublic: true,
    });
    const { price: subPrice } = await upsertCommercePrice({
      productId: subProduct.id,
      code: `test_boqunlock_${RUN_ID}_c_subscription_price`,
      amountMinor: 14900,
      billingInterval: "MONTH",
      isActive: true,
    });
    await prisma.commercePrice.update({ where: { id: subPrice.id }, data: { reviewStatus: "APPROVED" } });
    await createMapping({
      provider: "STRIPE",
      environment: "TEST",
      commerceProductId: subProduct.id,
      commercePriceId: subPrice.id,
      providerProductId: `prod_boqunlock_test_${RUN_ID}_c_sub`,
      providerPriceId: `price_boqunlock_test_${RUN_ID}_c_sub`,
      providerObjectType: "PRICE",
    });

    const { client: stripe, sessions } = makeStatefulStripeClient();

    const [boqUnlockResult, subscriptionResult] = await Promise.all([
      createCommerceCheckoutSession(
        fixture.actor,
        { checkoutMode: "BOQ_UNLOCK", boqId: fixture.boq.id, revisionNumber: fixture.boq.revisionNumber },
        stripe,
      ),
      createCommerceCheckoutSession(fixture.actor, { priceCode: subPrice.code }, stripe),
    ]);

    expect(boqUnlockResult.checkoutSessionId).not.toBe(subscriptionResult.checkoutSessionId);

    // The lock serializes both branches through the SAME getOrCreateStripeCustomerForCompany
    // call — exactly one Stripe customer and one StripeBillingCustomer row must exist for the
    // company no matter which mode ran first.
    expect(stripe.customers.create).toHaveBeenCalledTimes(1);
    const billingCustomer = await prisma.stripeBillingCustomer.findUnique({
      where: { companyId_livemode: { companyId: fixture.company.id, livemode: false } },
    });
    expect(billingCustomer).not.toBeNull();

    // handleBoqUnlockCheckoutSession unconditionally expires every app-owned open session
    // before creating its own (it has no per-price "reuse" concept, unlike the SUBSCRIPTION
    // path) — so whichever request commits second necessarily expires the first's session.
    // Exactly one open session must survive for this company's customer either way.
    const openForCustomer = Array.from(sessions.values()).filter(
      (session) => session.customer === billingCustomer!.stripeCustomerId && session.status === "open",
    );
    expect(openForCustomer).toHaveLength(1);
  });

  it("guards against Stripe returning a session with no URL instead of silently returning an unusable checkoutUrl", async () => {
    const fixture = await buildUnsatisfiedBoqFixture("nourl");
    const stripe = mockStripeClient();
    stripe.checkout.sessions.create.mockResolvedValueOnce({ id: `cs_boqunlock_nourl_${RUN_ID}`, url: null });

    await expect(
      createCommerceCheckoutSession(
        fixture.actor,
        { checkoutMode: "BOQ_UNLOCK", boqId: fixture.boq.id, revisionNumber: fixture.boq.revisionNumber },
        stripe,
      ),
    ).rejects.toMatchObject({ code: "STRIPE_CHECKOUT_SESSION_NO_URL" });
  });
});
