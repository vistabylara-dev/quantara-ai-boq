import { MasterCatalogueImportJobStatus, MasterCatalogueImportStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError, PermissionDeniedError } from "@/lib/errors/app-error";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { recordPlatformActionAudit } from "@/lib/repositories/platform-action-audit-repository";
import {
  checkDatasetReadiness,
  checkDatasetReadinessFast,
  computeDatasetFingerprint,
  computeDatasetSourceChecksum,
  listDatasetDefinitions,
  loadApprovedDatasetFiles,
  requireDatasetDefinition,
  type DatasetDefinition,
} from "@/lib/services/catalogue-dataset-registry";
import { evaluate, parseRows, requireHierarchyChain, type ParsedRow, type RowResult } from "@/lib/services/master-catalogue-bulk-import-service";

/**
 * CATALOGUE-PROD-ACTIVATE — resumable, checkpointed production activation
 * of a registered dataset. Replaces "hold one Vercel request open for the
 * whole file" with: a full read-only dry run in one call (fast — no
 * writes), then execution in bounded batches (default 200 rows) driven by
 * repeated authenticated `processNextBatch` calls, each of which claims the
 * job with an optimistic lock, processes its slice, persists the
 * checkpoint, and returns — so a closed browser tab, a slow network, or a
 * platform restart never loses progress or risks a duplicate write; the
 * next `processNextBatch` call just resumes from the persisted cursor.
 *
 * Only ever reuses evaluate()/parseRows()/requireHierarchyChain() from the
 * already-tested single-shot engine — never reimplements row/hierarchy
 * logic — so a dataset activated through this path produces byte-identical
 * results to the local CLI import.
 */

function requireOwner(actor: PlatformActor): void {
  if (actor.platformRole !== "PLATFORM_OWNER") {
    throw new PermissionDeniedError("Production catalogue activation is restricted to the platform owner.");
  }
}

export const CONTINUABLE_STATUSES: MasterCatalogueImportJobStatus[] = [MasterCatalogueImportJobStatus.PAUSED, MasterCatalogueImportJobStatus.IMPORT_RUNNING];
/** How long a job may sit in IMPORT_RUNNING before a new caller may treat it as abandoned (crashed/timed-out mid-batch) and reclaim it. Must exceed the longest maxDuration of any route that calls processNextBatch (the /activate route's runJobBatches loop is bounded at 300s) — otherwise a second caller could misclassify a still-legitimately-running call as stale before its own request ceiling has even expired, recreating the same race this guards against. 360s (6 min) gives a full minute of margin beyond that 300s ceiling. */
export const STALE_IMPORT_RUNNING_MS = 6 * 60 * 1000;
export const TERMINAL_STATUSES: MasterCatalogueImportJobStatus[] = [
  MasterCatalogueImportJobStatus.COMPLETED,
  MasterCatalogueImportJobStatus.COMPLETED_WITH_WARNINGS,
  MasterCatalogueImportJobStatus.FAILED,
  MasterCatalogueImportJobStatus.CANCELLED,
  MasterCatalogueImportJobStatus.ROLLED_BACK,
];

export type DryRunReport = {
  totalRows: number;
  validRows: number;
  rejectedRows: number;
  warningRows: number;
  toInsert: number;
  toUpdate: number;
  unchanged: number;
  estimatedBatches: number;
  warningSample: RowResult[];
  rejectedSample: RowResult[];
};

function toJobDTO(job: {
  id: string; datasetId: string; datasetVersion: string; status: MasterCatalogueImportJobStatus; sourceChecksum: string;
  manifestJson: unknown; dryRunReportJson: unknown; batchSize: number; currentRowCursor: number; totalRows: number;
  processedRows: number; insertedCount: number; updatedCount: number; unchangedCount: number; rejectedCount: number;
  warningCount: number; itemsCreated: number; versionsCreated: number; classificationsCreated: number; hierarchyNodesCreated: number;
  categoriesCreated: number; currentFileName: string | null; lastErrorMessage: string | null; startedAt: Date | null;
  completedAt: Date | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: job.id,
    datasetId: job.datasetId,
    datasetVersion: job.datasetVersion,
    status: job.status,
    sourceChecksum: job.sourceChecksum,
    dryRunReport: job.dryRunReportJson as DryRunReport | null,
    batchSize: job.batchSize,
    totalRows: job.totalRows,
    processedRows: job.processedRows,
    insertedCount: job.insertedCount,
    updatedCount: job.updatedCount,
    unchangedCount: job.unchangedCount,
    rejectedCount: job.rejectedCount,
    warningCount: job.warningCount,
    itemsCreated: job.itemsCreated,
    versionsCreated: job.versionsCreated,
    classificationsCreated: job.classificationsCreated,
    hierarchyNodesCreated: job.hierarchyNodesCreated,
    categoriesCreated: job.categoriesCreated,
    currentFileName: job.currentFileName,
    lastErrorMessage: job.lastErrorMessage,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

/** Concatenates every registered file's valid rows in manifest order — the single, stable sequence a job's cursor indexes into. */
function loadDatasetRowSequence(dataset: DatasetDefinition): { validRows: ParsedRow[]; malformed: RowResult[]; rowFileBoundaries: { fileName: string; startIndex: number; endIndex: number }[] } {
  const files = loadApprovedDatasetFiles(dataset);
  const validRows: ParsedRow[] = [];
  const malformed: RowResult[] = [];
  const rowFileBoundaries: { fileName: string; startIndex: number; endIndex: number }[] = [];

  for (const file of files) {
    const { rows, malformed: fileMalformed } = parseRows(file.csvText);
    const startIndex = validRows.length;
    validRows.push(...rows);
    malformed.push(...fileMalformed);
    rowFileBoundaries.push({ fileName: file.fileName, startIndex, endIndex: validRows.length });
  }

  return { validRows, malformed, rowFileBoundaries };
}

function fileNameForCursor(rowFileBoundaries: { fileName: string; startIndex: number; endIndex: number }[], cursor: number): string | null {
  const boundary = rowFileBoundaries.find((b) => cursor >= b.startIndex && cursor < b.endIndex);
  return boundary?.fileName ?? rowFileBoundaries[rowFileBoundaries.length - 1]?.fileName ?? null;
}

/**
 * CATALOGUE-ACTIVATE-2 — extended with registry metadata (industry/package
 * mapping, schema profile, approval/registration state, a stricter
 * combined fingerprint) and a fast readiness verdict (registry metadata +
 * a live MasterDiscipline lookup only — no per-file disk I/O, so this
 * stays cheap regardless of how many datasets or how large their source
 * files are). Never persisted, never creates an import job/batch row. Safe
 * fields only: no raw file content, no unrestricted paths (sourceDir is
 * always a data-imports/* subpath from the registry itself, never client
 * input), no commercial metadata from the source rows. See
 * getDatasetReadinessDetail below for the full, file-verifying check.
 */
export async function listRegisteredDatasetsSummary(owner: PlatformActor) {
  requireOwner(owner);
  const datasets = listDatasetDefinitions();
  const knownDisciplines = await prisma.masterDiscipline.findMany({ select: { key: true } });
  const knownDisciplineKeys = new Set(knownDisciplines.map((d) => d.key));

  return Promise.all(
    datasets.map(async (dataset) => {
      const [discipline, latestJob, itemCount] = await Promise.all([
        prisma.masterDiscipline.findUnique({ where: { key: dataset.disciplineKey } }),
        prisma.masterCatalogueImportJob.findFirst({ where: { datasetId: dataset.datasetId }, orderBy: { createdAt: "desc" } }),
        prisma.masterDiscipline.findUnique({ where: { key: dataset.disciplineKey } }).then((d) => (d ? prisma.masterItem.count({ where: { disciplineId: d.id } }) : 0)),
      ]);
      const readiness = checkDatasetReadinessFast(dataset, knownDisciplineKeys);
      return {
        datasetId: dataset.datasetId,
        datasetVersion: dataset.datasetVersion,
        label: dataset.label,
        sourceFolder: dataset.sourceDir,
        industryCode: dataset.industryCode,
        disciplineKey: dataset.disciplineKey,
        disciplineReady: Boolean(discipline),
        targetPackageCode: dataset.targetPackageCode,
        schemaProfileId: dataset.schemaProfileId,
        active: dataset.active,
        approved: dataset.approved,
        registrationSource: dataset.registrationSource,
        validationStatus: dataset.validationStatus,
        fileCount: dataset.files.length,
        expectedRowCount: dataset.files.reduce((sum, f) => sum + f.expectedRowCount, 0),
        sourceChecksum: computeDatasetSourceChecksum(dataset),
        fingerprint: computeDatasetFingerprint(dataset),
        currentProductionItemCount: itemCount,
        latestJob: latestJob ? toJobDTO(latestJob) : null,
        readiness: readiness.status,
        blockReasons: readiness.blockReasons,
        warnings: readiness.warnings,
      };
    }),
  );
}

/**
 * CATALOGUE-ACTIVATE-2 — the full, file-verifying readiness check for one
 * dataset, on demand. Unlike the fast check baked into
 * listRegisteredDatasetsSummary, this re-reads every file in the dataset
 * off disk to verify it still exists, still matches its approved
 * checksum, and still has the expected row count — real I/O, meant to be
 * called per-dataset rather than for every dataset on every list request.
 */
export async function getDatasetReadinessDetail(owner: PlatformActor, datasetId: string) {
  requireOwner(owner);
  const dataset = requireDatasetDefinition(datasetId);
  const knownDisciplines = await prisma.masterDiscipline.findMany({ select: { key: true } });
  const knownDisciplineKeys = new Set(knownDisciplines.map((d) => d.key));
  return checkDatasetReadiness(dataset, knownDisciplineKeys);
}

/**
 * CATALOGUE-COMMERCIAL Checkpoint 1A — read-only inspection only, no
 * mutation. Production evidence showed a dataset's currentProductionItemCount
 * above zero with latestJob null (no MasterCatalogueImportJob row for that
 * datasetId) — meaning those items did not come through this
 * datasetId-tracked pipeline. This lists their raw provenance
 * (sourceBatchId, which points at the older, separate
 * MasterCatalogueImportBatch table; createdAt) so the platform owner can
 * see where they actually came from before deciding whether to execute the
 * dataset's own governed import alongside them.
 */
export async function inspectDatasetProductionItems(owner: PlatformActor, datasetId: string) {
  requireOwner(owner);
  const dataset = requireDatasetDefinition(datasetId);
  const discipline = await prisma.masterDiscipline.findUnique({ where: { key: dataset.disciplineKey } });
  if (!discipline) return { disciplineReady: false, items: [] };

  const items = await prisma.masterItem.findMany({
    where: { disciplineId: discipline.id },
    select: {
      id: true,
      itemCode: true,
      name: true,
      status: true,
      createdAt: true,
      sourceBatchId: true,
      sourceBatch: { select: { uploadedFileName: true, status: true, executedAt: true, createdAt: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return {
    disciplineReady: true,
    disciplineKey: dataset.disciplineKey,
    totalCount: items.length,
    items: items.map((item) => ({
      id: item.id,
      itemCode: item.itemCode,
      name: item.name,
      status: item.status,
      createdAt: item.createdAt,
      sourceBatchId: item.sourceBatchId,
      sourceBatchFileName: item.sourceBatch?.uploadedFileName ?? null,
      sourceBatchStatus: item.sourceBatch?.status ?? null,
      sourceBatchExecutedAt: item.sourceBatch?.executedAt ?? null,
    })),
  };
}

export async function listJobsForDataset(owner: PlatformActor, datasetId: string) {
  requireOwner(owner);
  requireDatasetDefinition(datasetId);
  const jobs = await prisma.masterCatalogueImportJob.findMany({ where: { datasetId }, orderBy: { createdAt: "desc" }, take: 25 });
  return jobs.map(toJobDTO);
}

export async function getJob(owner: PlatformActor, jobId: string) {
  requireOwner(owner);
  const job = await prisma.masterCatalogueImportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundError("Import job not found.");
  return toJobDTO(job);
}

/**
 * Runs a complete, read-only pass over every registered file for a dataset
 * (no database mutation) and persists the report. Refuses to start a second
 * dry run or execution while one is already active for the same dataset.
 */
export async function registerAndDryRun(owner: PlatformActor, datasetId: string) {
  requireOwner(owner);
  const dataset = requireDatasetDefinition(datasetId);

  const active = await prisma.masterCatalogueImportJob.findFirst({
    where: { datasetId, status: { notIn: TERMINAL_STATUSES } },
    orderBy: { createdAt: "desc" },
  });
  if (active) throw new AppError("JOB_ALREADY_ACTIVE", `An import job for this dataset is already active (status: ${active.status}). View or cancel it before starting a new one.`, 409);

  const ctx = await requireHierarchyChain(dataset.profile);
  const { validRows, malformed, rowFileBoundaries } = loadDatasetRowSequence(dataset);
  void rowFileBoundaries;

  const dryRunResult = await evaluate(owner, ctx, dataset.profile, validRows, false);
  const sourceChecksum = computeDatasetSourceChecksum(dataset);
  const totalRows = validRows.length + malformed.length;
  const warningRowsSample = dryRunResult.results.filter((r) => (r.warnings?.length ?? 0) > 0).slice(0, 50);
  const rejectedSample = malformed.slice(0, 50);

  const job = await prisma.masterCatalogueImportJob.create({
    data: {
      datasetId: dataset.datasetId,
      datasetVersion: dataset.datasetVersion,
      actorUserId: owner.userId,
      disciplineId: ctx.disciplineId,
      status: MasterCatalogueImportJobStatus.DRY_RUN_COMPLETE,
      sourceChecksum,
      manifestJson: dataset.files.map((f) => ({ fileName: f.fileName, approvedChecksum: f.approvedChecksum, expectedRowCount: f.expectedRowCount })),
      dryRunReportJson: {
        totalRows,
        validRows: validRows.length,
        rejectedRows: malformed.length,
        warningRows: dryRunResult.warningRowCount,
        toInsert: dryRunResult.inserted,
        toUpdate: dryRunResult.updated,
        unchanged: dryRunResult.unchanged,
        estimatedBatches: Math.ceil(validRows.length / 200),
        warningSample: warningRowsSample,
        rejectedSample,
      },
      totalRows,
      rejectedCount: malformed.length,
      warningCount: dryRunResult.warningRowCount,
    },
  });

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "CATALOGUE_DATASET_DRY_RUN",
    targetType: "MasterCatalogueImportJob",
    targetId: job.id,
    metadata: { datasetId, totalRows, validRows: validRows.length, rejectedRows: malformed.length },
  });

  return toJobDTO(job);
}

/**
 * Validates the job's dry-run identity is still current (source unchanged
 * since dry run), creates the companion legacy batch row items will link
 * to, and arms the job (PAUSED, cursor 0) for its first processNextBatch call.
 */
export async function confirmExecution(owner: PlatformActor, jobId: string) {
  requireOwner(owner);
  const job = await prisma.masterCatalogueImportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundError("Import job not found.");
  if (job.status !== MasterCatalogueImportJobStatus.DRY_RUN_COMPLETE) {
    throw new AppError("JOB_NOT_CONFIRMABLE", `Job status is ${job.status}; only a job with a fresh dry run (DRY_RUN_COMPLETE) can be confirmed.`, 409);
  }

  const dataset = requireDatasetDefinition(job.datasetId);
  const currentChecksum = computeDatasetSourceChecksum(dataset);
  if (currentChecksum !== job.sourceChecksum) {
    throw new AppError("SOURCE_CHANGED", "The approved source files changed since this dry run. Run a new dry run before executing.", 409);
  }

  const legacyBatch = await prisma.masterCatalogueImportBatch.create({
    data: {
      actorUserId: owner.userId,
      disciplineId: job.disciplineId,
      uploadedFileName: `${dataset.datasetId}@${dataset.datasetVersion}`,
      checksum: currentChecksum,
      status: MasterCatalogueImportStatus.EXECUTED,
      totalRows: job.totalRows,
    },
  });

  const updated = await prisma.masterCatalogueImportJob.update({
    where: { id: jobId },
    data: { status: MasterCatalogueImportJobStatus.PAUSED, legacyBatchId: legacyBatch.id, startedAt: new Date() },
  });

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "CATALOGUE_DATASET_EXECUTION_CONFIRMED",
    targetType: "MasterCatalogueImportJob",
    targetId: jobId,
    metadata: { datasetId: job.datasetId, totalRows: job.totalRows },
  });

  return toJobDTO(updated);
}

/**
 * Processes exactly one bounded batch (job.batchSize rows) and returns
 * promptly — the caller (the admin UI, via repeated authenticated calls) is
 * what drives an import to completion, never one long-held request. Uses an
 * updatedAt-based optimistic lock so two concurrent calls for the same job
 * can never both process the same batch.
 */
export async function processNextBatch(owner: PlatformActor, jobId: string) {
  requireOwner(owner);
  const job = await prisma.masterCatalogueImportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundError("Import job not found.");
  if (!CONTINUABLE_STATUSES.includes(job.status)) {
    throw new AppError("JOB_NOT_CONTINUABLE", `Job status is ${job.status}; it cannot be continued.`, 409);
  }

  // CATALOGUE-INTEGRITY-REPAIR — verify the job's persisted source identity
  // against the CURRENT registered dataset definition before this job is
  // claimed/mutated at all (not after, inside the try block below). A
  // mismatch here means the registry's checksums changed since this job was
  // created (e.g. a registry correction like this one) — even when the
  // underlying CSV bytes never changed, computeDatasetSourceChecksum hashes
  // the registered checksum *strings*, so correcting them changes the
  // computed identity. Silently resuming under a different identity than
  // the job was created with would make its persisted provenance
  // (sourceChecksum, dryRunReportJson) inconsistent with what actually ran.
  // Throwing here — before the optimistic-lock claim below — guarantees the
  // job is left completely untouched: no status change, no cursor movement,
  // no row processed. The owner must explicitly cancel it and start a fresh
  // dry run under the current identity.
  const dataset = requireDatasetDefinition(job.datasetId);
  const currentIdentityChecksum = computeDatasetSourceChecksum(dataset);
  if (currentIdentityChecksum !== job.sourceChecksum) {
    throw new AppError(
      "JOB_SOURCE_IDENTITY_MISMATCH",
      "The approved source registration for this dataset has changed since this job was created. Cancel this job and start a new dry run before continuing.",
      409,
    );
  }

  // CATALOGUE-CONCURRENCY-REPAIR — CONTINUABLE_STATUSES intentionally includes
  // IMPORT_RUNNING (a job can be genuinely stuck there if a prior serverless
  // invocation crashed or timed out mid-batch), but a claim must never treat
  // a FRESH IMPORT_RUNNING job the same as a stale one. Previously this
  // updateMany matched status IN CONTINUABLE_STATUSES unconditionally, so two
  // overlapping callers could both win the lock in sequence: A claims
  // PAUSED->IMPORT_RUNNING, then B reads that same IMPORT_RUNNING row (with
  // the updatedAt A just wrote) and reclaims IMPORT_RUNNING->IMPORT_RUNNING
  // before A finishes — both then process the same cursor slice. That is the
  // exact mechanism behind the duplicate-row/unique-constraint incident this
  // repairs. A job is only eligible for reclaim from IMPORT_RUNNING if it has
  // sat there, untouched, longer than STALE_IMPORT_RUNNING_MS — comfortably
  // longer than a single 200-row batch should ever take, so a live
  // in-progress claim is never stolen, while a genuinely abandoned one
  // (crashed process) is still recoverable using only the already-persisted
  // updatedAt column — no new field, no migration.
  const isStaleImportRunning =
    job.status === MasterCatalogueImportJobStatus.IMPORT_RUNNING && Date.now() - job.updatedAt.getTime() > STALE_IMPORT_RUNNING_MS;

  if (job.status === MasterCatalogueImportJobStatus.IMPORT_RUNNING && !isStaleImportRunning) {
    throw new AppError("JOB_BUSY", "Another continuation is already in progress for this job.", 409);
  }

  const claim = await prisma.masterCatalogueImportJob.updateMany({
    where: {
      id: jobId,
      updatedAt: job.updatedAt,
      status: isStaleImportRunning ? MasterCatalogueImportJobStatus.IMPORT_RUNNING : MasterCatalogueImportJobStatus.PAUSED,
    },
    data: { status: MasterCatalogueImportJobStatus.IMPORT_RUNNING },
  });
  if (claim.count === 0) {
    throw new AppError("JOB_BUSY", "Another continuation is already in progress for this job.", 409);
  }

  try {
    const ctx = await requireHierarchyChain(dataset.profile);
    const { validRows, rowFileBoundaries } = loadDatasetRowSequence(dataset);

    const cursor = job.currentRowCursor;
    const slice = validRows.slice(cursor, cursor + job.batchSize);
    const batchResult = await evaluate(owner, ctx, dataset.profile, slice, true, job.legacyBatchId ?? undefined);

    const newCursor = cursor + slice.length;
    const isComplete = newCursor >= validRows.length;
    // Rejected/warning counts are already fully known from the dry-run pass (parsing is
    // deterministic and read-only) — execution never recomputes them, only item/version/
    // classification/hierarchy counts, which only exist once rows are actually written.
    const hasIssues = job.warningCount > 0 || job.rejectedCount > 0;

    const updated = await prisma.masterCatalogueImportJob.update({
      where: { id: jobId },
      data: {
        currentRowCursor: newCursor,
        processedRows: newCursor,
        insertedCount: { increment: batchResult.inserted },
        updatedCount: { increment: batchResult.updated },
        unchangedCount: { increment: batchResult.unchanged },
        itemsCreated: { increment: batchResult.inserted },
        versionsCreated: { increment: batchResult.versionsCreated },
        classificationsCreated: { increment: batchResult.classificationsCreated },
        hierarchyNodesCreated: { increment: batchResult.hierarchyNodesCreated },
        categoriesCreated: { increment: batchResult.categoriesCreated },
        currentFileName: fileNameForCursor(rowFileBoundaries, Math.min(newCursor, validRows.length - 1)),
        status: isComplete ? (hasIssues ? MasterCatalogueImportJobStatus.COMPLETED_WITH_WARNINGS : MasterCatalogueImportJobStatus.COMPLETED) : MasterCatalogueImportJobStatus.PAUSED,
        completedAt: isComplete ? new Date() : null,
        lastErrorMessage: null,
      },
    });

    if (isComplete) {
      await recordPlatformActionAudit({
        actorUserId: owner.userId,
        actorPlatformRole: owner.platformRole,
        action: "CATALOGUE_DATASET_IMPORT_COMPLETED",
        targetType: "MasterCatalogueImportJob",
        targetId: jobId,
        metadata: { datasetId: job.datasetId, insertedCount: updated.insertedCount, updatedCount: updated.updatedCount, unchangedCount: updated.unchangedCount },
      });
    }

    return toJobDTO(updated);
  } catch (error) {
    const message = error instanceof AppError ? error.message : "Unexpected error while processing this batch.";
    await prisma.masterCatalogueImportJob.update({
      where: { id: jobId },
      data: { status: MasterCatalogueImportJobStatus.FAILED, lastErrorMessage: message },
    });
    throw error;
  }
}

const MAX_BATCHES_PER_CALL = 40;

/**
 * CATALOGUE-CREATE-1 — drives processNextBatch repeatedly within one
 * authenticated call instead of requiring the owner to trigger every single
 * batch by hand. Reuses processNextBatch's own optimistic lock and
 * checkpointing unchanged; this is purely a server-side loop around it, so
 * every safety property (resumability, single-batch atomicity, failure
 * isolation) still holds. Capped at MAX_BATCHES_PER_CALL (40 x 200 rows =
 * 8,000 rows) to stay well inside a serverless function's execution window
 * for very large datasets — calling this again resumes from the persisted
 * cursor exactly like calling processNextBatch again would.
 */
export async function runJobBatches(owner: PlatformActor, jobId: string, maxBatches: number = MAX_BATCHES_PER_CALL) {
  requireOwner(owner);
  let last = await getJob(owner, jobId);
  let batchesRun = 0;
  while (batchesRun < maxBatches && CONTINUABLE_STATUSES.includes(last.status as MasterCatalogueImportJobStatus)) {
    last = await processNextBatch(owner, jobId);
    batchesRun += 1;
  }
  return { job: last, batchesRun, isComplete: TERMINAL_STATUSES.includes(last.status as MasterCatalogueImportJobStatus) };
}

export async function cancelJob(owner: PlatformActor, jobId: string) {
  requireOwner(owner);
  const job = await prisma.masterCatalogueImportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundError("Import job not found.");
  if (TERMINAL_STATUSES.includes(job.status)) {
    throw new AppError("JOB_ALREADY_TERMINAL", `Job is already ${job.status}.`, 409);
  }

  const updated = await prisma.masterCatalogueImportJob.update({ where: { id: jobId }, data: { status: MasterCatalogueImportJobStatus.CANCELLED } });

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "CATALOGUE_DATASET_IMPORT_CANCELLED",
    targetType: "MasterCatalogueImportJob",
    targetId: jobId,
    metadata: { datasetId: job.datasetId, processedRows: job.processedRows, totalRows: job.totalRows },
  });

  return toJobDTO(updated);
}
