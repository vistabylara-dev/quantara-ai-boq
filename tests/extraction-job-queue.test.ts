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
import { AppError, NotFoundError } from "../src/lib/errors/app-error";
import { resetExtractionJobToQueued } from "../src/lib/repositories/extraction-job-repository";

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

// @types/node marks NODE_ENV readonly; Object.assign mutates the same underlying object
// without tripping that check.
function setNodeEnv(value: string) {
  Object.assign(process.env, { NODE_ENV: value });
}
function deleteNodeEnv() {
  delete (process.env as Record<string, string | undefined>).NODE_ENV;
}

async function setupCompany(label: string) {
  const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
  const company = await prisma.company.create({ data: { legalName: `Job Queue Co ${label} ${RUN_ID}`, tradeName: `Job Queue ${label}`, email: `job-queue-${label}-${RUN_ID}@example.com` } });
  await prisma.companyIndustryEngine.create({ data: { companyId: company.id, industryEngineId: construction.id, enabled: true } });
  const client = await createClient(company.id, { name: `Client ${label}`, email: `job-queue-${label}-client-${RUN_ID}@example.com` });
  const ownerUser = await prisma.user.create({ data: { companyId: company.id, email: `job-queue-${label}-owner-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: `Owner ${label}`, role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() } });
  const ownerActor = { userId: ownerUser.id, companyId: company.id, role: UserRole.COMPANY_OWNER, fullName: `Owner ${label}`, email: ownerUser.email };
  const { project } = await createProjectWithDefaultBoq(ownerActor, {
    clientId: client.id, industryEngineId: "construction", reference: `JQ-${label}-${RUN_ID}`, name: `Job Queue Project ${label}`,
    location: "Dubai", currency: "AED", taxRate: "5", language: "English",
  });
  return { companyId: company.id, userId: ownerUser.id, projectId: project.databaseId };
}

describe("LocalJobQueue — request-lifecycle-aware scheduling", () => {
  let companyId: string;
  let projectId: string;
  let userId: string;
  let companyIdB: string;
  let projectIdB: string;
  let userIdB: string;
  let fileCounter = 0;
  const cleanupCompanyIds: string[] = [];
  // Captured once, outside any test's control, so restoration is exact regardless of test order.
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    const a = await setupCompany("A");
    companyId = a.companyId;
    projectId = a.projectId;
    userId = a.userId;
    cleanupCompanyIds.push(companyId);

    const b = await setupCompany("B");
    companyIdB = b.companyId;
    projectIdB = b.projectId;
    userIdB = b.userId;
    cleanupCompanyIds.push(companyIdB);
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
    // Deterministic starting point for every test, regardless of what NODE_ENV the test
    // runner process itself started with — most tests rely on the non-production
    // (setImmediate) scheduling path, which silently wouldn't run at all if NODE_ENV
    // happened to already be "production" when a test began.
    setNodeEnv("test");
  });
  afterEach(() => {
    if (originalNodeEnv === undefined) {
      deleteNodeEnv();
    } else {
      setNodeEnv(originalNodeEnv);
    }
  });

  async function makeFile(targetCompanyId = companyId, targetProjectId = projectId, targetUserId = userId) {
    fileCounter += 1;
    return prisma.projectFile.create({
      data: {
        companyId: targetCompanyId, projectId: targetProjectId, uploadedByUserId: targetUserId,
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

  it("lets a durable parent process a queued child inline without scheduling a competing worker", async () => {
    setNodeEnv("production");
    const setImmediateSpy = vi.spyOn(global, "setImmediate");
    const queue = newQueue();
    queue.registerHandler(ExtractionEngineType.FILE_PREPROCESSING, async () => ({ status: ExtractionJobStatus.COMPLETED }));
    const file = await makeFile();

    const job = await queue.enqueue(
      { companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.FILE_PREPROCESSING, createdByUserId: userId },
      { schedule: false },
    );

    expect(job.status).toBe(ExtractionJobStatus.QUEUED);
    expect(afterMock).not.toHaveBeenCalled();
    expect(setImmediateSpy).not.toHaveBeenCalled();

    await queue.processQueuedJob(companyId, job.id);
    const final = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(final.status).toBe(ExtractionJobStatus.COMPLETED);
    expect(final.attempts).toBe(1);
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

  it("D. NEEDS_REVIEW remains a supported terminal handler result, without being misreported as COMPLETED/100%", async () => {
    const queue = newQueue();
    queue.registerHandler(ExtractionEngineType.TABLE_EXTRACTION, async () => ({ status: ExtractionJobStatus.NEEDS_REVIEW, resultSummary: { reason: "low confidence" } }));
    const file = await makeFile();
    const job = await queue.enqueue({ companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.TABLE_EXTRACTION, createdByUserId: userId });

    await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } })).status === ExtractionJobStatus.NEEDS_REVIEW);
    // NEEDS_REVIEW is still a member of QUEUE_NON_TERMINAL_STATUSES (a human can act on it, and
    // it can be re-triggered) — it must not be stamped with a completion timestamp or 100%
    // progress the way a genuinely COMPLETED job is.
    const final = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(final.completedAt).toBeNull();
    expect(final.progressPercentage).not.toBe(100);
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

  it("preserves a typed application error code after bounded retries", async () => {
    const queue = newQueue();
    queue.registerHandler(ExtractionEngineType.FILE_PREPROCESSING, async () => {
      throw new AppError("PROVIDER_REJECTED", "Provider rejected the request.", 503);
    });
    const file = await makeFile();
    const job = await queue.enqueue({ companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.FILE_PREPROCESSING, createdByUserId: userId, maximumAttempts: 2 });

    await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } })).status === ExtractionJobStatus.FAILED);
    const final = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(final.errorCode).toBe("PROVIDER_REJECTED");
    expect(final.errorMessage).toBe("Provider rejected the request.");
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

  it("concurrent enqueue() calls for the same company+file+engine create exactly one job, and its handler runs once", async () => {
    const queue = newQueue();
    let invocationCount = 0;
    queue.registerHandler(ExtractionEngineType.DOCUMENT_CLASSIFICATION, async () => {
      invocationCount += 1;
      return { status: ExtractionJobStatus.COMPLETED };
    });
    const file = await makeFile();

    const [first, second] = await Promise.all([
      queue.enqueue({ companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.DOCUMENT_CLASSIFICATION, createdByUserId: userId }),
      queue.enqueue({ companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.DOCUMENT_CLASSIFICATION, createdByUserId: userId }),
    ]);

    expect(first.id).toBe(second.id);
    const allJobs = await prisma.extractionJob.findMany({ where: { projectFileId: file.id } });
    expect(allJobs).toHaveLength(1);

    await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: first.id } })).status === ExtractionJobStatus.COMPLETED);
    expect(invocationCount).toBe(1);
  });

  it("H. cancellation prevents an in-flight handler's result from overwriting CANCELLED, and leaves no state that affects a later, unrelated job", async () => {
    const queue = newQueue();
    const gate = deferred<void>();
    queue.registerHandler(ExtractionEngineType.TABLE_EXTRACTION, async () => {
      await gate.promise;
      return { status: ExtractionJobStatus.COMPLETED };
    });
    const file = await makeFile();
    const job = await prisma.extractionJob.create({
      data: { companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.TABLE_EXTRACTION, createdByUserId: userId, status: ExtractionJobStatus.QUEUED },
    });

    // Drive processing directly and hold the promise, rather than relying on enqueue()'s internal
    // fire-and-forget scheduling + a fixed sleep — awaiting this promise after resolving the gate
    // is what makes "the losing write was actually attempted" deterministic, not timing-dependent.
    const processing = queue.processQueuedJob(companyId, job.id);
    await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } })).status === ExtractionJobStatus.RUNNING);

    await queue.cancel(companyId, job.id);
    gate.resolve();
    await processing;

    const final = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(final.status).toBe(ExtractionJobStatus.CANCELLED);

    // Cancellation state lives entirely in the database row (there is no separate
    // in-memory marker to leak) — a brand new, unrelated job on the same queue instance
    // must run to completion completely unaffected.
    const otherFile = await makeFile();
    const otherJob = await queue.enqueue({ companyId, projectId, projectFileId: otherFile.id, engineType: ExtractionEngineType.TABLE_EXTRACTION, createdByUserId: userId });
    await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: otherJob.id } })).status === ExtractionJobStatus.COMPLETED);
  });

  it("cancel vs retry: a job cancelled while RUNNING is never requeued by a subsequent retryable failure", async () => {
    const queue = newQueue();
    const gate = deferred<void>();
    queue.registerHandler(ExtractionEngineType.FILE_PREPROCESSING, async () => {
      await gate.promise;
      throw new Error("simulated retryable failure");
    });
    const file = await makeFile();
    const job = await prisma.extractionJob.create({
      data: { companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.FILE_PREPROCESSING, createdByUserId: userId, status: ExtractionJobStatus.QUEUED, maximumAttempts: 3 },
    });

    const processing = queue.processQueuedJob(companyId, job.id);
    await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } })).status === ExtractionJobStatus.RUNNING);

    await queue.cancel(companyId, job.id);
    gate.resolve();
    await processing;

    const final = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(final.status).toBe(ExtractionJobStatus.CANCELLED);
    expect(final.errorCode).not.toBe("RETRY_PENDING");
  });

  it("cancel vs failure: a job cancelled while RUNNING is never marked FAILED by a subsequent final-attempt failure", async () => {
    const queue = newQueue();
    const gate = deferred<void>();
    queue.registerHandler(ExtractionEngineType.FILE_PREPROCESSING, async () => {
      await gate.promise;
      throw new Error("simulated final failure");
    });
    const file = await makeFile();
    const job = await prisma.extractionJob.create({
      data: { companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.FILE_PREPROCESSING, createdByUserId: userId, status: ExtractionJobStatus.QUEUED, maximumAttempts: 1 },
    });

    const processing = queue.processQueuedJob(companyId, job.id);
    await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } })).status === ExtractionJobStatus.RUNNING);

    await queue.cancel(companyId, job.id);
    gate.resolve();
    await processing;

    const final = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(final.status).toBe(ExtractionJobStatus.CANCELLED);
    expect(final.errorCode).not.toBe("HANDLER_ERROR");
  });

  it("retry cleanup: a job that fails once then succeeds on retry is COMPLETED with no leftover error fields", async () => {
    const queue = newQueue();
    let attempt = 0;
    queue.registerHandler(ExtractionEngineType.DOCUMENT_CLASSIFICATION, async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("transient failure on first attempt");
      return { status: ExtractionJobStatus.COMPLETED };
    });
    const file = await makeFile();
    const job = await queue.enqueue({ companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.DOCUMENT_CLASSIFICATION, createdByUserId: userId, maximumAttempts: 3 });

    await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } })).status === ExtractionJobStatus.COMPLETED);
    const final = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(final.attempts).toBe(2);
    expect(final.errorCode).toBeNull();
    expect(final.errorMessage).toBeNull();
    expect(final.failedAt).toBeNull();
  });

  it("recent RUNNING job is left untouched by recoverStaleJobs() — a still-live invocation must never be stolen", async () => {
    const queue = newQueue();
    const file = await makeFile();
    const recent = await prisma.extractionJob.create({
      data: { companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.FILE_PREPROCESSING, createdByUserId: userId, status: ExtractionJobStatus.RUNNING, startedAt: new Date(), attempts: 1 },
    });
    // updatedAt defaults to "now" on create — well inside the staleness cutoff.

    await queue.recoverStaleJobs();

    const stillRunning = await prisma.extractionJob.findUniqueOrThrow({ where: { id: recent.id } });
    expect(stillRunning.status).toBe(ExtractionJobStatus.RUNNING);
  });

  it("genuinely stale RUNNING job (no update in well over the cutoff) is reset to QUEUED by recoverStaleJobs()", async () => {
    const queue = newQueue();
    const file = await makeFile();
    const stale = await prisma.extractionJob.create({
      data: { companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.FILE_PREPROCESSING, createdByUserId: userId, status: ExtractionJobStatus.RUNNING, startedAt: new Date(), attempts: 1 },
    });
    // Backdate updatedAt well past the 5-minute cutoff, simulating an invocation that died
    // without ever reporting progress/completion again.
    await prisma.extractionJob.update({ where: { id: stale.id }, data: { updatedAt: new Date(Date.now() - 10 * 60 * 1000) } });

    await queue.recoverStaleJobs();

    const reset = await prisma.extractionJob.findUniqueOrThrow({ where: { id: stale.id } });
    expect(reset.status).toBe(ExtractionJobStatus.QUEUED);
  });

  it("stale recovery race: a job that receives a real update between the stale read and the reset attempt is left RUNNING", async () => {
    const file = await makeFile();
    const job = await prisma.extractionJob.create({
      data: { companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.FILE_PREPROCESSING, createdByUserId: userId, status: ExtractionJobStatus.RUNNING, startedAt: new Date(), attempts: 1 },
    });
    const oldUpdatedAt = new Date(Date.now() - 10 * 60 * 1000);
    await prisma.extractionJob.update({ where: { id: job.id }, data: { updatedAt: oldUpdatedAt } });

    // A cutoff that would have selected this job as stale at the time it was read...
    const cutoffUsedForTheStaleRead = new Date(Date.now() - 5 * 60 * 1000);
    expect(oldUpdatedAt.getTime()).toBeLessThan(cutoffUsedForTheStaleRead.getTime());

    // ...but a real worker reports progress (bumping updatedAt to "now") before the reset actually runs.
    await prisma.extractionJob.update({ where: { id: job.id }, data: { progressPercentage: 42 } });

    const applied = await resetExtractionJobToQueued(companyId, job.id, cutoffUsedForTheStaleRead);
    expect(applied).toBe(false);

    const final = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(final.status).toBe(ExtractionJobStatus.RUNNING);
  });

  it("concurrent processQueuedJob() calls for the same job claim exactly once — the handler runs a single time", async () => {
    const queue = newQueue();
    let invocationCount = 0;
    queue.registerHandler(ExtractionEngineType.DOCUMENT_CLASSIFICATION, async () => {
      invocationCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { status: ExtractionJobStatus.COMPLETED };
    });
    const file = await makeFile();
    const job = await prisma.extractionJob.create({
      data: { companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.DOCUMENT_CLASSIFICATION, createdByUserId: userId, status: ExtractionJobStatus.QUEUED },
    });

    // Two "simultaneous" processors racing the same QUEUED job — simulates a stale-recovery
    // re-trigger racing the still-live original, or duplicate scheduling of any kind.
    await Promise.all([queue.processQueuedJob(companyId, job.id), queue.processQueuedJob(companyId, job.id)]);

    expect(invocationCount).toBe(1);
    const final = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(final.status).toBe(ExtractionJobStatus.COMPLETED);
    expect(final.attempts).toBe(1);
  });

  it("tenant isolation: Company B's companyId can never claim, process, or cancel Company A's job", async () => {
    const queue = newQueue();
    let invoked = false;
    queue.registerHandler(ExtractionEngineType.DOCUMENT_CLASSIFICATION, async () => {
      invoked = true;
      return { status: ExtractionJobStatus.COMPLETED };
    });
    const file = await makeFile(companyId, projectId, userId);
    const job = await prisma.extractionJob.create({
      data: { companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.DOCUMENT_CLASSIFICATION, createdByUserId: userId, status: ExtractionJobStatus.QUEUED },
    });

    // Company B attempting to process Company A's job id must be a complete no-op.
    await queue.processQueuedJob(companyIdB, job.id);
    expect(invoked).toBe(false);
    const afterWrongTenantProcess = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(afterWrongTenantProcess.status).toBe(ExtractionJobStatus.QUEUED);

    // Company B attempting to cancel Company A's job id must 404, not succeed or leak existence.
    await expect(queue.cancel(companyIdB, job.id)).rejects.toThrow(NotFoundError);
    const afterWrongTenantCancel = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(afterWrongTenantCancel.status).toBe(ExtractionJobStatus.QUEUED);

    // The real owning company can still process it normally afterward.
    await queue.processQueuedJob(companyId, job.id);
    expect(invoked).toBe(true);
    const final = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(final.status).toBe(ExtractionJobStatus.COMPLETED);
  });

  it("tenant integrity: another company cannot enqueue or directly create a job for this company's file", async () => {
    const fileA = await makeFile(companyId, projectId, userId);
    const queue = newQueue();
    queue.registerHandler(ExtractionEngineType.DOCUMENT_CLASSIFICATION, async () => ({ status: ExtractionJobStatus.COMPLETED }));

    await expect(
      queue.enqueue({ companyId: companyIdB, projectId: projectIdB, projectFileId: fileA.id, engineType: ExtractionEngineType.DOCUMENT_CLASSIFICATION, createdByUserId: userIdB }),
    ).rejects.toThrow(NotFoundError);
    await expect(
      prisma.extractionJob.create({
        data: {
          companyId: companyIdB,
          projectId: projectIdB,
          projectFileId: fileA.id,
          engineType: ExtractionEngineType.DOCUMENT_CLASSIFICATION,
          createdByUserId: userIdB,
        },
      }),
    ).rejects.toThrow();
    expect(await prisma.extractionJob.count({ where: { companyId: companyIdB, projectFileId: fileA.id } })).toBe(0);
  });

  it("I. recoverStaleJobs() in production does not call after() and does not throw with no request context", async () => {
    setNodeEnv("production");
    const queue = newQueue();
    queue.registerHandler(ExtractionEngineType.FILE_PREPROCESSING, async () => ({ status: ExtractionJobStatus.COMPLETED }));
    const file = await makeFile();
    const created = await prisma.extractionJob.create({
      data: { companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.FILE_PREPROCESSING, createdByUserId: userId, status: ExtractionJobStatus.RUNNING, startedAt: new Date(), attempts: 1 },
    });
    await prisma.extractionJob.update({ where: { id: created.id }, data: { updatedAt: new Date(Date.now() - 10 * 60 * 1000) } });

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
    await prisma.extractionJob.update({ where: { id: stale.id }, data: { updatedAt: new Date(Date.now() - 10 * 60 * 1000) } });

    // Simulate production module-init recovery: it resets the row but deliberately does not
    // schedule work without a request lifecycle to keep the invocation alive.
    setNodeEnv("production");
    await queue.recoverStaleJobs();
    const afterReset = await prisma.extractionJob.findUniqueOrThrow({ where: { id: stale.id } });
    expect(afterReset.status).toBe(ExtractionJobStatus.QUEUED);
    expect(afterMock).not.toHaveBeenCalled();

    // A later real request for the same file+engine must give the recovered job an actual chance to run.
    setNodeEnv("test");
    const retriggered = await queue.enqueue({ companyId, projectId, projectFileId: file.id, engineType: ExtractionEngineType.FILE_PREPROCESSING, createdByUserId: userId });
    expect(retriggered.id).toBe(stale.id);

    await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: stale.id } })).status === ExtractionJobStatus.COMPLETED);
    expect(ran).toBe(true);
  });
});
