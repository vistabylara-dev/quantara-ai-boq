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

// CATALOGUE-PHASE7-STRICT-CLOSEOUT — teardown provenance. Only IDs this run
// itself produced are ever deleted; a record created by another concurrent
// process after beforeAll's residue check is never touched, even if it
// matches the same dataset/package scope.
const createdJobIds = new Set<string>();

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

/** Wraps activateDataset/registerAndDryRun calls so every job ID this run ever touches is tracked for surgical teardown. */
async function activateDatasetTracked() {
  const result = await activateDataset(ownerActor(), HVAC_DATASET_ID);
  createdJobIds.add(result.jobId);
  return result;
}

async function driveHvacToComplete() {
  const dataset = requireDatasetDefinition(HVAC_DATASET_ID);
  let last = await activateDatasetTracked();
  while (!last.isComplete) {
    last = await activateDatasetTracked();
  }
  return dataset;
}

/**
 * Deletes only what this test run created, derived from createdJobIds ->
 * their legacyBatchIds -> MasterItems whose sourceBatchId is one of those
 * batches. A foreign MasterItem sharing the same itemCode/discipline but a
 * different sourceBatchId (created by another process after beforeAll's
 * residue check) is never matched here and survives teardown intact. The
 * package itself is only deleted if, after removing this run's own
 * membership rows, zero membership rows remain — any surviving row means a
 * foreign process added to this package concurrently, and teardown fails
 * closed (leaves the package and reports it) rather than guessing.
 */
async function teardownTrackedHvacData(): Promise<void> {
  if (createdJobIds.size === 0) return;

  const trackedJobs = await prisma.masterCatalogueImportJob.findMany({
    where: { id: { in: [...createdJobIds] } },
    select: { id: true, legacyBatchId: true },
  });
  const trackedBatchIds = trackedJobs.map((j) => j.legacyBatchId).filter((id): id is string => Boolean(id));

  const trackedItems = trackedBatchIds.length > 0
    ? await prisma.masterItem.findMany({ where: { sourceBatchId: { in: trackedBatchIds } }, select: { id: true } })
    : [];
  const trackedItemIds = trackedItems.map((i) => i.id);

  if (trackedItemIds.length > 0) {
    await prisma.industryDataPackageItem.deleteMany({ where: { masterItemId: { in: trackedItemIds } } });
    await prisma.masterItemClassification.deleteMany({ where: { masterItemId: { in: trackedItemIds } } });
    await prisma.masterItemVersion.deleteMany({ where: { masterItemId: { in: trackedItemIds } } });
    await prisma.masterItem.deleteMany({ where: { id: { in: trackedItemIds } } });
  }

  await prisma.masterCatalogueImportJob.deleteMany({ where: { id: { in: [...createdJobIds] } } });
  if (trackedBatchIds.length > 0) {
    await prisma.masterCatalogueImportBatch.deleteMany({ where: { id: { in: trackedBatchIds } } });
  }

  const pkg = await prisma.industryDataPackage.findUnique({ where: { key: "hvac-library" } });
  if (pkg) {
    const remainingMembership = await prisma.industryDataPackageItem.count({ where: { packageId: pkg.id } });
    if (remainingMembership === 0) {
      await prisma.industryDataPackage.delete({ where: { id: pkg.id } });
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        `dataset-completeness.test.ts teardown: leaving "hvac-library" (id=${pkg.id}) in place — ` +
          `${remainingMembership} membership row(s) remain that this run did not create.`,
      );
    }
  }
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
    await teardownTrackedHvacData();
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
      createdJobIds.add(dryRun.id);
      const confirmed = await confirmExecution(ownerActor(), dryRun.id);
      expect(confirmed.status).not.toBe(MasterCatalogueImportJobStatus.COMPLETED);
      expect(confirmed.processedRows).toBeLessThan(confirmed.totalRows);
      expect(await isDatasetFullyActive(dataset)).toBe(false);

      // Drain to completion so the next test starts from a clean, terminal job.
      let last = await activateDatasetTracked();
      while (!last.isComplete) {
        last = await activateDatasetTracked();
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

  it("test teardown — a foreign concurrent record outside this run's tracked provenance survives teardown", async () => {
    // Simulates "another process created a matching record after beforeAll" —
    // a MasterItem sharing the HVAC discipline/prefix but with a distinct,
    // untracked sourceBatchId (a fabricated batch id this run never produced).
    const mechanical = await prisma.masterDiscipline.findUniqueOrThrow({ where: { key: "mechanical" } });
    const foreignBatch = await prisma.masterCatalogueImportBatch.create({
      data: {
        actorUserId: ownerUserId,
        disciplineId: mechanical.id,
        uploadedFileName: "foreign-concurrent-process.csv",
        checksum: `foreign-${RUN_ID}`,
        status: "EXECUTED",
        totalRows: 1,
      },
    });
    const foreignItem = await prisma.masterItem.create({
      data: {
        disciplineId: mechanical.id,
        categoryId: (await prisma.masterCategory.findFirstOrThrow({ where: { disciplineId: mechanical.id } })).id,
        itemCode: `HVAC-FOREIGN-${RUN_ID}`,
        name: "Foreign concurrent item",
        shortDescription: "Foreign concurrent item",
        fullDescription: "Foreign concurrent item",
        defaultUnit: "no",
        isPremium: true,
        sourceBatchId: foreignBatch.id,
      },
    });

    try {
      await teardownTrackedHvacData();

      const survived = await prisma.masterItem.findUnique({ where: { id: foreignItem.id } });
      expect(survived).not.toBeNull();
    } finally {
      // Real cleanup of the fixture this test itself introduced — in a
      // finally block, since a failed survival assertion would otherwise
      // leave this HVAC-prefixed MasterItem in place and trip the residue
      // guard on every later run of this suite.
      await prisma.masterItem.deleteMany({ where: { id: foreignItem.id } });
      await prisma.masterCatalogueImportBatch.delete({ where: { id: foreignBatch.id } });
    }
  });
});
