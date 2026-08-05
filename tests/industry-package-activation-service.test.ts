import { PlatformRole, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { PermissionDeniedError } from "../src/lib/errors/app-error";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { activateDataset, publishJobToPackage } from "../src/lib/services/industry-package-activation-service";
import { listPackages, listPackageItems } from "../src/lib/repositories/industry-package-repository";
import { getProductionCatalogueEvidence } from "../src/lib/services/catalogue-production-evidence-service";

const RUN_ID = `${Date.now()}-${process.pid}`;
const HVAC_DATASET_ID = "quantara-master-hvac-v1";
const HVAC_PACKAGE_KEY = "hvac-library";

let ownerUserId = "";
let companyId = "";

function ownerActor(): PlatformActor {
  return { userId: ownerUserId, companyId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "IPA Owner", email: `${RUN_ID}-owner@example.com` };
}
function adminActor(): PlatformActor {
  return { userId: ownerUserId, companyId, platformRole: PlatformRole.PLATFORM_ADMIN, fullName: "IPA Admin", email: `${RUN_ID}-admin@example.com` };
}

async function cleanupHvacItemsAndPackage() {
  const pkg = await prisma.industryDataPackage.findUnique({ where: { key: HVAC_PACKAGE_KEY } });
  if (pkg) {
    await prisma.industryDataPackageItem.deleteMany({ where: { packageId: pkg.id } });
    await prisma.industryDataPackage.delete({ where: { id: pkg.id } });
  }
  const mechanical = await prisma.masterDiscipline.findUnique({ where: { key: "mechanical" } });
  if (mechanical) {
    const items = await prisma.masterItem.findMany({ where: { disciplineId: mechanical.id, itemCode: { startsWith: "HVAC-" } } });
    for (const item of items) {
      await prisma.masterItemClassification.deleteMany({ where: { masterItemId: item.id } });
      await prisma.masterItemVersion.deleteMany({ where: { masterItemId: item.id } });
    }
    await prisma.masterItem.deleteMany({ where: { disciplineId: mechanical.id, itemCode: { startsWith: "HVAC-" } } });
  }
  const jobs = await prisma.masterCatalogueImportJob.findMany({ where: { datasetId: HVAC_DATASET_ID } });
  const legacyBatchIds = jobs.map((j) => j.legacyBatchId).filter((id): id is string => Boolean(id));
  await prisma.masterCatalogueImportJob.deleteMany({ where: { datasetId: HVAC_DATASET_ID } });
  if (legacyBatchIds.length > 0) await prisma.masterCatalogueImportBatch.deleteMany({ where: { id: { in: legacyBatchIds } } });
}

describe("CATALOGUE-CREATE-1: industry package activation (integration, real local Postgres, real HVAC dataset)", () => {
  beforeAll(async () => {
    await cleanupHvacItemsAndPackage();
    const company = await prisma.company.create({ data: { legalName: `IPA Co ${RUN_ID}`, tradeName: "IPA Co", email: `ipa-${RUN_ID}@example.com` } });
    companyId = company.id;
    const owner = await prisma.user.create({
      data: { companyId, email: `${RUN_ID}-owner@example.com`, passwordHash: `hash-${RUN_ID}`, fullName: "IPA Owner", role: UserRole.COMPANY_OWNER, platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerUserId = owner.id;
  });

  afterAll(async () => {
    await cleanupHvacItemsAndPackage();
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("blocks a non-owner platform actor", async () => {
    await expect(activateDataset(adminActor(), HVAC_DATASET_ID)).rejects.toThrow(PermissionDeniedError);
  });

  it("drives dry-run -> confirm -> batches -> package publication in one call for a dataset that fits under the batch cap", async () => {
    const beforeCount = await prisma.masterItem.count({ where: { itemCode: { startsWith: "HVAC-" } } });
    expect(beforeCount).toBe(0);

    const result = await activateDataset(ownerActor(), HVAC_DATASET_ID);

    expect(result.isComplete).toBe(true);
    expect(["COMPLETED", "COMPLETED_WITH_WARNINGS"]).toContain(result.status);
    expect(result.processedRows).toBe(891);
    expect(result.package).not.toBeNull();
    expect(result.package?.packageKey).toBe(HVAC_PACKAGE_KEY);
    expect(result.package?.itemCount).toBeGreaterThan(0);

    const afterCount = await prisma.masterItem.count({ where: { itemCode: { startsWith: "HVAC-" } } });
    expect(afterCount).toBe(result.package?.itemCount);

    const pkg = await prisma.industryDataPackage.findUniqueOrThrow({ where: { key: HVAC_PACKAGE_KEY } });
    expect(pkg.status).toBe("ACTIVE");
    expect(pkg.itemCount).toBe(afterCount);
  }, 60_000);

  it("is idempotent: re-activating the same dataset creates no duplicate items and no duplicate package assignments", async () => {
    const itemCountBefore = await prisma.masterItem.count({ where: { itemCode: { startsWith: "HVAC-" } } });
    const assignmentsBefore = await prisma.industryDataPackageItem.count({ where: { package: { key: HVAC_PACKAGE_KEY } } });

    const second = await activateDataset(ownerActor(), HVAC_DATASET_ID);

    expect(second.isComplete).toBe(true);
    const itemCountAfter = await prisma.masterItem.count({ where: { itemCode: { startsWith: "HVAC-" } } });
    const assignmentsAfter = await prisma.industryDataPackageItem.count({ where: { package: { key: HVAC_PACKAGE_KEY } } });

    expect(itemCountAfter).toBe(itemCountBefore);
    expect(assignmentsAfter).toBe(assignmentsBefore);
  }, 60_000);

  it("exposes the activated package through the real Marketplace listing with a truthful item count", async () => {
    const packages = await listPackages();
    const hvac = packages.find((p) => p.key === HVAC_PACKAGE_KEY);
    expect(hvac).toBeDefined();
    expect(hvac!.itemCount).toBeGreaterThan(0);

    const items = await listPackageItems(hvac!.id);
    expect(items.length).toBe(hvac!.itemCount);
    expect(items.every((item) => item.itemCode.startsWith("HVAC-"))).toBe(true);
  });

  it("publishJobToPackage refuses to publish an incomplete job", async () => {
    const job = await prisma.masterCatalogueImportJob.create({
      data: {
        datasetId: HVAC_DATASET_ID,
        datasetVersion: "1",
        actorUserId: ownerUserId,
        disciplineId: (await prisma.masterDiscipline.findUniqueOrThrow({ where: { key: "mechanical" } })).id,
        status: "PAUSED",
        sourceChecksum: "irrelevant-for-this-guard-test",
        manifestJson: [],
        totalRows: 891,
      },
    });
    await expect(publishJobToPackage(ownerActor(), job.id)).rejects.toMatchObject({ code: "JOB_NOT_COMPLETE" });
    await prisma.masterCatalogueImportJob.delete({ where: { id: job.id } });
  });

  it("production evidence reports HVAC as CUSTOMER_ACTIVE with real, batch-scoped counts (not discipline-wide)", async () => {
    const evidence = await getProductionCatalogueEvidence(ownerActor());
    const hvac = evidence.datasets.find((d) => d.datasetId === HVAC_DATASET_ID);
    expect(hvac).toBeDefined();
    expect(hvac!.stage).toBe("CUSTOMER_ACTIVE");
    expect(hvac!.itemCount).toBe(891);
    expect(hvac!.publishedVersionCount).toBe(891);
    expect(hvac!.package?.key).toBe(HVAC_PACKAGE_KEY);
    expect(hvac!.marketplaceVisible).toBe(true);
    expect(hvac!.job?.status).toMatch(/COMPLETED/);

    // Never-activated datasets must be honestly reported, not silently omitted or fabricated.
    const untouched = evidence.datasets.find((d) => d.datasetId === "quantara-master-plumbing-v1");
    expect(untouched).toBeDefined();
    expect(untouched!.stage).toBe("SOURCE_ONLY");
    expect(untouched!.itemCount).toBe(0);
    expect(untouched!.marketplaceVisible).toBe(false);

    expect(evidence.summary.totalDatasets).toBe(15);
    expect(evidence.summary.datasetsCompleted).toBeGreaterThanOrEqual(1);
  });

  it("production evidence blocks a non-owner platform actor", async () => {
    await expect(getProductionCatalogueEvidence(adminActor())).rejects.toThrow(PermissionDeniedError);
  });
});
