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
