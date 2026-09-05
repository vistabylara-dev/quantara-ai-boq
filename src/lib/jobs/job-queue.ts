import type { ExtractionEngineType, ExtractionJob } from "@prisma/client";

/**
 * Generic background-processing abstraction for Phase 8 file intelligence
 * work. Route handlers only ever call `enqueue` and return — the actual
 * processing runs outside the request/response cycle (spec section 1: no
 * synchronous large-file processing in API handlers). `LocalJobQueue` is the
 * dev/local implementation; a future distributed implementation (e.g. a
 * real worker process/queue service) would satisfy this same interface.
 */
export type JobHandlerContext = {
  updateProgress(percentage: number, step?: string): Promise<void>;
  isCancelled(): Promise<boolean>;
};

export type JobHandlerResult = {
  /** Defaults to COMPLETED. A handler may instead resolve to NEEDS_INPUT/NEEDS_REVIEW when human input is required before the job can finish. */
  status?: Extract<ExtractionJob["status"], "COMPLETED" | "NEEDS_INPUT" | "NEEDS_REVIEW">;
  resultSummary?: Record<string, unknown>;
  usageMetadata?: Record<string, unknown>;
};

/**
 * Handlers must be idempotent: safe resume (spec section 8) re-runs a
 * handler from the beginning after a crash/restart, it does not resume
 * mid-step. A handler that writes derived rows must upsert/replace them
 * rather than append, so a re-run does not duplicate results.
 */
export type JobHandler = (job: ExtractionJob, ctx: JobHandlerContext) => Promise<JobHandlerResult>;

export type EnqueueJobInput = {
  companyId: string;
  projectId: string;
  projectFileId: string;
  engineType: ExtractionEngineType;
  createdByUserId: string;
  configuration?: Record<string, unknown>;
  maximumAttempts?: number;
};

export type EnqueueJobOptions = {
  /**
   * The caller will claim and await this job in the current durable workflow.
   * Suppressing the normal background schedule prevents two execution paths
   * racing to claim the same freshly-created row.
   */
  schedule?: boolean;
};

export interface JobQueue {
  registerHandler(engineType: ExtractionEngineType, handler: JobHandler): void;
  /** Idempotent: an existing non-terminal job for the same file + engine type is returned instead of creating a duplicate. */
  enqueue(input: EnqueueJobInput, options?: EnqueueJobOptions): Promise<ExtractionJob>;
  cancel(companyId: string, jobId: string): Promise<ExtractionJob>;
  /**
   * Explicit maintenance recovery for stale RUNNING jobs.
   *
   * Normal user-triggered processing performs targeted recovery inside
   * enqueue(). This broad recovery method must never be invoked merely by
   * importing the queue module.
   */
  recoverStaleJobs(): Promise<void>;
  /**
   * Runs a single QUEUED job to a terminal (or retry-pending) state,
   * including its own bounded retry loop. Public so a request-scoped
   * caller can hand it to Next.js `after()` — see local-job-queue.ts. A
   * no-op if the job is not (or no longer) QUEUED for this companyId.
   */
  processQueuedJob(companyId: string, jobId: string): Promise<void>;
}
