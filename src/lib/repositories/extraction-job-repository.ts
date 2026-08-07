import { ExtractionJobStatus, type ExtractionEngineType, type ExtractionJob, type Prisma } from "@prisma/client";
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
// Queue-internal persistence — used by LocalJobQueue (src/lib/jobs). Not
// tenant-scoped by companyId the way the DTO-facing functions above are:
// the queue only ever operates on job IDs it already persisted itself, and
// callers into the queue (enqueue/cancel) are the ones responsible for
// tenant checks before a job ID ever reaches here. Keeps the queue's own
// state-machine logic (retry counting, terminal-status decisions,
// after()/setImmediate scheduling) out of this file — this file only ever
// does the actual Prisma reads/writes.
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

export async function findActiveExtractionJob(projectFileId: string, engineType: ExtractionEngineType): Promise<ExtractionJob | null> {
  return prisma.extractionJob.findFirst({
    where: { projectFileId, engineType, status: { in: QUEUE_NON_TERMINAL_STATUSES } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createQueuedExtractionJob(input: CreateQueuedExtractionJobInput): Promise<ExtractionJob> {
  return prisma.extractionJob.create({
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
}

/**
 * Atomically transitions QUEUED -> RUNNING: the conditional `where: {
 * status: QUEUED }` means the underlying UPDATE only ever matches a row
 * still in that state, so if two callers race to claim the same job,
 * Postgres serializes the two UPDATEs and only one can ever affect a row —
 * `updateMany`'s count tells us which. The loser gets `null` back and must
 * not invoke the handler. `startedAt` is (re)set to now on every claim,
 * including retries — it represents "when the current attempt started",
 * which is what the staleness check below actually needs.
 */
export async function claimQueuedExtractionJob(jobId: string): Promise<ExtractionJob | null> {
  const result = await prisma.extractionJob.updateMany({
    where: { id: jobId, status: ExtractionJobStatus.QUEUED },
    data: { status: ExtractionJobStatus.RUNNING, startedAt: new Date(), attempts: { increment: 1 } },
  });
  if (result.count !== 1) return null;
  return prisma.extractionJob.findUnique({ where: { id: jobId } });
}

export async function getExtractionJobByIdOrNull(jobId: string): Promise<ExtractionJob | null> {
  return prisma.extractionJob.findUnique({ where: { id: jobId } });
}

export async function updateExtractionJobProgress(jobId: string, percentage: number, step?: string): Promise<void> {
  await prisma.extractionJob.update({
    where: { id: jobId },
    data: { progressPercentage: Math.max(0, Math.min(100, Math.round(percentage))), ...(step ? { currentStep: step } : {}) },
  });
}

export async function isExtractionJobCancelled(jobId: string): Promise<boolean> {
  const current = await prisma.extractionJob.findUnique({ where: { id: jobId }, select: { status: true } });
  return current?.status === ExtractionJobStatus.CANCELLED;
}

export async function requeueExtractionJobForRetry(jobId: string, errorMessage: string): Promise<void> {
  await prisma.extractionJob.update({
    where: { id: jobId },
    data: { status: ExtractionJobStatus.QUEUED, errorCode: "RETRY_PENDING", errorMessage },
  });
}

export type CompleteExtractionJobInput = {
  status: Extract<ExtractionJob["status"], "COMPLETED" | "NEEDS_INPUT" | "NEEDS_REVIEW">;
  resultSummary?: Record<string, unknown>;
  usageMetadata?: Record<string, unknown>;
};

export async function completeExtractionJob(jobId: string, input: CompleteExtractionJobInput): Promise<void> {
  await prisma.extractionJob.update({
    where: { id: jobId },
    data: {
      status: input.status,
      completedAt: new Date(),
      progressPercentage: 100,
      resultSummaryJson: (input.resultSummary as Prisma.InputJsonValue | undefined) ?? undefined,
      usageMetadataJson: (input.usageMetadata as Prisma.InputJsonValue | undefined) ?? undefined,
    },
  });
}

export async function failExtractionJob(jobId: string, errorMessage: string, errorCode = "HANDLER_ERROR"): Promise<void> {
  await prisma.extractionJob.update({
    where: { id: jobId },
    data: { status: ExtractionJobStatus.FAILED, failedAt: new Date(), errorCode, errorMessage },
  });
}

/**
 * A RUNNING job whose `updatedAt` hasn't moved since before `cutoff` — every
 * write in the processing lifecycle (claim, progress update, retry,
 * completion, failure) touches `updatedAt`, so a RUNNING row with no recent
 * write can only mean the invocation that owned it is gone, never a
 * legitimately slow attempt still reporting progress.
 */
export async function findStaleRunningExtractionJobs(cutoff: Date): Promise<ExtractionJob[]> {
  return prisma.extractionJob.findMany({ where: { status: ExtractionJobStatus.RUNNING, updatedAt: { lt: cutoff } } });
}

export async function resetExtractionJobToQueued(jobId: string): Promise<void> {
  await prisma.extractionJob.update({ where: { id: jobId }, data: { status: ExtractionJobStatus.QUEUED, currentStep: null } });
}

export async function setExtractionJobCancelled(jobId: string): Promise<ExtractionJob> {
  return prisma.extractionJob.update({ where: { id: jobId }, data: { status: ExtractionJobStatus.CANCELLED } });
}
