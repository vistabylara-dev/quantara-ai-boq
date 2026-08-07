import { after } from "next/server";
import { ExtractionJobStatus, type ExtractionEngineType, type ExtractionJob } from "@prisma/client";
import { AppError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import {
  claimQueuedExtractionJob,
  completeExtractionJob,
  failExtractionJob,
  findOrCreateQueuedExtractionJob,
  findStaleRunningExtractionJobs,
  getExtractionJobByIdOrNull,
  getExtractionJobRecord,
  isExtractionJobCancelled,
  QUEUE_NON_TERMINAL_STATUSES,
  requeueExtractionJobForRetry,
  resetExtractionJobToQueued,
  setExtractionJobCancelled,
  updateExtractionJobProgress,
} from "@/lib/repositories/extraction-job-repository";
import type { EnqueueJobInput, JobHandler, JobHandlerContext, JobQueue } from "./job-queue";

/**
 * Comfortably longer than the extraction routes' 60s maxDuration
 * (preprocess/classify/extract) — a RUNNING job with no persisted update in
 * this long can only mean the invocation that owned it is dead, never a
 * legitimately slow attempt still in flight (see
 * findStaleRunningExtractionJobs's own doc for why `updatedAt` is the right
 * signal). 5 minutes is ~5x the longest maxDuration in this codebase,
 * leaving no realistic room for a false "stale" classification while still
 * recovering genuinely abandoned jobs promptly.
 */
const STALE_RUNNING_CUTOFF_MS = 5 * 60 * 1000;

/**
 * In-process queue — "local" in the same spirit as local-document-storage-adapter:
 * there is no separate worker process or durable external queue here, this
 * still processes jobs inside the same Node process that received the
 * triggering HTTP request.
 *
 * What differs from a plain dev-server setup is how that in-process work
 * survives past the response. On Vercel, a Route Handler's function
 * invocation can be frozen almost immediately after the response is sent —
 * a bare `setImmediate()` scheduled during the request has no guarantee of
 * ever running. In production, scheduling instead goes through Next.js
 * `after()`, which Vercel explicitly keeps the invocation alive for (up to
 * the function's maxDuration). Outside of a request context (dev/test
 * processes calling these services directly, or module-init recovery —
 * see recoverStaleJobs()), `after()` throws by design, so those paths keep
 * using `setImmediate`, matching the previous behavior and long-lived
 * process.
 *
 * All actual Prisma reads/writes — including tenant scoping and conditional
 * lifecycle-transition guards — live in extraction-job-repository.ts; this
 * class only holds the state-machine decisions (when to retry, when to
 * schedule, when a job is stale).
 */
export class LocalJobQueue implements JobQueue {
  private handlers = new Map<ExtractionEngineType, JobHandler>();

  registerHandler(engineType: ExtractionEngineType, handler: JobHandler): void {
    this.handlers.set(engineType, handler);
  }

  async enqueue(input: EnqueueJobInput): Promise<ExtractionJob> {
    // findOrCreateQueuedExtractionJob is atomic (SERIALIZABLE transaction) — two concurrent
    // enqueue() calls for the same company+file+engine can never both create a row.
    const job = await findOrCreateQueuedExtractionJob(input);
    if (job.status === ExtractionJobStatus.QUEUED) {
      // Whether this call created the job or found an existing QUEUED one (e.g. one
      // recoverStaleJobs() reset, or one whose original after()/setImmediate scheduling was
      // itself lost), scheduling is safe either way: claimQueuedExtractionJob() inside
      // processQueuedJob() is a no-op once another execution has already moved the job past
      // QUEUED, so this can never cause double-processing.
      this.scheduleProcessing(job.companyId, job.id);
    }
    return job;
  }

  async cancel(companyId: string, jobId: string): Promise<ExtractionJob> {
    const job = await getExtractionJobRecord(companyId, jobId);
    if (!QUEUE_NON_TERMINAL_STATUSES.includes(job.status)) {
      throw new AppError("JOB_NOT_CANCELLABLE", `Cannot cancel a job that is already ${job.status}.`, 409);
    }

    const updated = await setExtractionJobCancelled(companyId, jobId);
    if (!updated) {
      // Raced past terminal between the check above and the conditional write.
      throw new AppError("JOB_NOT_CANCELLABLE", "Cannot cancel a job that is already in a terminal state.", 409);
    }
    await createAuditLog(companyId, { entityType: "ExtractionJob", entityId: jobId, action: "EXTRACTION_JOB_CANCELLED", payload: { engineType: job.engineType, projectFileId: job.projectFileId } });
    return updated;
  }

  /**
   * Module-init has no request to attach `after()` to, so this deliberately
   * does not attempt to re-run recovered jobs itself in production — that
   * would either throw (calling after() with no request store) or, with a
   * bare setImmediate, run in a cold-start invocation with no guarantee of
   * surviving to completion, silently re-creating the exact bug the
   * after()-based scheduling fixes. Resetting the status is still correct
   * and honest: the job becomes eligible to actually run the next time a
   * real request touches this file + engine (see enqueue() above). In dev,
   * the process stays alive, so immediate reprocessing via setImmediate is
   * still safe and preserves prior behavior.
   *
   * Only genuinely stale RUNNING jobs are touched — see
   * STALE_RUNNING_CUTOFF_MS and findStaleRunningExtractionJobs.
   * resetExtractionJobToQueued re-checks the same staleness condition
   * atomically at reset time, so a job a real worker updated between the
   * selecting read and this reset is left alone instead of being stolen —
   * it can never be claimed twice.
   */
  async recoverStaleJobs(): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_RUNNING_CUTOFF_MS);
    const stale = await findStaleRunningExtractionJobs(cutoff);
    for (const job of stale) {
      const reset = await resetExtractionJobToQueued(job.companyId, job.id, cutoff);
      if (!reset) continue; // a real update raced in since the selecting read; leave it alone
      if (process.env.NODE_ENV !== "production") {
        this.scheduleLocal(job.companyId, job.id);
      }
    }
  }

  /**
   * Production: schedule via Next.js `after()` so Vercel keeps the
   * invocation alive past the response. `after()` throws synchronously if
   * called with no active request context (e.g. a script, or module-init
   * recovery) — that's a genuine "there is nothing to attach to" case, not
   * an error to hide, but still falls back to setImmediate rather than
   * silently dropping the job.
   */
  private scheduleProcessing(companyId: string, jobId: string): void {
    if (process.env.NODE_ENV === "production") {
      try {
        after(() =>
          this.processQueuedJob(companyId, jobId).catch((error) => {
            console.error(`[local-job-queue] unhandled error processing job ${jobId}`, error);
          }),
        );
        return;
      } catch (error) {
        console.error(`[local-job-queue] after() unavailable outside a request context for job ${jobId}, falling back to setImmediate`, error);
      }
    }
    this.scheduleLocal(companyId, jobId);
  }

  private scheduleLocal(companyId: string, jobId: string): void {
    setImmediate(() => {
      this.processQueuedJob(companyId, jobId).catch((error) => {
        console.error(`[local-job-queue] unhandled error processing job ${jobId}`, error);
      });
    });
  }

  /**
   * Runs one job to a terminal state, retrying in place (bounded by
   * maximumAttempts) rather than recursively rescheduling itself — a retry
   * must not depend on a second setImmediate/after() ever firing.
   *
   * Every iteration re-claims the job atomically via
   * claimQueuedExtractionJob(): if two scheduled callbacks (or a stale-job
   * re-trigger racing a still-live original) both call this for the same
   * jobId, only one claim can ever succeed. Every subsequent write
   * (complete/retry/fail) is itself a conditional transition scoped to
   * "only from RUNNING" — so if cancel() lands at any point after the
   * claim, the next write this loop attempts simply fails to match and the
   * loop returns without ever overwriting CANCELLED. There is no
   * read-then-decide cancellation check left in this method; the
   * conditional writes are what actually guarantee correctness.
   */
  async processQueuedJob(companyId: string, jobId: string): Promise<void> {
    for (;;) {
      const claimed = await claimQueuedExtractionJob(companyId, jobId);
      if (!claimed) return; // not QUEUED for this company anymore: claimed elsewhere, cancelled, or terminal

      const handler = this.handlers.get(claimed.engineType);
      if (!handler) {
        await failExtractionJob(companyId, jobId, `No handler is registered for engine type ${claimed.engineType}.`, "NO_HANDLER_REGISTERED");
        return;
      }

      const ctx: JobHandlerContext = {
        updateProgress: (percentage, step) => updateExtractionJobProgress(companyId, jobId, percentage, step),
        isCancelled: () => isExtractionJobCancelled(companyId, jobId),
      };

      try {
        const result = await handler(claimed, ctx);
        await completeExtractionJob(companyId, jobId, {
          status: result.status ?? ExtractionJobStatus.COMPLETED,
          resultSummary: result.resultSummary,
          usageMetadata: result.usageMetadata,
        });
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const current = await getExtractionJobByIdOrNull(companyId, jobId);
        if (!current || current.status !== ExtractionJobStatus.RUNNING) return; // cancelled (or otherwise moved on) — nothing to write

        if (current.attempts < current.maximumAttempts) {
          const requeued = await requeueExtractionJobForRetry(companyId, jobId, message);
          if (!requeued) return; // lost a race (e.g. cancellation) between the read above and this write
          continue; // another controlled attempt, in the same call — re-claims atomically at the top
        }

        await failExtractionJob(companyId, jobId, message);
        return;
      }
    }
  }
}
