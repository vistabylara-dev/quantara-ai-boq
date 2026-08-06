import { ExtractionEngineType, ExtractionJobStatus, UserRole } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const afterMock = vi.fn<(task: () => unknown) => void>();
vi.mock("next/server", () => ({
  after: (task: () => unknown) => afterMock(task),
}));

import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { LocalJobQueue } from "../src/lib/jobs/local-job-queue";

const RUN_ID = Date.now();

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 4000, intervalMs = 20): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("waitFor: condition not met within timeout");
}

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const originalNodeEnv = process.env.NODE_ENV;
function setNodeEnv(value: string) {
  // @types/node marks NODE_ENV readonly; Object.assign mutates the same underlying object without
  // tripping that check, and is restored via the same path in afterEach/beforeEach below.
  Object.assign(process.env, { NODE_ENV: value });
}

describe("LocalJobQueue — request-lifecycle-aware scheduling", () => {
  let companyId: string;
  let projectId: string;
  let userId: string;
  let fileCounter = 0;
  const cleanupCompanyIds: string[] = [];

  beforeAll(async () => {
    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    const company = await prisma.company.create({ data: { legalName: `Job Queue Co ${RUN_ID}`, tradeName: "Job Queue", email: `job-queue-${RUN_ID}@example.com` } });
    companyId = company.id;
    cleanupCompanyIds.push(companyId);
    await prisma.companyIndustryEngine.create({ data: { companyId, industryEngineId: construction.id, enabled: true } });
    const client = await createClient(companyId, { name: "Client JQ", email: `job-queue-client-${RUN_ID}@example.com` });

    const ownerUser = await prisma.user.create({ data: { companyId, email: `job-queue-owner-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Owner JQ", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() } });
    userId = ownerUser.id;
    const ownerActor = { userId: ownerUser.id, companyId, role: UserRole.COMPANY_OWNER, fullName: "Owner JQ", email: ownerUser.email };

    const { project } = await createProjectWithDefaultBoq(ownerActor, {
      clientId: client.id, industryEngineId: "construction", reference: `JQ-${RUN_ID}`, name: "Job Queue Project",
      location: "Dubai", currency: "AED", taxRate: "5", language: "English",
    });
    projectId = project.databaseId;
  });

  afterAll(async () => {
    for (const id of cleanupCompanyIds) {
      await prisma.extractionJob.deleteMany({ where: { companyId: id } });
      await prisma.projectFile.deleteMany({ where: { companyId: id } });
      await prisma.bOQItem.deleteMany({ where: { companyId: id } });
      await prisma.bOQSection.deleteMany({ where: { companyId: id } });
      await prisma.bOQ.deleteMany({ where: { companyId: id } });
      await prisma.project.deleteMany({ where: { companyId: id } });
      await prisma.client.deleteMany({ where: { companyId: id } });
      await prisma.companyIndustryEngine.deleteMany({ where: { companyId: id } });
      await prisma.user.deleteMany({ where: { companyId: id } });
      await prisma.company.delete({ where: { id } });
    }
  });

  beforeEach(() => {
    afterMock.mockReset();
    setNodeEnv(originalNodeEnv ?? "test");
  });
  afterEach(() => {
    setNodeEnv(originalNodeEnv ?? "test");
  });

  async function makeFile() {
    fileCounter += 1;
    return prisma.projectFile.create({
      data: {
        companyId, projectId, uploadedByUserId: userId,
        originalName: `job-queue-${fileCounter}.pdf`, safeFileName: `job-queue-${fileCounter}.pdf`,
        storageKey: `test/job-queue-${RUN_ID}-${fileCounter}.pdf`, mimeType: "application/pdf", extension: "pdf",
        fileSize: 10, checksum: `checksum-${RUN_ID}-${fileCounter}`,
      },
    });
  }

  function newQueue() {
    return new LocalJobQueue();
  }

  it("A. enqueue creates a QUEUED job immediately", async () => {
    const queue = newQueue();
    queue.registerHandler(ExtractionEngineType.DOCUMENT_CLASSIFICATION, async () => ({ status: ExtractionJobStatus.COMPLETED }));
    const file = await makeFile();
    const job = await queue.enqueue({ companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.DOCUMENT_CLASSIFICATION, createdByUserId: userId });
    expect(job.status).toBe(ExtractionJobStatus.QUEUED);
  });

  it("B/J. production scheduling uses after(), not setImmediate, and the task actually executes", async () => {
    setNodeEnv("production");
    const setImmediateSpy = vi.spyOn(global, "setImmediate");
    const queue = newQueue();
    queue.registerHandler(ExtractionEngineType.DOCUMENT_CLASSIFICATION, async () => ({ status: ExtractionJobStatus.COMPLETED }));
    const file = await makeFile();

    afterMock.mockImplementation((task) => {
      // Simulate Vercel keeping the invocation alive long enough to run the task.
      void Promise.resolve().then(() => task());
    });

    const job = await queue.enqueue({ companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.DOCUMENT_CLASSIFICATION, createdByUserId: userId });
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(setImmediateSpy).not.toHaveBeenCalled();

    await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } })).status === ExtractionJobStatus.COMPLETED);
    setImmediateSpy.mockRestore();
  });

  it("production falls back to setImmediate if after() throws (no request context)", async () => {
    setNodeEnv("production");
    const queue = newQueue();
    queue.registerHandler(ExtractionEngineType.DOCUMENT_CLASSIFICATION, async () => ({ status: ExtractionJobStatus.COMPLETED }));
    const file = await makeFile();

    afterMock.mockImplementation(() => {
      throw new Error("`after` was called outside a request scope.");
    });

    const job = await queue.enqueue({ companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.DOCUMENT_CLASSIFICATION, createdByUserId: userId });
    await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } })).status === ExtractionJobStatus.COMPLETED);
  });

  it("C. successful handler transitions QUEUED -> RUNNING -> COMPLETED", async () => {
    const queue = newQueue();
    const statusesSeen: string[] = [];
    queue.registerHandler(ExtractionEngineType.DOCUMENT_CLASSIFICATION, async (job) => {
      statusesSeen.push(job.status);
      return { status: ExtractionJobStatus.COMPLETED };
    });
    const file = await makeFile();
    const job = await queue.enqueue({ companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.DOCUMENT_CLASSIFICATION, createdByUserId: userId });

    await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } })).status === ExtractionJobStatus.COMPLETED);
    expect(statusesSeen).toEqual([ExtractionJobStatus.RUNNING]);
    const final = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(final.attempts).toBe(1);
    expect(final.completedAt).not.toBeNull();
  });

  it("D. NEEDS_REVIEW remains a supported terminal handler result", async () => {
    const queue = newQueue();
    queue.registerHandler(ExtractionEngineType.TABLE_EXTRACTION, async () => ({ status: ExtractionJobStatus.NEEDS_REVIEW, resultSummary: { reason: "low confidence" } }));
    const file = await makeFile();
    const job = await queue.enqueue({ companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.TABLE_EXTRACTION, createdByUserId: userId });

    await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } })).status === ExtractionJobStatus.NEEDS_REVIEW);
  });

  it("E/F. a handler that always fails retries up to maximumAttempts, then becomes FAILED", async () => {
    const queue = newQueue();
    let calls = 0;
    queue.registerHandler(ExtractionEngineType.FILE_PREPROCESSING, async () => {
      calls += 1;
      throw new Error("simulated handler failure");
    });
    const file = await makeFile();
    const job = await queue.enqueue({ companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.FILE_PREPROCESSING, createdByUserId: userId, maximumAttempts: 3 });

    await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } })).status === ExtractionJobStatus.FAILED);
    const final = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(final.attempts).toBe(3);
    expect(calls).toBe(3);
    expect(final.errorCode).toBe("HANDLER_ERROR");
  });

  it("G. a duplicate enqueue for the same file+engine while non-terminal returns the existing job, not a new one", async () => {
    const queue = newQueue();
    const gate = deferred<void>();
    queue.registerHandler(ExtractionEngineType.DOCUMENT_CLASSIFICATION, async () => {
      await gate.promise;
      return { status: ExtractionJobStatus.COMPLETED };
    });
    const file = await makeFile();
    const first = await queue.enqueue({ companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.DOCUMENT_CLASSIFICATION, createdByUserId: userId });
    await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: first.id } })).status === ExtractionJobStatus.RUNNING);

    const second = await queue.enqueue({ companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.DOCUMENT_CLASSIFICATION, createdByUserId: userId });
    expect(second.id).toBe(first.id);

    gate.resolve();
    await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: first.id } })).status === ExtractionJobStatus.COMPLETED);
    const allJobs = await prisma.extractionJob.findMany({ where: { projectFileId: file.id } });
    expect(allJobs).toHaveLength(1);
  });

  it("H. cancellation prevents an in-flight handler's result from overwriting CANCELLED", async () => {
    const queue = newQueue();
    const gate = deferred<void>();
    queue.registerHandler(ExtractionEngineType.TABLE_EXTRACTION, async () => {
      await gate.promise;
      return { status: ExtractionJobStatus.COMPLETED };
    });
    const file = await makeFile();
    const job = await queue.enqueue({ companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.TABLE_EXTRACTION, createdByUserId: userId });
    await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } })).status === ExtractionJobStatus.RUNNING);

    await queue.cancel(companyId, job.id);
    gate.resolve();

    await new Promise((resolve) => setTimeout(resolve, 200));
    const final = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(final.status).toBe(ExtractionJobStatus.CANCELLED);
  });

  it("I. recoverStaleJobs() in production does not call after() and does not throw with no request context", async () => {
    setNodeEnv("production");
    const queue = newQueue();
    queue.registerHandler(ExtractionEngineType.FILE_PREPROCESSING, async () => ({ status: ExtractionJobStatus.COMPLETED }));
    const file = await makeFile();
    const created = await prisma.extractionJob.create({
      data: { companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.FILE_PREPROCESSING, createdByUserId: userId, status: ExtractionJobStatus.RUNNING, startedAt: new Date(), attempts: 1 },
    });

    afterMock.mockImplementation(() => {
      throw new Error("after() must never be called from recoverStaleJobs()");
    });

    await expect(queue.recoverStaleJobs()).resolves.toBeUndefined();
    expect(afterMock).not.toHaveBeenCalled();

    const reset = await prisma.extractionJob.findUniqueOrThrow({ where: { id: created.id } });
    expect(reset.status).toBe(ExtractionJobStatus.QUEUED);
  });

  it("a QUEUED job recovered by recoverStaleJobs() actually runs the next time a real request re-triggers it", async () => {
    const queue = newQueue();
    let ran = false;
    queue.registerHandler(ExtractionEngineType.FILE_PREPROCESSING, async () => {
      ran = true;
      return { status: ExtractionJobStatus.COMPLETED };
    });
    const file = await makeFile();
    const stale = await prisma.extractionJob.create({
      data: { companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.FILE_PREPROCESSING, createdByUserId: userId, status: ExtractionJobStatus.RUNNING, startedAt: new Date(), attempts: 1 },
    });

    // Simulate module-init recovery finding this RUNNING job stale (no request context, non-prod so no after() involved here).
    await queue.recoverStaleJobs();
    const afterReset = await prisma.extractionJob.findUniqueOrThrow({ where: { id: stale.id } });
    expect(afterReset.status).toBe(ExtractionJobStatus.QUEUED);

    // A later real request for the same file+engine must give the recovered job an actual chance to run.
    const retriggered = await queue.enqueue({ companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.FILE_PREPROCESSING, createdByUserId: userId });
    expect(retriggered.id).toBe(stale.id);

    await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: stale.id } })).status === ExtractionJobStatus.COMPLETED);
    expect(ran).toBe(true);
  });
});
