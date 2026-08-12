import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { IndustryPackageType, MasterHierarchyNodeType, MasterItemVersionStatus } from "@prisma/client";
import { prisma } from "../src/lib/db/prisma";
import { createPackage, addItemsToPackage } from "../src/lib/repositories/industry-package-repository";

/**
 * CATALOGUE-PHASE7-RECOVERY — cross-package leakage must be checked against
 * the real explicit membership table (IndustryDataPackageItem), never
 * inferred from a package's denormalized itemCount. Two different packages
 * can legitimately share the exact same item count without any overlap at
 * all, and conversely two packages could share real items while having
 * different counts — a count comparison catches neither case. This checks
 * actual masterItemId-set intersection between package pairs, with both a
 * negative control (two packages with disjoint membership, must report zero
 * overlap) and a positive control (a package that intentionally shares one
 * item with another, must be caught) — proving the check can actually fail,
 * not just always pass. The real-package-pairs check runs first, before any
 * synthetic fixtures exist, so the intentional-overlap fixture from the
 * positive control never contaminates it.
 */

const RUN_ID = `${Date.now()}-${process.pid}`;

let disciplineId = "";
let categoryId = "";
let hierarchyNodeId = "";
const createdItemIds: string[] = [];
const createdPackageIds: string[] = [];

async function createTestMasterItem(itemCode: string) {
  const item = await prisma.masterItem.create({
    data: {
      disciplineId,
      categoryId,
      hierarchyNodeId,
      itemCode,
      name: `Leakage test item ${itemCode}`,
      shortDescription: `Leakage test item ${itemCode}`,
      fullDescription: `Leakage test item ${itemCode}`,
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
      changeSummary: "Leakage test fixture.",
      name: item.name,
      shortDescription: item.shortDescription,
      fullDescription: item.fullDescription,
      specificationTemplate: "",
      primaryUnit: item.defaultUnit,
      createdByUserId: null,
    },
  });
  createdItemIds.push(item.id);
  return item;
}

async function cleanupSyntheticFixtures() {
  for (const packageId of createdPackageIds.splice(0)) {
    await prisma.industryDataPackageItem.deleteMany({ where: { packageId } });
    await prisma.industryDataPackage.delete({ where: { id: packageId } }).catch(() => undefined);
  }
  for (const itemId of createdItemIds.splice(0)) {
    await prisma.masterItemVersion.deleteMany({ where: { masterItemId: itemId } });
    await prisma.masterItem.delete({ where: { id: itemId } }).catch(() => undefined);
  }
}

describe("CATALOGUE-PHASE7-RECOVERY: cross-package leakage (integration, real local Postgres)", () => {
  beforeAll(async () => {
    const discipline = await prisma.masterDiscipline.create({
      data: { key: `leakage-test-${RUN_ID}`, name: `Leakage Test Discipline ${RUN_ID}`, sortOrder: 999 },
    });
    disciplineId = discipline.id;

    const category = await prisma.masterCategory.create({
      data: { disciplineId, key: `leakage-cat-${RUN_ID}`, name: "Leakage Test Category", path: `leakage-cat-${RUN_ID}`, depth: 0 },
    });
    categoryId = category.id;

    const node = await prisma.masterHierarchyNode.create({
      data: { code: `leakage-node-${RUN_ID}`, name: "Leakage Test Node", nodeType: MasterHierarchyNodeType.CATEGORY, parentId: null, sortOrder: 0 },
    });
    hierarchyNodeId = node.id;
  });

  afterEach(async () => {
    await cleanupSyntheticFixtures();
  });

  afterAll(async () => {
    await prisma.masterCategory.delete({ where: { id: categoryId } }).catch(() => undefined);
    await prisma.masterHierarchyNode.delete({ where: { id: hierarchyNodeId } }).catch(() => undefined);
    await prisma.masterDiscipline.delete({ where: { id: disciplineId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("all currently packaged datasets — no unintended overlap across every real package pair in this database", async () => {
    const packages = await prisma.industryDataPackage.findMany({ select: { id: true, key: true } });
    const memberships = await prisma.industryDataPackageItem.findMany({ select: { packageId: true, masterItemId: true } });

    const byPackage = new Map<string, Set<string>>();
    for (const m of memberships) {
      if (!byPackage.has(m.packageId)) byPackage.set(m.packageId, new Set());
      byPackage.get(m.packageId)!.add(m.masterItemId);
    }

    const leaks: Array<{ a: string; b: string; sharedItemIds: string[] }> = [];
    for (let i = 0; i < packages.length; i += 1) {
      for (let j = i + 1; j < packages.length; j += 1) {
        const setA = byPackage.get(packages[i].id) ?? new Set<string>();
        const setB = byPackage.get(packages[j].id) ?? new Set<string>();
        const shared = [...setA].filter((id) => setB.has(id));
        if (shared.length > 0) leaks.push({ a: packages[i].key, b: packages[j].key, sharedItemIds: shared });
      }
    }

    expect(leaks).toEqual([]);
  });

  it("negative control — two packages with disjoint explicit membership report zero item-ID overlap", async () => {
    const itemsA = await Promise.all([createTestMasterItem(`LEAK-A1-${RUN_ID}`), createTestMasterItem(`LEAK-A2-${RUN_ID}`)]);
    const itemsB = await Promise.all([createTestMasterItem(`LEAK-B1-${RUN_ID}`), createTestMasterItem(`LEAK-B2-${RUN_ID}`)]);

    const pkgA = await createPackage({ key: `leakage-pkg-a-${RUN_ID}`, name: "Leakage Package A", disciplineId, packageType: IndustryPackageType.CORE });
    const pkgB = await createPackage({ key: `leakage-pkg-b-${RUN_ID}`, name: "Leakage Package B", disciplineId, packageType: IndustryPackageType.CORE });
    createdPackageIds.push(pkgA.id, pkgB.id);

    await addItemsToPackage(pkgA.id, itemsA.map((i) => i.id));
    await addItemsToPackage(pkgB.id, itemsB.map((i) => i.id));

    const membershipA = await prisma.industryDataPackageItem.findMany({ where: { packageId: pkgA.id }, select: { masterItemId: true } });
    const membershipB = await prisma.industryDataPackageItem.findMany({ where: { packageId: pkgB.id }, select: { masterItemId: true } });
    const setA = new Set(membershipA.map((m) => m.masterItemId));
    const overlap = membershipB.filter((m) => setA.has(m.masterItemId));

    expect(overlap).toHaveLength(0);
  });

  it("positive control — a package that intentionally shares one item with another IS caught by the same overlap check", async () => {
    const sharedItem = await createTestMasterItem(`LEAK-SHARED-${RUN_ID}`);
    const onlyInC = await createTestMasterItem(`LEAK-C1-${RUN_ID}`);

    const pkgC = await createPackage({ key: `leakage-pkg-c-${RUN_ID}`, name: "Leakage Package C", disciplineId, packageType: IndustryPackageType.CORE });
    const pkgD = await createPackage({ key: `leakage-pkg-d-${RUN_ID}`, name: "Leakage Package D", disciplineId, packageType: IndustryPackageType.CORE });
    createdPackageIds.push(pkgC.id, pkgD.id);

    await addItemsToPackage(pkgC.id, [sharedItem.id, onlyInC.id]);
    await addItemsToPackage(pkgD.id, [sharedItem.id]);

    const membershipC = await prisma.industryDataPackageItem.findMany({ where: { packageId: pkgC.id }, select: { masterItemId: true } });
    const membershipD = await prisma.industryDataPackageItem.findMany({ where: { packageId: pkgD.id }, select: { masterItemId: true } });
    const setC = new Set(membershipC.map((m) => m.masterItemId));
    const overlap = membershipD.filter((m) => setC.has(m.masterItemId));

    expect(overlap).toHaveLength(1);
    expect(overlap[0].masterItemId).toBe(sharedItem.id);
  });
});
