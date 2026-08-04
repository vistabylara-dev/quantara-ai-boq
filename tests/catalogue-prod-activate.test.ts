import { readFileSync } from "node:fs";
import { PlatformRole, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { AppError, PermissionDeniedError } from "../src/lib/errors/app-error";
import { computeChecksum } from "../src/lib/files/file-security";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import {
  computeDatasetSourceChecksum,
  getDatasetDefinition,
  loadApprovedDatasetFiles,
  requireDatasetDefinition,
  type DatasetDefinition,
} from "../src/lib/services/catalogue-dataset-registry";
import {
  cancelJob,
  confirmExecution,
  getJob,
  listJobsForDataset,
  listRegisteredDatasetsSummary,
  processNextBatch,
  registerAndDryRun,
} from "../src/lib/services/master-catalogue-import-job-service";

const RUN_ID = `${Date.now()}-${process.pid}`;
const HVAC_DATASET_ID = "quantara-master-hvac-v1";

let ownerUserId = "";
let companyId = "";

function ownerActor(): PlatformActor {
  return { userId: ownerUserId, companyId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "CPA Owner", email: `${RUN_ID}-owner@example.com` };
}
function adminActor(): PlatformActor {
  return { userId: ownerUserId, companyId, platformRole: PlatformRole.PLATFORM_ADMIN, fullName: "CPA Admin", email: `${RUN_ID}-admin@example.com` };
}

async function cleanupHvacItems() {
  const mechanical = await prisma.masterDiscipline.findUnique({ where: { key: "mechanical" } });
  if (!mechanical) return;
  const items = await prisma.masterItem.findMany({ where: { disciplineId: mechanical.id, itemCode: { startsWith: "HVAC-" } } });
  for (const item of items) {
    await prisma.masterItemClassification.deleteMany({ where: { masterItemId: item.id } });
    await prisma.masterItemVersion.deleteMany({ where: { masterItemId: item.id } });
  }
  await prisma.masterItem.deleteMany({ where: { disciplineId: mechanical.id, itemCode: { startsWith: "HVAC-" } } });
}

describe("CATALOGUE-PROD-ACTIVATE: registered dataset registry", () => {
  it("has an approved HVAC dataset with a checksum matching the real committed source files", () => {
    const dataset = requireDatasetDefinition(HVAC_DATASET_ID);
    for (const file of dataset.files) {
      const bytes = readFileSync(`${dataset.sourceDir}/${file.fileName}`);
      expect(computeChecksum(bytes)).toBe(file.approvedChecksum);
    }
  });

  it("has an approved Plumbing dataset registered", () => {
    const dataset = requireDatasetDefinition("quantara-master-plumbing-v1");
    expect(dataset.files.length).toBe(13);
    expect(dataset.files.reduce((sum, f) => sum + f.expectedRowCount, 0)).toBe(13111);
  });

  it("rejects an unknown dataset ID rather than accepting an arbitrary source path", () => {
    expect(getDatasetDefinition("not-a-real-dataset")).toBeNull();
    expect(() => requireDatasetDefinition("not-a-real-dataset")).toThrow(AppError);
  });

  it("rejects a file whose actual content does not match its approved checksum", () => {
    const real = requireDatasetDefinition(HVAC_DATASET_ID);
    const tampered: DatasetDefinition = { ...real, files: [{ ...real.files[0], approvedChecksum: "0".repeat(64) }] };
    expect(() => loadApprovedDatasetFiles(tampered)).toThrow(/checksum/i);
  });

  it("rejects a manifest entry whose file does not exist on disk", () => {
    const real = requireDatasetDefinition(HVAC_DATASET_ID);
    const missing: DatasetDefinition = { ...real, files: [{ fileName: "does-not-exist.csv", approvedChecksum: "x", expectedRowCount: 1 }] };
    expect(() => loadApprovedDatasetFiles(missing)).toThrow(/not found/i);
  });

  it("computes a stable, deterministic combined source checksum for the same dataset", () => {
    const dataset = requireDatasetDefinition(HVAC_DATASET_ID);
    expect(computeDatasetSourceChecksum(dataset)).toBe(computeDatasetSourceChecksum(dataset));
  });
});

describe("CATALOGUE-PROD-ACTIVATE: resumable job execution (integration, real local Postgres, real HVAC dataset)", () => {
  beforeAll(async () => {
    await cleanupHvacItems();
    await prisma.masterCatalogueImportJob.deleteMany({ where: { datasetId: HVAC_DATASET_ID } });

    const company = await prisma.company.create({ data: { legalName: `CPA Co ${RUN_ID}`, tradeName: "CPA Co", email: `cpa-${RUN_ID}@example.com` } });
    companyId = company.id;
    const owner = await prisma.user.create({
      data: { companyId, email: `${RUN_ID}-owner@example.com`, passwordHash: `hash-${RUN_ID}`, fullName: "CPA Owner", role: UserRole.COMPANY_OWNER, platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerUserId = owner.id;
  });

  afterAll(async () => {
    await cleanupHvacItems();
    const jobs = await prisma.masterCatalogueImportJob.findMany({ where: { datasetId: HVAC_DATASET_ID } });
    const legacyBatchIds = jobs.map((j) => j.legacyBatchId).filter((id): id is string => Boolean(id));
    await prisma.masterCatalogueImportJob.deleteMany({ where: { datasetId: HVAC_DATASET_ID } });
    if (legacyBatchIds.length > 0) await prisma.masterCatalogueImportBatch.deleteMany({ where: { id: { in: legacyBatchIds } } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("blocks a non-owner platform actor from every job action", async () => {
    await expect(registerAndDryRun(adminActor(), HVAC_DATASET_ID)).rejects.toThrow(PermissionDeniedError);
  });

  it("dry run processes the complete dataset without mutating the database", async () => {
    const before = await prisma.masterItem.count({ where: { itemCode: { startsWith: "HVAC-" } } });
    const job = await registerAndDryRun(ownerActor(), HVAC_DATASET_ID);
    const after = await prisma.masterItem.count({ where: { itemCode: { startsWith: "HVAC-" } } });

    expect(after).toBe(before);
    expect(job.status).toBe("DRY_RUN_COMPLETE");
    expect(job.totalRows).toBe(891);
    expect(job.dryRunReport?.validRows).toBe(891);
    expect(job.dryRunReport?.rejectedRows).toBe(0);
    expect(job.dryRunReport?.toInsert).toBe(891);

    // Persisted and independently retrievable — a page refresh must be able to see this exact report again.
    const reloaded = await getJob(ownerActor(), job.id);
    expect(reloaded.dryRunReport).toEqual(job.dryRunReport);
  });

  it("refuses a second dry run or execution while one is already active for the dataset", async () => {
    await expect(registerAndDryRun(ownerActor(), HVAC_DATASET_ID)).rejects.toThrow(/already active/i);
  });

  it("rejects execution confirmation if the recorded source checksum no longer matches", async () => {
    const job = await prisma.masterCatalogueImportJob.findFirstOrThrow({ where: { datasetId: HVAC_DATASET_ID }, orderBy: { createdAt: "desc" } });
    await prisma.masterCatalogueImportJob.update({ where: { id: job.id }, data: { sourceChecksum: "stale-checksum-from-before-a-file-changed" } });
    await expect(confirmExecution(ownerActor(), job.id)).rejects.toThrow(/changed/i);
    // Restore the correct checksum so the rest of the suite can proceed with this same job.
    const dataset = requireDatasetDefinition(HVAC_DATASET_ID);
    await prisma.masterCatalogueImportJob.update({ where: { id: job.id }, data: { sourceChecksum: computeDatasetSourceChecksum(dataset) } });
  });

  it("confirms execution and processes the dataset in bounded, checkpointed batches", async () => {
    const dryRunJob = await prisma.masterCatalogueImportJob.findFirstOrThrow({ where: { datasetId: HVAC_DATASET_ID }, orderBy: { createdAt: "desc" } });
    const armed = await confirmExecution(ownerActor(), dryRunJob.id);
    expect(armed.status).toBe("PAUSED");

    let job = armed;
    let batches = 0;
    while (job.status === "PAUSED" || job.status === "IMPORT_RUNNING") {
      const before = job.processedRows;
      job = await processNextBatch(ownerActor(), dryRunJob.id);
      batches++;
      // Every batch is bounded — never more than batchSize rows processed in one call.
      expect(job.processedRows - before).toBeLessThanOrEqual(job.batchSize);
      expect(job.processedRows).toBeGreaterThanOrEqual(before);
      if (batches > 20) throw new Error("Too many batches — checkpoint is not advancing correctly.");
    }

    expect(job.status).toBe("COMPLETED");
    expect(job.processedRows).toBe(891);
    expect(job.insertedCount).toBe(891);
    expect(job.itemsCreated).toBe(891);
    expect(job.versionsCreated).toBe(891);
    expect(batches).toBeGreaterThan(1); // proves it actually ran in multiple bounded batches, not one shot

    const realCount = await prisma.masterItem.count({ where: { itemCode: { startsWith: "HVAC-" } } });
    expect(realCount).toBe(891);
  }, 60_000);

  it("a completed job cannot be continued or re-confirmed", async () => {
    const job = await prisma.masterCatalogueImportJob.findFirstOrThrow({ where: { datasetId: HVAC_DATASET_ID }, orderBy: { createdAt: "desc" } });
    expect(job.status).toBe("COMPLETED");
    await expect(processNextBatch(ownerActor(), job.id)).rejects.toThrow(AppError);
    await expect(confirmExecution(ownerActor(), job.id)).rejects.toThrow(AppError);
  });

  it("an identical rerun is fully idempotent — zero new inserts, everything unchanged", async () => {
    const dryRun = await registerAndDryRun(ownerActor(), HVAC_DATASET_ID);
    expect(dryRun.dryRunReport?.toInsert).toBe(0);
    expect(dryRun.dryRunReport?.unchanged).toBe(891);

    const armed = await confirmExecution(ownerActor(), dryRun.id);
    let job = armed;
    while (job.status === "PAUSED" || job.status === "IMPORT_RUNNING") {
      job = await processNextBatch(ownerActor(), dryRun.id);
    }

    expect(job.status).toBe("COMPLETED");
    expect(job.insertedCount).toBe(0);
    expect(job.unchangedCount).toBe(891);
    expect(job.itemsCreated).toBe(0);

    const realCount = await prisma.masterItem.count({ where: { itemCode: { startsWith: "HVAC-" } } });
    expect(realCount).toBe(891); // still exactly 891 — no duplicates created
  }, 60_000);

  it("prevents two concurrent continuations of the same job from both processing a batch", async () => {
    const dryRun = await registerAndDryRun(ownerActor(), HVAC_DATASET_ID);
    const armed = await confirmExecution(ownerActor(), dryRun.id);
    void armed;

    const [first, second] = await Promise.allSettled([
      processNextBatch(ownerActor(), dryRun.id),
      processNextBatch(ownerActor(), dryRun.id),
    ]);

    const outcomes = [first, second];
    const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
    const rejected = outcomes.filter((o) => o.status === "rejected");
    // Exactly one of the two truly concurrent calls should win the optimistic lock; the other must be refused, never silently double-processed.
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Drain the job to completion so afterAll cleanup can find a consistent final state.
    let job = await getJob(ownerActor(), dryRun.id);
    while (job.status === "PAUSED" || job.status === "IMPORT_RUNNING") {
      job = await processNextBatch(ownerActor(), dryRun.id);
    }
    expect(job.status).toBe("COMPLETED");
  }, 60_000);

  it("a cancelled job can never be continued again", async () => {
    const dryRun = await registerAndDryRun(ownerActor(), HVAC_DATASET_ID);
    const armed = await confirmExecution(ownerActor(), dryRun.id);
    await processNextBatch(ownerActor(), armed.id);

    const cancelled = await cancelJob(ownerActor(), armed.id);
    expect(cancelled.status).toBe("CANCELLED");
    await expect(processNextBatch(ownerActor(), armed.id)).rejects.toThrow(AppError);

    // Clean up the partial items this cancelled run created, so it doesn't affect later counts in this file.
    await cleanupHvacItems();
  }, 60_000);

  it("job/dry-run responses never leak a database credential, connection string, or raw server filesystem path", async () => {
    const job = await registerAndDryRun(ownerActor(), HVAC_DATASET_ID);
    const serialized = JSON.stringify(job);
    expect(serialized).not.toMatch(/postgres(ql)?:\/\/[^"]*:[^"]*@/i);
    expect(serialized).not.toMatch(/DATABASE_URL/i);
    expect(serialized).not.toMatch(/[A-Za-z]:\\Users\\|\/home\/|\/var\/task/);
    await cancelJob(ownerActor(), job.id);
  });

  it("lists registered datasets with real, current production counts", async () => {
    const summaries = await listRegisteredDatasetsSummary(ownerActor());
    const hvac = summaries.find((s) => s.datasetId === HVAC_DATASET_ID);
    expect(hvac).toBeDefined();
    expect(hvac?.expectedRowCount).toBe(891);
    expect(typeof hvac?.currentProductionItemCount).toBe("number");
  });

  it("lists job history for a dataset, most recent first", async () => {
    const jobs = await listJobsForDataset(ownerActor(), HVAC_DATASET_ID);
    expect(jobs.length).toBeGreaterThan(0);
    for (let i = 1; i < jobs.length; i++) {
      expect(new Date(jobs[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(jobs[i].createdAt).getTime());
    }
  });
});
