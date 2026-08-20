import { PlatformRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { buildSyncPlan, synchronizeCommerceCatalogue } from "../src/lib/services/stripe-sync-service";
import { seedCommerceProducts } from "../prisma/seed-data/commerce-products";
import {
  LIBRARY_PACKAGE_PRICES,
  approveLibraryPackagePrices,
  backfillLibraryPackagePricing,
} from "../prisma/seed-data/library-package-pricing";

/**
 * MARKETPLACE-FULL-STRIPE-LINK mission 7 — real proof the entire pipeline
 * (price data -> eligibility gate -> sync plan -> Stripe object creation ->
 * provider mapping) genuinely works for the 15 library packages, using the
 * exact mocked-Stripe-client mechanism tests/stripe-sync-service.test.ts
 * already established (overrideClient — never a real STRIPE_SECRET_KEY,
 * never a real network call).
 *
 * The 15 real IndustryDataPackage rows this bug is about are created via
 * master-catalogue activation (createOrReuseDatasetPackage), never by
 * prisma/seed.ts — a fresh local test database has none of them. This
 * suite creates them itself as fixture rows, deliberately in the exact
 * broken state Layer 1 leaves them in production (monthlyPrice/annualPrice:
 * 0, currency: AED), then runs the real backfill + seed + approval pipeline
 * against them — proving the fix, not fabricating a different scenario.
 *
 * buildSyncPlan()/synchronizeCommerceCatalogue() process the ENTIRE
 * commerce catalogue (every test file's fixtures share this DB), so —
 * mirroring tests/stripe-sync-service.test.ts's own established pattern —
 * every assertion below filters to this test's own product/price codes
 * rather than asserting on total/global counts.
 */

const RUN_ID = `${Date.now()}-${process.pid}-libpricing`;

function ownerActor(userId: string, companyId: string): PlatformActor {
  return { userId, companyId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "Library Pricing Test Owner", email: `lib-pricing-owner-${RUN_ID}@example.com` };
}

function mockStripeClient() {
  let productCounter = 0;
  let priceCounter = 0;
  return {
    balance: { retrieve: vi.fn(async () => ({ livemode: false })) },
    products: {
      create: vi.fn(async () => ({ id: `prod_test_${RUN_ID}_${++productCounter}` })),
      update: vi.fn(async (id: string) => ({ id })),
      retrieve: vi.fn(async (id: string) => ({ id, name: "Mock Product", active: true })),
    },
    prices: {
      create: vi.fn(async () => ({ id: `price_test_${RUN_ID}_${++priceCounter}` })),
      update: vi.fn(async (id: string) => ({ id })),
      retrieve: vi.fn(async (id: string) => ({ id, unit_amount: 14900, currency: "aed", recurring: { interval: "month" } })),
    },
    // Same rationale as stripe-sync-service.test.ts's mock: reconfigured post-creation via
    // .mock.calls / .mockResolvedValueOnce, which a Stripe-typed cast would break.
  } as any;
}

function libraryProductCode(key: string): string {
  return `industry_${key.replace(/-/g, "_")}`;
}
function libraryPriceCodes(key: string): { monthly: string; annual: string } {
  const stem = libraryProductCode(key);
  return { monthly: `${stem}_monthly`, annual: `${stem}_annual` };
}
const ALL_LIBRARY_PRICE_CODES = new Set(
  LIBRARY_PACKAGE_PRICES.flatMap((spec) => Object.values(libraryPriceCodes(spec.key))),
);
const ALL_LIBRARY_PRODUCT_CODES = new Set(LIBRARY_PACKAGE_PRICES.map((spec) => libraryProductCode(spec.key)));

describe("MARKETPLACE-FULL-STRIPE-LINK: library package pricing end-to-end sync (integration, real local Postgres, mocked Stripe)", () => {
  let companyId: string;
  let userId: string;
  let disciplineId: string;
  const packageIds: string[] = [];
  const originalKey = process.env.STRIPE_SECRET_KEY;

  // Snapshots of protected, pre-existing rows this pipeline must never touch.
  let mechanicalPackageSnapshot: { monthlyPrice: string; annualPrice: string; currency: string } | null = null;
  let mechanicalPriceSnapshot: { code: string; amountMinor: number; reviewStatus: string }[] = [];

  beforeAll(async () => {
    const discipline = await prisma.masterDiscipline.findFirstOrThrow();
    disciplineId = discipline.id;

    const company = await prisma.company.create({
      data: { legalName: `Library Pricing Test Co ${RUN_ID}`, tradeName: "Library Pricing Test", email: `lib-pricing-co-${RUN_ID}@example.com` },
    });
    companyId = company.id;
    const owner = await prisma.user.create({
      data: {
        companyId,
        email: `lib-pricing-owner-${RUN_ID}@example.com`,
        passwordHash: "test-fixture-not-a-real-hash",
        fullName: "Library Pricing Test Owner",
        role: "COMPANY_OWNER",
        platformRole: PlatformRole.PLATFORM_OWNER,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    userId = owner.id;

    // The real Layer-1 broken state: every library package created by
    // createOrReuseDatasetPackage sits at monthlyPrice/annualPrice: 0,
    // currency: AED, forever, until this backfill runs.
    for (const spec of LIBRARY_PACKAGE_PRICES) {
      const pkg = await prisma.industryDataPackage.create({
        data: {
          key: spec.key,
          name: spec.name,
          disciplineId,
          packageType: "PROFESSIONAL",
          status: "ACTIVE",
          monthlyPrice: 0,
          annualPrice: 0,
          currency: "AED",
        },
      });
      packageIds.push(pkg.id);
    }

    const mechanicalPackage = await prisma.industryDataPackage.findUniqueOrThrow({ where: { key: "mechanical-hvac-professional" } });
    mechanicalPackageSnapshot = {
      monthlyPrice: mechanicalPackage.monthlyPrice.toString(),
      annualPrice: mechanicalPackage.annualPrice.toString(),
      currency: mechanicalPackage.currency,
    };
    const mechanicalPrices = await prisma.commercePrice.findMany({
      where: { product: { code: "industry_mechanical_hvac_professional" } },
      select: { code: true, amountMinor: true, reviewStatus: true },
    });
    mechanicalPriceSnapshot = mechanicalPrices.map((p) => ({ code: p.code, amountMinor: p.amountMinor, reviewStatus: p.reviewStatus }));
  });

  beforeAll(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fixture_key_not_real";
  });

  afterAll(async () => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;

    // Cascades to each product's CommercePrice + CommerceProviderMapping rows.
    await prisma.commerceProduct.deleteMany({ where: { code: { in: [...ALL_LIBRARY_PRODUCT_CODES] } } });
    await prisma.commerceSyncRun.deleteMany({ where: { initiatedByUserId: userId } });
    await prisma.platformAuditLog.deleteMany({ where: { actorUserId: userId } });
    // industryPackageId uses onDelete: SetNull, not cascade — safe to delete after the products above.
    await prisma.industryDataPackage.deleteMany({ where: { id: { in: packageIds } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it("backfillLibraryPackagePricing sets the real prices on all 15 packages, idempotently", async () => {
    const first = await backfillLibraryPackagePricing(prisma);
    for (const spec of LIBRARY_PACKAGE_PRICES) {
      expect(first.updated).toContain(spec.key);
    }
    expect(first.missing).toEqual([]);

    for (const spec of LIBRARY_PACKAGE_PRICES) {
      const pkg = await prisma.industryDataPackage.findUniqueOrThrow({ where: { key: spec.key } });
      expect(Number(pkg.monthlyPrice)).toBe(spec.monthlyPrice);
      expect(Number(pkg.annualPrice)).toBe(spec.annualPrice);
      expect(pkg.currency).toBe("AED");
    }

    const second = await backfillLibraryPackagePricing(prisma);
    expect(second.updated).toEqual([]);
    for (const spec of LIBRARY_PACKAGE_PRICES) {
      expect(second.unchanged).toContain(spec.key);
    }
  });

  it("seedCommerceProducts creates exactly 15 CommerceProduct + 30 CommercePrice rows with the exact amountMinor values from the table, all REQUIRES_REVIEW by default", async () => {
    await seedCommerceProducts(prisma);

    for (const spec of LIBRARY_PACKAGE_PRICES) {
      const product = await prisma.commerceProduct.findUnique({ where: { code: libraryProductCode(spec.key) } });
      expect(product, `missing CommerceProduct for ${spec.key}`).not.toBeNull();
      expect(product!.industryPackageId).not.toBeNull();
      const pkg = await prisma.industryDataPackage.findUniqueOrThrow({ where: { key: spec.key } });
      expect(product!.industryPackageId).toBe(pkg.id);

      const { monthly, annual } = libraryPriceCodes(spec.key);
      const monthlyPrice = await prisma.commercePrice.findUniqueOrThrow({ where: { code: monthly } });
      const annualPrice = await prisma.commercePrice.findUniqueOrThrow({ where: { code: annual } });

      expect(monthlyPrice.productId).toBe(product!.id);
      expect(monthlyPrice.currency).toBe("AED");
      expect(monthlyPrice.billingInterval).toBe("MONTH");
      expect(monthlyPrice.amountMinor).toBe(spec.monthlyPrice * 100);
      expect(monthlyPrice.reviewStatus).toBe("REQUIRES_REVIEW");

      expect(annualPrice.productId).toBe(product!.id);
      expect(annualPrice.currency).toBe("AED");
      expect(annualPrice.billingInterval).toBe("YEAR");
      expect(annualPrice.amountMinor).toBe(spec.annualPrice * 100);
      expect(annualPrice.reviewStatus).toBe("REQUIRES_REVIEW");
    }

    const productCount = await prisma.commerceProduct.count({ where: { code: { in: [...ALL_LIBRARY_PRODUCT_CODES] } } });
    expect(productCount).toBe(15);
    const priceCount = await prisma.commercePrice.count({ where: { code: { in: [...ALL_LIBRARY_PRICE_CODES] } } });
    expect(priceCount).toBe(30);
  });

  it("(a) before approval, the dry-run sync plan blocks all 30 library prices with PRICE_NOT_APPROVED", async () => {
    const plan = await buildSyncPlan();
    const libraryEntries = plan.prices.filter((entry) => ALL_LIBRARY_PRICE_CODES.has(entry.code));
    expect(libraryEntries).toHaveLength(30);
    for (const entry of libraryEntries) {
      expect(entry.action).toBe("BLOCKED");
      expect(entry.blockedReason).toBe("PRICE_NOT_APPROVED");
    }
  });

  it("approveLibraryPackagePrices moves exactly those 30 rows to APPROVED, idempotently, and touches nothing else", async () => {
    const first = await approveLibraryPackagePrices(prisma);
    expect(first.missing).toEqual([]);
    expect(new Set(first.approved)).toEqual(ALL_LIBRARY_PRICE_CODES);

    for (const code of ALL_LIBRARY_PRICE_CODES) {
      const price = await prisma.commercePrice.findUniqueOrThrow({ where: { code } });
      expect(price.reviewStatus).toBe("APPROVED");
      expect(price.reviewedByUserId).toBeNull();
      expect(price.reviewedAt).not.toBeNull();
      expect(price.reviewNote).toContain("library-package-pricing backfill");
    }

    // mechanical-hvac-professional's prices are untouched — never part of LIBRARY_PACKAGE_PRICES.
    for (const snapshot of mechanicalPriceSnapshot) {
      const price = await prisma.commercePrice.findUniqueOrThrow({ where: { code: snapshot.code } });
      expect(price.reviewStatus).toBe(snapshot.reviewStatus);
    }

    const second = await approveLibraryPackagePrices(prisma);
    expect(second.approved).toEqual([]);
    expect(new Set(second.alreadyApproved)).toEqual(ALL_LIBRARY_PRICE_CODES);
  });

  it("(b) after approval, the dry-run sync plan shows all 15 products / 30 prices as CREATE, with the exact amountMinor/currency values", async () => {
    const plan = await buildSyncPlan();

    const productEntries = plan.products.filter((entry) => ALL_LIBRARY_PRODUCT_CODES.has(entry.code));
    expect(productEntries).toHaveLength(15);
    for (const entry of productEntries) expect(entry.action).toBe("CREATE");

    const priceEntries = plan.prices.filter((entry) => ALL_LIBRARY_PRICE_CODES.has(entry.code));
    expect(priceEntries).toHaveLength(30);
    for (const entry of priceEntries) expect(entry.action).toBe("CREATE");

    for (const spec of LIBRARY_PACKAGE_PRICES) {
      const { monthly, annual } = libraryPriceCodes(spec.key);
      const monthlyRow = await prisma.commercePrice.findUniqueOrThrow({ where: { code: monthly } });
      const annualRow = await prisma.commercePrice.findUniqueOrThrow({ where: { code: annual } });
      expect(monthlyRow.amountMinor).toBe(spec.monthlyPrice * 100);
      expect(monthlyRow.currency).toBe("AED");
      expect(annualRow.amountMinor).toBe(spec.annualPrice * 100);
      expect(annualRow.currency).toBe("AED");
    }
  });

  it("(c) synchronizeCommerceCatalogue (mock Stripe) creates all 15 products + 30 prices and their CommerceProviderMapping rows", async () => {
    const mock = mockStripeClient();
    const actor = ownerActor(userId, companyId);
    const plan = await buildSyncPlan();

    const result = await synchronizeCommerceCatalogue(actor, { catalogueFingerprint: plan.catalogueFingerprint, confirm: true }, { method: "POST", path: "/test" }, mock);

    const libraryErrors = result.errors.filter((message) => [...ALL_LIBRARY_PRODUCT_CODES, ...ALL_LIBRARY_PRICE_CODES].some((code) => message.startsWith(`${code}:`)));
    expect(libraryErrors).toEqual([]);

    const productCalls = mock.products.create.mock.calls.filter((call: unknown[]) =>
      ALL_LIBRARY_PRODUCT_CODES.has((call[0] as { metadata: { quantara_product_code: string } }).metadata.quantara_product_code),
    );
    expect(productCalls).toHaveLength(15);
    const priceCalls = mock.prices.create.mock.calls.filter((call: unknown[]) =>
      ALL_LIBRARY_PRICE_CODES.has((call[0] as { metadata: { quantara_price_code: string } }).metadata.quantara_price_code),
    );
    expect(priceCalls).toHaveLength(30);

    for (const call of priceCalls) {
      const params = call[0] as { unit_amount: number; currency: string; recurring?: { interval: string } };
      expect(params.currency).toBe("aed");
      expect(["month", "year"]).toContain(params.recurring?.interval);
    }

    for (const spec of LIBRARY_PACKAGE_PRICES) {
      const product = await prisma.commerceProduct.findUniqueOrThrow({ where: { code: libraryProductCode(spec.key) } });
      const productMappingCount = await prisma.commerceProviderMapping.count({
        where: { commerceProductId: product.id, providerObjectType: "PRODUCT" },
      });
      expect(productMappingCount).toBe(1);
      const priceMappingCount = await prisma.commerceProviderMapping.count({
        where: { commerceProductId: product.id, providerObjectType: "PRICE" },
      });
      expect(priceMappingCount).toBe(2);
    }
  });

  it("(d) a second synchronizeCommerceCatalogue run is idempotent — no duplicate Stripe calls, no duplicate mappings, plan shows UNCHANGED", async () => {
    const mock = mockStripeClient();
    const actor = ownerActor(userId, companyId);

    const plan = await buildSyncPlan();
    const libraryProductEntries = plan.products.filter((entry) => ALL_LIBRARY_PRODUCT_CODES.has(entry.code));
    const libraryPriceEntries = plan.prices.filter((entry) => ALL_LIBRARY_PRICE_CODES.has(entry.code));
    expect(libraryProductEntries.every((entry) => entry.action === "UPDATE")).toBe(true);
    expect(libraryPriceEntries.every((entry) => entry.action === "UNCHANGED")).toBe(true);

    await synchronizeCommerceCatalogue(actor, { catalogueFingerprint: plan.catalogueFingerprint, confirm: true }, { method: "POST", path: "/test" }, mock);

    const priceCallsAfterSecondRun = mock.prices.create.mock.calls.filter((call: unknown[]) =>
      ALL_LIBRARY_PRICE_CODES.has((call[0] as { metadata: { quantara_price_code: string } }).metadata.quantara_price_code),
    );
    expect(priceCallsAfterSecondRun).toHaveLength(0);
    const productCreateCallsAfterSecondRun = mock.products.create.mock.calls.filter((call: unknown[]) =>
      ALL_LIBRARY_PRODUCT_CODES.has((call[0] as { metadata: { quantara_product_code: string } }).metadata.quantara_product_code),
    );
    expect(productCreateCallsAfterSecondRun).toHaveLength(0);

    for (const spec of LIBRARY_PACKAGE_PRICES) {
      const product = await prisma.commerceProduct.findUniqueOrThrow({ where: { code: libraryProductCode(spec.key) } });
      const mappingCount = await prisma.commerceProviderMapping.count({ where: { commerceProductId: product.id } });
      expect(mappingCount).toBe(3); // 1 PRODUCT + 2 PRICE, unchanged from the first run
    }
  });

  it("(e) mechanical-hvac-professional and the CATALOGUE_PRODUCTS anchor SKUs are untouched", async () => {
    const mechanicalPackage = await prisma.industryDataPackage.findUniqueOrThrow({ where: { key: "mechanical-hvac-professional" } });
    expect(mechanicalPackage.monthlyPrice.toString()).toBe(mechanicalPackageSnapshot!.monthlyPrice);
    expect(mechanicalPackage.annualPrice.toString()).toBe(mechanicalPackageSnapshot!.annualPrice);
    expect(mechanicalPackage.currency).toBe(mechanicalPackageSnapshot!.currency);

    for (const snapshot of mechanicalPriceSnapshot) {
      const price = await prisma.commercePrice.findUniqueOrThrow({ where: { code: snapshot.code } });
      expect(price.amountMinor).toBe(snapshot.amountMinor);
    }

    const starter = await prisma.commercePrice.findUnique({ where: { code: "starter_monthly_aed_149" } });
    expect(starter?.amountMinor).toBe(14900);
    expect(starter?.currency).toBe("AED");
    const tayqanMonthly = await prisma.commercePrice.findUnique({ where: { code: "tayqan_monthly_2499" } });
    expect(tayqanMonthly?.amountMinor).toBe(249900);
  });
});
