import { UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { addBoqItemFromSource } from "../src/lib/services/boq-item-source-service";
import { resolveBoqCommercialRequirements } from "../src/lib/commercial/commercial-requirement-service";
import { acceptTrialTerms, recordDocumentGenerated, startTrial } from "../src/lib/entitlements/entitlement-service";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { assertIsolatedLocalTestDatabase } from "./helpers/isolated-database-guard";

/**
 * CANVA-HUMAN-JOURNEY-FINAL — proves package offers are derived from the
 * REAL CommerceProduct/CommercePrice catalog (already seeded on main via
 * prisma/seed-data/commerce-products.ts), never invented from
 * IndustryDataPackage.monthlyPrice. A wrong priceCode here would 400 at
 * Antigravity's real checkout route the moment it's live — this is the
 * guard against silently shipping an offer nothing can actually purchase.
 */

const RUN_ID = Date.now();
const userIdByCompany = new Map<string, string>();

function actor(companyId: string): CurrentActor {
  const userId = userIdByCompany.get(companyId);
  if (!userId) throw new Error(`No test user seeded for company ${companyId}`);
  return { userId, companyId, role: UserRole.COMPANY_OWNER, fullName: "Test Actor", email: "actor@example.com" };
}

async function seedCompanyWithUser(suffix: string) {
  const company = await prisma.company.create({
    data: {
      legalName: `Commercial Req Test Co ${suffix} ${RUN_ID}`,
      tradeName: `CommReq ${suffix}`,
      email: `commreq-${suffix}-${RUN_ID}@example.com`,
      address: "Dubai, UAE",
      country: "UAE",
      taxRegistrationNumber: "100000000000003",
    },
  });
  const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
  await prisma.companyIndustryEngine.create({ data: { companyId: company.id, industryEngineId: construction.id, enabled: true } });
  const client = await createClient(company.id, { name: `Client ${suffix}`, email: `commreq-client-${suffix}-${RUN_ID}@example.com` });
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      email: `commreq-owner-${suffix}-${RUN_ID}@example.com`,
      passwordHash: "test-fixture-not-a-real-hash",
      fullName: "Test Actor",
      role: UserRole.COMPANY_OWNER,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });
  userIdByCompany.set(company.id, user.id);
  return { companyId: company.id, clientId: client.id };
}

describe("resolveBoqCommercialRequirements: real commerce-catalog offer derivation", () => {
  const cleanupCompanyIds: string[] = [];

  beforeAll(() => {
    assertIsolatedLocalTestDatabase("commercial-requirement-service test setup");
  });

  afterAll(async () => {
    for (const companyId of cleanupCompanyIds) {
      await prisma.bOQItem.deleteMany({ where: { companyId } });
      await prisma.bOQSection.deleteMany({ where: { companyId } });
      await prisma.bOQ.deleteMany({ where: { companyId } });
      await prisma.project.deleteMany({ where: { companyId } });
      await prisma.client.deleteMany({ where: { companyId } });
      await prisma.companyIndustryEngine.deleteMany({ where: { companyId } });
      await prisma.trialPremiumItemUnlock.deleteMany({ where: { companyId } });
      await prisma.companyTrialUsage.deleteMany({ where: { companyId } });
      await prisma.companySoftwareSubscription.deleteMany({ where: { companyId } });
      await prisma.auditLog.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
    }
    const syntheticPackage = await prisma.industryDataPackage.findFirst({ where: { key: `no-product-test-package-${RUN_ID}` } });
    if (syntheticPackage) {
      await prisma.industryDataPackageItem.deleteMany({ where: { packageId: syntheticPackage.id } });
      await prisma.masterItem.deleteMany({ where: { itemCode: `NOPROD-${RUN_ID}` } });
      await prisma.industryDataPackage.delete({ where: { id: syntheticPackage.id } });
    }
    await prisma.$disconnect();
  }, 30_000);

  it("derives a PACKAGE offer's priceCode/amount from the real linked CommerceProduct+CommercePrice, not IndustryDataPackage.monthlyPrice", async () => {
    const { companyId, clientId } = await seedCompanyWithUser("real-product");
    cleanupCompanyIds.push(companyId);

    const membership = await prisma.industryDataPackageItem.findFirstOrThrow({
      where: { masterItem: { isPremium: true, status: "ACTIVE" }, package: { key: "mechanical-hvac-professional" } },
      include: { masterItem: true, package: true },
    });
    const product = await prisma.commerceProduct.findFirstOrThrow({ where: { industryPackageId: membership.packageId } });
    const monthlyPrice = await prisma.commercePrice.findFirstOrThrow({
      where: { productId: product.id, billingInterval: "MONTH", isFromPrice: false },
    });

    const { project, boq } = await createProjectWithDefaultBoq(actor(companyId), {
      clientId,
      industryEngineId: "construction",
      reference: `COMMREQ-REAL-${RUN_ID}`,
      name: "Real Product Offer Test",
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    void project;

    await addBoqItemFromSource(actor(companyId), boq.id, {
      sourceType: "MASTER_ITEM",
      sourceId: membership.masterItemId,
      sectionId: boq.sections[0].id,
      itemNumber: 1,
      quantity: "1",
    });

    const decision = await resolveBoqCommercialRequirements(companyId, boq.id);
    expect(decision.status).toBe("COMMERCIAL_UNLOCK_REQUIRED");
    const requirement = decision.requirements.find((r) => r.type === "PACKAGE" && r.key === "mechanical-hvac-professional");
    expect(requirement).toBeDefined();
    const offer = requirement!.offers[0];
    expect(offer).toBeDefined();
    // The real, seeded facts — not a synthetic "${key}-monthly" string and
    // not IndustryDataPackage.monthlyPrice.
    expect(offer.priceCode).toBe(monthlyPrice.code);
    expect(offer.productCode).toBe(product.code);
    expect(offer.amountMinor).toBe(monthlyPrice.amountMinor);
    expect(offer.currency).toBe(monthlyPrice.currency);
    expect(offer.checkoutAvailable).toBe(monthlyPrice.reviewStatus === "APPROVED" && monthlyPrice.amountMinor > 0);
  });

  it("returns an honest unavailable offer (empty priceCode, no invented price) for a premium item whose package has no linked CommerceProduct", async () => {
    const { companyId, clientId } = await seedCompanyWithUser("no-product");
    cleanupCompanyIds.push(companyId);

    // A synthetic package/item deliberately created with NO CommerceProduct
    // link — self-contained rather than depending on a specific pre-seeded
    // governed package (e.g. plumbing-library) existing in whatever
    // database this test happens to run against.
    const discipline = await prisma.masterDiscipline.findFirstOrThrow();
    const category = await prisma.masterCategory.findFirstOrThrow({ where: { disciplineId: discipline.id } });
    const packageKey = `no-product-test-package-${RUN_ID}`;
    const pkg = await prisma.industryDataPackage.create({
      data: {
        key: packageKey,
        name: "No Product Test Package",
        disciplineId: discipline.id,
        packageType: "SPECIALIST",
        monthlyPrice: 0,
      },
    });
    const masterItem = await prisma.masterItem.create({
      data: {
        disciplineId: discipline.id,
        categoryId: category.id,
        itemCode: `NOPROD-${RUN_ID}`,
        name: "No Product Test Item",
        defaultUnit: "nos",
        isPremium: true,
        status: "ACTIVE",
      },
    });
    await prisma.industryDataPackageItem.create({
      data: { packageId: pkg.id, masterItemId: masterItem.id, sortOrder: 0 },
    });
    const noProduct = await prisma.commerceProduct.findFirst({ where: { industryPackageId: pkg.id } });
    expect(noProduct).toBeNull();

    const { boq } = await createProjectWithDefaultBoq(actor(companyId), {
      clientId,
      industryEngineId: "construction",
      reference: `COMMREQ-NOPROD-${RUN_ID}`,
      name: "No Product Offer Test",
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });

    await addBoqItemFromSource(actor(companyId), boq.id, {
      sourceType: "MASTER_ITEM",
      sourceId: masterItem.id,
      sectionId: boq.sections[0].id,
      itemNumber: 1,
      quantity: "1",
    });

    const decision = await resolveBoqCommercialRequirements(companyId, boq.id);
    const requirement = decision.requirements.find((r) => r.type === "PACKAGE" && r.key === packageKey);
    expect(requirement).toBeDefined();
    const offer = requirement!.offers[0];
    expect(offer.priceCode).toBe("");
    expect(offer.amountMinor).toBe(0);
    expect(offer.checkoutAvailable).toBe(false);
    expect(offer.unavailableReason).toBe("Pricing not yet configured for this package.");
  });

  it("never claims a PLAN (trial final-export) offer is checkout-available, since SoftwarePlan has no CommerceProduct link", async () => {
    const { companyId, clientId } = await seedCompanyWithUser("plan-honest");
    cleanupCompanyIds.push(companyId);

    const { boq } = await createProjectWithDefaultBoq(actor(companyId), {
      clientId,
      industryEngineId: "construction",
      reference: `COMMREQ-PLAN-${RUN_ID}`,
      name: "Plan Offer Test",
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });

    // Exhaust the trial's one-final-export allowance so
    // canGenerateDocument(companyId, false) denies (TRIAL_LIMITS.maxFinalExports === 1).
    await acceptTrialTerms(actor(companyId));
    await startTrial(actor(companyId));
    await recordDocumentGenerated(companyId, false);

    const decision = await resolveBoqCommercialRequirements(companyId, boq.id);
    const planRequirement = decision.requirements.find((r) => r.type === "PLAN");
    expect(planRequirement).toBeDefined();
    const offer = planRequirement!.offers[0];
    expect(offer).toBeDefined();
    expect(offer.checkoutAvailable).toBe(false);
    expect(offer.priceCode).toBe("");
    expect(offer.unavailableReason).toContain("Plan upgrades aren't available for direct checkout yet");
  });
});
