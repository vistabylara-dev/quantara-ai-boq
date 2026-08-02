import { ExtractionJobStatus, type ExtractionEngineType, type ExtractionJob } from "@prisma/client";
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
 * In-process queue: work is dispatched via setImmediate so it runs after
 * the current request/response cycle completes, not inline within it. This
 * is an honest "local" implementation (same spirit as
 * local-document-storage-adapter) — it processes jobs in the same Node
 * process as the dev server, not on a separate worker. It survives Next.js
 * dev-mode hot reloads via the globalThis singleton in extraction-worker.ts,
 * but does NOT survive a full process restart mid-job; recoverStaleJobs()
 * exists specifically to detect and resume from that case.
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
    if (existing) return existing;

    const job = await prisma.extractionJob.create({
      data: {
        companyId: input.companyId,
        projectId: input.projectId,
        projectFileId: input.projectFileId,
        engineType: input.engineType,
        createdByUserId: input.createdByUserId,
        configurationJson: input.configuration ?? undefined,
        maximumAttempts: input.maximumAttempts ?? 3,
        status: ExtractionJobStatus.QUEUED,
      },
    });

    this.schedule(job.id);
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

  async recoverStaleJobs(): Promise<void> {
    const stale = await prisma.extractionJob.findMany({ where: { status: ExtractionJobStatus.RUNNING } });
    for (const job of stale) {
      await prisma.extractionJob.update({ where: { id: job.id }, data: { status: ExtractionJobStatus.QUEUED, currentStep: null } });
      this.schedule(job.id);
    }
  }

  private schedule(jobId: string): void {
    setImmediate(() => {
      this.processJob(jobId).catch((error) => {
        console.error(`[local-job-queue] unhandled error processing job ${jobId}`, error);
      });
    });
  }

  private async processJob(jobId: string): Promise<void> {
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
          resultSummaryJson: result.resultSummary ?? undefined,
          usageMetadataJson: result.usageMetadata ?? undefined,
        },
      });
    } catch (error) {
      if (await ctx.isCancelled()) return;
      const message = error instanceof Error ? error.message : String(error);
      const current = await prisma.extractionJob.findUnique({ where: { id: jobId } });
      if (current && current.attempts < current.maximumAttempts) {
        await prisma.extractionJob.update({
          where: { id: jobId },
          data: { status: ExtractionJobStatus.QUEUED, errorCode: "RETRY_PENDING", errorMessage: message },
        });
        this.schedule(jobId);
      } else {
        await prisma.extractionJob.update({
          where: { id: jobId },
          data: { status: ExtractionJobStatus.FAILED, failedAt: new Date(), errorCode: "HANDLER_ERROR", errorMessage: message },
        });
      }
    }
  }
}
