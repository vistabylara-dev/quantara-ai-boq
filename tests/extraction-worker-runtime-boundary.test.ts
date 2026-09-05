import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("extraction worker runtime boundary", () => {
  const worker = readFileSync(
    path.resolve(__dirname, "../src/lib/jobs/extraction-worker.ts"),
    "utf8",
  );

  const queue = readFileSync(
    path.resolve(__dirname, "../src/lib/jobs/local-job-queue.ts"),
    "utf8",
  );

  const repository = readFileSync(
    path.resolve(__dirname, "../src/lib/repositories/extraction-job-repository.ts"),
    "utf8",
  );

  const extractionRoute = readFileSync(
    path.resolve(__dirname, "../src/app/api/files/[fileId]/extract/route.ts"),
    "utf8",
  );

  it("performs no stale-job database recovery merely by importing extraction-worker", () => {
    expect(worker).not.toContain("quantaraExtractionJobQueueRecovered");
    expect(worker).not.toContain("extractionJobQueue.recoverStaleJobs()");
    expect(worker).toContain("no database work is allowed at module import time");
  });

  it("performs targeted stale recovery only when an actual job is enqueued", () => {
    expect(queue).toContain("recoverStaleRunningExtractionJobForTarget");
    expect(queue).toContain("input.companyId");
    expect(queue).toContain("input.projectFileId");
    expect(queue).toContain("input.engineType");
    expect(queue).toContain("STALE_RUNNING_CUTOFF_MS");
  });

  it("gives production PDF extraction five minutes and keeps stale recovery beyond that budget", () => {
    expect(extractionRoute).toContain("export const maxDuration = 300;");
    expect(queue).toContain("const STALE_RUNNING_CUTOFF_MS = 10 * 60 * 1000;");
  });

  it("claims the queued extraction inside the request so post-response scheduling cannot strand it", () => {
    expect(extractionRoute).toContain("await extractionJobQueue.processQueuedJob(actor.companyId, data.id);");
    expect(queue).toContain("claimQueuedExtractionJob(companyId, jobId)");
  });

  it("scopes targeted stale recovery to tenant, file, engine, RUNNING state and cutoff", () => {
    expect(repository).toContain("recoverStaleRunningExtractionJobForTarget");
    expect(repository).toContain("companyId,");
    expect(repository).toContain("projectFileId,");
    expect(repository).toContain("engineType,");
    expect(repository).toContain("status: ExtractionJobStatus.RUNNING");
    expect(repository).toContain('updatedAt: { lt: cutoff }');
    expect(repository).toContain("resetExtractionJobToQueued(companyId, stale.id, cutoff)");
  });
});
