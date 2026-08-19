import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { prisma } from "../src/lib/db/prisma";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { activateDevelopmentPackage, expireDevelopmentPackage } from "../src/lib/entitlements/package-entitlement-service";
import { createMapping } from "../src/lib/repositories/commerce-provider-mapping-repository";
import { resolvePackagePurchaseOptions } from "../src/lib/services/package-purchase-options";

/**
 * MARKETPLACE-FIX-2 — closes the free-unlock leak
 * (activateDevelopmentPackage/its route were reachable by any
 * COMPANY_OWNER/ADMINISTRATOR in every environment, including production,
 * granting a permanent full package unlock with no payment) and proves the
 * marketplace UI's priceCode resolution behaves correctly for both a
 * purchasable package and one with no backing CommerceProduct yet.
 */

const RUN_ID = `${Date.now()}-${process.pid}-real-purchase`;

function actorFor(companyId: string): CurrentActor {
  return { userId: `00000000-0000-4000-8000-000000000001`, companyId, role: UserRole.COMPANY_OWNER, fullName: "Fixture Owner", email: `fixture-${RUN_ID}@example.com` };
}

describe("MARKETPLACE-FIX-2: free-unlock leak is closed (integration, real local Postgres)", () => {
  let companyId: string;
  let packageId: string;
  const originalMode = process.env.STRIPE_MODE;

  beforeAll(async () => {
    const company = await prisma.company.create({ data: { legalName: `Real Purchase Co ${RUN_ID}`, tradeName: "Real Purchase Co", email: `real-purchase-${RUN_ID}@example.com` } });
    companyId = company.id;
    const discipline = await prisma.masterDiscipline.create({ data: { key: `real-purchase-${RUN_ID}`, name: `Real Purchase Discipline ${RUN_ID}`, sortOrder: 999 } });
    const pkg = await prisma.industryDataPackage.create({
      data: {
        key: `real-purchase-${RUN_ID}`,
        name: `Real Purchase Package ${RUN_ID}`,
        description: "Fixture package",
        disciplineId: discipline.id,
        packageType: "PROFESSIONAL",
        monthlyPrice: 99,
        annualPrice: 990,
        currency: "AED",
        status: "ACTIVE",
      },
    });
    packageId = pkg.id;
  });

  afterAll(async () => {
    if (originalMode === undefined) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = originalMode;

    await prisma.companyPackageSubscription.deleteMany({ where: { companyId } });
    await prisma.commercePrice.deleteMany({ where: { code: { contains: RUN_ID } } });
    await prisma.commerceProduct.deleteMany({ where: { code: { contains: RUN_ID } } });
    await prisma.industryDataPackage.deleteMany({ where: { key: { contains: RUN_ID } } });
    await prisma.masterDiscipline.deleteMany({ where: { key: { contains: RUN_ID } } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it("a company without an active subscription cannot reach a free package unlock when STRIPE_MODE=live — the negative case for the closed leak", async () => {
    process.env.STRIPE_MODE = "live";
    await expect(activateDevelopmentPackage(actorFor(companyId), packageId)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });

    const access = await prisma.companyPackageSubscription.findFirst({ where: { companyId, packageId } });
    expect(access).toBeNull(); // no row was created — the leak path granted nothing
  });

  it("expireDevelopmentPackage is gated the same way in live mode", async () => {
    process.env.STRIPE_MODE = "live";
    await expect(expireDevelopmentPackage(actorFor(companyId), packageId)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });

  it("stays available for local dev/QA and the existing test fixtures when STRIPE_MODE is unset (defaults to test)", async () => {
    delete process.env.STRIPE_MODE;
    await activateDevelopmentPackage(actorFor(companyId), packageId);
    const access = await prisma.companyPackageSubscription.findFirst({ where: { companyId, packageId, status: "ACTIVE" } });
    expect(access).not.toBeNull();
    await expireDevelopmentPackage(actorFor(companyId), packageId);
  });
});

describe("MARKETPLACE-FIX-2: package purchase-option (priceCode) resolution (integration, real local Postgres)", () => {
  let companyId: string;
  let purchasablePackageId: string;
  let unconfiguredPackageId: string;
  let expectedPriceCode: string;

  beforeAll(async () => {
    const company = await prisma.company.create({ data: { legalName: `Purchase Options Co ${RUN_ID}`, tradeName: "Purchase Options Co", email: `purchase-options-${RUN_ID}@example.com` } });
    companyId = company.id;
    const discipline = await prisma.masterDiscipline.create({ data: { key: `purchase-options-${RUN_ID}`, name: `Purchase Options Discipline ${RUN_ID}`, sortOrder: 999 } });

    const purchasablePkg = await prisma.industryDataPackage.create({
      data: {
        key: `purchasable-${RUN_ID}`,
        name: `Purchasable Package ${RUN_ID}`,
        description: "Has a real, approved, synced CommerceProduct/CommercePrice",
        disciplineId: discipline.id,
        packageType: "PROFESSIONAL",
        monthlyPrice: 149,
        annualPrice: 1490,
        currency: "AED",
        status: "ACTIVE",
      },
    });
    purchasablePackageId = purchasablePkg.id;

    const unconfiguredPkg = await prisma.industryDataPackage.create({
      data: {
        key: `unconfigured-${RUN_ID}`,
        name: `Unconfigured Package ${RUN_ID}`,
        description: "Deliberately has no backing CommerceProduct at all",
        disciplineId: discipline.id,
        packageType: "PROFESSIONAL",
        monthlyPrice: 149,
        annualPrice: 1490,
        currency: "AED",
        status: "ACTIVE",
      },
    });
    unconfiguredPackageId = unconfiguredPkg.id;

    const product = await prisma.commerceProduct.create({
      data: {
        code: `industry_purchasable_${RUN_ID}`,
        type: "SUBSCRIPTION",
        name: `Purchasable Package Access ${RUN_ID}`,
        purchaseMode: "DIRECT",
        isActive: true,
        isPublic: true,
        industryPackageId: purchasablePackageId,
      },
    });
    expectedPriceCode = `industry_purchasable_${RUN_ID}_monthly`;
    const price = await prisma.commercePrice.create({
      data: {
        productId: product.id,
        code: expectedPriceCode,
        amountMinor: 14900,
        currency: "AED",
        billingInterval: "MONTH",
        reviewStatus: "APPROVED",
      },
    });
    await createMapping({
      provider: "STRIPE",
      environment: "TEST",
      commerceProductId: product.id,
      commercePriceId: price.id,
      providerProductId: `prod_test_purchasable_${RUN_ID}`,
      providerPriceId: `price_test_purchasable_${RUN_ID}`,
      providerObjectType: "PRICE",
    });
  });

  afterAll(async () => {
    await prisma.commercePrice.deleteMany({ where: { code: { contains: RUN_ID } } });
    await prisma.commerceProduct.deleteMany({ where: { code: { contains: RUN_ID } } });
    await prisma.industryDataPackage.deleteMany({ where: { key: { contains: RUN_ID } } });
    await prisma.masterDiscipline.deleteMany({ where: { key: { contains: RUN_ID } } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it("resolves the real, approved, synced priceCode for a package with a backing CommerceProduct", async () => {
    const options = await resolvePackagePurchaseOptions(actorFor(companyId), [purchasablePackageId]);
    const entry = options.get(purchasablePackageId);
    expect(entry).toBeDefined();
    expect(entry?.available).toBe(true);
    const monthly = entry?.prices.find((p) => p.billingInterval === "MONTH");
    expect(monthly?.priceCode).toBe(expectedPriceCode);
    expect(monthly?.available).toBe(true);
    expect(monthly?.unavailableReason).toBeNull();
  });

  it("reports no entry at all for a package with no backing CommerceProduct — callers must treat this as 'not yet available for purchase', never a broken checkout attempt", async () => {
    const options = await resolvePackagePurchaseOptions(actorFor(companyId), [unconfiguredPackageId]);
    expect(options.has(unconfiguredPackageId)).toBe(false);
  });
});
