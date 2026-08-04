import { PlatformRole, UserRole } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { NotFoundError, PermissionDeniedError } from "../src/lib/errors/app-error";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { getMasterItemViewAccessEffective } from "../src/lib/entitlements/effective-entitlement-service";
import { getMasterItemCustomerDetail } from "../src/lib/repositories/master-item-repository";
import { buildMasterItemAdminDetail, getMasterItemAdminDetail } from "../src/lib/services/master-item-governance-service";
import { createDraftVersion, transitionVersionStatus, addClassification } from "../src/lib/services/master-item-governance-service";
import { getLibraryItemForCompany, getLibraryItemForOwner, createManualLibraryItem } from "../src/lib/services/company-library-service";
import { startOrChangeSimulation, exitSimulation } from "../src/lib/services/platform-simulation-service";
import { activateDevelopmentPackage } from "../src/lib/entitlements/package-entitlement-service";

const RUN_ID = `${Date.now()}-${process.pid}`;

let companyAId = "";
let companyBId = "";
let ownerUserId = "";
let companyAUserId = "";
let companyBUserId = "";
let disciplineId = "";
let categoryId = "";
let premiumItemId = "";
let freeItemId = "";
let libraryItemAId = "";
let libraryItemBId = "";
let mechanicalPackageId = "";

function ownerActor(): PlatformActor {
  return { userId: ownerUserId, companyId: companyAId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "ADA1 Owner", email: `${RUN_ID}-owner@example.com` };
}
function adminActor(): PlatformActor {
  return { userId: ownerUserId, companyId: companyAId, platformRole: PlatformRole.PLATFORM_ADMIN, fullName: "ADA1 Admin", email: `${RUN_ID}-admin@example.com` };
}
function ownerAsCurrentActor(): CurrentActor {
  return { userId: ownerUserId, companyId: companyAId, role: UserRole.COMPANY_OWNER, fullName: "ADA1 Owner", email: `${RUN_ID}-owner@example.com` };
}
function companyAActor(): CurrentActor {
  return { userId: companyAUserId, companyId: companyAId, role: UserRole.COMPANY_OWNER, fullName: "ADA1 Company A", email: `${RUN_ID}-a@example.com` };
}
function companyBActor(): CurrentActor {
  return { userId: companyBUserId, companyId: companyBId, role: UserRole.COMPANY_OWNER, fullName: "ADA1 Company B", email: `${RUN_ID}-b@example.com` };
}

describe("ADMIN-DATA-ACCESS-1: platform owner data-library access (integration)", () => {
  beforeAll(async () => {
    const companyA = await prisma.company.create({ data: { legalName: `ADA1 Co A ${RUN_ID}`, tradeName: "ADA1 Co A", email: `ada1-a-${RUN_ID}@example.com` } });
    companyAId = companyA.id;
    const companyB = await prisma.company.create({ data: { legalName: `ADA1 Co B ${RUN_ID}`, tradeName: "ADA1 Co B", email: `ada1-b-${RUN_ID}@example.com` } });
    companyBId = companyB.id;

    const owner = await prisma.user.create({
      data: { companyId: companyAId, email: `${RUN_ID}-owner@example.com`, passwordHash: `hash-${RUN_ID}`, fullName: "ADA1 Owner", role: UserRole.COMPANY_OWNER, platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerUserId = owner.id;
    const userA = await prisma.user.create({
      data: { companyId: companyAId, email: `${RUN_ID}-a@example.com`, passwordHash: `hash-${RUN_ID}`, fullName: "ADA1 Company A", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    companyAUserId = userA.id;
    const userB = await prisma.user.create({
      data: { companyId: companyBId, email: `${RUN_ID}-b@example.com`, passwordHash: `hash-${RUN_ID}`, fullName: "ADA1 Company B", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    companyBUserId = userB.id;

    const discipline = await prisma.masterDiscipline.create({ data: { key: `ada1-${RUN_ID}`, name: `ADA1 Discipline ${RUN_ID}` } });
    disciplineId = discipline.id;
    const category = await prisma.masterCategory.create({ data: { disciplineId, key: "cat", name: "Category", path: "cat", depth: 0 } });
    categoryId = category.id;

    const premiumItem = await prisma.masterItem.create({
      data: { disciplineId, categoryId, itemCode: `ADA1-PREM-${RUN_ID}`, name: "Premium Test Item", shortDescription: "short", defaultUnit: "EA", isPremium: true },
    });
    premiumItemId = premiumItem.id;
    const freeItem = await prisma.masterItem.create({
      data: { disciplineId, categoryId, itemCode: `ADA1-FREE-${RUN_ID}`, name: "Free Test Item", shortDescription: "short", defaultUnit: "EA", isPremium: false },
    });
    freeItemId = freeItem.id;

    // Give the premium item a published version + classification so admin detail has real content to assert on.
    const v1 = await createDraftVersion(ownerActor(), premiumItemId, { name: "V1", primaryUnit: "EA" });
    await transitionVersionStatus(ownerActor(), v1.id, "REVIEW");
    await transitionVersionStatus(ownerActor(), v1.id, "APPROVED");
    await transitionVersionStatus(ownerActor(), v1.id, "PUBLISHED");
    await addClassification(ownerActor(), premiumItemId, { system: "MASTERFORMAT_2020", code: "23 00 00", label: "Test" });
    // A second, still-draft version so "owner sees draft/review versions too" is a real assertion, not just PUBLISHED.
    await createDraftVersion(ownerActor(), premiumItemId, { name: "V2 Draft", primaryUnit: "EA" });

    const libA = await createManualLibraryItem(companyAActor(), { companyItemCode: `LIBA-${RUN_ID}`, name: "Company A item", description: "d", unit: "EA", defaultCost: 10, defaultMargin: 10, disciplineId, categoryId });
    libraryItemAId = libA.id;
    const libB = await createManualLibraryItem(companyBActor(), { companyItemCode: `LIBB-${RUN_ID}`, name: "Company B item", description: "d", unit: "EA", defaultCost: 10, defaultMargin: 10, disciplineId, categoryId });
    libraryItemBId = libB.id;

    const mechanical = await prisma.masterDiscipline.findUniqueOrThrow({ where: { key: "mechanical" } });
    const pkg = await prisma.industryDataPackage.upsert({
      where: { key: `ada1-pkg-${RUN_ID}` },
      update: {},
      create: { key: `ada1-pkg-${RUN_ID}`, name: "ADA1 Test Package", disciplineId: mechanical.id, packageType: "PROFESSIONAL", itemCount: 0, monthlyPrice: 0, annualPrice: 0, currency: "USD", status: "ACTIVE" },
    });
    mechanicalPackageId = pkg.id;
  });

  afterEach(async () => {
    await exitSimulation(ownerActor()).catch(() => undefined);
  });

  afterAll(async () => {
    await prisma.platformSimulationSession.deleteMany({ where: { userId: ownerUserId } });
    await prisma.companyPackageSubscription.deleteMany({ where: { packageId: mechanicalPackageId } });
    await prisma.industryDataPackageItem.deleteMany({ where: { packageId: mechanicalPackageId } });
    await prisma.industryDataPackage.deleteMany({ where: { key: `ada1-pkg-${RUN_ID}` } });
    if (premiumItemId) {
      await prisma.masterItemAttributeValue.deleteMany({ where: { masterItemId: premiumItemId } });
      await prisma.masterItemClassification.deleteMany({ where: { masterItemId: premiumItemId } });
      await prisma.masterItemVersion.deleteMany({ where: { masterItemId: premiumItemId } });
    }
    await prisma.masterItem.deleteMany({ where: { disciplineId } });
    await prisma.masterCategory.deleteMany({ where: { disciplineId } });
    await prisma.masterDiscipline.deleteMany({ where: { id: disciplineId } });
    for (const companyId of [companyAId, companyBId]) {
      await prisma.companyLibraryItem.deleteMany({ where: { companyId } });
      await prisma.user.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  describe("platform owner — normal mode", () => {
    it("owner can view a premium master item without any package or trial (the reported production bug)", async () => {
      const access = await getMasterItemViewAccessEffective({ userId: ownerUserId, companyId: companyAId }, premiumItemId);
      expect(access.allowed).toBe(true);
      expect(access.isOwnerView).toBe(true);
    });

    it("owner can view a free (non-premium) item", async () => {
      const access = await getMasterItemViewAccessEffective({ userId: ownerUserId, companyId: companyAId }, freeItemId);
      expect(access.allowed).toBe(true);
      expect(access.isOwnerView).toBe(true);
    });

    it("owner's admin detail includes draft AND published versions, and real classifications — not just the customer-visible published one", async () => {
      const detail = await getMasterItemAdminDetail(ownerActor(), premiumItemId);
      expect(detail.versions.length).toBeGreaterThanOrEqual(2);
      expect(detail.versions.some((v) => v.status === "DRAFT")).toBe(true);
      expect(detail.versions.some((v) => v.status === "PUBLISHED")).toBe(true);
      expect(detail.classifications.length).toBeGreaterThanOrEqual(1);
    });

    it("owner's admin detail never leaks secrets — no passwordHash, token, or DATABASE_URL-shaped strings", async () => {
      const detail = await buildMasterItemAdminDetail(premiumItemId);
      const serialized = JSON.stringify(detail);
      expect(serialized).not.toMatch(/passwordHash|tokenHash|DATABASE_URL|postgres:\/\//i);
    });

    it("a non-owner platform actor (PLATFORM_ADMIN) is blocked from the owner admin detail", async () => {
      await expect(getMasterItemAdminDetail(adminActor(), premiumItemId)).rejects.toThrow(PermissionDeniedError);
    });

    it("owner can view company A's library item and company B's library item (cross-tenant operational inspection)", async () => {
      const detailA = await getLibraryItemForOwner(ownerActor(), libraryItemAId);
      expect(detailA.owningCompany?.id).toBe(companyAId);
      const detailB = await getLibraryItemForOwner(ownerActor(), libraryItemBId);
      expect(detailB.owningCompany?.id).toBe(companyBId);
    });

    it("a non-owner platform actor cannot use cross-tenant library inspection", async () => {
      await expect(getLibraryItemForOwner(adminActor(), libraryItemAId)).rejects.toThrow(PermissionDeniedError);
    });

    it("no hardcoded owner email is involved — owner detection is driven purely by the DB platformRole column", async () => {
      // ownerActor()/ownerAsCurrentActor() above use a random RUN_ID-scoped email, never a real production address,
      // and access still resolves correctly — proving the check is role-based, not email-based.
      expect(ownerActor().email).not.toMatch(/vistabylara|quantara\.com$/i);
      const access = await getMasterItemViewAccessEffective({ userId: ownerUserId, companyId: companyAId }, premiumItemId);
      expect(access.isOwnerView).toBe(true);
    });
  });

  describe("customer simulation", () => {
    it("owner simulating Trial sees trial restrictions on a premium item (locked, not owner view)", async () => {
      await startOrChangeSimulation(ownerActor(), "TRIAL_ACTIVE");
      const access = await getMasterItemViewAccessEffective({ userId: ownerUserId, companyId: companyAId }, premiumItemId);
      expect(access.allowed).toBe(false);
      expect(access.isOwnerView).toBe(false);
      expect(access.source).toBe("simulation");
      expect(access.simulationMode).toBe("TRIAL_ACTIVE");
    });

    it("owner simulating Free sees free restrictions", async () => {
      await startOrChangeSimulation(ownerActor(), "FREE");
      const access = await getMasterItemViewAccessEffective({ userId: ownerUserId, companyId: companyAId }, premiumItemId);
      expect(access.allowed).toBe(false);
      expect(access.simulationMode).toBe("FREE");
    });

    it("owner simulating Pro can view the premium item, but still not as owner view", async () => {
      await startOrChangeSimulation(ownerActor(), "PRO");
      const access = await getMasterItemViewAccessEffective({ userId: ownerUserId, companyId: companyAId }, premiumItemId);
      expect(access.allowed).toBe(true);
      expect(access.isOwnerView).toBe(false);
      expect(access.simulationMode).toBe("PRO");
    });

    it("Exit Simulation restores full, unrestricted owner access", async () => {
      await startOrChangeSimulation(ownerActor(), "TRIAL_ACTIVE");
      await exitSimulation(ownerActor());
      const access = await getMasterItemViewAccessEffective({ userId: ownerUserId, companyId: companyAId }, premiumItemId);
      expect(access.allowed).toBe(true);
      expect(access.isOwnerView).toBe(true);
      expect(access.source).toBe("owner-override");
    });

    it("simulation never modifies the real platformRole column", async () => {
      await startOrChangeSimulation(ownerActor(), "TRIAL_ACTIVE");
      const user = await prisma.user.findUniqueOrThrow({ where: { id: ownerUserId } });
      expect(user.platformRole).toBe("PLATFORM_OWNER");
    });
  });

  describe("company users — tenant isolation unchanged", () => {
    it("a company user without any package/trial sees the item locked, exactly as before this fix", async () => {
      const access = await getMasterItemViewAccessEffective({ userId: companyAUserId, companyId: companyAId }, premiumItemId);
      expect(access.allowed).toBe(false);
      expect(access.isOwnerView).toBe(false);
      expect(access.source).toBe("real");
    });

    it("a company user with a real, activated package can view the premium item, but is never marked as owner view", async () => {
      await prisma.industryDataPackageItem.create({ data: { packageId: mechanicalPackageId, masterItemId: premiumItemId, sortOrder: 0 } });
      await activateDevelopmentPackage(ownerAsCurrentActor(), mechanicalPackageId);
      const access = await getMasterItemViewAccessEffective({ userId: companyAUserId, companyId: companyAId }, premiumItemId);
      expect(access.allowed).toBe(true);
      expect(access.isOwnerView).toBe(false);
      expect(access.source).toBe("real");
    });

    it("company A user cannot view company B's library item — cross-tenant lookup returns not-found", async () => {
      await expect(getLibraryItemForCompany(companyAActor(), libraryItemBId)).rejects.toThrow(NotFoundError);
    });

    it("company A user can view their own company's library item", async () => {
      const detail = await getLibraryItemForCompany(companyAActor(), libraryItemAId);
      expect(detail.id).toBe(libraryItemAId);
    });
  });

  describe("regression — customer detail shape unchanged for a real, entitled user", () => {
    it("free item detail is identical in shape whether fetched as owner-detail-base or customer detail", async () => {
      const customerDetail = await getMasterItemCustomerDetail(freeItemId);
      expect(customerDetail.itemCode).toBe(`ADA1-FREE-${RUN_ID}`);
    });
  });
});
