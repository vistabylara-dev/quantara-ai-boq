import { MasterCatalogueImportJobStatus, PlatformRole, Prisma, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { prisma } from "../src/lib/db/prisma";
import { DATABASE_STORAGE_CAPACITY_ERROR_CODE } from "../src/lib/db/database-capacity-error";
import {
  confirmExecution,
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

async function cleanTestState(): Promise<void> {
  assertIsolatedLocalTestDatabase();
  const jobs = await prisma.masterCatalogueImportJob.findMany({
    where: { datasetId: HVAC_DATASET_ID },
    select: { legacyBatchId: true },
  });
  const legacyBatchIds = jobs.map((job) => job.legacyBatchId).filter((id): id is string => Boolean(id));
  await prisma.masterCatalogueImportJob.deleteMany({ where: { datasetId: HVAC_DATASET_ID } });

  const itemWhere = await hvacItemWhere();
  const items = await prisma.masterItem.findMany({ where: itemWhere, select: { id: true } });
  const itemIds = items.map((item) => item.id);
  if (itemIds.length > 0) {
    await prisma.masterItemClassification.deleteMany({ where: { masterItemId: { in: itemIds } } });
    await prisma.masterItemVersion.deleteMany({ where: { masterItemId: { in: itemIds } } });
    await prisma.masterItem.deleteMany({ where: { id: { in: itemIds } } });
  }
  if (legacyBatchIds.length > 0) {
    await prisma.masterCatalogueImportBatch.deleteMany({ where: { id: { in: legacyBatchIds } } });
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
    await cleanTestState();
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
});
