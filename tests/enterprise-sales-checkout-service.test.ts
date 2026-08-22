import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import type { PlatformRequestMetadata } from "../src/lib/repositories/platform-admin-repository";
import { createEnterpriseSalesCheckoutSession } from "../src/lib/services/enterprise-sales-checkout-service";
import { seedEnterpriseCommerceProducts } from "../prisma/seed-data/commerce-products";
import { requireIsolatedLocalTestDatabase } from "./helpers/require-isolated-test-database";

const RUN_ID = `${Date.now()}-${process.pid}-entsales`;

const requestMetadata: PlatformRequestMetadata = {
  method: "POST",
  path: "/api/admin/commerce/enterprise-checkout",
};
const LEGACY_ENTERPRISE_ANNUAL_PRICE_CODES = [
  "enterprise_core_annual_aed_15000",
  "enterprise_scale_annual_aed_25000",
  "enterprise_authority_annual_aed_35000",
] as const;
const ENTERPRISE_ONE_TIME_PRICE_CODES = [
  "enterprise_core_one_time_aed_15000",
  "enterprise_scale_one_time_aed_25000",
  "enterprise_authority_one_time_aed_35000",
] as const;

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

describe("legacy Enterprise sales checkout after the one-time Marketplace transition", () => {
  let ownerUserId: string;
  let testCompanyId: string;

  beforeAll(async () => {
    requireIsolatedLocalTestDatabase();
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
  });

  afterAll(async () => {
    await prisma.platformAuditLog.deleteMany({ where: { actorUserId: ownerUserId } });
    await prisma.stripeBillingCustomer.deleteMany({ where: { companyId: testCompanyId } });
    await prisma.user.deleteMany({ where: { id: ownerUserId } });
    await prisma.company.deleteMany({ where: { id: testCompanyId } });
    await prisma.$disconnect();
  });

  it.each(LEGACY_ENTERPRISE_ANNUAL_PRICE_CODES)(
    "fails closed for removed legacy annual code %s",
    async (priceCode) => {
      const stripe = mockStripeClient();
      await expect(
        createEnterpriseSalesCheckoutSession(
          platformActor(ownerUserId, testCompanyId),
          { companyId: testCompanyId, priceCode },
          requestMetadata,
          stripe,
        ),
      ).rejects.toMatchObject({
        code: "ENTERPRISE_CHECKOUT_NOT_ELIGIBLE",
        reason: "PRICE_NOT_FOUND",
      });
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    },
  );

  it.each(ENTERPRISE_ONE_TIME_PRICE_CODES)(
    "does not admit Marketplace one-time code %s into the protected legacy sales path",
    async (priceCode) => {
      const stripe = mockStripeClient();
      await expect(
        createEnterpriseSalesCheckoutSession(
          platformActor(ownerUserId, testCompanyId),
          { companyId: testCompanyId, priceCode },
          requestMetadata,
          stripe,
        ),
      ).rejects.toMatchObject({
        code: "ENTERPRISE_CHECKOUT_NOT_ELIGIBLE",
        reason: "PRICE_CODE_NOT_ENTERPRISE",
      });
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    },
  );
});
