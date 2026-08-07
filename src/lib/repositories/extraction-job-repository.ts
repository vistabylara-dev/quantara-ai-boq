import { ExtractionJobStatus, Prisma, type ExtractionEngineType, type ExtractionJob } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";

/** Statuses a job can be re-triggered/cancelled from — anything not yet in a terminal state. */
export const QUEUE_NON_TERMINAL_STATUSES: ExtractionJobStatus[] = [
  ExtractionJobStatus.QUEUED,
  ExtractionJobStatus.RUNNING,
  ExtractionJobStatus.NEEDS_INPUT,
  ExtractionJobStatus.NEEDS_REVIEW,
];

export function toExtractionJobDTO(row: ExtractionJob) {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId,
    projectFileId: row.projectFileId,
    engineType: row.engineType,
    provider: row.provider,
    status: row.status,
    progressPercentage: row.progressPercentage,
    currentStep: row.currentStep,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
    attempts: row.attempts,
    maximumAttempts: row.maximumAttempts,
    resultSummary: row.resultSummaryJson,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getExtractionJobRecord(companyId: string, jobId: string): Promise<ExtractionJob> {
  const row = await prisma.extractionJob.findFirst({ where: { id: jobId, companyId } });
  if (!row) throw new NotFoundError("Extraction job not found.");
  return row;
}

export async function listExtractionJobsForFile(companyId: string, projectFileId: string): Promise<ExtractionJob[]> {
  return prisma.extractionJob.findMany({
    where: { companyId, projectFileId },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Queue-internal persistence — used by LocalJobQueue (src/lib/jobs).
//
// Every operation here takes companyId and includes it in its Prisma `where`
// clause — job IDs are UUIDs and effectively unguessable, but this is a
// multi-tenant SaaS and tenant isolation must not rest on that alone. A
// companyId mismatch makes an operation a safe no-op (0 rows affected, or a
// null return), never a cross-tenant read or write, and never a thrown
// error that would leak whether a given ID belongs to another company.
//
// Every lifecycle-transition write below is a conditional `updateMany`
// scoped to the exact status(es) it's valid to transition *from*, and
// reports back whether it actually applied (count === 1). This is what
// makes cancellation race-safe: cancel() writes CANCELLED unconditionally
// (from any non-terminal status), and every other transition (claim, retry,
// complete, fail) only ever succeeds `where: { status: <its own valid
// source status> }` — so if cancellation lands first, every later
// transition's WHERE simply stops matching and the write silently does
// nothing. There is no read-then-decide window for a race to land in.
// ---------------------------------------------------------------------------

export type CreateQueuedExtractionJobInput = {
  companyId: string;
  projectId: string;
  projectFileId: string;
  engineType: ExtractionEngineType;
  createdByUserId: string;
  configuration?: Record<string, unknown>;
  maximumAttempts?: number;
};

function isSerializationFailure(error: unknown): boolean {
  // Prisma P2034: "Transaction failed due to a write conflict or a deadlock. Please retry your
  // transaction" — surfaced for a SERIALIZABLE transaction aborted by Postgres's conflict
  // detection (SQLSTATE 40001).
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2034";
}

/**
 * Finds the existing active (non-terminal) job for this company + file +
 * engine, or creates one — atomically, so two concurrent callers can never
 * both see "no active job" and both create one. A plain "SELECT then
 * INSERT if none" is a genuine write-skew race under READ COMMITTED (the
 * only two-query safety Postgres's default isolation actually gives you is
 * per-statement snapshot consistency, not cross-statement). Running the
 * check-and-create inside a SERIALIZABLE transaction instead means Postgres
 * itself detects that exact anomaly: if two concurrent transactions both
 * read "no active job" and both try to write a new one for the same
 * company+file+engine, Postgres aborts one with a serialization failure
 * (Prisma surfaces this as P2034) rather than silently letting both commit.
 * The aborted side retries — bounded, a handful of attempts — and on retry
 * its SELECT now sees the other transaction's committed row, so it
 * correctly returns the existing job instead of creating a duplicate.
 *
 * No unique index needed: this isn't working around a missing constraint,
 * it's Postgres's standard tool for exactly this "check invariant, then act
 * on it" class of race (the textbook SERIALIZABLE use case). Checked
 * against the current schema — no equivalent partial unique index already
 * exists on ExtractionJob, and this transactional approach makes adding
 * one unnecessary.
 */
export async function findOrCreateQueuedExtractionJob(input: CreateQueuedExtractionJobInput): Promise<ExtractionJob> {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const existing = await tx.extractionJob.findFirst({
            where: { companyId: input.companyId, projectFileId: input.projectFileId, engineType: input.engineType, status: { in: QUEUE_NON_TERMINAL_STATUSES } },
            orderBy: { createdAt: "desc" },
          });
          if (existing) return existing;

          return tx.extractionJob.create({
            data: {
              companyId: input.companyId,
              projectId: input.projectId,
              projectFileId: input.projectFileId,
              engineType: input.engineType,
              createdByUserId: input.createdByUserId,
              configurationJson: (input.configuration as Prisma.InputJsonValue | undefined) ?? undefined,
              maximumAttempts: input.maximumAttempts ?? 3,
              status: ExtractionJobStatus.QUEUED,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isSerializationFailure(error) && attempt < maxAttempts) continue;
      throw error;
    }
  }
  /* istanbul ignore next -- loop always returns or throws */
  throw new Error("findOrCreateQueuedExtractionJob: unreachable");
}

/**
 * Atomically transitions QUEUED -> RUNNING, scoped to this company: the
 * conditional `where: { status: QUEUED, companyId }` means the underlying
 * UPDATE only ever matches a row still in that state for that tenant, so if
 * two callers race to claim the same job, Postgres serializes the two
 * UPDATEs and only one can ever affect a row — `updateMany`'s count tells
 * us which. The loser gets `null` back and must not invoke the handler.
 * `startedAt` is (re)set to now on every claim, including retries — it
 * represents "when the current attempt started", which is what the
 * staleness check below actually needs.
 */
export async function claimQueuedExtractionJob(companyId: string, jobId: string): Promise<ExtractionJob | null> {
  const result = await prisma.extractionJob.updateMany({
    where: { id: jobId, companyId, status: ExtractionJobStatus.QUEUED },
    data: { status: ExtractionJobStatus.RUNNING, startedAt: new Date(), attempts: { increment: 1 } },
  });
  if (result.count !== 1) return null;
  return prisma.extractionJob.findFirst({ where: { id: jobId, companyId, status: ExtractionJobStatus.RUNNING } });
}

export async function getExtractionJobByIdOrNull(companyId: string, jobId: string): Promise<ExtractionJob | null> {
  return prisma.extractionJob.findFirst({ where: { id: jobId, companyId } });
}

export async function updateExtractionJobProgress(companyId: string, jobId: string, percentage: number, step?: string): Promise<void> {
  await prisma.extractionJob.updateMany({
    where: { id: jobId, companyId },
    data: { progressPercentage: Math.max(0, Math.min(100, Math.round(percentage))), ...(step ? { currentStep: step } : {}) },
  });
}

export async function isExtractionJobCancelled(companyId: string, jobId: string): Promise<boolean> {
  const current = await prisma.extractionJob.findFirst({ where: { id: jobId, companyId }, select: { status: true } });
  return current?.status === ExtractionJobStatus.CANCELLED;
}

/** Only applies `from` RUNNING — a job cancelled between the handler throwing and this call is left untouched. Returns whether it actually applied. */
export async function requeueExtractionJobForRetry(companyId: string, jobId: string, errorMessage: string): Promise<boolean> {
  const result = await prisma.extractionJob.updateMany({
    where: { id: jobId, companyId, status: ExtractionJobStatus.RUNNING },
    data: { status: ExtractionJobStatus.QUEUED, errorCode: "RETRY_PENDING", errorMessage },
  });
  return result.count === 1;
}

export type CompleteExtractionJobInput = {
  status: Extract<ExtractionJob["status"], "COMPLETED" | "NEEDS_INPUT" | "NEEDS_REVIEW">;
  resultSummary?: Record<string, unknown>;
  usageMetadata?: Record<string, unknown>;
};

/**
 * Only applies `from` RUNNING — a job cancelled between the handler
 * resolving and this call is left untouched (CANCELLED is never
 * overwritten). Clears errorCode/errorMessage/failedAt unconditionally on
 * success: a job that failed once, retried, and then succeeded must not
 * keep reporting the earlier attempt's error alongside a COMPLETED status.
 * Returns whether it actually applied.
 */
export async function completeExtractionJob(companyId: string, jobId: string, input: CompleteExtractionJobInput): Promise<boolean> {
  const result = await prisma.extractionJob.updateMany({
    where: { id: jobId, companyId, status: ExtractionJobStatus.RUNNING },
    data: {
      status: input.status,
      completedAt: new Date(),
      progressPercentage: 100,
      resultSummaryJson: (input.resultSummary as Prisma.InputJsonValue | undefined) ?? undefined,
      usageMetadataJson: (input.usageMetadata as Prisma.InputJsonValue | undefined) ?? undefined,
      errorCode: null,
      errorMessage: null,
      failedAt: null,
    },
  });
  return result.count === 1;
}

/** Only applies `from` RUNNING — a job cancelled between the handler throwing (final attempt) and this call is left untouched. Returns whether it actually applied. */
export async function failExtractionJob(companyId: string, jobId: string, errorMessage: string, errorCode = "HANDLER_ERROR"): Promise<boolean> {
  const result = await prisma.extractionJob.updateMany({
    where: { id: jobId, companyId, status: ExtractionJobStatus.RUNNING },
    data: { status: ExtractionJobStatus.FAILED, failedAt: new Date(), errorCode, errorMessage },
  });
  return result.count === 1;
}

/**
 * A RUNNING job whose `updatedAt` hasn't moved since before `cutoff` — every
 * write in the processing lifecycle (claim, progress update, retry,
 * completion, failure) touches `updatedAt`, so a RUNNING row with no recent
 * write can only mean the invocation that owned it is gone, never a
 * legitimately slow attempt still reporting progress. Deliberately not
 * scoped to a single companyId — recovery is a system-level sweep across
 * every tenant; each returned row carries its own companyId, which the
 * caller must pass into resetExtractionJobToQueued below.
 */
export async function findStaleRunningExtractionJobs(cutoff: Date): Promise<ExtractionJob[]> {
  return prisma.extractionJob.findMany({ where: { status: ExtractionJobStatus.RUNNING, updatedAt: { lt: cutoff } } });
}

/**
 * Resets a stale RUNNING job back to QUEUED — but only if it is *still*
 * exactly as stale as when it was selected: `status: RUNNING` AND
 * `updatedAt` still older than the same `cutoff` the caller used to select
 * it. A real worker can legitimately call updateProgress() between the
 * selecting read and this reset; that bumps `updatedAt` past `cutoff`, so
 * this conditional update simply won't match that row anymore — the
 * still-live job is left alone instead of being stolen out from under its
 * actual owner. Returns whether the reset actually applied.
 */
export async function resetExtractionJobToQueued(companyId: string, jobId: string, cutoff: Date): Promise<boolean> {
  const result = await prisma.extractionJob.updateMany({
    where: { id: jobId, companyId, status: ExtractionJobStatus.RUNNING, updatedAt: { lt: cutoff } },
    data: { status: ExtractionJobStatus.QUEUED, currentStep: null },
  });
  return result.count === 1;
}

export async function setExtractionJobCancelled(companyId: string, jobId: string): Promise<ExtractionJob | null> {
  const result = await prisma.extractionJob.updateMany({
    where: { id: jobId, companyId, status: { in: QUEUE_NON_TERMINAL_STATUSES } },
    data: { status: ExtractionJobStatus.CANCELLED },
  });
  if (result.count !== 1) return null;
  return prisma.extractionJob.findFirst({ where: { id: jobId, companyId } });
}
