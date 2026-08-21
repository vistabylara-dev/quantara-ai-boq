import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import {
  CheckoutNotEligibleError,
  createCommerceCheckoutSession,
} from "../src/lib/services/commerce-checkout-service";
import { upsertCommerceProduct, upsertCommercePrice } from "../src/lib/repositories/commerce-product-repository";
import { createMapping } from "../src/lib/repositories/commerce-provider-mapping-repository";

const RUN_ID = `${Date.now()}-${process.pid}-checkout`;

function actorFor(userId: string, companyId: string, email: string): CurrentActor {
  return { userId, companyId, role: "COMPANY_OWNER", fullName: "Checkout Test Owner", email };
}

// Module-level (not per-mockStripeClient()) so IDs stay unique across every
// test in this file — stripeCustomerId carries a real database-wide unique
// constraint, and a per-instance counter reset to 0 in each test previously
// caused two different tests' first customer to both mint "..._1" and
// collide on that constraint.
let globalCustomerCounter = 0;
let globalSessionCounter = 0;

function mockStripeClient() {
  return {
    customers: {
      create: vi.fn(async () => ({ id: `cus_test_${RUN_ID}_${++globalCustomerCounter}` })),
    },
    // Defaults to "no existing subscription" / "no open session" — FIX B
    // tests override these per-test to simulate the Stripe-side state a
    // DB-only check can't see (webhook lag, a still-open prior session).
    subscriptions: {
      list: vi.fn(async () => ({ data: [], has_more: false })),
    },
    checkout: {
      sessions: {
        create: vi.fn(async () => ({ id: `cs_test_${RUN_ID}_${++globalSessionCounter}`, url: `https://checkout.stripe.com/test/${RUN_ID}_${globalSessionCounter}` })),
        list: vi.fn(async () => ({ data: [], has_more: false })),
        expire: vi.fn(async (id: string) => ({ id, status: "expired" })),
      },
    },
    billingPortal: {
      sessions: { create: vi.fn(async () => ({ url: `https://billing.stripe.com/test/${RUN_ID}` })) },
    },
    // ESLint's `@typescript-eslint/no-explicit-any` rule is not registered for tests/** in
    // this repo's config, so a disable comment for it errors as "rule not found" — the cast
    // itself is fine as plain `any` (this mock is extensively reconfigured post-creation via
    // `.mockResolvedValueOnce`/`.mockImplementation`, which a `Stripe`-typed cast would break).
  } as any;
}

// Module-level so IDs stay unique across concurrency tests that share a
// single makeStatefulStripeClient() instance within one test's Promise.all().
let globalStatefulCustomerCounter = 0;
let globalStatefulSessionCounter = 0;

type StatefulSession = {
  id: string;
  url: string;
  status: "open" | "expired" | "complete";
  metadata: Record<string, string>;
  customer: string;
};

/**
 * Unlike mockStripeClient() above (which always answers "no existing
 * session"), this backs sessions.create/list/expire with real shared state
 * in a Map, so concurrent createCommerceCheckoutSession() calls racing
 * against the REAL Postgres advisory lock (STRIPE-COMMERCIAL-18) produce a
 * genuinely observable final state — e.g. "exactly one open session
 * survives" — rather than each call independently believing it's the only
 * one. This is what lets the concurrency tests below assert on outcomes
 * instead of just mock call counts.
 */
function makeStatefulStripeClient() {
  const sessions = new Map<string, StatefulSession>();

  const client = {
    customers: {
      create: vi.fn(async () => ({ id: `cus_stateful_${RUN_ID}_${++globalStatefulCustomerCounter}` })),
    },
    subscriptions: {
      list: vi.fn(async () => ({ data: [], has_more: false })),
    },
    checkout: {
      sessions: {
        create: vi.fn(async (params: { customer: string; metadata?: Record<string, string> }) => {
          const id = `cs_stateful_${RUN_ID}_${++globalStatefulSessionCounter}`;
          const url = `https://checkout.stripe.com/test/stateful_${RUN_ID}_${globalStatefulSessionCounter}`;
          sessions.set(id, { id, url, status: "open", metadata: params.metadata ?? {}, customer: params.customer });
          return { id, url };
        }),
        list: vi.fn(async (params: { customer: string; status?: string; starting_after?: string }) => {
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
    // Same rationale as mockStripeClient() above: kept as `any` (no disable comment needed,
    // since the rule isn't registered for tests/**) because callers reach into
    // `.mock.calls`/`.mockResolvedValueOnce` on these methods after construction.
  } as any;

  return { client, sessions };
}

describe("commerce-checkout-service (integration, real local Postgres, mocked Stripe)", () => {
  let companyId: string;
  let otherCompanyId: string;
  let thirdCompanyId: string;
  let fourthCompanyId: string;
  let raceCompanyId: string;
  let raceCompanyBId: string;
  let cleanupCompanyId: string;
  let userId: string;
  const originalKey = process.env.STRIPE_SECRET_KEY;
  const originalMode = process.env.STRIPE_MODE;
  const originalBaseUrl = process.env.APP_BASE_URL;

  beforeAll(async () => {
    const company = await prisma.company.create({ data: { legalName: `Checkout Co ${RUN_ID}`, tradeName: "Checkout Co", email: `checkout-${RUN_ID}@example.com` } });
    companyId = company.id;
    const otherCompany = await prisma.company.create({ data: { legalName: `Other Co ${RUN_ID}`, tradeName: "Other Co", email: `checkout-other-${RUN_ID}@example.com` } });
    otherCompanyId = otherCompany.id;
    const thirdCompany = await prisma.company.create({ data: { legalName: `Third Co ${RUN_ID}`, tradeName: "Third Co", email: `checkout-third-${RUN_ID}@example.com` } });
    thirdCompanyId = thirdCompany.id;
    const fourthCompany = await prisma.company.create({ data: { legalName: `Fourth Co ${RUN_ID}`, tradeName: "Fourth Co", email: `checkout-fourth-${RUN_ID}@example.com` } });
    fourthCompanyId = fourthCompany.id;
    const raceCompany = await prisma.company.create({ data: { legalName: `Race Co ${RUN_ID}`, tradeName: "Race Co", email: `checkout-race-${RUN_ID}@example.com` } });
    raceCompanyId = raceCompany.id;
    const raceCompanyB = await prisma.company.create({ data: { legalName: `Race Co B ${RUN_ID}`, tradeName: "Race Co B", email: `checkout-race-b-${RUN_ID}@example.com` } });
    raceCompanyBId = raceCompanyB.id;
    const cleanupCompany = await prisma.company.create({ data: { legalName: `Cleanup Co ${RUN_ID}`, tradeName: "Cleanup Co", email: `checkout-cleanup-${RUN_ID}@example.com` } });
    cleanupCompanyId = cleanupCompany.id;
    const user = await prisma.user.create({ data: { companyId, email: `checkout-owner-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Owner", role: "COMPANY_OWNER", isActive: true, emailVerifiedAt: new Date() } });
    userId = user.id;
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
    const allCompanyIds = [companyId, otherCompanyId, thirdCompanyId, fourthCompanyId, raceCompanyId, raceCompanyBId, cleanupCompanyId];
    await prisma.commerceProduct.deleteMany({ where: { code: { contains: RUN_ID } } });
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: { in: allCompanyIds } } });
    await prisma.softwarePlan.deleteMany({ where: { key: { contains: RUN_ID } } });
    await prisma.stripeBillingCustomer.deleteMany({ where: { companyId: { in: allCompanyIds } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: { in: allCompanyIds } } });
    await prisma.$disconnect();
  });

  async function makeApprovedDirectPrice(overrides: {
    purchaseMode?: "DIRECT" | "QUOTATION_REQUIRED" | "CONTACT_SALES";
    isActive?: boolean;
    isPublic?: boolean;
    type?: "SUBSCRIPTION" | "ONE_TIME" | "ADD_ON";
    priceActive?: boolean;
    approved?: boolean;
    amountMinor?: number;
    billingInterval?: "ONE_TIME" | "MONTH" | "YEAR";
  } = {}) {
    const suffix = `${RUN_ID}_${Math.random().toString(36).slice(2)}`;
    const { product } = await upsertCommerceProduct({
      code: `test_checkout_product_${suffix}`,
      type: overrides.type ?? "SUBSCRIPTION",
      name: "Checkout Test Product",
      purchaseMode: overrides.purchaseMode ?? "DIRECT",
      isActive: overrides.isActive ?? true,
      isPublic: overrides.isPublic ?? true,
    });
    const { price } = await upsertCommercePrice({
      productId: product.id,
      code: `test_checkout_price_${suffix}`,
      amountMinor: overrides.amountMinor ?? 14900,
      billingInterval: overrides.billingInterval ?? "MONTH",
      isActive: overrides.priceActive ?? true,
    });
    if (overrides.approved !== false) {
      await prisma.commercePrice.update({ where: { id: price.id }, data: { reviewStatus: "APPROVED" } });
    }
    return { product, price };
  }

  it("rejects an unrecognized price code", async () => {
    const actor = actorFor(userId, companyId, `checkout-owner-${RUN_ID}@example.com`);
    await expect(createCommerceCheckoutSession(actor, { priceCode: "does_not_exist" }, mockStripeClient())).rejects.toMatchObject({ reason: "PRICE_NOT_FOUND" });
  });

  it("rejects an inactive product", async () => {
    const { price } = await makeApprovedDirectPrice({ isActive: false });
    const actor = actorFor(userId, companyId, `checkout-owner-${RUN_ID}@example.com`);
    await expect(createCommerceCheckoutSession(actor, { priceCode: price.code }, mockStripeClient())).rejects.toMatchObject({ reason: "PRODUCT_INACTIVE" });
  });

  it("rejects a non-DIRECT (quotation-required) product", async () => {
    const { price } = await makeApprovedDirectPrice({ purchaseMode: "QUOTATION_REQUIRED" });
    const actor = actorFor(userId, companyId, `checkout-owner-${RUN_ID}@example.com`);
    await expect(createCommerceCheckoutSession(actor, { priceCode: price.code }, mockStripeClient())).rejects.toMatchObject({ reason: "PRODUCT_NOT_DIRECT_PURCHASE" });
  });

  it("rejects a REQUIRES_REVIEW (non-APPROVED) price", async () => {
    const { price } = await makeApprovedDirectPrice({ approved: false });
    const actor = actorFor(userId, companyId, `checkout-owner-${RUN_ID}@example.com`);
    await expect(createCommerceCheckoutSession(actor, { priceCode: price.code }, mockStripeClient())).rejects.toMatchObject({ reason: "PRICE_NOT_APPROVED" });
  });

  it("rejects an inactive price", async () => {
    const { price } = await makeApprovedDirectPrice({ priceActive: false });
    const actor = actorFor(userId, companyId, `checkout-owner-${RUN_ID}@example.com`);
    await expect(createCommerceCheckoutSession(actor, { priceCode: price.code }, mockStripeClient())).rejects.toMatchObject({ reason: "PRICE_INACTIVE" });
  });

  it("rejects a zero-amount price", async () => {
    const { price } = await makeApprovedDirectPrice({ amountMinor: 0 });
    const actor = actorFor(userId, companyId, `checkout-owner-${RUN_ID}@example.com`);
    await expect(createCommerceCheckoutSession(actor, { priceCode: price.code }, mockStripeClient())).rejects.toMatchObject({ reason: "ZERO_OR_NEGATIVE_AMOUNT" });
  });

  it("rejects an APPROVED, DIRECT, active price with no provider mapping at all", async () => {
    const { price } = await makeApprovedDirectPrice();
    const actor = actorFor(userId, companyId, `checkout-owner-${RUN_ID}@example.com`);
    await expect(createCommerceCheckoutSession(actor, { priceCode: price.code }, mockStripeClient())).rejects.toMatchObject({ reason: "PROVIDER_MAPPING_MISSING" });
  });

  it("rejects a LIVE-environment mapping while running in test mode", async () => {
    const { product, price } = await makeApprovedDirectPrice();
    await createMapping({ provider: "STRIPE", environment: "LIVE", commerceProductId: product.id, commercePriceId: price.id, providerProductId: `prod_live_${RUN_ID}`, providerPriceId: `price_live_${RUN_ID}`, providerObjectType: "PRICE" });
    const actor = actorFor(userId, companyId, `checkout-owner-${RUN_ID}@example.com`);
    // STRIPE_MODE is unset (defaults to test), so only a TEST mapping should be honored.
    await expect(createCommerceCheckoutSession(actor, { priceCode: price.code }, mockStripeClient())).rejects.toMatchObject({ reason: "PROVIDER_MAPPING_MISSING" });
  });

  it("rejects a mapping that is not SYNCED (drifted)", async () => {
    const { product, price } = await makeApprovedDirectPrice();
    const mapping = await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: price.id, providerProductId: `prod_test_${RUN_ID}`, providerPriceId: `price_test_${RUN_ID}`, providerObjectType: "PRICE" });
    await prisma.commerceProviderMapping.update({ where: { id: mapping.id }, data: { synchronizationStatus: "DRIFTED" } });
    const actor = actorFor(userId, companyId, `checkout-owner-${RUN_ID}@example.com`);
    await expect(createCommerceCheckoutSession(actor, { priceCode: price.code }, mockStripeClient())).rejects.toMatchObject({ reason: "PROVIDER_MAPPING_NOT_SYNCED" });
  });

  it("creates a real subscription-mode checkout session for an eligible, mapped price and never trusts a client-supplied companyId", async () => {
    const { product, price } = await makeApprovedDirectPrice();
    await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: price.id, providerProductId: `prod_test_${RUN_ID}`, providerPriceId: `price_test_ok_${RUN_ID}`, providerObjectType: "PRICE" });
    const actor = actorFor(userId, companyId, `checkout-owner-${RUN_ID}@example.com`);
    const stripe = mockStripeClient();

    const result = await createCommerceCheckoutSession(actor, { priceCode: price.code }, stripe);

    expect(result.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com/);
    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    const callArgs = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(callArgs.mode).toBe("subscription");
    expect(callArgs.line_items).toEqual([{ price: `price_test_ok_${RUN_ID}`, quantity: 1 }]);
    // Company identity comes only from the authenticated actor, attached server-side — never accepted as input.
    expect(callArgs.client_reference_id).toBe(companyId);
    expect(callArgs.metadata.quantara_company_id).toBe(companyId);

    const billingCustomer = await prisma.stripeBillingCustomer.findUnique({ where: { companyId_livemode: { companyId, livemode: false } } });
    expect(billingCustomer).not.toBeNull();
  });

  it("reuses an existing StripeBillingCustomer instead of creating a second one", async () => {
    const { product, price } = await makeApprovedDirectPrice();
    await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: price.id, providerProductId: `prod_test_reuse_${RUN_ID}`, providerPriceId: `price_test_reuse_${RUN_ID}`, providerObjectType: "PRICE" });
    const actor = actorFor(userId, otherCompanyId, `checkout-other-${RUN_ID}@example.com`);
    const stripe = mockStripeClient();

    await createCommerceCheckoutSession(actor, { priceCode: price.code }, stripe);
    await createCommerceCheckoutSession(actor, { priceCode: price.code }, stripe);

    expect(stripe.customers.create).toHaveBeenCalledTimes(1);
    const count = await prisma.stripeBillingCustomer.count({ where: { companyId: otherCompanyId, livemode: false } });
    expect(count).toBe(1);
  });

  it("throws CheckoutNotEligibleError as an AppError subclass carrying a safe machine-readable reason", async () => {
    const { price } = await makeApprovedDirectPrice({ approved: false });
    const actor = actorFor(userId, companyId, `checkout-owner-${RUN_ID}@example.com`);
    await expect(createCommerceCheckoutSession(actor, { priceCode: price.code }, mockStripeClient())).rejects.toBeInstanceOf(CheckoutNotEligibleError);
  });

  it("rejects a private (isPublic: false) product — FIX 7", async () => {
    const { price } = await makeApprovedDirectPrice({ isPublic: false });
    const actor = actorFor(userId, companyId, `checkout-owner-${RUN_ID}@example.com`);
    await expect(createCommerceCheckoutSession(actor, { priceCode: price.code }, mockStripeClient())).rejects.toMatchObject({ reason: "PRODUCT_NOT_PUBLIC" });
  });

  it("rejects a non-SUBSCRIPTION product — FIX 5", async () => {
    const { price } = await makeApprovedDirectPrice({ type: "ADD_ON" });
    const actor = actorFor(userId, companyId, `checkout-owner-${RUN_ID}@example.com`);
    await expect(createCommerceCheckoutSession(actor, { priceCode: price.code }, mockStripeClient())).rejects.toMatchObject({ reason: "PRODUCT_NOT_SUBSCRIPTION" });
  });

  it("rejects a ONE_TIME billing interval — one-time fulfillment does not exist yet (FIX 5)", async () => {
    const { price } = await makeApprovedDirectPrice({ billingInterval: "ONE_TIME" });
    const actor = actorFor(userId, companyId, `checkout-owner-${RUN_ID}@example.com`);
    await expect(createCommerceCheckoutSession(actor, { priceCode: price.code }, mockStripeClient())).rejects.toMatchObject({ reason: "UNSUPPORTED_INTERVAL" });
  });

  it("rejects a second checkout when the company already has a non-final Stripe subscription — FIX 4", async () => {
    const { product, price } = await makeApprovedDirectPrice();
    await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: price.id, providerProductId: `prod_test_double_${RUN_ID}`, providerPriceId: `price_test_double_${RUN_ID}`, providerObjectType: "PRICE" });

    const plan = await prisma.softwarePlan.create({ data: { key: `test_checkout_double_plan_${RUN_ID}`, name: "Double Sub Test Plan", planType: "PRO" } });
    await prisma.companySoftwareSubscription.create({
      data: { companyId: otherCompanyId, softwarePlanId: plan.id, status: "ACTIVE", externalSubscriptionId: `sub_existing_${RUN_ID}`, source: "stripe" },
    });

    const actor = actorFor(userId, otherCompanyId, `checkout-other-${RUN_ID}@example.com`);
    await expect(createCommerceCheckoutSession(actor, { priceCode: price.code }, mockStripeClient())).rejects.toMatchObject({ code: "CHECKOUT_EXISTING_SUBSCRIPTION" });
  });

  it("allows a fresh checkout when the company's only prior Stripe subscription is CANCELLED — FIX 4", async () => {
    const { product, price } = await makeApprovedDirectPrice();
    await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: price.id, providerProductId: `prod_test_cancelled_${RUN_ID}`, providerPriceId: `price_test_cancelled_${RUN_ID}`, providerObjectType: "PRICE" });

    const plan = await prisma.softwarePlan.create({ data: { key: `test_checkout_cancelled_plan_${RUN_ID}`, name: "Cancelled Sub Test Plan", planType: "PRO" } });
    await prisma.companySoftwareSubscription.create({
      data: { companyId: thirdCompanyId, softwarePlanId: plan.id, status: "CANCELLED", externalSubscriptionId: `sub_cancelled_${RUN_ID}`, source: "stripe" },
    });

    const actor = actorFor(userId, thirdCompanyId, `checkout-third-${RUN_ID}@example.com`);
    const result = await createCommerceCheckoutSession(actor, { priceCode: price.code }, mockStripeClient());
    expect(result.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com/);
  });

  it("STRIPE-COMMERCIAL-20: each genuine new Checkout Session creation attempt gets a fresh, distinct high-entropy idempotency key — the old deterministic time-bucket key is gone", async () => {
    const { product, price } = await makeApprovedDirectPrice();
    await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: price.id, providerProductId: `prod_test_idem_${RUN_ID}`, providerPriceId: `price_test_idem_${RUN_ID}`, providerObjectType: "PRICE" });
    const actor = actorFor(userId, fourthCompanyId, `checkout-fourth-${RUN_ID}@example.com`);
    const stripe = mockStripeClient();

    await createCommerceCheckoutSession(actor, { priceCode: price.code }, stripe);
    // No open session is returned by the mock between calls (each is a genuinely separate attempt).
    stripe.checkout.sessions.list.mockResolvedValueOnce({ data: [], has_more: false });
    await createCommerceCheckoutSession(actor, { priceCode: price.code }, stripe);

    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(2);
    const firstKey = stripe.checkout.sessions.create.mock.calls[0][1]?.idempotencyKey;
    const secondKey = stripe.checkout.sessions.create.mock.calls[1][1]?.idempotencyKey;
    expect(firstKey).toBeTruthy();
    expect(secondKey).toBeTruthy();
    expect(firstKey).not.toBe(secondKey);
    // A UUID, not a predictable "quantara:test:checkout:<company>:<price>:<bucket>" string.
    expect(firstKey).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("FIX B: webhook lag cannot allow a second subscription — a Stripe-side active subscription blocks checkout even with no DB record yet", async () => {
    const { product, price } = await makeApprovedDirectPrice();
    await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: price.id, providerProductId: `prod_test_lag_${RUN_ID}`, providerPriceId: `price_test_lag_${RUN_ID}`, providerObjectType: "PRICE" });
    const actor = actorFor(userId, fourthCompanyId, `checkout-fourth-${RUN_ID}@example.com`);
    const stripe = mockStripeClient();
    // Simulates: an earlier checkout completed on Stripe's side and Stripe already created the
    // subscription, but our webhook hasn't been processed yet — companySoftwareSubscription has
    // no row for this company, so the DB-only check alone would incorrectly allow a second checkout.
    stripe.subscriptions.list.mockResolvedValueOnce({ data: [{ id: `sub_lag_${RUN_ID}`, status: "active" }] });

    const dbCheckPassed = await prisma.companySoftwareSubscription.count({ where: { companyId: fourthCompanyId, source: "stripe" } });
    expect(dbCheckPassed).toBe(0); // confirms the DB-only signal would have said "no existing subscription"

    await expect(createCommerceCheckoutSession(actor, { priceCode: price.code }, stripe)).rejects.toMatchObject({ code: "CHECKOUT_EXISTING_SUBSCRIPTION" });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("FIX B/FIX 1: an existing open Checkout Session for THIS company AND THIS price is reused instead of creating a second one", async () => {
    const { product, price } = await makeApprovedDirectPrice();
    await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: price.id, providerProductId: `prod_test_open_${RUN_ID}`, providerPriceId: `price_test_open_${RUN_ID}`, providerObjectType: "PRICE" });
    const actor = actorFor(userId, fourthCompanyId, `checkout-fourth-${RUN_ID}@example.com`);
    const stripe = mockStripeClient();
    stripe.checkout.sessions.list.mockResolvedValueOnce({
      data: [{ id: `cs_existing_open_${RUN_ID}`, url: `https://checkout.stripe.com/test/existing_${RUN_ID}`, metadata: { quantara_company_id: fourthCompanyId, quantara_price_code: price.code } }],
      has_more: false,
    });

    const result = await createCommerceCheckoutSession(actor, { priceCode: price.code }, stripe);

    expect(result.checkoutSessionId).toBe(`cs_existing_open_${RUN_ID}`);
    expect(result.checkoutUrl).toBe(`https://checkout.stripe.com/test/existing_${RUN_ID}`);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.expire).not.toHaveBeenCalled();
  });

  it("FIX B: a genuinely canceled Stripe subscription does not block a fresh checkout", async () => {
    const { product, price } = await makeApprovedDirectPrice();
    await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: price.id, providerProductId: `prod_test_stripecancel_${RUN_ID}`, providerPriceId: `price_test_stripecancel_${RUN_ID}`, providerObjectType: "PRICE" });
    const actor = actorFor(userId, fourthCompanyId, `checkout-fourth-${RUN_ID}@example.com`);
    const stripe = mockStripeClient();
    stripe.subscriptions.list.mockResolvedValueOnce({ data: [{ id: `sub_old_cancelled_${RUN_ID}`, status: "canceled" }], has_more: false });

    const result = await createCommerceCheckoutSession(actor, { priceCode: price.code }, stripe);
    expect(result.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com/);
  });

  it("FIX 1: an open session for a DIFFERENT price code is never reused — it is expired and a new session is created for the requested price", async () => {
    const { product: starterProduct, price: starterPrice } = await makeApprovedDirectPrice();
    const { product: proProduct, price: proPrice } = await makeApprovedDirectPrice();
    await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: starterProduct.id, commercePriceId: starterPrice.id, providerProductId: `prod_test_starter_${RUN_ID}`, providerPriceId: `price_test_starter_${RUN_ID}`, providerObjectType: "PRICE" });
    await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: proProduct.id, commercePriceId: proPrice.id, providerProductId: `prod_test_pro_${RUN_ID}`, providerPriceId: `price_test_pro_${RUN_ID}`, providerObjectType: "PRICE" });

    const actor = actorFor(userId, fourthCompanyId, `checkout-fourth-${RUN_ID}@example.com`);
    const stripe = mockStripeClient();
    const staleStarterSessionId = `cs_stale_starter_${RUN_ID}`;
    stripe.checkout.sessions.list.mockResolvedValueOnce({
      data: [{ id: staleStarterSessionId, url: `https://checkout.stripe.com/test/stale_${RUN_ID}`, metadata: { quantara_company_id: fourthCompanyId, quantara_price_code: starterPrice.code } }],
      has_more: false,
    });

    // Customer already has an open Starter checkout, but is now requesting Professional.
    const result = await createCommerceCheckoutSession(actor, { priceCode: proPrice.code }, stripe);

    expect(result.checkoutSessionId).not.toBe(staleStarterSessionId);
    expect(result.checkoutUrl).not.toContain("stale");
    expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith(staleStarterSessionId);
    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    const callArgs = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(callArgs.line_items).toEqual([{ price: `price_test_pro_${RUN_ID}`, quantity: 1 }]);
  });

  it("FIX 1: an open session for the SAME product but a DIFFERENT interval (monthly vs annual) is never reused", async () => {
    const { product } = await makeApprovedDirectPrice();
    const { price: monthlyPrice } = await upsertCommercePrice({ productId: product.id, code: `test_checkout_monthly_${RUN_ID}`, amountMinor: 14900, billingInterval: "MONTH" });
    await prisma.commercePrice.update({ where: { id: monthlyPrice.id }, data: { reviewStatus: "APPROVED" } });
    const { price: annualPrice } = await upsertCommercePrice({ productId: product.id, code: `test_checkout_annual_${RUN_ID}`, amountMinor: 149000, billingInterval: "YEAR" });
    await prisma.commercePrice.update({ where: { id: annualPrice.id }, data: { reviewStatus: "APPROVED" } });
    await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: monthlyPrice.id, providerProductId: `prod_test_interval_${RUN_ID}`, providerPriceId: `price_test_monthly_${RUN_ID}`, providerObjectType: "PRICE" });
    await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: annualPrice.id, providerProductId: `prod_test_interval_${RUN_ID}`, providerPriceId: `price_test_annual_${RUN_ID}`, providerObjectType: "PRICE" });

    const actor = actorFor(userId, fourthCompanyId, `checkout-fourth-${RUN_ID}@example.com`);
    const stripe = mockStripeClient();
    const staleMonthlySessionId = `cs_stale_monthly_${RUN_ID}`;
    stripe.checkout.sessions.list.mockResolvedValueOnce({
      data: [{ id: staleMonthlySessionId, url: `https://checkout.stripe.com/test/stale_monthly_${RUN_ID}`, metadata: { quantara_company_id: fourthCompanyId, quantara_price_code: monthlyPrice.code } }],
      has_more: false,
    });

    const result = await createCommerceCheckoutSession(actor, { priceCode: annualPrice.code }, stripe);

    expect(result.checkoutSessionId).not.toBe(staleMonthlySessionId);
    expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith(staleMonthlySessionId);
    const callArgs = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(callArgs.line_items).toEqual([{ price: `price_test_annual_${RUN_ID}`, quantity: 1 }]);
  });

  it("FIX 3: a blocking subscription that only appears on a later page still blocks checkout", async () => {
    const { product, price } = await makeApprovedDirectPrice();
    await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: price.id, providerProductId: `prod_test_page_${RUN_ID}`, providerPriceId: `price_test_page_${RUN_ID}`, providerObjectType: "PRICE" });
    const actor = actorFor(userId, fourthCompanyId, `checkout-fourth-${RUN_ID}@example.com`);
    const stripe = mockStripeClient();

    stripe.subscriptions.list.mockImplementation(async (params: { starting_after?: string }) => {
      if (!params?.starting_after) {
        // Page 1: only a non-blocking (canceled) subscription, but there's more.
        return { data: [{ id: `sub_page1_${RUN_ID}`, status: "canceled" }], has_more: true };
      }
      // Page 2: the genuinely blocking one.
      return { data: [{ id: `sub_page2_${RUN_ID}`, status: "active" }], has_more: false };
    });

    await expect(createCommerceCheckoutSession(actor, { priceCode: price.code }, stripe)).rejects.toMatchObject({ code: "CHECKOUT_EXISTING_SUBSCRIPTION" });
    expect(stripe.subscriptions.list).toHaveBeenCalledTimes(2);
  });

  it("FIX 3: a matching open Quantara session that only appears on a later page is still found and reused, and unrelated first-page sessions never hide it", async () => {
    const { product, price } = await makeApprovedDirectPrice();
    await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: price.id, providerProductId: `prod_test_page2_${RUN_ID}`, providerPriceId: `price_test_page2_${RUN_ID}`, providerObjectType: "PRICE" });
    const actor = actorFor(userId, fourthCompanyId, `checkout-fourth-${RUN_ID}@example.com`);
    const stripe = mockStripeClient();
    const targetSessionId = `cs_page2_match_${RUN_ID}`;

    stripe.checkout.sessions.list.mockImplementation(async (params: { starting_after?: string }) => {
      if (!params?.starting_after) {
        // Page 1: an open session that belongs to a different company entirely — must not hide the real match.
        return { data: [{ id: `cs_page1_unrelated_${RUN_ID}`, url: "https://checkout.stripe.com/test/unrelated", metadata: { quantara_company_id: "some-other-company-id" } }], has_more: true };
      }
      return { data: [{ id: targetSessionId, url: `https://checkout.stripe.com/test/page2_${RUN_ID}`, metadata: { quantara_company_id: fourthCompanyId, quantara_price_code: price.code } }], has_more: false };
    });

    const result = await createCommerceCheckoutSession(actor, { priceCode: price.code }, stripe);

    expect(result.checkoutSessionId).toBe(targetSessionId);
    expect(stripe.checkout.sessions.list).toHaveBeenCalledTimes(2);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("FIX 3: fails closed (safe error, never treated as 'no blocker found') when the Stripe subscription lookup itself errors", async () => {
    const { product, price } = await makeApprovedDirectPrice();
    await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: price.id, providerProductId: `prod_test_lookupfail_${RUN_ID}`, providerPriceId: `price_test_lookupfail_${RUN_ID}`, providerObjectType: "PRICE" });
    const actor = actorFor(userId, fourthCompanyId, `checkout-fourth-${RUN_ID}@example.com`);
    const stripe = mockStripeClient();
    stripe.subscriptions.list.mockRejectedValueOnce(new Error("network error"));

    await expect(createCommerceCheckoutSession(actor, { priceCode: price.code }, stripe)).rejects.toMatchObject({ code: "STRIPE_SUBSCRIPTION_LOOKUP_FAILED" });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  describe("STRIPE-COMMERCIAL-18/19/20: per-company checkout concurrency (real Postgres advisory lock)", () => {
    it("concurrent Starter + Professional requests for the SAME company cannot leave two open Checkout Sessions", async () => {
      const { product: starterProduct, price: starterPrice } = await makeApprovedDirectPrice();
      const { product: proProduct, price: proPrice } = await makeApprovedDirectPrice();
      await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: starterProduct.id, commercePriceId: starterPrice.id, providerProductId: `prod_race_starter_${RUN_ID}`, providerPriceId: `price_race_starter_${RUN_ID}`, providerObjectType: "PRICE" });
      await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: proProduct.id, commercePriceId: proPrice.id, providerProductId: `prod_race_pro_${RUN_ID}`, providerPriceId: `price_race_pro_${RUN_ID}`, providerObjectType: "PRICE" });

      const actor = actorFor(userId, raceCompanyId, `checkout-race-${RUN_ID}@example.com`);
      const { client: stripe, sessions } = makeStatefulStripeClient();

      const [resultA, resultB] = await Promise.all([
        createCommerceCheckoutSession(actor, { priceCode: starterPrice.code }, stripe),
        createCommerceCheckoutSession(actor, { priceCode: proPrice.code }, stripe),
      ]);

      expect(resultA.checkoutSessionId).not.toBe(resultB.checkoutSessionId);
      const billingCustomer = await prisma.stripeBillingCustomer.findUnique({ where: { companyId_livemode: { companyId: raceCompanyId, livemode: false } } });
      expect(billingCustomer).not.toBeNull();
      // Only one Stripe customer must ever be created for this company, even though two requests raced.
      expect(stripe.customers.create).toHaveBeenCalledTimes(1);
      const openForCustomer = Array.from(sessions.values()).filter((s) => s.customer === billingCustomer!.stripeCustomerId && s.status === "open");
      expect(openForCustomer).toHaveLength(1);
      // Whichever request lost the race must have had its stale session expired, not left open.
      expect(stripe.checkout.sessions.expire).toHaveBeenCalledTimes(1);
    });

    it("concurrent monthly + annual requests for the SAME company cannot leave two open Checkout Sessions", async () => {
      const { product } = await makeApprovedDirectPrice();
      const { price: monthlyPrice } = await upsertCommercePrice({ productId: product.id, code: `test_checkout_race_monthly_${RUN_ID}`, amountMinor: 14900, billingInterval: "MONTH" });
      await prisma.commercePrice.update({ where: { id: monthlyPrice.id }, data: { reviewStatus: "APPROVED" } });
      const { price: annualPrice } = await upsertCommercePrice({ productId: product.id, code: `test_checkout_race_annual_${RUN_ID}`, amountMinor: 149000, billingInterval: "YEAR" });
      await prisma.commercePrice.update({ where: { id: annualPrice.id }, data: { reviewStatus: "APPROVED" } });
      await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: monthlyPrice.id, providerProductId: `prod_race_interval_${RUN_ID}`, providerPriceId: `price_race_monthly_${RUN_ID}`, providerObjectType: "PRICE" });
      await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: annualPrice.id, providerProductId: `prod_race_interval_${RUN_ID}`, providerPriceId: `price_race_annual_${RUN_ID}`, providerObjectType: "PRICE" });

      const actor = actorFor(userId, raceCompanyId, `checkout-race-${RUN_ID}@example.com`);
      const { client: stripe, sessions } = makeStatefulStripeClient();

      const [resultA, resultB] = await Promise.all([
        createCommerceCheckoutSession(actor, { priceCode: monthlyPrice.code }, stripe),
        createCommerceCheckoutSession(actor, { priceCode: annualPrice.code }, stripe),
      ]);

      expect(resultA.checkoutSessionId).not.toBe(resultB.checkoutSessionId);
      const billingCustomer = await prisma.stripeBillingCustomer.findUnique({ where: { companyId_livemode: { companyId: raceCompanyId, livemode: false } } });
      const openForCustomer = Array.from(sessions.values()).filter((s) => s.customer === billingCustomer!.stripeCustomerId && s.status === "open");
      expect(openForCustomer).toHaveLength(1);
    });

    it("different companies racing at the same time do not block each other and each gets its own session", async () => {
      const { product: productA, price: priceA } = await makeApprovedDirectPrice();
      const { product: productB, price: priceB } = await makeApprovedDirectPrice();
      await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: productA.id, commercePriceId: priceA.id, providerProductId: `prod_race_companyA_${RUN_ID}`, providerPriceId: `price_race_companyA_${RUN_ID}`, providerObjectType: "PRICE" });
      await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: productB.id, commercePriceId: priceB.id, providerProductId: `prod_race_companyB_${RUN_ID}`, providerPriceId: `price_race_companyB_${RUN_ID}`, providerObjectType: "PRICE" });

      const actorA = actorFor(userId, raceCompanyId, `checkout-race-${RUN_ID}@example.com`);
      const actorB = actorFor(userId, raceCompanyBId, `checkout-race-b-${RUN_ID}@example.com`);
      const { client: stripe, sessions } = makeStatefulStripeClient();

      const [resultA, resultB] = await Promise.all([
        createCommerceCheckoutSession(actorA, { priceCode: priceA.code }, stripe),
        createCommerceCheckoutSession(actorB, { priceCode: priceB.code }, stripe),
      ]);

      expect(resultA.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com/);
      expect(resultB.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com/);
      expect(resultA.checkoutSessionId).not.toBe(resultB.checkoutSessionId);
      // Neither company's lock caused the other's stale-session cleanup — no expiry needed at all.
      expect(stripe.checkout.sessions.expire).not.toHaveBeenCalled();
      const customerA = await prisma.stripeBillingCustomer.findUnique({ where: { companyId_livemode: { companyId: raceCompanyId, livemode: false } } });
      const customerB = await prisma.stripeBillingCustomer.findUnique({ where: { companyId_livemode: { companyId: raceCompanyBId, livemode: false } } });
      expect(customerA!.stripeCustomerId).not.toBe(customerB!.stripeCustomerId);
      expect(Array.from(sessions.values()).filter((s) => s.customer === customerA!.stripeCustomerId && s.status === "open")).toHaveLength(1);
      expect(Array.from(sessions.values()).filter((s) => s.customer === customerB!.stripeCustomerId && s.status === "open")).toHaveLength(1);
    });

    it("fails closed with STRIPE_STALE_SESSION_EXPIRE_FAILED and creates NO new session when expiring a stale session errors", async () => {
      const { product: staleProduct, price: stalePrice } = await makeApprovedDirectPrice();
      const { product: newProduct, price: newPrice } = await makeApprovedDirectPrice();
      await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: staleProduct.id, commercePriceId: stalePrice.id, providerProductId: `prod_race_stale_${RUN_ID}`, providerPriceId: `price_race_stale_${RUN_ID}`, providerObjectType: "PRICE" });
      await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: newProduct.id, commercePriceId: newPrice.id, providerProductId: `prod_race_new_${RUN_ID}`, providerPriceId: `price_race_new_${RUN_ID}`, providerObjectType: "PRICE" });

      const actor = actorFor(userId, fourthCompanyId, `checkout-fourth-${RUN_ID}@example.com`);
      const stripe = mockStripeClient();
      const staleSessionId = `cs_stale_expirefail_${RUN_ID}`;
      stripe.checkout.sessions.list.mockResolvedValueOnce({
        data: [{ id: staleSessionId, url: `https://checkout.stripe.com/test/stale_expirefail_${RUN_ID}`, metadata: { quantara_company_id: fourthCompanyId, quantara_price_code: stalePrice.code } }],
        has_more: false,
      });
      stripe.checkout.sessions.expire.mockRejectedValueOnce(new Error("Stripe network timeout"));

      await expect(createCommerceCheckoutSession(actor, { priceCode: newPrice.code }, stripe)).rejects.toMatchObject({ code: "STRIPE_STALE_SESSION_EXPIRE_FAILED" });
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it("multiple app-owned open sessions are all confirmed expired and reduced to exactly one new session", async () => {
      const { product: staleProductA, price: stalePriceA } = await makeApprovedDirectPrice();
      const { product: staleProductB, price: stalePriceB } = await makeApprovedDirectPrice();
      const { product: newProduct, price: newPrice } = await makeApprovedDirectPrice();
      await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: staleProductA.id, commercePriceId: stalePriceA.id, providerProductId: `prod_race_multiA_${RUN_ID}`, providerPriceId: `price_race_multiA_${RUN_ID}`, providerObjectType: "PRICE" });
      await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: staleProductB.id, commercePriceId: stalePriceB.id, providerProductId: `prod_race_multiB_${RUN_ID}`, providerPriceId: `price_race_multiB_${RUN_ID}`, providerObjectType: "PRICE" });
      await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: newProduct.id, commercePriceId: newPrice.id, providerProductId: `prod_race_multiNew_${RUN_ID}`, providerPriceId: `price_race_multiNew_${RUN_ID}`, providerObjectType: "PRICE" });

      const actor = actorFor(userId, fourthCompanyId, `checkout-fourth-${RUN_ID}@example.com`);
      const stripe = mockStripeClient();
      const staleIdA = `cs_stale_multiA_${RUN_ID}`;
      const staleIdB = `cs_stale_multiB_${RUN_ID}`;
      stripe.checkout.sessions.list.mockResolvedValueOnce({
        data: [
          { id: staleIdA, url: `https://checkout.stripe.com/test/multiA_${RUN_ID}`, metadata: { quantara_company_id: fourthCompanyId, quantara_price_code: stalePriceA.code } },
          { id: staleIdB, url: `https://checkout.stripe.com/test/multiB_${RUN_ID}`, metadata: { quantara_company_id: fourthCompanyId, quantara_price_code: stalePriceB.code } },
        ],
        has_more: false,
      });

      const result = await createCommerceCheckoutSession(actor, { priceCode: newPrice.code }, stripe);

      expect(stripe.checkout.sessions.expire).toHaveBeenCalledTimes(2);
      expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith(staleIdA);
      expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith(staleIdB);
      expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
      expect(result.checkoutSessionId).not.toBe(staleIdA);
      expect(result.checkoutSessionId).not.toBe(staleIdB);
    });

    it("a genuine new attempt after a prior session has already expired creates a NEW session with a NEW idempotency key, not a replay of the expired one", async () => {
      const { product, price } = await makeApprovedDirectPrice();
      await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: price.id, providerProductId: `prod_race_reattempt_${RUN_ID}`, providerPriceId: `price_race_reattempt_${RUN_ID}`, providerObjectType: "PRICE" });

      const actor = actorFor(userId, raceCompanyId, `checkout-race-${RUN_ID}@example.com`);
      const { client: stripe, sessions } = makeStatefulStripeClient();

      const first = await createCommerceCheckoutSession(actor, { priceCode: price.code }, stripe);
      // Simulate real-world natural expiry (e.g. the customer never completed payment and the
      // session's 24h lifetime elapsed) — the session no longer shows up in a "status: open" list.
      const expiredSession = sessions.get(first.checkoutSessionId);
      expiredSession!.status = "expired";

      const second = await createCommerceCheckoutSession(actor, { priceCode: price.code }, stripe);

      expect(second.checkoutSessionId).not.toBe(first.checkoutSessionId);
      // Nothing was "open" to expire — the already-expired session must never be touched again.
      expect(stripe.checkout.sessions.expire).not.toHaveBeenCalled();
      expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(2);
      const firstKey = stripe.checkout.sessions.create.mock.calls[0][1]?.idempotencyKey;
      const secondKey = stripe.checkout.sessions.create.mock.calls[1][1]?.idempotencyKey;
      expect(firstKey).not.toBe(secondKey);
    });
  });

  describe("STRIPE-COMMERCIAL-21: at most one Quantara-owned open Checkout Session survives, even when a match is found among several", () => {
    async function seedBillingCustomer(companyForTest: string, stripeCustomerId: string) {
      await prisma.stripeBillingCustomer.create({ data: { companyId: companyForTest, stripeCustomerId, livemode: false } });
    }

    it("(A) a matching requested-price open session plus a stale different-price open session: the stale one is expired, the match is reused, no new session is created, exactly one remains open", async () => {
      const { product: matchProduct, price: matchPrice } = await makeApprovedDirectPrice();
      const { product: staleProduct, price: stalePrice } = await makeApprovedDirectPrice();
      await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: matchProduct.id, commercePriceId: matchPrice.id, providerProductId: `prod_cleanup_a_match_${RUN_ID}`, providerPriceId: `price_cleanup_a_match_${RUN_ID}`, providerObjectType: "PRICE" });
      await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: staleProduct.id, commercePriceId: stalePrice.id, providerProductId: `prod_cleanup_a_stale_${RUN_ID}`, providerPriceId: `price_cleanup_a_stale_${RUN_ID}`, providerObjectType: "PRICE" });

      const seededCustomerId = `cus_seeded_a_${RUN_ID}`;
      await seedBillingCustomer(cleanupCompanyId, seededCustomerId);
      const { client: stripe, sessions } = makeStatefulStripeClient();
      const matchingSessionId = `cs_cleanup_a_match_${RUN_ID}`;
      const staleSessionId = `cs_cleanup_a_stale_${RUN_ID}`;
      sessions.set(matchingSessionId, {
        id: matchingSessionId,
        url: `https://checkout.stripe.com/test/cleanup_a_match_${RUN_ID}`,
        status: "open",
        customer: seededCustomerId,
        metadata: { quantara_company_id: cleanupCompanyId, quantara_price_code: matchPrice.code },
      });
      sessions.set(staleSessionId, {
        id: staleSessionId,
        url: `https://checkout.stripe.com/test/cleanup_a_stale_${RUN_ID}`,
        status: "open",
        customer: seededCustomerId,
        metadata: { quantara_company_id: cleanupCompanyId, quantara_price_code: stalePrice.code },
      });

      const actor = actorFor(userId, cleanupCompanyId, `checkout-cleanup-${RUN_ID}@example.com`);
      const result = await createCommerceCheckoutSession(actor, { priceCode: matchPrice.code }, stripe);

      expect(result.checkoutSessionId).toBe(matchingSessionId);
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(stripe.checkout.sessions.expire).toHaveBeenCalledTimes(1);
      expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith(staleSessionId);
      const openForCustomer = Array.from(sessions.values()).filter((s) => s.customer === seededCustomerId && s.status === "open");
      expect(openForCustomer).toHaveLength(1);
      expect(openForCustomer[0].id).toBe(matchingSessionId);
    });

    it("(B) two matching same-price open sessions: one is chosen and reused, the duplicate is expired, no new session is created, exactly one remains open", async () => {
      const { product, price } = await makeApprovedDirectPrice();
      await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: product.id, commercePriceId: price.id, providerProductId: `prod_cleanup_b_${RUN_ID}`, providerPriceId: `price_cleanup_b_${RUN_ID}`, providerObjectType: "PRICE" });

      // (A) already claimed cleanupCompanyId's single (companyId, livemode) StripeBillingCustomer
      // row, so this test uses its own throwaway company + customer.
      const seededCustomerId = `cus_seeded_b_${RUN_ID}`;
      const company = await prisma.company.create({ data: { legalName: `Cleanup Co B ${RUN_ID}`, tradeName: "Cleanup Co B", email: `checkout-cleanup-b-${RUN_ID}@example.com` } });
      await seedBillingCustomer(company.id, seededCustomerId);

      const { client: stripe, sessions } = makeStatefulStripeClient();
      const duplicateOneId = `cs_cleanup_b_one_${RUN_ID}`;
      const duplicateTwoId = `cs_cleanup_b_two_${RUN_ID}`;
      sessions.set(duplicateOneId, {
        id: duplicateOneId,
        url: `https://checkout.stripe.com/test/cleanup_b_one_${RUN_ID}`,
        status: "open",
        customer: seededCustomerId,
        metadata: { quantara_company_id: company.id, quantara_price_code: price.code },
      });
      sessions.set(duplicateTwoId, {
        id: duplicateTwoId,
        url: `https://checkout.stripe.com/test/cleanup_b_two_${RUN_ID}`,
        status: "open",
        customer: seededCustomerId,
        metadata: { quantara_company_id: company.id, quantara_price_code: price.code },
      });

      const actor = actorFor(userId, company.id, `checkout-cleanup-b-${RUN_ID}@example.com`);
      const result = await createCommerceCheckoutSession(actor, { priceCode: price.code }, stripe);

      expect([duplicateOneId, duplicateTwoId]).toContain(result.checkoutSessionId);
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(stripe.checkout.sessions.expire).toHaveBeenCalledTimes(1);
      const openForCustomer = Array.from(sessions.values()).filter((s) => s.customer === seededCustomerId && s.status === "open");
      expect(openForCustomer).toHaveLength(1);
      expect(openForCustomer[0].id).toBe(result.checkoutSessionId);

      await prisma.company.deleteMany({ where: { id: company.id } });
      await prisma.stripeBillingCustomer.deleteMany({ where: { stripeCustomerId: seededCustomerId } });
    });

    it("(C) if cleanup of a stale session fails while a valid matching session exists, the whole request fails closed — no session is returned, none is created", async () => {
      const { product: matchProduct, price: matchPrice } = await makeApprovedDirectPrice();
      const { product: staleProduct, price: stalePrice } = await makeApprovedDirectPrice();
      await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: matchProduct.id, commercePriceId: matchPrice.id, providerProductId: `prod_cleanup_c_match_${RUN_ID}`, providerPriceId: `price_cleanup_c_match_${RUN_ID}`, providerObjectType: "PRICE" });
      await createMapping({ provider: "STRIPE", environment: "TEST", commerceProductId: staleProduct.id, commercePriceId: stalePrice.id, providerProductId: `prod_cleanup_c_stale_${RUN_ID}`, providerPriceId: `price_cleanup_c_stale_${RUN_ID}`, providerObjectType: "PRICE" });

      const actor = actorFor(userId, fourthCompanyId, `checkout-fourth-${RUN_ID}@example.com`);
      const stripe = mockStripeClient();
      const matchingSessionId = `cs_cleanup_c_match_${RUN_ID}`;
      const staleSessionId = `cs_cleanup_c_stale_${RUN_ID}`;
      stripe.checkout.sessions.list.mockResolvedValueOnce({
        data: [
          { id: matchingSessionId, url: `https://checkout.stripe.com/test/cleanup_c_match_${RUN_ID}`, metadata: { quantara_company_id: fourthCompanyId, quantara_price_code: matchPrice.code } },
          { id: staleSessionId, url: `https://checkout.stripe.com/test/cleanup_c_stale_${RUN_ID}`, metadata: { quantara_company_id: fourthCompanyId, quantara_price_code: stalePrice.code } },
        ],
        has_more: false,
      });
      stripe.checkout.sessions.expire.mockRejectedValue(new Error("Stripe network timeout"));

      await expect(createCommerceCheckoutSession(actor, { priceCode: matchPrice.code }, stripe)).rejects.toMatchObject({ code: "STRIPE_STALE_SESSION_EXPIRE_FAILED" });
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });
  });
});
