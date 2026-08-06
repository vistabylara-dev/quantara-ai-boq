import { after } from "next/server";
import { ExtractionJobStatus, type ExtractionEngineType, type ExtractionJob, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import type { EnqueueJobInput, JobHandler, JobHandlerContext, JobQueue } from "./job-queue";

const NON_TERMINAL_STATUSES: ExtractionJobStatus[] = [
  ExtractionJobStatus.QUEUED,
  ExtractionJobStatus.RUNNING,
  ExtractionJobStatus.NEEDS_INPUT,
  ExtractionJobStatus.NEEDS_REVIEW,
];

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
 */
export class LocalJobQueue implements JobQueue {
  private handlers = new Map<ExtractionEngineType, JobHandler>();
  private cancelRequested = new Set<string>();

  registerHandler(engineType: ExtractionEngineType, handler: JobHandler): void {
    this.handlers.set(engineType, handler);
  }

  async enqueue(input: EnqueueJobInput): Promise<ExtractionJob> {
    const existing = await prisma.extractionJob.findFirst({
      where: { projectFileId: input.projectFileId, engineType: input.engineType, status: { in: NON_TERMINAL_STATUSES } },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      // A QUEUED job may be one recoverStaleJobs() reset after an interrupted invocation, or one
      // whose original after()/setImmediate scheduling was itself lost (e.g. the invocation that
      // enqueued it died before ever running it). Re-scheduling here is safe either way:
      // processQueuedJob() is a no-op once another execution has already moved the job past
      // QUEUED, so this can never cause double-processing. This is also the only place a stale
      // job gets a real chance to actually run again, rather than sitting QUEUED forever.
      if (existing.status === ExtractionJobStatus.QUEUED) {
        this.scheduleProcessing(existing.id);
      }
      return existing;
    }

    const job = await prisma.extractionJob.create({
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

    this.scheduleProcessing(job.id);
    return job;
  }

  async cancel(companyId: string, jobId: string): Promise<ExtractionJob> {
    const job = await prisma.extractionJob.findFirst({ where: { id: jobId, companyId } });
    if (!job) throw new NotFoundError("Extraction job not found.");
    if (!NON_TERMINAL_STATUSES.includes(job.status)) {
      throw new AppError("JOB_NOT_CANCELLABLE", `Cannot cancel a job that is already ${job.status}.`, 409);
    }

    this.cancelRequested.add(jobId);
    const updated = await prisma.extractionJob.update({ where: { id: jobId }, data: { status: ExtractionJobStatus.CANCELLED } });
    await createAuditLog(companyId, { entityType: "ExtractionJob", entityId: jobId, action: "EXTRACTION_JOB_CANCELLED", payload: { engineType: job.engineType, projectFileId: job.projectFileId } });
    return updated;
  }

  /**
   * Module-init has no request to attach `after()` to, so this deliberately
   * does not attempt to re-run RUNNING→QUEUED jobs itself in production —
   * that would either throw (calling after() with no request store) or,
   * with a bare setImmediate, run in a cold-start invocation with no
   * guarantee of surviving to completion, silently re-creating the exact
   * bug this fix addresses. Resetting the status is still correct and
   * honest: the job becomes eligible to actually run the next time a real
   * request touches this file + engine (see the QUEUED branch in enqueue()
   * above). In dev, the process stays alive, so immediate reprocessing via
   * setImmediate is still safe and preserves prior behavior.
   */
  async recoverStaleJobs(): Promise<void> {
    const stale = await prisma.extractionJob.findMany({ where: { status: ExtractionJobStatus.RUNNING } });
    for (const job of stale) {
      await prisma.extractionJob.update({ where: { id: job.id }, data: { status: ExtractionJobStatus.QUEUED, currentStep: null } });
      if (process.env.NODE_ENV !== "production") {
        this.scheduleLocal(job.id);
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
  private scheduleProcessing(jobId: string): void {
    if (process.env.NODE_ENV === "production") {
      try {
        after(() =>
          this.processQueuedJob(jobId).catch((error) => {
            console.error(`[local-job-queue] unhandled error processing job ${jobId}`, error);
          }),
        );
        return;
      } catch (error) {
        console.error(`[local-job-queue] after() unavailable outside a request context for job ${jobId}, falling back to setImmediate`, error);
      }
    }
    this.scheduleLocal(jobId);
  }

  private scheduleLocal(jobId: string): void {
    setImmediate(() => {
      this.processQueuedJob(jobId).catch((error) => {
        console.error(`[local-job-queue] unhandled error processing job ${jobId}`, error);
      });
    });
  }

  /**
   * Runs one job to a terminal state, retrying in place (bounded by
   * maximumAttempts) rather than recursively rescheduling itself — a
   * retry must not depend on a second setImmediate/after() ever firing.
   */
  async processQueuedJob(jobId: string): Promise<void> {
    for (;;) {
      const job = await prisma.extractionJob.findUnique({ where: { id: jobId } });
      if (!job || job.status !== ExtractionJobStatus.QUEUED) return;
      if (this.cancelRequested.has(jobId)) {
        this.cancelRequested.delete(jobId);
        return;
      }

      const handler = this.handlers.get(job.engineType);
      if (!handler) {
        await prisma.extractionJob.update({
          where: { id: jobId },
          data: {
            status: ExtractionJobStatus.FAILED,
            failedAt: new Date(),
            errorCode: "NO_HANDLER_REGISTERED",
            errorMessage: `No handler is registered for engine type ${job.engineType}.`,
          },
        });
        return;
      }

      const running = await prisma.extractionJob.update({
        where: { id: jobId },
        data: { status: ExtractionJobStatus.RUNNING, startedAt: job.startedAt ?? new Date(), attempts: { increment: 1 } },
      });

      const ctx: JobHandlerContext = {
        updateProgress: async (percentage, step) => {
          await prisma.extractionJob.update({
            where: { id: jobId },
            data: { progressPercentage: Math.max(0, Math.min(100, Math.round(percentage))), ...(step ? { currentStep: step } : {}) },
          });
        },
        isCancelled: async () => {
          const current = await prisma.extractionJob.findUnique({ where: { id: jobId }, select: { status: true } });
          return current?.status === ExtractionJobStatus.CANCELLED;
        },
      };

      try {
        const result = await handler(running, ctx);
        if (await ctx.isCancelled()) return;

        await prisma.extractionJob.update({
          where: { id: jobId },
          data: {
            status: result.status ?? ExtractionJobStatus.COMPLETED,
            completedAt: new Date(),
            progressPercentage: 100,
            resultSummaryJson: (result.resultSummary as Prisma.InputJsonValue | undefined) ?? undefined,
            usageMetadataJson: (result.usageMetadata as Prisma.InputJsonValue | undefined) ?? undefined,
          },
        });
        return;
      } catch (error) {
        if (await ctx.isCancelled()) return;
        const message = error instanceof Error ? error.message : String(error);
        const current = await prisma.extractionJob.findUnique({ where: { id: jobId } });
        if (current && current.attempts < current.maximumAttempts) {
          await prisma.extractionJob.update({
            where: { id: jobId },
            data: { status: ExtractionJobStatus.QUEUED, errorCode: "RETRY_PENDING", errorMessage: message },
          });
          continue; // another controlled attempt, in the same call — never a second schedule
        }

        await prisma.extractionJob.update({
          where: { id: jobId },
          data: { status: ExtractionJobStatus.FAILED, failedAt: new Date(), errorCode: "HANDLER_ERROR", errorMessage: message },
        });
        return;
      }
    }
  }
}
