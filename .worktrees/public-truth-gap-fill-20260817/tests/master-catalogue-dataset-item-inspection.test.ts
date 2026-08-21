import { MasterCatalogueImportStatus, MasterItemStatus, PlatformRole, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { PermissionDeniedError } from "../src/lib/errors/app-error";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { inspectDatasetProductionItems } from "../src/lib/services/master-catalogue-import-job-service";

/**
 * CATALOGUE-COMMERCIAL Checkpoint 1A — read-only inspection of a
 * registered dataset's existing production MasterItem rows and their raw
 * provenance (sourceBatchId), added after production evidence showed
 * MasterItems existing for a dataset with no MasterCatalogueImportJob
 * record at all — i.e. items that did not come through this dataset's own
 * governed pipeline. This proves the inspection surfaces exactly that
 * distinction (items with a batch vs. items with none) without mutating
 * anything.
 */
const RUN_ID = `${Date.now()}-${process.pid}`;
let disciplineId = "";
let categoryId = "";
let ownerUserId = "";
let companyId = "";

function ownerActor(): PlatformActor {
  return { userId: ownerUserId, companyId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "Inspect Owner", email: `${RUN_ID}-owner@example.com` };
}
function adminActor(): PlatformActor {
  return { userId: ownerUserId, companyId, platformRole: PlatformRole.PLATFORM_ADMIN, fullName: "Inspect Admin", email: `${RUN_ID}-admin@example.com` };
}

beforeAll(async () => {
  const discipline = await prisma.masterDiscipline.upsert({
    where: { key: "plumbing" },
    update: {},
    create: { key: "plumbing", name: "Plumbing" },
  });
  disciplineId = discipline.id;
  const category = await prisma.masterCategory.create({
    data: { disciplineId, key: `inspect-category-${RUN_ID}`, name: "Inspect Category", path: `inspect-category-${RUN_ID}` },
  });
  categoryId = category.id;

  const company = await prisma.company.create({ data: { legalName: `Inspect Co ${RUN_ID}`, tradeName: "Inspect Co", email: `inspect-${RUN_ID}@example.com` } });
  companyId = company.id;
  const owner = await prisma.user.create({
    data: { companyId, email: `${RUN_ID}-owner@example.com`, passwordHash: `hash-${RUN_ID}`, fullName: "Inspect Owner", role: UserRole.COMPANY_OWNER, platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() },
  });
  ownerUserId = owner.id;

  // An item with no source batch at all — mirrors the real production anomaly (MasterItems
  // existing with no MasterCatalogueImportJob for their dataset).
  await prisma.masterItem.create({
    data: {
      disciplineId,
      categoryId,
      itemCode: `INSPECT-NOBATCH-${RUN_ID}`,
      name: "No batch item",
      shortDescription: "x",
      fullDescription: "x",
      defaultUnit: "no.",
      status: MasterItemStatus.ACTIVE,
    },
  });

  // An item that DOES have a real, traceable source batch.
  const batch = await prisma.masterCatalogueImportBatch.create({
    data: {
      actorUserId: ownerUserId,
      disciplineId,
      uploadedFileName: `traceable-${RUN_ID}.csv`,
      checksum: "test-checksum",
      status: MasterCatalogueImportStatus.EXECUTED,
      executedAt: new Date(),
    },
  });
  await prisma.masterItem.create({
    data: {
      disciplineId,
      categoryId,
      itemCode: `INSPECT-WITHBATCH-${RUN_ID}`,
      name: "With batch item",
      shortDescription: "x",
      fullDescription: "x",
      defaultUnit: "no.",
      status: MasterItemStatus.ACTIVE,
      sourceBatchId: batch.id,
    },
  });
});

afterAll(async () => {
  await prisma.masterItem.deleteMany({ where: { itemCode: { in: [`INSPECT-NOBATCH-${RUN_ID}`, `INSPECT-WITHBATCH-${RUN_ID}`] } } });
  await prisma.masterCatalogueImportBatch.deleteMany({ where: { uploadedFileName: `traceable-${RUN_ID}.csv` } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
  await prisma.$disconnect();
});

describe("inspectDatasetProductionItems (integration, real local Postgres)", () => {
  it("denies a non-owner platform actor", async () => {
    await expect(inspectDatasetProductionItems(adminActor(), "quantara-master-plumbing-v1")).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects an unregistered dataset id", async () => {
    await expect(inspectDatasetProductionItems(ownerActor(), "not-a-real-dataset")).rejects.toMatchObject({ code: "UNKNOWN_DATASET" });
  });

  it("distinguishes items with no source batch from items with a traceable batch, mutating nothing", async () => {
    const before = await prisma.masterItem.count({ where: { disciplineId } });

    const result = await inspectDatasetProductionItems(ownerActor(), "quantara-master-plumbing-v1");

    const after = await prisma.masterItem.count({ where: { disciplineId } });
    expect(after).toBe(before);

    expect(result.disciplineReady).toBe(true);
    const noBatch = result.items.find((i) => i.itemCode === `INSPECT-NOBATCH-${RUN_ID}`);
    const withBatch = result.items.find((i) => i.itemCode === `INSPECT-WITHBATCH-${RUN_ID}`);
    expect(noBatch?.sourceBatchId).toBeNull();
    expect(noBatch?.sourceBatchFileName).toBeNull();
    expect(withBatch?.sourceBatchId).not.toBeNull();
    expect(withBatch?.sourceBatchFileName).toBe(`traceable-${RUN_ID}.csv`);
    expect(withBatch?.sourceBatchStatus).toBe(MasterCatalogueImportStatus.EXECUTED);
  });
});
