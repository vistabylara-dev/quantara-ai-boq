import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import type { PlatformRequestMetadata } from "../src/lib/repositories/platform-admin-repository";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { createEnterpriseSalesCheckoutSession } from "../src/lib/services/enterprise-sales-checkout-service";
import { createCommerceCheckoutSession } from "../src/lib/services/commerce-checkout-service";
import { seedEnterpriseCommerceProducts } from "../prisma/seed-data/commerce-products";
import { createStripeBillingCustomer } from "../src/lib/repositories/stripe-billing-repository";

const RUN_ID = `${Date.now()}-${process.pid}-entsales`;

const requestMetadata: PlatformRequestMetadata = {
  method: "POST",
  path: "/api/admin/commerce/enterprise-checkout",
};

let globalCustomerCounter = 0;
let globalSessionCounter = 0;

function mockStripeClient(options: { openSessions?: any[]; subscriptions?: any[] } = {}) {
  return {
    customers: {
      create: vi.fn(async () => ({ id: `cus_entsales_${RUN_ID}_${++globalCustomerCounter}` })),
    },
    subscriptions: {
      list: vi.fn(async () => ({ data: options.subscriptions ?? [], has_more: false })),
    },
    checkout: {
      sessions: {
        create: vi.fn(async () => {
          const n = ++globalSessionCounter;
          return { id: `cs_entsales_${RUN_ID}_${n}`, url: `https://checkout.stripe.com/test/entsales_${RUN_ID}_${n}` };
        }),
        list: vi.fn(async () => ({ data: options.openSessions ?? [], has_more: false })),
        expire: vi.fn(async (id: string) => ({ id, status: "expired" })),
      },
    },
  } as any;
}

function platformActor(userId: string, companyId: string, platformRole: any = "PLATFORM_OWNER"): PlatformActor {
  return { userId, companyId, platformRole, fullName: "Test", email: "test@example.com", isPlatformAdmin: true, hasCapability: (cap: any) => true } as any;
}

describe("Enterprise Checkout (Direct transition)", () => {
  let ownerUserId: string;
  let testCompanyId: string;
  
  beforeAll(async () => {
    await seedEnterpriseCommerceProducts(prisma);

    const company = await prisma.company.create({
      data: {
        legalName: "Enterprise Transition Test Company",
        tradeName: "Enterprise Transition Test Company",
        email: `entsales-test-${RUN_ID}@example.com`,
      },
    });
    testCompanyId = company.id;

    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        email: `entsales-test-${RUN_ID}@example.com`,
        fullName: "Test User",
        passwordHash: "hash",
        isActive: true,
        platformRole: "PLATFORM_OWNER",
      },
    });
    ownerUserId = user.id;

    // Approve core price and map it
    const corePrice = await prisma.commercePrice.findUniqueOrThrow({ where: { code: "enterprise_core_annual_aed_15000" } });
    await prisma.commercePrice.update({ where: { id: corePrice.id }, data: { reviewStatus: "APPROVED" } });
    await prisma.commerceProviderMapping.create({
      data: {
        provider: "STRIPE",
        environment: "TEST",
        commerceProductId: corePrice.productId,
        commercePriceId: corePrice.id,
        providerProductId: `prod_test_${RUN_ID}`,
        providerPriceId: `price_test_${RUN_ID}`,
        synchronizationStatus: "SYNCED",
        lastSynchronizedAt: new Date(),
        providerObjectType: "PRICE",
      }
    });
  });

  afterAll(async () => {
    // cleanup not required for local test db, but good practice
  });

  it("A. enterprise_core passed into createEnterpriseSalesCheckoutSession rejects with PRODUCT_NOT_SALES_LED", async () => {
    const stripe = mockStripeClient();
    await expect(
      createEnterpriseSalesCheckoutSession(
        platformActor(ownerUserId, testCompanyId),
        { companyId: testCompanyId, priceCode: "enterprise_core_annual_aed_15000" },
        requestMetadata,
        stripe
      )
    ).rejects.toMatchObject({
      reason: "PRODUCT_NOT_SALES_LED"
    });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("B. enterprise_scale rejects with PRODUCT_NOT_SALES_LED", async () => {
    const stripe = mockStripeClient();
    await expect(
      createEnterpriseSalesCheckoutSession(
        platformActor(ownerUserId, testCompanyId),
        { companyId: testCompanyId, priceCode: "enterprise_scale_annual_aed_25000" },
        requestMetadata,
        stripe
      )
    ).rejects.toMatchObject({
      reason: "PRODUCT_NOT_SALES_LED"
    });
  });

  it("C. enterprise_authority rejects with PRODUCT_NOT_SALES_LED", async () => {
    const stripe = mockStripeClient();
    await expect(
      createEnterpriseSalesCheckoutSession(
        platformActor(ownerUserId, testCompanyId),
        { companyId: testCompanyId, priceCode: "enterprise_authority_annual_aed_35000" },
        requestMetadata,
        stripe
      )
    ).rejects.toMatchObject({
      reason: "PRODUCT_NOT_SALES_LED"
    });
  });

  it("D. invalid/non-enterprise price code rejects with PRICE_CODE_NOT_ENTERPRISE", async () => {
    const stripe = mockStripeClient();
    await expect(
      createEnterpriseSalesCheckoutSession(
        platformActor(ownerUserId, testCompanyId),
        { companyId: testCompanyId, priceCode: "starter_monthly_aed_149" },
        requestMetadata,
        stripe
      )
    ).rejects.toMatchObject({
      reason: "PRICE_CODE_NOT_ENTERPRISE"
    });
  });

  it("E. NORMAL DIRECT ENTERPRISE CHECKOUT WORKS", async () => {
    const stripe = mockStripeClient();
    const actor: CurrentActor = {
      userId: ownerUserId,
      companyId: testCompanyId,
      role: "COMPANY_OWNER",
      fullName: "Test User",
      email: `entsales-test-${RUN_ID}@example.com`,
    };

    const result = await createCommerceCheckoutSession(actor, { priceCode: "enterprise_core_annual_aed_15000" }, stripe);

    expect(result.checkoutUrl).toBeTruthy();
    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    
    const callArgs = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(callArgs.mode).toBe("subscription");
    expect(callArgs.line_items).toHaveLength(1);
    expect(callArgs.line_items[0].price).toBe(`price_test_${RUN_ID}`);
    expect(callArgs.customer).toBeTruthy();
  });

  it("F. NORMAL DIRECT CHECKOUT STILL BLOCKS DUPLICATE CORE SOFTWARE SUBSCRIPTION", async () => {
    const stripe = mockStripeClient();
    const actor: CurrentActor = {
      userId: ownerUserId,
      companyId: testCompanyId,
      role: "COMPANY_OWNER",
      fullName: "Test User",
      email: `entsales-test-${RUN_ID}@example.com`,
    };

    // Pretend company has an active software subscription
    const plan = await prisma.softwarePlan.findUniqueOrThrow({ where: { key: "commerce_starter" } });
    await prisma.companySoftwareSubscription.create({
      data: {
        companyId: testCompanyId,
        softwarePlanId: plan.id,
        status: "ACTIVE",
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        externalSubscriptionId: `sub_test_${RUN_ID}`,
        source: "stripe",
      }
    });

    await expect(
      createCommerceCheckoutSession(actor, { priceCode: "enterprise_core_annual_aed_15000" }, stripe)
    ).rejects.toMatchObject({
      code: "CHECKOUT_EXISTING_SUBSCRIPTION"
    });

    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
