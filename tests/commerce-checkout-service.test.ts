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
    checkout: {
      sessions: {
        create: vi.fn(async () => ({ id: `cs_test_${RUN_ID}_${++globalSessionCounter}`, url: `https://checkout.stripe.com/test/${RUN_ID}_${globalSessionCounter}` })),
      },
    },
    billingPortal: {
      sessions: { create: vi.fn(async () => ({ url: `https://billing.stripe.com/test/${RUN_ID}` })) },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("commerce-checkout-service (integration, real local Postgres, mocked Stripe)", () => {
  let companyId: string;
  let otherCompanyId: string;
  let thirdCompanyId: string;
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
    await prisma.commerceProduct.deleteMany({ where: { code: { contains: RUN_ID } } });
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId, thirdCompanyId] } } });
    await prisma.softwarePlan.deleteMany({ where: { key: { contains: RUN_ID } } });
    await prisma.stripeBillingCustomer.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId, thirdCompanyId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId, thirdCompanyId] } } });
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
});
