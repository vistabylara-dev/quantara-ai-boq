import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PlatformRole, UserRole, MasterItemVersionStatus, MasterCatalogueImportJobStatus } from "@prisma/client";
import { prisma } from "../src/lib/db/prisma";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { requireDatasetDefinition } from "../src/lib/services/catalogue-dataset-registry";
import { activateDataset, isDatasetFullyActive } from "../src/lib/services/industry-package-activation-service";
import { registerAndDryRun, confirmExecution } from "../src/lib/services/master-catalogue-import-job-service";

/**
 * CATALOGUE-PHASE7-RECOVERY — regression coverage for the strict dataset
 * completeness predicate (isDatasetFullyActive). The predicate this
 * replaces treated any package with itemCount > 0 and a completed job as
 * "fully active," which let a partially-recovered dataset (e.g. a
 * cancelled job that partially imported) read as complete. Each test here
 * takes the real HVAC dataset to a genuinely complete state, then corrupts
 * exactly one fact the predicate is supposed to check and confirms it flips
 * to false — proving the predicate actually inspects that fact rather than
 * just the ones the old, weaker check already covered.
 */

const RUN_ID = `${Date.now()}-${process.pid}`;
const HVAC_DATASET_ID = "quantara-master-hvac-v1";

let companyId = "";
let ownerUserId = "";

function ownerActor(): PlatformActor {
  return { userId: ownerUserId, companyId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "DC Owner", email: `${RUN_ID}-owner@example.com` };
}

/**
 * Same guard as catalogue-storage-capacity-recovery.test.ts — this file's
 * beforeAll unconditionally clears HVAC catalogue data to establish a known
 * baseline before testing the completeness predicate against it. That must
 * never run against anything but an isolated local test database.
 */
function assertIsolatedLocalTestDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for this integration test");
  const parsed = new URL(databaseUrl);
  const isLocalHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  const isTestDatabase = /(?:test|e2e)/i.test(parsed.pathname);
  if (!isLocalHost || !isTestDatabase) {
    throw new Error("Refusing catalogue test cleanup outside an isolated local test database");
  }
}

async function hvacItemWhere() {
  const mechanical = await prisma.masterDiscipline.findUnique({ where: { key: "mechanical" } });
  return { disciplineId: mechanical?.id ?? "__no_mechanical_discipline__", itemCode: { startsWith: "HVAC-" } } as const;
}

async function cleanupHvacItems() {
  const where = await hvacItemWhere();
  const items = await prisma.masterItem.findMany({ where });
  for (const item of items) {
    await prisma.masterItemClassification.deleteMany({ where: { masterItemId: item.id } });
    await prisma.masterItemVersion.deleteMany({ where: { masterItemId: item.id } });
  }
  await prisma.masterItem.deleteMany({ where });
}

async function cleanupHvacPackage() {
  const pkg = await prisma.industryDataPackage.findUnique({ where: { key: "hvac-library" } });
  if (!pkg) return;
  await prisma.industryDataPackageItem.deleteMany({ where: { packageId: pkg.id } });
  await prisma.industryDataPackage.delete({ where: { id: pkg.id } });
}

async function driveHvacToComplete() {
  const dataset = requireDatasetDefinition(HVAC_DATASET_ID);
  let last = await activateDataset(ownerActor(), HVAC_DATASET_ID);
  while (!last.isComplete) {
    last = await activateDataset(ownerActor(), HVAC_DATASET_ID);
  }
  return dataset;
}

describe("CATALOGUE-PHASE7-RECOVERY: strict dataset completeness predicate (integration, real local Postgres, real HVAC dataset)", () => {
  beforeAll(async () => {
    assertIsolatedLocalTestDatabase();

    // Same fail-closed pattern as catalogue-storage-capacity-recovery.test.ts:
    // this suite drives the real HVAC dataset through a full recovery cycle
    // (partial job -> corrupted fact -> exact/expected), which only makes
    // sense starting from an empty HVAC state. Rather than assuming the
    // isolated test database is empty and silently wiping whatever's there,
    // refuse outright if pre-existing HVAC data survives from a prior run —
    // that's a signal something upstream didn't clean up correctly, not
    // something this file should paper over by deleting it anyway.
    const existingJob = await prisma.masterCatalogueImportJob.findFirst({ where: { datasetId: HVAC_DATASET_ID } });
    if (existingJob) {
      throw new Error(
        `Refusing to run: a MasterCatalogueImportJob (id=${existingJob.id}) already exists for ${HVAC_DATASET_ID} in ` +
          "this database, before this test run created anything of its own. This test cannot prove it's safe to " +
          "delete, so it is failing closed rather than guessing — investigate and clean up manually before rerunning.",
      );
    }
    const existingItem = await prisma.masterItem.findFirst({ where: await hvacItemWhere() });
    if (existingItem) {
      throw new Error(
        `Refusing to run: a MasterItem (id=${existingItem.id}, itemCode=${existingItem.itemCode}) already matches ` +
          "this test's HVAC scope, before this test run created anything of its own. This test cannot prove it's " +
          "safe to delete, so it is failing closed rather than guessing — investigate and clean up manually before rerunning.",
      );
    }
    const existingPackage = await prisma.industryDataPackage.findUnique({ where: { key: "hvac-library" } });
    if (existingPackage) {
      throw new Error(
        `Refusing to run: the "hvac-library" IndustryDataPackage (id=${existingPackage.id}) already exists, before ` +
          "this test run created anything of its own. This test cannot prove it's safe to delete, so it is failing " +
          "closed rather than guessing — investigate and clean up manually before rerunning.",
      );
    }

    const company = await prisma.company.create({ data: { legalName: `DC Co ${RUN_ID}`, tradeName: "DC Co", email: `dc-${RUN_ID}@example.com` } });
    companyId = company.id;
    const owner = await prisma.user.create({
      data: { companyId, email: `${RUN_ID}-owner@example.com`, passwordHash: `hash-${RUN_ID}`, fullName: "DC Owner", role: UserRole.COMPANY_OWNER, platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerUserId = owner.id;
  });

  afterAll(async () => {
    await cleanupHvacPackage();
    await cleanupHvacItems();
    await prisma.masterCatalogueImportJob.deleteMany({ where: { datasetId: HVAC_DATASET_ID } });
    if (ownerUserId) await prisma.masterCatalogueImportBatch.deleteMany({ where: { actorUserId: ownerUserId } });
    if (companyId) await prisma.user.deleteMany({ where: { companyId } });
    if (companyId) await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it("0/expected — no job at all is never fully active", async () => {
    const dataset = requireDatasetDefinition(HVAC_DATASET_ID);
    expect(await isDatasetFullyActive(dataset)).toBe(false);
  });

  it(
    "partial/expected — a dry-run confirmed but not yet batch-processed job is never fully active",
    async () => {
      const dataset = requireDatasetDefinition(HVAC_DATASET_ID);
      const dryRun = await registerAndDryRun(ownerActor(), HVAC_DATASET_ID);
      const confirmed = await confirmExecution(ownerActor(), dryRun.id);
      expect(confirmed.status).not.toBe(MasterCatalogueImportJobStatus.COMPLETED);
      expect(confirmed.processedRows).toBeLessThan(confirmed.totalRows);
      expect(await isDatasetFullyActive(dataset)).toBe(false);

      // Drain to completion so the next test starts from a clean, terminal job.
      let last = await activateDataset(ownerActor(), HVAC_DATASET_ID);
      while (!last.isComplete) {
        last = await activateDataset(ownerActor(), HVAC_DATASET_ID);
      }
    },
    150_000,
  );

  it(
    "exact/expected — a genuinely complete dataset (job, items, membership, published versions, active package) is fully active",
    async () => {
      const dataset = await driveHvacToComplete();
      expect(await isDatasetFullyActive(dataset)).toBe(true);
    },
    150_000,
  );

  it("package counter mismatch — package.itemCount out of sync with real membership rows is never fully active", async () => {
    const dataset = requireDatasetDefinition(HVAC_DATASET_ID);
    const pkg = await prisma.industryDataPackage.findUniqueOrThrow({ where: { key: "hvac-library" } });
    await prisma.industryDataPackage.update({ where: { id: pkg.id }, data: { itemCount: pkg.itemCount + 1 } });

    expect(await isDatasetFullyActive(dataset)).toBe(false);

    await prisma.industryDataPackage.update({ where: { id: pkg.id }, data: { itemCount: pkg.itemCount } });
    expect(await isDatasetFullyActive(dataset)).toBe(true);
  });

  it("incomplete explicit membership — a package missing one item's explicit membership row is never fully active, even though the item and its published version exist", async () => {
    const dataset = requireDatasetDefinition(HVAC_DATASET_ID);
    const pkg = await prisma.industryDataPackage.findUniqueOrThrow({ where: { key: "hvac-library" } });
    const oneMembership = await prisma.industryDataPackageItem.findFirstOrThrow({ where: { packageId: pkg.id } });

    await prisma.industryDataPackageItem.delete({ where: { id: oneMembership.id } });
    await prisma.industryDataPackage.update({ where: { id: pkg.id }, data: { itemCount: { decrement: 1 } } });

    expect(await isDatasetFullyActive(dataset)).toBe(false);

    await prisma.industryDataPackageItem.create({ data: { packageId: oneMembership.packageId, masterItemId: oneMembership.masterItemId, sortOrder: oneMembership.sortOrder } });
    await prisma.industryDataPackage.update({ where: { id: pkg.id }, data: { itemCount: { increment: 1 } } });
    expect(await isDatasetFullyActive(dataset)).toBe(true);
  });

  it("missing published version — an item with no PUBLISHED version is never fully active, even with correct counts and an ACTIVE package", async () => {
    const dataset = requireDatasetDefinition(HVAC_DATASET_ID);
    const pkg = await prisma.industryDataPackage.findUniqueOrThrow({ where: { key: "hvac-library" } });
    const oneMembership = await prisma.industryDataPackageItem.findFirstOrThrow({ where: { packageId: pkg.id } });
    const version = await prisma.masterItemVersion.findFirstOrThrow({ where: { masterItemId: oneMembership.masterItemId, status: MasterItemVersionStatus.PUBLISHED } });

    await prisma.masterItemVersion.update({ where: { id: version.id }, data: { status: MasterItemVersionStatus.DRAFT } });

    expect(await isDatasetFullyActive(dataset)).toBe(false);

    await prisma.masterItemVersion.update({ where: { id: version.id }, data: { status: MasterItemVersionStatus.PUBLISHED } });
    expect(await isDatasetFullyActive(dataset)).toBe(true);
  });

  it("active package but incomplete data — package status ACTIVE alone is not enough if no completed job exists", async () => {
    const dataset = requireDatasetDefinition(HVAC_DATASET_ID);
    const pkg = await prisma.industryDataPackage.findUniqueOrThrow({ where: { key: "hvac-library" } });
    expect(pkg.status).toBe("ACTIVE");

    // The dataset's items, membership, and published versions are all still
    // real and correct at this point — only the job history changes. Proves
    // the predicate actually requires job evidence, not just package/item
    // state that happens to look complete.
    const jobs = await prisma.masterCatalogueImportJob.findMany({ where: { datasetId: HVAC_DATASET_ID } });
    expect(jobs.length).toBeGreaterThan(0);
    await prisma.masterCatalogueImportJob.updateMany({ where: { datasetId: HVAC_DATASET_ID }, data: { status: MasterCatalogueImportJobStatus.CANCELLED } });

    expect(await isDatasetFullyActive(dataset)).toBe(false);
  });
});
