import { readFileSync } from "node:fs";
import { PlatformRole, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { AppError, PermissionDeniedError } from "../src/lib/errors/app-error";
import { computeCatalogueCsvChecksum } from "../src/lib/services/catalogue-csv-checksum";
import { parseCsv } from "../src/lib/imports/csv-parser";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import {
  computeDatasetSourceChecksum,
  getDatasetDefinition,
  listDatasetDefinitions,
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
  STALE_IMPORT_RUNNING_MS,
} from "../src/lib/services/master-catalogue-import-job-service";
import { MasterCatalogueImportJobStatus } from "@prisma/client";

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

/**
 * CodeRabbit finding — cleanupHvacItems() scopes deletion to the "mechanical"
 * discipline, but a plain `itemCode: { startsWith: "HVAC-" }` count could
 * also match an HVAC-prefixed item belonging to a different discipline,
 * making a concurrency assertion fail for unrelated data. Every HVAC item
 * count in this file must use this same discipline-scoped condition.
 */
async function hvacItemWhere() {
  const mechanical = await prisma.masterDiscipline.findUnique({ where: { key: "mechanical" } });
  return { disciplineId: mechanical?.id ?? "__no_mechanical_discipline__", itemCode: { startsWith: "HVAC-" } } as const;
}

describe("CATALOGUE-PROD-ACTIVATE: registered dataset registry", () => {
  it("has an approved HVAC dataset with a checksum matching the real committed source files", () => {
    const dataset = requireDatasetDefinition(HVAC_DATASET_ID);
    for (const file of dataset.files) {
      const bytes = readFileSync(`${dataset.sourceDir}/${file.fileName}`);
      expect(computeCatalogueCsvChecksum(bytes)).toBe(file.approvedChecksum);
    }
  });

  /**
   * CATALOGUE-INTEGRITY-REPAIR — the real regression test for the incident
   * itself: every registered dataset's every file, checked against the
   * actual current worktree file using the canonical (CRLF-normalized)
   * checksum. This must pass identically whether the checkout is LF (Git/
   * Linux/Vercel) or CRLF (Windows, core.autocrlf=true) — that platform
   * independence is the entire point of computeCatalogueCsvChecksum. Also
   * confirms expectedRowCount is still correct for every file.
   */
  it("every registered dataset's every file matches its approved checksum (15 datasets, 53 files)", () => {
    const datasets = listDatasetDefinitions();
    expect(datasets.length).toBe(15);

    let totalFiles = 0;
    for (const dataset of datasets) {
      for (const file of dataset.files) {
        totalFiles += 1;
        const path = `${dataset.sourceDir}/${file.fileName}`;
        const bytes = readFileSync(path);

        const canonical = computeCatalogueCsvChecksum(bytes);
        expect(canonical, `${dataset.datasetId}/${file.fileName}: canonical checksum mismatch`).toBe(file.approvedChecksum);

        const rows = parseCsv(bytes.toString("utf-8"));
        const actualRowCount = Math.max(0, rows.length - 1);
        expect(actualRowCount, `${dataset.datasetId}/${file.fileName}: row count mismatch`).toBe(file.expectedRowCount);
      }
    }
    expect(totalFiles).toBe(53);
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

  /**
   * CATALOGUE-INTEGRITY-REPAIR — mirrors the real doors-and-windows incident:
   * a non-terminal, partway-through job whose persisted sourceChecksum no
   * longer matches the current registered dataset identity (e.g. because the
   * registry's approved checksums were corrected, exactly like this repair
   * does). processNextBatch must refuse to continue it — and, critically,
   * must leave the job completely untouched (no status change, no cursor
   * movement, no row processed, no MasterItem created) rather than moving it
   * to FAILED the way an ordinary processing error would. Then proves a job
   * created under the CURRENT identity continues normally.
   */
  it("a non-terminal job with a stale source identity is never silently resumed, and is left completely untouched", async () => {
    const dryRun = await registerAndDryRun(ownerActor(), HVAC_DATASET_ID);
    const armed = await confirmExecution(ownerActor(), dryRun.id);
    expect(armed.status).toBe("PAUSED");

    // Make real forward progress first — like the real doors-and-windows job at 4800/11567 —
    // so the test proves cursor/processedRows are truly unaffected, not just untouched from zero.
    const afterOneBatch = await processNextBatch(ownerActor(), dryRun.id);
    expect(afterOneBatch.processedRows).toBeGreaterThan(0);
    const itemCountBeforeMismatch = await prisma.masterItem.count({ where: { itemCode: { startsWith: "HVAC-" } } });

    // Simulate a registry checksum correction changing the computed identity, exactly
    // like this repair's registry fix does — without touching the actual CSV bytes.
    // Snapshot AFTER this injection (not before) so the comparison below isolates
    // exactly what processNextBatch itself does — the injection update necessarily
    // changes updatedAt too, and that's not what's under test here.
    await prisma.masterCatalogueImportJob.update({ where: { id: dryRun.id }, data: { sourceChecksum: "stale-identity-from-before-a-registry-correction" } });
    const staleSnapshot = await prisma.masterCatalogueImportJob.findUniqueOrThrow({ where: { id: dryRun.id } });

    await expect(processNextBatch(ownerActor(), dryRun.id)).rejects.toThrow(/source registration|identity/i);

    // Left completely untouched: same status, same cursor, same processedRows, same updatedAt — not moved to FAILED.
    const afterMismatch = await prisma.masterCatalogueImportJob.findUniqueOrThrow({ where: { id: dryRun.id } });
    expect(afterMismatch.status).toBe(staleSnapshot.status);
    expect(afterMismatch.currentRowCursor).toBe(staleSnapshot.currentRowCursor);
    expect(afterMismatch.processedRows).toBe(staleSnapshot.processedRows);
    expect(afterMismatch.updatedAt).toEqual(staleSnapshot.updatedAt);
    const itemCountAfterMismatch = await prisma.masterItem.count({ where: { itemCode: { startsWith: "HVAC-" } } });
    expect(itemCountAfterMismatch).toBe(itemCountBeforeMismatch);

    // Restore the correct identity — the owner's real remedy is "cancel and start a new dry
    // run," but restoring here proves a job under the CURRENT identity continues normally,
    // and lets this test drain the job so afterAll cleanup finds a consistent final state.
    const dataset = requireDatasetDefinition(HVAC_DATASET_ID);
    await prisma.masterCatalogueImportJob.update({ where: { id: dryRun.id }, data: { sourceChecksum: computeDatasetSourceChecksum(dataset) } });

    let job = await getJob(ownerActor(), dryRun.id);
    while (job.status === "PAUSED" || job.status === "IMPORT_RUNNING") {
      job = await processNextBatch(ownerActor(), dryRun.id);
    }
    // Drained to COMPLETED via the same idempotent upsert path "an identical rerun" below
    // relies on — the 891 items already exist from the earlier full-import test, so this
    // drain reconfirms them as unchanged rather than duplicating anything. Deliberately no
    // cleanup call here: later tests expect the 891 HVAC items to still exist.
    expect(job.status).toBe("COMPLETED");
  }, 60_000);

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

  /**
   * CATALOGUE-CONCURRENCY-REPAIR — the regression test for the real
   * production incident (Structural dataset, job stuck IMPORT_RUNNING with
   * insertedCount exceeding processedRows and a UNIQUE_CONSTRAINT error).
   * The existing "prevents two concurrent continuations" test above only
   * exercises two callers racing to claim a job starting from PAUSED — that
   * case was already safe (only one atomic updateMany can match). The actual
   * incident is a *sequential* race: caller A's claim already committed
   * (job is now IMPORT_RUNNING with a fresh updatedAt) before caller B reads
   * it. This deterministically reproduces exactly that moment by writing the
   * post-claim state directly, then proves a second caller cannot steal it.
   */
  it("a fresh IMPORT_RUNNING job cannot be stolen by a second caller, and is left completely untouched", async () => {
    const dryRun = await registerAndDryRun(ownerActor(), HVAC_DATASET_ID);
    const armed = await confirmExecution(ownerActor(), dryRun.id);
    expect(armed.status).toBe("PAUSED");

    // Simulate caller A's claim having already committed a moment ago (well within the
    // staleness window) — the exact state a second caller would observe mid-race.
    await prisma.masterCatalogueImportJob.update({
      where: { id: dryRun.id },
      data: { status: MasterCatalogueImportJobStatus.IMPORT_RUNNING },
    });
    const freshClaimSnapshot = await prisma.masterCatalogueImportJob.findUniqueOrThrow({ where: { id: dryRun.id } });
    expect(Date.now() - freshClaimSnapshot.updatedAt.getTime()).toBeLessThan(STALE_IMPORT_RUNNING_MS);

    await expect(processNextBatch(ownerActor(), dryRun.id)).rejects.toMatchObject({ code: "JOB_BUSY" });

    // Left completely untouched: no cursor movement, no status change, no row processed.
    const afterStolenAttempt = await prisma.masterCatalogueImportJob.findUniqueOrThrow({ where: { id: dryRun.id } });
    expect(afterStolenAttempt.status).toBe(MasterCatalogueImportJobStatus.IMPORT_RUNNING);
    expect(afterStolenAttempt.currentRowCursor).toBe(freshClaimSnapshot.currentRowCursor);
    expect(afterStolenAttempt.processedRows).toBe(freshClaimSnapshot.processedRows);
    expect(afterStolenAttempt.updatedAt).toEqual(freshClaimSnapshot.updatedAt);

    // Restore to PAUSED (what caller A would have left it as on success) and drain to
    // completion so afterAll cleanup finds a consistent final state.
    await prisma.masterCatalogueImportJob.update({ where: { id: dryRun.id }, data: { status: MasterCatalogueImportJobStatus.PAUSED } });
    let job = await getJob(ownerActor(), dryRun.id);
    // processNextBatch always returns PAUSED or a terminal status on success — IMPORT_RUNNING
    // is only ever a transient DB state during a call, never a value handed back to the caller.
    while (job.status === "PAUSED") {
      job = await processNextBatch(ownerActor(), dryRun.id);
    }
    expect(job.status).toBe("COMPLETED");
    expect(job.insertedCount + job.updatedCount + job.unchangedCount).toBe(job.processedRows);
  }, 60_000);

  it("a genuinely stale IMPORT_RUNNING job (abandoned by a crashed/timed-out caller) can be recovered and processes exactly one more batch, with no duplicates", async () => {
    // Every earlier test in this suite leaves the full 891 HVAC items in place (only the
    // dedicated cancellation test below cleans up), so a fresh slate is required here —
    // otherwise every "insert" is really an idempotent "unchanged" and proves nothing about
    // duplicate creation.
    await cleanupHvacItems();

    const dryRun = await registerAndDryRun(ownerActor(), HVAC_DATASET_ID);
    const armed = await confirmExecution(ownerActor(), dryRun.id);
    const afterFirstBatch = await processNextBatch(ownerActor(), armed.id);
    expect(afterFirstBatch.status).toBe("PAUSED");
    expect(afterFirstBatch.insertedCount).toBe(afterFirstBatch.processedRows); // clean slate: every row in batch 1 is a real insert
    const cursorAfterFirstBatch = afterFirstBatch.processedRows;
    const itemsAfterFirstBatch = await prisma.masterItem.count({ where: await hvacItemWhere() });
    expect(itemsAfterFirstBatch).toBe(cursorAfterFirstBatch);

    // Simulate an abandoned claim: IMPORT_RUNNING with an updatedAt well past the
    // staleness window — as if a prior serverless invocation crashed mid-batch and
    // never reached the final status update.
    await prisma.masterCatalogueImportJob.update({
      where: { id: dryRun.id },
      data: { status: MasterCatalogueImportJobStatus.IMPORT_RUNNING, updatedAt: new Date(Date.now() - STALE_IMPORT_RUNNING_MS - 5_000) },
    });

    const recovered = await processNextBatch(ownerActor(), dryRun.id);
    expect(recovered.processedRows).toBeGreaterThan(cursorAfterFirstBatch);
    expect(recovered.processedRows - cursorAfterFirstBatch).toBeLessThanOrEqual(recovered.batchSize);

    const itemsAfterRecovery = await prisma.masterItem.count({ where: await hvacItemWhere() });
    // Exactly the newly-inserted rows from this one recovered batch — no duplicates from the
    // abandoned claim being processed twice.
    expect(itemsAfterRecovery - itemsAfterFirstBatch).toBe(recovered.processedRows - cursorAfterFirstBatch);

    // Drain to completion so afterAll cleanup finds a consistent final state. processNextBatch
    // always returns PAUSED or a terminal status on success — IMPORT_RUNNING is only ever a
    // transient DB state during a call, never a value handed back to the caller.
    let job = recovered;
    while (job.status === "PAUSED") {
      job = await processNextBatch(ownerActor(), dryRun.id);
    }
    expect(job.status).toBe("COMPLETED");
    expect(job.processedRows).toBe(891);
    expect(job.itemsCreated).toBe(891);
    expect(job.versionsCreated).toBe(891);
    expect(job.insertedCount + job.updatedCount + job.unchangedCount).toBe(job.processedRows);

    const finalItemCount = await prisma.masterItem.count({ where: await hvacItemWhere() });
    expect(finalItemCount).toBe(891); // no duplicate MasterItems from the stale-recovery batch
    const versionCount = await prisma.masterItemVersion.count({ where: { masterItem: await hvacItemWhere() } });
    expect(versionCount).toBe(891); // no duplicate MasterItemVersions
    const classificationCount = await prisma.masterItemClassification.count({ where: { masterItem: await hvacItemWhere() } });
    expect(classificationCount).toBe(job.classificationsCreated); // no duplicate classifications
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
