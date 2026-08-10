import type { JobQueue } from "./job-queue";
import { LocalJobQueue } from "./local-job-queue";

/**
 * Singleton queue instance, cached on globalThis so Next.js dev-mode hot
 * reloads (which re-evaluate modules on every file change) don't spawn a
 * second in-memory queue with its own handler registry — same pattern as
 * src/lib/db/prisma.ts. Sub-phase modules (classification, table
 * extraction, room detection, etc.) import this and call
 * `extractionJobQueue.registerHandler(engineType, handler)` once at module
 * load.
 */
const globalForJobQueue = globalThis as unknown as {
  quantaraExtractionJobQueue: JobQueue | undefined;
};

export const extractionJobQueue: JobQueue = globalForJobQueue.quantaraExtractionJobQueue ?? new LocalJobQueue();

if (process.env.NODE_ENV !== "production") {
  globalForJobQueue.quantaraExtractionJobQueue = extractionJobQueue;
}

/**
 * IMPORTANT: no database work is allowed at module import time.
 *
 * Next.js evaluates server modules while collecting/building routes. Calling
 * recoverStaleJobs() here previously caused next build itself to connect to
 * Postgres. Normal crash recovery now occurs inside LocalJobQueue.enqueue(),
 * scoped to the exact company + file + engine being retried.
 *
 * recoverStaleJobs() remains available on the JobQueue interface for an
 * explicit maintenance/recovery caller; importing this singleton is pure.
 */
