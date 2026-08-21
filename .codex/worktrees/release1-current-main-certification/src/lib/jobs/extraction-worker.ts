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
  quantaraExtractionJobQueueRecovered: boolean | undefined;
};

export const extractionJobQueue: JobQueue = globalForJobQueue.quantaraExtractionJobQueue ?? new LocalJobQueue();

if (process.env.NODE_ENV !== "production") {
  globalForJobQueue.quantaraExtractionJobQueue = extractionJobQueue;
}

if (!globalForJobQueue.quantaraExtractionJobQueueRecovered) {
  globalForJobQueue.quantaraExtractionJobQueueRecovered = true;
  extractionJobQueue.recoverStaleJobs().catch((error) => {
    console.error("[extraction-worker] stale job recovery failed", error);
  });
}
