import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { IndustryPackageType, MasterHierarchyNodeType, MasterItemVersionStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createPackage, addItemsToPackage } from "@/lib/repositories/industry-package-repository";
import { listAccessibleMasterItemsPaginated, companyHasPackageAccessForItem } from "@/lib/entitlements/package-entitlement-service";

/**
 * Self-contained fixtures — Company has no `key` field and no "org-1" row is
 * ever seeded (see prisma/seed.ts), so this suite creates its own company,
 * discipline/category/hierarchy node, master item, and package rather than
 * depending on undocumented pre-existing rows (matches the pattern in
 * tests/cross-package-leakage.test.ts and tests/industry-package-activation-service.test.ts).
 */
const RUN_ID = `${Date.now()}-${process.pid}`;

let companyId = "";
let disciplineId = "";
let categoryId = "";
let hierarchyNodeId = "";
let testPackageId = "";
let testMasterItemId = "";

describe("Marketplace Isolation", () => {
  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { legalName: `Isolation Test Co ${RUN_ID}`, tradeName: "Isolation Test Co", email: `isolation-${RUN_ID}@example.com` },
    });
    companyId = company.id;

    const discipline = await prisma.masterDiscipline.create({
      data: { key: `isolation-test-${RUN_ID}`, name: `Isolation Test Discipline ${RUN_ID}`, sortOrder: 999 },
    });
    disciplineId = discipline.id;

    const category = await prisma.masterCategory.create({
      data: { disciplineId, key: `isolation-cat-${RUN_ID}`, name: "Isolation Test Category", path: `isolation-cat-${RUN_ID}`, depth: 0 },
    });
    categoryId = category.id;

    const node = await prisma.masterHierarchyNode.create({
      data: { code: `isolation-node-${RUN_ID}`, name: "Isolation Test Node", nodeType: MasterHierarchyNodeType.CATEGORY, parentId: null, sortOrder: 0 },
    });
    hierarchyNodeId = node.id;
  });

  afterAll(async () => {
    await prisma.masterCategory.delete({ where: { id: categoryId } }).catch(() => undefined);
    await prisma.masterHierarchyNode.delete({ where: { id: hierarchyNodeId } }).catch(() => undefined);
    await prisma.masterDiscipline.delete({ where: { id: disciplineId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const item = await prisma.masterItem.create({
      data: {
        disciplineId,
        categoryId,
        hierarchyNodeId,
        itemCode: `ISO-${RUN_ID}-${Date.now()}`,
        name: "Isolation test item",
        shortDescription: "Isolation test item",
        fullDescription: "Isolation test item",
        defaultUnit: "no",
        isPremium: true,
      },
    });
    await prisma.masterItemVersion.create({
      data: {
        masterItemId: item.id,
        versionNumber: 1,
        status: MasterItemVersionStatus.PUBLISHED,
        effectiveDate: new Date(),
        changeSummary: "Isolation test fixture.",
        name: item.name,
        shortDescription: item.shortDescription,
        fullDescription: item.fullDescription,
        specificationTemplate: "",
        primaryUnit: item.defaultUnit,
        createdByUserId: null,
      },
    });
    testMasterItemId = item.id;

    const pkg = await createPackage({
      key: `isolation-pkg-${RUN_ID}-${Date.now()}`,
      name: "Isolation Test Package",
      disciplineId,
      packageType: IndustryPackageType.CORE,
    });
    testPackageId = pkg.id;
    await addItemsToPackage(testPackageId, [testMasterItemId]);
  });

  afterEach(async () => {
    await prisma.companyPackageSubscription.deleteMany({ where: { companyId, packageId: testPackageId } });
    await prisma.industryDataPackageItem.deleteMany({ where: { packageId: testPackageId } });
    await prisma.industryDataPackage.delete({ where: { id: testPackageId } }).catch(() => undefined);
    await prisma.masterItemVersion.deleteMany({ where: { masterItemId: testMasterItemId } });
    await prisma.masterItem.delete({ where: { id: testMasterItemId } }).catch(() => undefined);
  });

  it("should not return items from an unentitled package via listAccessibleMasterItemsPaginated", async () => {
    // No subscription created for this test — company has NO access.
    await expect(listAccessibleMasterItemsPaginated(companyId, testPackageId, { page: 1, pageSize: 50 }))
      .rejects.toThrow("This package is not active for your company.");
  });

  it("should block direct item access when package is not active", async () => {
    const hasAccess = await companyHasPackageAccessForItem(companyId, testMasterItemId);
    expect(hasAccess).toBe(false);
  });

  it("should return items when package is active via listAccessibleMasterItemsPaginated", async () => {
    const sub = await prisma.companyPackageSubscription.create({
      data: {
        companyId,
        packageId: testPackageId,
        status: "ACTIVE",
        startsAt: new Date(),
        source: "development",
      },
    });

    const result = await listAccessibleMasterItemsPaginated(companyId, testPackageId, { page: 1, pageSize: 50 });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);

    await prisma.companyPackageSubscription.delete({ where: { id: sub.id } });
  });
});
