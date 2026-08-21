import {
  MasterCatalogueImportJobStatus,
  MasterCatalogueImportStatus,
  MasterClassificationSystem,
  MasterItemVersionStatus,
  PlatformRole,
  Prisma,
  UserRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { prisma } from "../src/lib/db/prisma";
import { DATABASE_STORAGE_CAPACITY_ERROR_CODE } from "../src/lib/db/database-capacity-error";
import {
  confirmExecution,
  itemCodesUnambiguouslyInSlice,
  processNextBatch,
  registerAndDryRun,
  STALE_IMPORT_RUNNING_MS,
} from "../src/lib/services/master-catalogue-import-job-service";

const HVAC_DATASET_ID = "quantara-master-hvac-v1";
const RUN_ID = `capacity-${Date.now()}-${process.pid}`;

let companyId = "";
let ownerUserId = "";

function ownerActor(): PlatformActor {
  return {
    userId: ownerUserId,
    companyId,
    platformRole: PlatformRole.PLATFORM_OWNER,
    fullName: "Capacity Test Owner",
    email: `${RUN_ID}@example.com`,
  };
}

async function hvacItemWhere() {
  const discipline = await prisma.masterDiscipline.findUniqueOrThrow({ where: { key: "mechanical" } });
  return { disciplineId: discipline.id, itemCode: { startsWith: "HVAC-" } } as const;
}

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

/**
 * CodeRabbit finding — the previous version of this helper scoped every
 * DELETE by the global HVAC_DATASET_ID constant or an itemCode prefix, both
 * shared with production and with every other test file that touches this
 * same dataset (e.g. tests/catalogue-prod-activate.test.ts). That could
 * delete baseline fixtures or another test's records outright, not just this
 * run's own. Every DELETE here is now scoped strictly by provenance back to
 * this run's own uniquely-created ownerUserId — never by datasetId, never by
 * itemCode prefix:
 *   MasterCatalogueImportJob.actorUserId === ownerUserId
 *   MasterCatalogueImportBatch.actorUserId === ownerUserId
 *   MasterItem.sourceBatchId -> one of the batches above
 *   MasterItemVersion / MasterItemClassification -> one of the items above
 * A record with no provable path back to ownerUserId is never touched, no
 * matter what dataset it claims or what its itemCode looks like.
 */
async function cleanTestState(): Promise<void> {
  assertIsolatedLocalTestDatabase();
  if (!ownerUserId) return; // nothing can be owned by this run before its own user exists

  const [ownedJobs, ownedBatches] = await Promise.all([
    prisma.masterCatalogueImportJob.findMany({ where: { actorUserId: ownerUserId }, select: { legacyBatchId: true } }),
    prisma.masterCatalogueImportBatch.findMany({ where: { actorUserId: ownerUserId }, select: { id: true } }),
  ]);
  const ownedBatchIds = Array.from(
    new Set([
      ...ownedJobs.map((job) => job.legacyBatchId).filter((id): id is string => Boolean(id)),
      ...ownedBatches.map((batch) => batch.id),
    ]),
  );

  const ownedItems = ownedBatchIds.length > 0
    ? await prisma.masterItem.findMany({ where: { sourceBatchId: { in: ownedBatchIds } }, select: { id: true } })
    : [];
  const ownedItemIds = ownedItems.map((item) => item.id);

  if (ownedItemIds.length > 0) {
    await prisma.masterItemClassification.deleteMany({ where: { masterItemId: { in: ownedItemIds } } });
    await prisma.masterItemVersion.deleteMany({ where: { masterItemId: { in: ownedItemIds } } });
    await prisma.masterItem.deleteMany({ where: { id: { in: ownedItemIds } } });
  }
  await prisma.masterCatalogueImportJob.deleteMany({ where: { actorUserId: ownerUserId } });
  if (ownedBatchIds.length > 0) {
    await prisma.masterCatalogueImportBatch.deleteMany({ where: { id: { in: ownedBatchIds } } });
  }
}

/**
 * CodeRabbit finding — the old beforeAll called the (then-unsafe) cleanTestState()
 * to manufacture a clean slate before this run's own fixtures existed. If a prior
 * run crashed before reaching its own afterAll, or a baseline fixture, or another
 * process left real HVAC catalogue data in this database, this test has no way to
 * prove it's safe to delete — so it fails closed with a clear, actionable error
 * instead of either silently wiping unknown data or silently running on top of it.
 */
async function assertNoUnrelatedHvacResidue(): Promise<void> {
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
}

describe("catalogue import storage-capacity recovery", () => {
  beforeAll(async () => {
    assertIsolatedLocalTestDatabase();
    await prisma.masterDiscipline.upsert({
      where: { key: "mechanical" },
      update: {},
      create: { key: "mechanical", name: "Mechanical" },
    });
    await assertNoUnrelatedHvacResidue();
    const company = await prisma.company.create({
      data: { legalName: `Capacity Co ${RUN_ID}`, tradeName: "Capacity Co", email: `${RUN_ID}@example.com` },
    });
    companyId = company.id;
    const owner = await prisma.user.create({
      data: {
        companyId,
        email: `${RUN_ID}-owner@example.com`,
        passwordHash: `hash-${RUN_ID}`,
        fullName: "Capacity Test Owner",
        role: UserRole.COMPANY_OWNER,
        platformRole: PlatformRole.PLATFORM_OWNER,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    ownerUserId = owner.id;
  }, 60_000);

  afterAll(async () => {
    await cleanTestState();
    if (companyId) {
      await prisma.user.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }, 60_000);

  it("keeps a 53100-failed claim recoverable and retries one batch without duplicate records", async () => {
    const dryRun = await registerAndDryRun(ownerActor(), HVAC_DATASET_ID);
    const armed = await confirmExecution(ownerActor(), dryRun.id);
    expect(armed.status).toBe(MasterCatalogueImportJobStatus.PAUSED);

    const productionCapacityError = new Prisma.PrismaClientUnknownRequestError(
      'ConnectorError(ConnectorError { kind: QueryError(PostgresError { code: "53100", message: "could not extend file because project size limit (512 MB) has been exceeded" }) })',
      { clientVersion: "6.19.3" },
    );
    const masterItemDelegate = prisma.masterItem;
    const originalCreate = masterItemDelegate.create.bind(masterItemDelegate);
    const createSpy = vi.spyOn(masterItemDelegate, "create").mockRejectedValueOnce(productionCapacityError);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      await expect(processNextBatch(ownerActor(), dryRun.id)).rejects.toMatchObject({
        code: DATABASE_STORAGE_CAPACITY_ERROR_CODE,
        status: 507,
      });
    } finally {
      createSpy.mockRestore();
      // Prisma's generated delegate is proxy-backed; Vitest's restore deletes
      // the spied own property instead of reinstating the callable proxy
      // method, so restore the captured method explicitly for the retry.
      Object.defineProperty(masterItemDelegate, "create", {
        value: originalCreate,
        configurable: true,
        writable: true,
      });
      consoleSpy.mockRestore();
    }

    const blocked = await prisma.masterCatalogueImportJob.findUniqueOrThrow({ where: { id: dryRun.id } });
    expect(blocked).toMatchObject({
      status: MasterCatalogueImportJobStatus.IMPORT_RUNNING,
      currentRowCursor: 0,
      processedRows: 0,
      insertedCount: 0,
      itemsCreated: 0,
      lastErrorMessage: null,
    });
    expect(await prisma.masterItem.count({ where: await hvacItemWhere() })).toBe(0);
    await expect(processNextBatch(ownerActor(), dryRun.id)).rejects.toMatchObject({ code: "JOB_BUSY" });

    await prisma.masterCatalogueImportJob.update({
      where: { id: dryRun.id },
      data: { updatedAt: new Date(Date.now() - STALE_IMPORT_RUNNING_MS - 5_000) },
    });
    const recovered = await processNextBatch(ownerActor(), dryRun.id);
    expect(recovered.processedRows).toBe(recovered.batchSize);
    expect(recovered.insertedCount).toBe(recovered.batchSize);
    expect(await prisma.masterItem.count({ where: await hvacItemWhere() })).toBe(recovered.batchSize);
    expect(await prisma.masterItemVersion.count({ where: { masterItem: await hvacItemWhere() } })).toBe(recovered.batchSize);
    expect(await prisma.masterItemClassification.count({ where: { masterItem: await hvacItemWhere() } })).toBe(recovered.classificationsCreated);
  }, 120_000);

  /**
   * CodeRabbit Major finding #1 — the case the test above does NOT cover: the
   * existing test fails on the very FIRST masterItem.create() call, so zero
   * rows ever persist before the checkpoint is left stale. In the real
   * incident, SQLSTATE 53100 can strike after one or more rows have already
   * fully persisted (MasterItem + MasterItemVersion + classifications) but
   * before the batch's checkpoint/counter update runs. This test forces
   * exactly that: a few rows complete for real, then the failure hits
   * mid-batch, then recovery must reconcile — not duplicate, not undercount.
   */
  it("recovers a batch that already persisted several full rows before a 53100 failure, with no duplicates and reconciled counters", async () => {
    // The test above leaves its job PAUSED (never drained or cancelled) rather than resetting
    // state, so this test must not assume a clean slate.
    await cleanTestState();

    const dryRun = await registerAndDryRun(ownerActor(), HVAC_DATASET_ID);
    const armed = await confirmExecution(ownerActor(), dryRun.id);
    expect(armed.status).toBe(MasterCatalogueImportJobStatus.PAUSED);

    const productionCapacityError = new Prisma.PrismaClientUnknownRequestError(
      'ConnectorError(ConnectorError { kind: QueryError(PostgresError { code: "53100", message: "could not extend file because project size limit (512 MB) has been exceeded" }) })',
      { clientVersion: "6.19.3" },
    );

    const ROWS_TO_PERSIST_BEFORE_FAILURE = 3;
    const masterItemDelegate = prisma.masterItem;
    const originalCreate = masterItemDelegate.create.bind(masterItemDelegate);
    let createCallCount = 0;
    // Prisma's generated delegate type is too complex a generic overload for vi.spyOn's
    // mockImplementation to accept directly; the existing test above works around the same
    // proxy-backed delegate issue by using mockRejectedValueOnce instead.
    const createSpy = vi.spyOn(masterItemDelegate, "create").mockImplementation((async (args: any) => {
      createCallCount += 1;
      // Let the first few rows persist for real (item + version + classifications, exactly
      // like a genuine successful insert), then fail exactly like the production incident —
      // mid-batch, with real rows already on disk.
      if (createCallCount > ROWS_TO_PERSIST_BEFORE_FAILURE) throw productionCapacityError;
      return originalCreate(args);
    }) as unknown as typeof originalCreate);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      await expect(processNextBatch(ownerActor(), dryRun.id)).rejects.toMatchObject({
        code: DATABASE_STORAGE_CAPACITY_ERROR_CODE,
        status: 507,
      });
    } finally {
      createSpy.mockRestore();
      Object.defineProperty(masterItemDelegate, "create", {
        value: originalCreate,
        configurable: true,
        writable: true,
      });
      consoleSpy.mockRestore();
    }

    // Real, verifiable partial persistence — proves this isn't the "nothing wrote yet" case
    // the test above already covers.
    expect(await prisma.masterItem.count({ where: await hvacItemWhere() })).toBe(ROWS_TO_PERSIST_BEFORE_FAILURE);
    expect(await prisma.masterItemVersion.count({ where: { masterItem: await hvacItemWhere() } })).toBe(ROWS_TO_PERSIST_BEFORE_FAILURE);

    // The exact inconsistency CodeRabbit flagged: real rows exist, but the job checkpoint
    // doesn't know it yet.
    const blocked = await prisma.masterCatalogueImportJob.findUniqueOrThrow({ where: { id: dryRun.id } });
    expect(blocked).toMatchObject({
      status: MasterCatalogueImportJobStatus.IMPORT_RUNNING,
      currentRowCursor: 0,
      processedRows: 0,
      insertedCount: 0,
      itemsCreated: 0,
      versionsCreated: 0,
      classificationsCreated: 0,
      lastErrorMessage: null,
    });

    // PR12's protection must still hold: a fresh IMPORT_RUNNING claim cannot be stolen.
    await expect(processNextBatch(ownerActor(), dryRun.id)).rejects.toMatchObject({ code: "JOB_BUSY" });

    // Simulate the claim going stale (capacity fixed, owner retries later).
    await prisma.masterCatalogueImportJob.update({
      where: { id: dryRun.id },
      data: { updatedAt: new Date(Date.now() - STALE_IMPORT_RUNNING_MS - 5_000) },
    });

    const recovered = await processNextBatch(ownerActor(), dryRun.id);
    expect(recovered.status).toBe("PAUSED");
    // Correct cursor advancement: the full batch, not a partial one (processedRows and
    // currentRowCursor are always set to the same value — see processNextBatch's update call
    // — but only processedRows is exposed on this DTO).
    expect(recovered.processedRows).toBe(recovered.batchSize);

    const finalItemCount = await prisma.masterItem.count({ where: await hvacItemWhere() });
    const finalVersionCount = await prisma.masterItemVersion.count({ where: { masterItem: await hvacItemWhere() } });
    const finalClassificationCount = await prisma.masterItemClassification.count({ where: { masterItem: await hvacItemWhere() } });

    // No duplicate MasterItem: exactly one per row in the batch, not batchSize + the 3 that
    // already existed.
    expect(finalItemCount).toBe(recovered.batchSize);
    // No duplicate MasterItemVersion, and none dangling/missing for the 3 rows that already
    // had one before recovery ran.
    expect(finalVersionCount).toBe(recovered.batchSize);

    // The actual fix: the job's own counters now match database reality exactly, including
    // the rows the crashed attempt already wrote — without this reconciliation, insertedCount/
    // itemsCreated would silently read (batchSize - 3) instead.
    expect(recovered.insertedCount).toBe(recovered.batchSize);
    expect(recovered.itemsCreated).toBe(recovered.batchSize);
    expect(recovered.versionsCreated).toBe(finalVersionCount);
    expect(recovered.classificationsCreated).toBe(finalClassificationCount);

    // CodeRabbit Finding B — every processed row must contribute to exactly one outcome
    // bucket. Without redistributing a reconciled row's this-pass outcome (update/unchanged)
    // into "inserted", this sum could exceed processedRows.
    expect(recovered.insertedCount + recovered.updatedCount + recovered.unchangedCount).toBe(recovered.processedRows);

    // Successful continued processing after recovery, exactly like a normal run.
    let job = recovered;
    while (job.status === "PAUSED") {
      job = await processNextBatch(ownerActor(), dryRun.id);
    }
    expect(["COMPLETED", "COMPLETED_WITH_WARNINGS"]).toContain(job.status);

    const totalItemCount = await prisma.masterItem.count({ where: await hvacItemWhere() });
    const totalVersionCount = await prisma.masterItemVersion.count({ where: { masterItem: await hvacItemWhere() } });
    expect(totalItemCount).toBe(891); // full HVAC dataset, no duplicates anywhere across the whole run
    expect(totalVersionCount).toBe(891); // no dangling/duplicate versions anywhere across the whole run
    expect(job.itemsCreated).toBe(891);
    expect(job.versionsCreated).toBe(totalVersionCount);
    // The partition invariant holds across the ENTIRE job's lifetime too, not just the one
    // reconciled batch.
    expect(job.insertedCount + job.updatedCount + job.unchangedCount).toBe(job.processedRows);
  }, 120_000);

  /**
   * CodeRabbit Major finding #2 — proves cleanTestState() deletes only records
   * provably owned by this run's own ownerUserId, never anything that merely
   * shares HVAC_DATASET_ID or an "HVAC-" itemCode prefix. Simulates a
   * completely separate process/test owning real HVAC catalogue data in this
   * same database (its own company, user, category, batch, job, item,
   * version, and classification) and proves cleanup leaves every one of them
   * untouched while still fully removing this run's own records.
   */
  it("cleanup deletes only this run's own records — unrelated HVAC jobs, items, versions, and classifications survive", async () => {
    await cleanTestState(); // start from a known state regardless of prior test ordering

    // CodeRabbit Finding C — every fixture handle is declared before try and created INSIDE
    // it, so a failure partway through setup leaves finally able to clean up exactly what was
    // actually created, never silently orphaning the rest (see the dedicated setup-failure
    // test below for a direct proof of this).
    let unrelatedCompany: Awaited<ReturnType<typeof prisma.company.create>> | undefined;
    let unrelatedUser: Awaited<ReturnType<typeof prisma.user.create>> | undefined;
    let unrelatedCategory: Awaited<ReturnType<typeof prisma.masterCategory.create>> | undefined;
    let unrelatedBatch: Awaited<ReturnType<typeof prisma.masterCatalogueImportBatch.create>> | undefined;
    let unrelatedJob: Awaited<ReturnType<typeof prisma.masterCatalogueImportJob.create>> | undefined;
    let unrelatedItem: Awaited<ReturnType<typeof prisma.masterItem.create>> | undefined;
    let unrelatedVersion: Awaited<ReturnType<typeof prisma.masterItemVersion.create>> | undefined;
    let unrelatedClassification: Awaited<ReturnType<typeof prisma.masterItemClassification.create>> | undefined;

    try {
      unrelatedCompany = await prisma.company.create({
        data: { legalName: `Unrelated Co ${RUN_ID}`, tradeName: "Unrelated Co", email: `unrelated-${RUN_ID}@example.com` },
      });
      unrelatedUser = await prisma.user.create({
        data: {
          companyId: unrelatedCompany.id,
          email: `unrelated-${RUN_ID}-owner@example.com`,
          passwordHash: `hash-unrelated-${RUN_ID}`,
          fullName: "Unrelated Owner",
          role: UserRole.COMPANY_OWNER,
          platformRole: PlatformRole.PLATFORM_OWNER,
          isActive: true,
          emailVerifiedAt: new Date(),
        },
      });
      const mechanical = await prisma.masterDiscipline.upsert({
        where: { key: "mechanical" },
        update: {},
        create: { key: "mechanical", name: "Mechanical" },
      });
      unrelatedCategory = await prisma.masterCategory.create({
        data: { disciplineId: mechanical.id, key: `unrelated-${RUN_ID}`, name: "Unrelated Category", path: `unrelated-${RUN_ID}`, depth: 0 },
      });
      unrelatedBatch = await prisma.masterCatalogueImportBatch.create({
        data: {
          actorUserId: unrelatedUser.id,
          disciplineId: mechanical.id,
          uploadedFileName: `unrelated-${RUN_ID}.csv`,
          checksum: `unrelated-checksum-${RUN_ID}`,
          status: MasterCatalogueImportStatus.EXECUTED,
          totalRows: 1,
        },
      });
      unrelatedJob = await prisma.masterCatalogueImportJob.create({
        data: {
          datasetId: HVAC_DATASET_ID,
          datasetVersion: "1",
          actorUserId: unrelatedUser.id,
          disciplineId: mechanical.id,
          legacyBatchId: unrelatedBatch.id,
          status: MasterCatalogueImportJobStatus.COMPLETED,
          sourceChecksum: `unrelated-source-checksum-${RUN_ID}`,
          manifestJson: [],
          totalRows: 1,
          processedRows: 1,
        },
      });
      unrelatedItem = await prisma.masterItem.create({
        data: {
          disciplineId: mechanical.id,
          categoryId: unrelatedCategory.id,
          itemCode: `HVAC-UNRELATED-${RUN_ID}`,
          name: "Unrelated fixture item",
          shortDescription: "Unrelated fixture item",
          fullDescription: "Unrelated fixture item",
          defaultUnit: "no.",
          sourceBatchId: unrelatedBatch.id,
        },
      });
      unrelatedVersion = await prisma.masterItemVersion.create({
        data: {
          masterItemId: unrelatedItem.id,
          versionNumber: 1,
          status: MasterItemVersionStatus.PUBLISHED,
          effectiveDate: new Date(),
          name: "Unrelated fixture item",
          shortDescription: "Unrelated fixture item",
          fullDescription: "Unrelated fixture item",
          primaryUnit: "no.",
          createdByUserId: unrelatedUser.id,
        },
      });
      unrelatedClassification = await prisma.masterItemClassification.create({
        data: {
          masterItemId: unrelatedItem.id,
          system: MasterClassificationSystem.MASTERFORMAT_2020,
          code: `UNRELATED-${RUN_ID}`,
          label: "Unrelated",
          source: "unrelated-fixture",
        },
      });

      // A real job/batch/items owned by THIS run, to prove cleanup actually removes what it
      // should while leaving the unrelated fixture above alone.
      const dryRun = await registerAndDryRun(ownerActor(), HVAC_DATASET_ID);
      await confirmExecution(ownerActor(), dryRun.id);
      const afterOneBatch = await processNextBatch(ownerActor(), dryRun.id);
      expect(afterOneBatch.insertedCount).toBeGreaterThan(0);
      const ownedJobRaw = await prisma.masterCatalogueImportJob.findUniqueOrThrow({ where: { id: dryRun.id } });
      const ownedBatchId = ownedJobRaw.legacyBatchId;
      expect(ownedBatchId).not.toBeNull();
      const ownedItemCountBeforeCleanup = await prisma.masterItem.count({ where: { sourceBatchId: ownedBatchId } });
      expect(ownedItemCountBeforeCleanup).toBeGreaterThan(0);

      await cleanTestState();

      // A + F: this run's own job, batch, and items are fully gone — nothing left behind.
      expect(await prisma.masterCatalogueImportJob.findUnique({ where: { id: dryRun.id } })).toBeNull();
      expect(await prisma.masterCatalogueImportBatch.findUnique({ where: { id: ownedBatchId! } })).toBeNull();
      expect(await prisma.masterItem.count({ where: { sourceBatchId: ownedBatchId } })).toBe(0);

      // B/C/D: the unrelated fixture — different owner, same dataset/discipline/itemCode
      // prefix — survives completely untouched.
      expect(await prisma.masterItem.findUnique({ where: { id: unrelatedItem.id } })).not.toBeNull();
      expect(await prisma.masterCatalogueImportJob.findUnique({ where: { id: unrelatedJob.id } })).not.toBeNull();
      expect(await prisma.masterCatalogueImportBatch.findUnique({ where: { id: unrelatedBatch.id } })).not.toBeNull();
      expect(await prisma.masterItemVersion.findUnique({ where: { id: unrelatedVersion.id } })).not.toBeNull();
      expect(await prisma.masterItemClassification.findUnique({ where: { id: unrelatedClassification.id } })).not.toBeNull();
    } finally {
      // This test manufactured the unrelated fixture itself, so it — not the shared
      // cleanTestState(), which must never be able to touch it — is responsible for removing
      // it, leaving the database clean for whatever runs next. Only delete handles that were
      // actually created (Finding C) — a failure partway through the try block must not
      // attempt to delete something that was never created.
      if (unrelatedClassification) await prisma.masterItemClassification.deleteMany({ where: { id: unrelatedClassification.id } });
      if (unrelatedVersion) await prisma.masterItemVersion.deleteMany({ where: { id: unrelatedVersion.id } });
      if (unrelatedItem) await prisma.masterItem.deleteMany({ where: { id: unrelatedItem.id } });
      if (unrelatedJob) await prisma.masterCatalogueImportJob.deleteMany({ where: { id: unrelatedJob.id } });
      if (unrelatedBatch) await prisma.masterCatalogueImportBatch.deleteMany({ where: { id: unrelatedBatch.id } });
      if (unrelatedCategory) await prisma.masterCategory.deleteMany({ where: { id: unrelatedCategory.id } });
      if (unrelatedUser) await prisma.user.deleteMany({ where: { id: unrelatedUser.id } });
      if (unrelatedCompany) await prisma.company.deleteMany({ where: { id: unrelatedCompany.id } });
    }
  }, 60_000);

  /**
   * CodeRabbit Final Re-Review, Finding C — proves the fix directly: force a failure on the
   * LAST fixture-creation call (after company/user/category/batch/job/item/version already
   * succeeded) and confirm nothing from any of those earlier steps is left behind. If cleanup
   * correctly handles the "failed at the very last step" case, it trivially handles failing
   * at any earlier step too, since strictly fewer records would exist to clean up.
   */
  it("a failure partway through unrelated-fixture setup leaves no residue", async () => {
    const setupRunId = `${RUN_ID}-setupfail`;
    let failCompany: Awaited<ReturnType<typeof prisma.company.create>> | undefined;
    let failUser: Awaited<ReturnType<typeof prisma.user.create>> | undefined;
    let failCategory: Awaited<ReturnType<typeof prisma.masterCategory.create>> | undefined;
    let failBatch: Awaited<ReturnType<typeof prisma.masterCatalogueImportBatch.create>> | undefined;
    let failJob: Awaited<ReturnType<typeof prisma.masterCatalogueImportJob.create>> | undefined;
    let failItem: Awaited<ReturnType<typeof prisma.masterItem.create>> | undefined;
    let failVersion: Awaited<ReturnType<typeof prisma.masterItemVersion.create>> | undefined;

    const classificationDelegate = prisma.masterItemClassification;
    const originalClassificationCreate = classificationDelegate.create.bind(classificationDelegate);
    const failureSpy = vi.spyOn(classificationDelegate, "create").mockRejectedValueOnce(new Error("simulated setup failure"));

    try {
      await expect(
        (async () => {
          failCompany = await prisma.company.create({
            data: { legalName: `SetupFail Co ${setupRunId}`, tradeName: "SetupFail Co", email: `${setupRunId}@example.com` },
          });
          failUser = await prisma.user.create({
            data: {
              companyId: failCompany.id,
              email: `${setupRunId}-owner@example.com`,
              passwordHash: `hash-${setupRunId}`,
              fullName: "SetupFail Owner",
              role: UserRole.COMPANY_OWNER,
              platformRole: PlatformRole.PLATFORM_OWNER,
              isActive: true,
              emailVerifiedAt: new Date(),
            },
          });
          const mechanical = await prisma.masterDiscipline.upsert({
            where: { key: "mechanical" },
            update: {},
            create: { key: "mechanical", name: "Mechanical" },
          });
          failCategory = await prisma.masterCategory.create({
            data: { disciplineId: mechanical.id, key: `setupfail-${setupRunId}`, name: "SetupFail Category", path: `setupfail-${setupRunId}`, depth: 0 },
          });
          failBatch = await prisma.masterCatalogueImportBatch.create({
            data: {
              actorUserId: failUser.id,
              disciplineId: mechanical.id,
              uploadedFileName: `setupfail-${setupRunId}.csv`,
              checksum: `setupfail-checksum-${setupRunId}`,
              status: MasterCatalogueImportStatus.EXECUTED,
              totalRows: 1,
            },
          });
          failJob = await prisma.masterCatalogueImportJob.create({
            data: {
              datasetId: HVAC_DATASET_ID,
              datasetVersion: "1",
              actorUserId: failUser.id,
              disciplineId: mechanical.id,
              legacyBatchId: failBatch.id,
              status: MasterCatalogueImportJobStatus.COMPLETED,
              sourceChecksum: `setupfail-source-${setupRunId}`,
              manifestJson: [],
              totalRows: 1,
              processedRows: 1,
            },
          });
          failItem = await prisma.masterItem.create({
            data: {
              disciplineId: mechanical.id,
              categoryId: failCategory.id,
              itemCode: `HVAC-SETUPFAIL-${setupRunId}`,
              name: "SetupFail fixture item",
              shortDescription: "SetupFail fixture item",
              fullDescription: "SetupFail fixture item",
              defaultUnit: "no.",
              sourceBatchId: failBatch.id,
            },
          });
          failVersion = await prisma.masterItemVersion.create({
            data: {
              masterItemId: failItem.id,
              versionNumber: 1,
              status: MasterItemVersionStatus.PUBLISHED,
              effectiveDate: new Date(),
              name: "SetupFail fixture item",
              shortDescription: "SetupFail fixture item",
              fullDescription: "SetupFail fixture item",
              primaryUnit: "no.",
              createdByUserId: failUser.id,
            },
          });
          // Mocked to throw once — simulates the setup failing on its very last step.
          await prisma.masterItemClassification.create({
            data: {
              masterItemId: failItem.id,
              system: MasterClassificationSystem.MASTERFORMAT_2020,
              code: `SETUPFAIL-${setupRunId}`,
              label: "SetupFail",
              source: "setupfail-fixture",
            },
          });
        })(),
      ).rejects.toThrow("simulated setup failure");
    } finally {
      failureSpy.mockRestore();
      Object.defineProperty(classificationDelegate, "create", { value: originalClassificationCreate, configurable: true, writable: true });

      if (failVersion) await prisma.masterItemVersion.deleteMany({ where: { id: failVersion.id } });
      if (failItem) await prisma.masterItem.deleteMany({ where: { id: failItem.id } });
      if (failJob) await prisma.masterCatalogueImportJob.deleteMany({ where: { id: failJob.id } });
      if (failBatch) await prisma.masterCatalogueImportBatch.deleteMany({ where: { id: failBatch.id } });
      if (failCategory) await prisma.masterCategory.deleteMany({ where: { id: failCategory.id } });
      if (failUser) await prisma.user.deleteMany({ where: { id: failUser.id } });
      if (failCompany) await prisma.company.deleteMany({ where: { id: failCompany.id } });
    }

    // Prove nothing survives from ANY step of the failed setup — company, user, category,
    // batch, job, and MasterItem (which cascades to its own version) are all gone.
    expect(await prisma.company.findFirst({ where: { legalName: `SetupFail Co ${setupRunId}` } })).toBeNull();
    expect(await prisma.user.findFirst({ where: { email: `${setupRunId}-owner@example.com` } })).toBeNull();
    expect(await prisma.masterCategory.findFirst({ where: { key: `setupfail-${setupRunId}` } })).toBeNull();
    expect(await prisma.masterCatalogueImportBatch.findFirst({ where: { uploadedFileName: `setupfail-${setupRunId}.csv` } })).toBeNull();
    expect(await prisma.masterCatalogueImportJob.findFirst({ where: { sourceChecksum: `setupfail-source-${setupRunId}` } })).toBeNull();
    expect(await prisma.masterItem.findFirst({ where: { itemCode: `HVAC-SETUPFAIL-${setupRunId}` } })).toBeNull();
  }, 60_000);
});

/**
 * CodeRabbit Final Re-Review, Finding A — pure unit coverage for the exact
 * mechanism the reconciliation guard relies on. No dataset registered today
 * actually contains a duplicate itemCode, so this can't be exercised through
 * a real end-to-end import without either fabricating CSV content (not
 * allowed) or fragile module mocking — a plain unit test on the extracted
 * pure function proves the guard correctly regardless.
 */
describe("itemCodesUnambiguouslyInSlice (pure, no database)", () => {
  it("excludes an itemCode that also appears outside the current slice, even though it's present in the slice", () => {
    const allRows = [
      { itemCode: "A" }, // row 0 — appears again below, outside any slice under test
      { itemCode: "B" }, // row 1 — unique
      { itemCode: "C" }, // row 2 — unique
      { itemCode: "A" }, // row 3 — same code as row 0, in a LATER batch
    ];
    // Simulate "batch 2" = rows [1, 3): itemCodes ["B", "C"] are genuinely unique to this
    // slice; "A" would also need to be excluded if it were part of this slice, since it
    // occurs at both row 0 (a different, already-completed batch) and row 3.
    const sliceItemCodes = ["B", "C"];
    expect(itemCodesUnambiguouslyInSlice(allRows, sliceItemCodes)).toEqual(["B", "C"]);

    // Now simulate a slice that DOES include the duplicated code alongside unique ones —
    // this is the exact scenario CodeRabbit flagged: "A" must never be treated as safe to
    // reconcile, because a database match on itemCode="A" could belong to the OTHER
    // occurrence (a different, already-counted batch), not this slice's own row.
    const sliceIncludingDuplicate = ["A", "B"];
    expect(itemCodesUnambiguouslyInSlice(allRows, sliceIncludingDuplicate)).toEqual(["B"]);
    expect(itemCodesUnambiguouslyInSlice(allRows, sliceIncludingDuplicate)).not.toContain("A");
  });

  it("returns every itemCode in the slice when none repeat anywhere in the dataset (the normal, current-production case)", () => {
    const allRows = [{ itemCode: "X" }, { itemCode: "Y" }, { itemCode: "Z" }];
    expect(itemCodesUnambiguouslyInSlice(allRows, ["X", "Y", "Z"])).toEqual(["X", "Y", "Z"]);
  });

  it("returns an empty array for an empty slice", () => {
    expect(itemCodesUnambiguouslyInSlice([{ itemCode: "A" }, { itemCode: "A" }], [])).toEqual([]);
  });
});

/**
 * CodeRabbit Final Re-Review, Finding D — the nitpick suggests capturing the
 * original property descriptor before spying and letting mockRestore()
 * restore normally, only falling back to manual restoration "if needed."
 * This proves it IS needed for this specific Prisma delegate: Prisma's
 * generated client exposes model methods as Proxy-trapped accessors, not
 * plain own-value properties (getOwnPropertyDescriptor on the underlying
 * delegate reports the same shape whether or not a spy is active), and
 * Vitest's mockRestore() leaves the spied property as an own `undefined`
 * value rather than reinstating the callable method — breaking every
 * subsequent call in the same process. Capturing "the original descriptor"
 * wouldn't help either, since that descriptor never reflects the real
 * underlying accessor. This documents why the manual bind-and-reassign
 * workaround used above is necessary, not just stylistic.
 */
describe("Prisma delegate restoration after vi.spyOn (Finding D)", () => {
  it("mockRestore() alone leaves a spied Prisma delegate method uncallable", async () => {
    const delegate = prisma.masterItem;
    const originalCreate = delegate.create.bind(delegate);

    const spy = vi.spyOn(delegate, "create").mockRejectedValue(new Error("mocked for this diagnostic only"));
    spy.mockRestore();

    expect(typeof delegate.create).toBe("undefined");

    // Restore it for real so this test doesn't leave the shared Prisma client broken for
    // whatever runs next in this process.
    Object.defineProperty(delegate, "create", { value: originalCreate, configurable: true, writable: true });
    expect(typeof delegate.create).toBe("function");
  });
});
