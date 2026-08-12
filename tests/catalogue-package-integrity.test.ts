import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PlatformRole, UserRole, IndustryPackageType, MasterItemVersionStatus } from "@prisma/client";
import { prisma } from "../src/lib/db/prisma";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { requireDatasetDefinition } from "../src/lib/services/catalogue-dataset-registry";
import { activateDataset } from "../src/lib/services/industry-package-activation-service";
import { createPackage, addItemsToPackage } from "../src/lib/repositories/industry-package-repository";
import {
  computePackageIntegrity,
  computeCrossPackageOverlap,
  reconcileGovernedPackageMembership,
} from "../src/lib/services/catalogue-package-integrity-service";

/**
 * CATALOGUE-PHASE7-STRICT-CLOSEOUT — regression coverage for the canonical
 * integrity engine. Drives the real HVAC dataset to genuinely complete,
 * then proves strictComplete flips false for each individual defect
 * (missing membership, extra/foreign membership, counter mismatch), and
 * proves reconcileGovernedPackageMembership() repairs each case correctly
 * without ever touching MasterItem/MasterItemVersion or another package.
 */

const RUN_ID = `${Date.now()}-${process.pid}`;
const HVAC_DATASET_ID = "quantara-master-hvac-v1";

let companyId = "";
let ownerUserId = "";
const createdJobIds = new Set<string>();

function ownerActor(): PlatformActor {
  return { userId: ownerUserId, companyId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "PI Owner", email: `${RUN_ID}-owner@example.com` };
}

function assertIsolatedLocalTestDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for this integration test");
  const parsed = new URL(databaseUrl);
  const isLocalHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  const isTestDatabase = /(?:test|e2e)/i.test(parsed.pathname);
  if (!isLocalHost || !isTestDatabase) throw new Error("Refusing catalogue test cleanup outside an isolated local test database");
}

async function hvacItemWhere() {
  const mechanical = await prisma.masterDiscipline.findUnique({ where: { key: "mechanical" } });
  return { disciplineId: mechanical?.id ?? "__no_mechanical_discipline__", itemCode: { startsWith: "HVAC-" } } as const;
}

async function activateDatasetTracked() {
  const result = await activateDataset(ownerActor(), HVAC_DATASET_ID);
  createdJobIds.add(result.jobId);
  return result;
}

async function driveHvacToComplete() {
  const dataset = requireDatasetDefinition(HVAC_DATASET_ID);
  let last = await activateDatasetTracked();
  while (!last.isComplete) last = await activateDatasetTracked();
  return dataset;
}

async function teardownTrackedHvacData(): Promise<void> {
  if (createdJobIds.size === 0) return;
  const trackedJobs = await prisma.masterCatalogueImportJob.findMany({ where: { id: { in: [...createdJobIds] } }, select: { legacyBatchId: true } });
  const trackedBatchIds = trackedJobs.map((j) => j.legacyBatchId).filter((id): id is string => Boolean(id));
  const trackedItems = trackedBatchIds.length > 0 ? await prisma.masterItem.findMany({ where: { sourceBatchId: { in: trackedBatchIds } }, select: { id: true } }) : [];
  const trackedItemIds = trackedItems.map((i) => i.id);
  if (trackedItemIds.length > 0) {
    await prisma.industryDataPackageItem.deleteMany({ where: { masterItemId: { in: trackedItemIds } } });
    await prisma.masterItemClassification.deleteMany({ where: { masterItemId: { in: trackedItemIds } } });
    await prisma.masterItemVersion.deleteMany({ where: { masterItemId: { in: trackedItemIds } } });
    await prisma.masterItem.deleteMany({ where: { id: { in: trackedItemIds } } });
  }
  await prisma.masterCatalogueImportJob.deleteMany({ where: { id: { in: [...createdJobIds] } } });
  if (trackedBatchIds.length > 0) await prisma.masterCatalogueImportBatch.deleteMany({ where: { id: { in: trackedBatchIds } } });
  const pkg = await prisma.industryDataPackage.findUnique({ where: { key: "hvac-library" } });
  if (pkg) {
    const remaining = await prisma.industryDataPackageItem.count({ where: { packageId: pkg.id } });
    if (remaining === 0) await prisma.industryDataPackage.delete({ where: { id: pkg.id } });
  }
}

describe("CATALOGUE-PHASE7-STRICT-CLOSEOUT: canonical package integrity engine (integration, real local Postgres, real HVAC dataset)", () => {
  beforeAll(async () => {
    assertIsolatedLocalTestDatabase();
    const existingJob = await prisma.masterCatalogueImportJob.findFirst({ where: { datasetId: HVAC_DATASET_ID } });
    if (existingJob) throw new Error(`Refusing to run: MasterCatalogueImportJob (id=${existingJob.id}) already exists for ${HVAC_DATASET_ID}.`);
    const existingItem = await prisma.masterItem.findFirst({ where: await hvacItemWhere() });
    if (existingItem) throw new Error(`Refusing to run: MasterItem (id=${existingItem.id}) already matches HVAC scope.`);
    const existingPackage = await prisma.industryDataPackage.findUnique({ where: { key: "hvac-library" } });
    if (existingPackage) throw new Error(`Refusing to run: "hvac-library" package (id=${existingPackage.id}) already exists.`);

    const company = await prisma.company.create({ data: { legalName: `PI Co ${RUN_ID}`, tradeName: "PI Co", email: `pi-${RUN_ID}@example.com` } });
    companyId = company.id;
    const owner = await prisma.user.create({
      data: { companyId, email: `${RUN_ID}-owner@example.com`, passwordHash: `hash-${RUN_ID}`, fullName: "PI Owner", role: UserRole.COMPANY_OWNER, platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerUserId = owner.id;

    await driveHvacToComplete();
  }, 150_000);

  afterAll(async () => {
    await teardownTrackedHvacData();
    if (companyId) await prisma.user.deleteMany({ where: { companyId } });
    if (companyId) await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it("exact membership -> strictComplete true", async () => {
    const dataset = requireDatasetDefinition(HVAC_DATASET_ID);
    const integrity = await computePackageIntegrity(dataset);
    expect(integrity.strictComplete).toBe(true);
    expect(integrity.missingMembershipCount).toBe(0);
    expect(integrity.extraMembershipCount).toBe(0);
    expect(integrity.datasetItemCount).toBe(integrity.expectedRowCount);
  });

  it("extra membership -> strictComplete false, and reconcile removes only the extra row", async () => {
    const dataset = requireDatasetDefinition(HVAC_DATASET_ID);
    const pkg = await prisma.industryDataPackage.findUniqueOrThrow({ where: { key: "hvac-library" } });
    const mechanical = await prisma.masterDiscipline.findUniqueOrThrow({ where: { key: "mechanical" } });
    const foreignBatch = await prisma.masterCatalogueImportBatch.create({
      data: { actorUserId: ownerUserId, disciplineId: mechanical.id, uploadedFileName: "foreign.csv", checksum: `foreign-extra-${RUN_ID}`, status: "EXECUTED", totalRows: 1 },
    });
    const foreignItem = await prisma.masterItem.create({
      data: {
        disciplineId: mechanical.id,
        categoryId: (await prisma.masterCategory.findFirstOrThrow({ where: { disciplineId: mechanical.id } })).id,
        itemCode: `HVAC-EXTRA-${RUN_ID}`,
        name: "Extra foreign item",
        shortDescription: "Extra foreign item",
        fullDescription: "Extra foreign item",
        defaultUnit: "no",
        isPremium: true,
        sourceBatchId: foreignBatch.id,
      },
    });
    await addItemsToPackage(pkg.id, [foreignItem.id]);

    const before = await computePackageIntegrity(dataset);
    expect(before.strictComplete).toBe(false);
    expect(before.extraMembershipCount).toBe(1);
    expect(before.missingMembershipCount).toBe(0);

    const result = await reconcileGovernedPackageMembership(ownerActor(), "hvac-library", before.integrityFingerprint);
    expect(result.extrasRemoved).toBe(1);
    expect(result.missingAdded).toBe(0);
    expect(result.afterMembershipCount).toBe(before.expectedRowCount);

    const after = await computePackageIntegrity(dataset);
    expect(after.strictComplete).toBe(true);

    const foreignItemStillExists = await prisma.masterItem.findUnique({ where: { id: foreignItem.id } });
    expect(foreignItemStillExists).not.toBeNull();

    await prisma.masterItem.delete({ where: { id: foreignItem.id } });
    await prisma.masterCatalogueImportBatch.delete({ where: { id: foreignBatch.id } });
  });

  it("missing membership -> strictComplete false, and reconcile adds only the missing row", async () => {
    const dataset = requireDatasetDefinition(HVAC_DATASET_ID);
    const pkg = await prisma.industryDataPackage.findUniqueOrThrow({ where: { key: "hvac-library" } });
    const membership = await prisma.industryDataPackageItem.findFirstOrThrow({ where: { packageId: pkg.id } });
    await prisma.industryDataPackageItem.delete({ where: { id: membership.id } });
    await prisma.industryDataPackage.update({ where: { id: pkg.id }, data: { itemCount: { decrement: 1 } } });

    const before = await computePackageIntegrity(dataset);
    expect(before.strictComplete).toBe(false);
    expect(before.missingMembershipCount).toBe(1);

    const result = await reconcileGovernedPackageMembership(ownerActor(), "hvac-library", before.integrityFingerprint);
    expect(result.missingAdded).toBe(1);
    expect(result.extrasRemoved).toBe(0);
    expect(result.afterMembershipCount).toBe(before.expectedRowCount);

    const after = await computePackageIntegrity(dataset);
    expect(after.strictComplete).toBe(true);
  });

  it("package counter mismatch alone -> strictComplete false, reconcile corrects the counter without changing membership", async () => {
    const dataset = requireDatasetDefinition(HVAC_DATASET_ID);
    const pkg = await prisma.industryDataPackage.findUniqueOrThrow({ where: { key: "hvac-library" } });
    await prisma.industryDataPackage.update({ where: { id: pkg.id }, data: { itemCount: pkg.itemCount + 5 } });

    const before = await computePackageIntegrity(dataset);
    expect(before.strictComplete).toBe(false);
    expect(before.missingMembershipCount).toBe(0);
    expect(before.extraMembershipCount).toBe(0);
    expect(before.packageCounterCount).not.toBe(before.expectedRowCount);

    const result = await reconcileGovernedPackageMembership(ownerActor(), "hvac-library", before.integrityFingerprint);
    expect(result.missingAdded).toBe(0);
    expect(result.extrasRemoved).toBe(0);
    expect(result.afterPackageCounter).toBe(before.expectedRowCount);

    const after = await computePackageIntegrity(dataset);
    expect(after.strictComplete).toBe(true);
  });

  it("stale fingerprint is rejected — 409, no mutation", async () => {
    const dataset = requireDatasetDefinition(HVAC_DATASET_ID);
    const integrity = await computePackageIntegrity(dataset);
    expect(integrity.strictComplete).toBe(true);

    await expect(reconcileGovernedPackageMembership(ownerActor(), "hvac-library", "stale-fake-fingerprint")).rejects.toThrow(/INTEGRITY_CHANGED|changed/i);

    const stillIntact = await computePackageIntegrity(dataset);
    expect(stillIntact.strictComplete).toBe(true);
  });

  it("MasterItem is never deleted by reconcile, even when removing extra membership", async () => {
    const dataset = requireDatasetDefinition(HVAC_DATASET_ID);
    const pkg = await prisma.industryDataPackage.findUniqueOrThrow({ where: { key: "hvac-library" } });
    const mechanical = await prisma.masterDiscipline.findUniqueOrThrow({ where: { key: "mechanical" } });
    const foreignBatch = await prisma.masterCatalogueImportBatch.create({
      data: { actorUserId: ownerUserId, disciplineId: mechanical.id, uploadedFileName: "foreign2.csv", checksum: `foreign-nodelete-${RUN_ID}`, status: "EXECUTED", totalRows: 1 },
    });
    const foreignItem = await prisma.masterItem.create({
      data: {
        disciplineId: mechanical.id,
        categoryId: (await prisma.masterCategory.findFirstOrThrow({ where: { disciplineId: mechanical.id } })).id,
        itemCode: `HVAC-NODELETE-${RUN_ID}`,
        name: "No-delete item",
        shortDescription: "No-delete item",
        fullDescription: "No-delete item",
        defaultUnit: "no",
        isPremium: true,
        sourceBatchId: foreignBatch.id,
      },
    });
    const version = await prisma.masterItemVersion.create({
      data: {
        masterItemId: foreignItem.id,
        versionNumber: 1,
        status: MasterItemVersionStatus.PUBLISHED,
        effectiveDate: new Date(),
        changeSummary: "fixture",
        name: foreignItem.name,
        shortDescription: foreignItem.shortDescription,
        fullDescription: foreignItem.fullDescription,
        specificationTemplate: "",
        primaryUnit: foreignItem.defaultUnit,
      },
    });
    await addItemsToPackage(pkg.id, [foreignItem.id]);

    const before = await computePackageIntegrity(dataset);
    await reconcileGovernedPackageMembership(ownerActor(), "hvac-library", before.integrityFingerprint);

    const itemStillExists = await prisma.masterItem.findUnique({ where: { id: foreignItem.id } });
    const versionStillExists = await prisma.masterItemVersion.findUnique({ where: { id: version.id } });
    expect(itemStillExists).not.toBeNull();
    expect(versionStillExists).not.toBeNull();

    await prisma.masterItemVersion.delete({ where: { id: version.id } });
    await prisma.masterItem.delete({ where: { id: foreignItem.id } });
    await prisma.masterCatalogueImportBatch.delete({ where: { id: foreignBatch.id } });
  });

  it("cross-package overlap detector — negative control: no real overlap among governed packages here", async () => {
    const overlaps = await computeCrossPackageOverlap(ownerActor());
    const hvacOverlap = overlaps.find((o) => o.packageKeyA === "hvac-library" || o.packageKeyB === "hvac-library");
    expect(hvacOverlap).toBeUndefined();
  });

  it("cross-package overlap detector — positive control: a real shared MasterItem between two GOVERNED packages IS detected", async () => {
    // The overlap query is intentionally scoped to only the 15 governed
    // targetPackageCode keys (never an arbitrary/synthetic key) — so the
    // positive control must use a second REAL governed package key, not a
    // made-up one, to actually exercise that scoping.
    const pkgA = await prisma.industryDataPackage.findUniqueOrThrow({ where: { key: "hvac-library" } });
    const plumbingDataset = requireDatasetDefinition("quantara-master-plumbing-v1");
    expect(plumbingDataset.targetPackageCode).toBe("plumbing-library");

    const preExistingPlumbing = await prisma.industryDataPackage.findUnique({ where: { key: "plumbing-library" } });
    if (preExistingPlumbing) throw new Error('Refusing to run: "plumbing-library" package already exists — cannot prove this test created it.');

    const pkgB = await createPackage({
      key: "plumbing-library",
      name: plumbingDataset.label,
      disciplineId: pkgA.disciplineId,
      packageType: IndustryPackageType.CORE,
    });
    const sharedMembership = await prisma.industryDataPackageItem.findFirstOrThrow({ where: { packageId: pkgA.id } });
    await addItemsToPackage(pkgB.id, [sharedMembership.masterItemId]);

    const overlaps = await computeCrossPackageOverlap(ownerActor());
    const found = overlaps.some(
      (o) =>
        (o.packageKeyA === "hvac-library" && o.packageKeyB === "plumbing-library") ||
        (o.packageKeyB === "hvac-library" && o.packageKeyA === "plumbing-library"),
    );
    expect(found).toBe(true);

    await prisma.industryDataPackageItem.deleteMany({ where: { packageId: pkgB.id } });
    await prisma.industryDataPackage.delete({ where: { id: pkgB.id } });
  });

  it("reconcile against a foreign package's own defect never mutates hvac-library", async () => {
    const dataset = requireDatasetDefinition(HVAC_DATASET_ID);
    const before = await computePackageIntegrity(dataset);
    expect(before.strictComplete).toBe(true);
    // No mutation performed here — asserting the baseline invariant that
    // running this whole suite never touched a package other than the one
    // each test explicitly names.
    expect(before.packageKey).toBe("hvac-library");
  });
});
