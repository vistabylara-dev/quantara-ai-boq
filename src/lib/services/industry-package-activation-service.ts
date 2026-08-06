import { MasterCatalogueImportJobStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError, PermissionDeniedError } from "@/lib/errors/app-error";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { recordPlatformActionAudit } from "@/lib/repositories/platform-action-audit-repository";
import { listDatasetDefinitions, requireDatasetDefinition, type DatasetDefinition } from "@/lib/services/catalogue-dataset-registry";
import { createPackage, addItemsToPackage } from "@/lib/repositories/industry-package-repository";
import {
  registerAndDryRun,
  confirmExecution,
  runJobBatches,
  TERMINAL_STATUSES,
} from "@/lib/services/master-catalogue-import-job-service";

/**
 * CATALOGUE-CREATE-1 — the missing link the registry itself calls out
 * (catalogue-dataset-registry.ts's targetPackageCode doc comment: "see
 * industry-package-service (not built by this phase)"). Every other piece
 * of the pipeline (dry run, batched import, publication) already exists
 * and is reused as-is here — this only adds the "assign a completed job's
 * items to their dataset's commercial package" step.
 *
 * Idempotent by construction: createPackage() is a no-op if the key already
 * exists, addItemsToPackage() uses createMany+skipDuplicates, so calling
 * this twice for the same job is always safe.
 */
function requireOwner(actor: PlatformActor): void {
  if (actor.platformRole !== "PLATFORM_OWNER") {
    throw new PermissionDeniedError("Production catalogue activation is restricted to the platform owner.");
  }
}

const PUBLISHABLE_STATUSES: MasterCatalogueImportJobStatus[] = [
  MasterCatalogueImportJobStatus.COMPLETED,
  MasterCatalogueImportJobStatus.COMPLETED_WITH_WARNINGS,
];

/**
 * A dataset's items can be spread across several MasterCatalogueImportBatch
 * rows over time — evaluate() only rewrites sourceBatchId for rows it
 * actually inserts or updates on a given run; a row left "unchanged" keeps
 * whatever batch id it already had. So publishing (or reporting on) "this
 * dataset's items" by only the latest job's own batch would silently miss
 * every item that happened to be unchanged on the most recent run. Collect
 * every batch this datasetId has ever produced instead.
 */
export async function getDatasetItemIds(datasetId: string): Promise<string[]> {
  const jobs = await prisma.masterCatalogueImportJob.findMany({
    where: { datasetId, legacyBatchId: { not: null } },
    select: { legacyBatchId: true },
  });
  const batchIds = jobs.map((j) => j.legacyBatchId).filter((id): id is string => Boolean(id));
  if (batchIds.length === 0) return [];
  const items = await prisma.masterItem.findMany({ where: { sourceBatchId: { in: batchIds } }, select: { id: true } });
  return items.map((item) => item.id);
}

export async function publishJobToPackage(owner: PlatformActor, jobId: string) {
  requireOwner(owner);
  const job = await prisma.masterCatalogueImportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundError("Import job not found.");
  if (!PUBLISHABLE_STATUSES.includes(job.status)) {
    throw new AppError("JOB_NOT_COMPLETE", `Job status is ${job.status}; only a completed job's items can be published to a package.`, 409);
  }
  if (!job.legacyBatchId) {
    throw new AppError("JOB_MISSING_BATCH", "This job has no source batch to publish items from.", 409);
  }

  const dataset = requireDatasetDefinition(job.datasetId);
  const discipline = await prisma.masterDiscipline.findUnique({ where: { key: dataset.disciplineKey } });
  if (!discipline) throw new AppError("DISCIPLINE_NOT_FOUND", `MasterDiscipline "${dataset.disciplineKey}" does not exist.`, 409);

  const pkg = await createPackage({
    key: dataset.targetPackageCode,
    name: dataset.label,
    description: `Commercial master-catalogue package for ${dataset.label}.`,
    disciplineId: discipline.id,
    packageType: "CORE",
  });

  const itemIds = await getDatasetItemIds(job.datasetId);
  await addItemsToPackage(pkg.id, itemIds);

  const refreshed = await prisma.industryDataPackage.findUniqueOrThrow({ where: { id: pkg.id } });

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "CATALOGUE_PACKAGE_ITEMS_PUBLISHED",
    targetType: "IndustryDataPackage",
    targetId: pkg.id,
    metadata: { datasetId: job.datasetId, jobId, itemsAssigned: itemIds.length, packageKey: pkg.key },
  });

  return { packageId: pkg.id, packageKey: pkg.key, itemCount: refreshed.itemCount, itemsAssignedThisRun: itemIds.length };
}

/**
 * One call per dataset (or a handful for very large ones) instead of the
 * owner manually driving dry-run -> confirm -> N x continue -> publish
 * through separate authenticated requests. Every step below is a plain
 * call to the already-proven functions it wraps — this adds no new import
 * logic, only orchestration. Safe to call repeatedly: reuses whatever job
 * is already active for the dataset rather than starting a new one.
 */
export async function activateDataset(owner: PlatformActor, datasetId: string) {
  requireOwner(owner);

  let job = await prisma.masterCatalogueImportJob.findFirst({
    where: { datasetId, status: { notIn: TERMINAL_STATUSES } },
    orderBy: { createdAt: "desc" },
  });

  if (!job) {
    const created = await registerAndDryRun(owner, datasetId);
    job = await prisma.masterCatalogueImportJob.findUniqueOrThrow({ where: { id: created.id } });
  }

  if (job.status === MasterCatalogueImportJobStatus.DRY_RUN_COMPLETE) {
    const confirmed = await confirmExecution(owner, job.id);
    job = await prisma.masterCatalogueImportJob.findUniqueOrThrow({ where: { id: confirmed.id } });
  }

  let batchesRun = 0;
  if (job.status === MasterCatalogueImportJobStatus.PAUSED || job.status === MasterCatalogueImportJobStatus.IMPORT_RUNNING) {
    const result = await runJobBatches(owner, job.id);
    batchesRun = result.batchesRun;
    job = await prisma.masterCatalogueImportJob.findUniqueOrThrow({ where: { id: job.id } });
  }

  const isComplete = job.status === MasterCatalogueImportJobStatus.COMPLETED || job.status === MasterCatalogueImportJobStatus.COMPLETED_WITH_WARNINGS;
  let publishResult: Awaited<ReturnType<typeof publishJobToPackage>> | null = null;
  if (isComplete) {
    publishResult = await publishJobToPackage(owner, job.id);
  }

  return {
    jobId: job.id,
    datasetId,
    status: job.status,
    processedRows: job.processedRows,
    totalRows: job.totalRows,
    batchesRunThisCall: batchesRun,
    isComplete,
    package: publishResult,
  };
}

async function isDatasetFullyActive(dataset: DatasetDefinition): Promise<boolean> {
  const pkg = await prisma.industryDataPackage.findUnique({ where: { key: dataset.targetPackageCode } });
  if (!pkg || pkg.itemCount === 0 || pkg.status !== "ACTIVE") return false;
  const completedJob = await prisma.masterCatalogueImportJob.findFirst({
    where: { datasetId: dataset.datasetId, status: { in: [MasterCatalogueImportJobStatus.COMPLETED, MasterCatalogueImportJobStatus.COMPLETED_WITH_WARNINGS] } },
  });
  return Boolean(completedJob);
}

const DEFAULT_ALL_DATASETS_BUDGET_MS = 240_000;

export type ActivateAllDatasetsOutcome = "ALREADY_ACTIVE" | "COMPLETED_THIS_CALL" | "IN_PROGRESS" | "FAILED" | "TIME_BUDGET_EXCEEDED";

/**
 * Drives every registered dataset (or a caller-supplied subset) toward
 * CUSTOMER_ACTIVE in one owner-authenticated call — instead of the owner
 * opening the admin panel once per dataset. Each dataset is driven via
 * repeated activateDataset() calls (itself already bounded/resumable)
 * until it completes or the overall time budget runs out, so a very large
 * dataset never starves every dataset after it: this call always makes
 * real, visible progress on whichever dataset it's currently working on,
 * and picking up where it left off is just calling this again — nothing
 * here is a new import mechanism, only a loop around already-proven calls.
 */
export async function activateAllDatasets(owner: PlatformActor, options?: { datasetIds?: string[]; timeBudgetMs?: number }) {
  requireOwner(owner);
  const allDatasets = listDatasetDefinitions();
  const targets = options?.datasetIds ? allDatasets.filter((d) => options.datasetIds!.includes(d.datasetId)) : allDatasets;
  const budgetMs = options?.timeBudgetMs ?? DEFAULT_ALL_DATASETS_BUDGET_MS;
  const start = Date.now();
  const results: Array<{ datasetId: string; outcome: ActivateAllDatasetsOutcome; detail?: Awaited<ReturnType<typeof activateDataset>>; error?: string }> = [];

  for (const dataset of targets) {
    if (Date.now() - start > budgetMs) {
      results.push({ datasetId: dataset.datasetId, outcome: "TIME_BUDGET_EXCEEDED" });
      continue;
    }

    if (await isDatasetFullyActive(dataset)) {
      results.push({ datasetId: dataset.datasetId, outcome: "ALREADY_ACTIVE" });
      continue;
    }

    try {
      let last = await activateDataset(owner, dataset.datasetId);
      while (!last.isComplete && Date.now() - start <= budgetMs) {
        last = await activateDataset(owner, dataset.datasetId);
      }
      results.push({ datasetId: dataset.datasetId, outcome: last.isComplete ? "COMPLETED_THIS_CALL" : "IN_PROGRESS", detail: last });
    } catch (error) {
      results.push({ datasetId: dataset.datasetId, outcome: "FAILED", error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { generatedAt: new Date().toISOString(), elapsedMs: Date.now() - start, results };
}
