import { ExtractionEngineType, ExtractionJobStatus, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { uploadProjectFile } from "../src/lib/services/project-file-service";
import { LocalJobQueue } from "../src/lib/jobs/local-job-queue";
import { extractionJobQueue } from "../src/lib/jobs/extraction-worker";
import { cancelExtractionJob, getExtractionJob, listExtractionJobsForFile } from "../src/lib/services/extraction-job-service";
import { AppError, NotFoundError, PermissionDeniedError } from "../src/lib/errors/app-error";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import type { JobHandlerContext } from "../src/lib/jobs/job-queue";

const RUN_ID = Date.now();

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 3000, intervalMs = 20): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("waitFor: condition not met within timeout");
}

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe("Phase 8 sub-phase 2: background processing (job queue) (integration, real local Postgres)", () => {
  let companyId: string;
  let projectId: string;
  let projectFileId: string;
  let ownerActor: CurrentActor;
  let reviewerActor: CurrentActor;
  let ownerActorOtherCompany: CurrentActor;
  const cleanupCompanyIds: string[] = [];

  beforeAll(async () => {
    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });

    const company = await prisma.company.create({ data: { legalName: `Phase8 JobQueue Co ${RUN_ID}`, tradeName: "Phase8 JQ", email: `phase8-jq-${RUN_ID}@example.com` } });
    companyId = company.id;
    cleanupCompanyIds.push(companyId);
    await prisma.companyIndustryEngine.create({ data: { companyId, industryEngineId: construction.id, enabled: true } });
    const client = await createClient(companyId, { name: "Client JQ", email: `phase8-jq-client-${RUN_ID}@example.com` });

    const ownerUser = await prisma.user.create({ data: { companyId, email: `phase8-jq-owner-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Owner JQ", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() } });
    const reviewerUser = await prisma.user.create({ data: { companyId, email: `phase8-jq-reviewer-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Reviewer JQ", role: UserRole.REVIEWER, isActive: true, emailVerifiedAt: new Date() } });
    ownerActor = { userId: ownerUser.id, companyId, role: UserRole.COMPANY_OWNER, fullName: "Owner JQ", email: ownerUser.email };
    reviewerActor = { userId: reviewerUser.id, companyId, role: UserRole.REVIEWER, fullName: "Reviewer JQ", email: reviewerUser.email };

    const { project } = await createProjectWithDefaultBoq(ownerActor, {
      clientId: client.id, industryEngineId: "construction", reference: `P8JQ-${RUN_ID}`, name: "Phase8 JobQueue Project",
      location: "Dubai", currency: "AED", taxRate: "5", language: "English",
    });
    projectId = project.databaseId;

    const uploaded = await uploadProjectFile(ownerActor, projectId, { originalName: "schedule.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nqueue test fixture\n%%EOF") });
    projectFileId = uploaded.file.id;

    const otherCompany = await prisma.company.create({ data: { legalName: `Phase8 JobQueue Co Other ${RUN_ID}`, tradeName: "Phase8 JQ Other", email: `phase8-jq-other-${RUN_ID}@example.com` } });
    cleanupCompanyIds.push(otherCompany.id);
    const otherOwner = await prisma.user.create({ data: { companyId: otherCompany.id, email: `phase8-jq-other-owner-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Owner Other", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() } });
    ownerActorOtherCompany = { userId: otherOwner.id, companyId: otherCompany.id, role: UserRole.COMPANY_OWNER, fullName: "Owner Other", email: otherOwner.email };
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

  describe("LocalJobQueue mechanics (isolated instance, real Postgres rows)", () => {
    it("runs the registered handler and marks the job COMPLETED with progress and result", async () => {
      const queue = new LocalJobQueue();
      queue.registerHandler(ExtractionEngineType.DOCUMENT_CLASSIFICATION, async (_job, ctx) => {
        await ctx.updateProgress(50, "analyzing");
        return { resultSummary: { detectedType: "STRUCTURAL_PLAN" } };
      });

      const job = await queue.enqueue({ companyId, projectId, projectFileId, engineType: ExtractionEngineType.DOCUMENT_CLASSIFICATION, createdByUserId: ownerActor.userId });

      await waitFor(async () => {
        const row = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
        return row.status === ExtractionJobStatus.COMPLETED;
      });

      const final = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(final.progressPercentage).toBe(100);
      expect(final.attempts).toBe(1);
      expect(final.startedAt).not.toBeNull();
      expect(final.completedAt).not.toBeNull();
      expect((final.resultSummaryJson as { detectedType?: string })?.detectedType).toBe("STRUCTURAL_PLAN");
    });

    it("does not create a duplicate job while a non-terminal job already exists for the same file + engine", async () => {
      const queue = new LocalJobQueue();
      const gate = deferred<void>();
      queue.registerHandler(ExtractionEngineType.TABLE_EXTRACTION, async () => {
        await gate.promise;
        return { resultSummary: {} };
      });

      const first = await queue.enqueue({ companyId, projectId, projectFileId, engineType: ExtractionEngineType.TABLE_EXTRACTION, createdByUserId: ownerActor.userId });
      await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: first.id } })).status === ExtractionJobStatus.RUNNING);

      const second = await queue.enqueue({ companyId, projectId, projectFileId, engineType: ExtractionEngineType.TABLE_EXTRACTION, createdByUserId: ownerActor.userId });
      expect(second.id).toBe(first.id);

      gate.resolve();
      await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: first.id } })).status === ExtractionJobStatus.COMPLETED);
    });

    it("retries a failing handler up to maximumAttempts, then marks FAILED with the last error recorded", async () => {
      const queue = new LocalJobQueue();
      let callCount = 0;
      queue.registerHandler(ExtractionEngineType.SCALE_DETECTION, async () => {
        callCount += 1;
        throw new Error(`synthetic failure #${callCount}`);
      });

      const job = await queue.enqueue({ companyId, projectId, projectFileId, engineType: ExtractionEngineType.SCALE_DETECTION, createdByUserId: ownerActor.userId, maximumAttempts: 2 });

      await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } })).status === ExtractionJobStatus.FAILED);

      const final = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(final.attempts).toBe(2);
      expect(callCount).toBe(2);
      expect(final.errorCode).toBe("HANDLER_ERROR");
      expect(final.errorMessage).toContain("synthetic failure #2");
      expect(final.failedAt).not.toBeNull();
    });

    it("marks a job FAILED with NO_HANDLER_REGISTERED when no handler exists for its engine type", async () => {
      const queue = new LocalJobQueue();
      const job = await queue.enqueue({ companyId, projectId, projectFileId, engineType: ExtractionEngineType.SYMBOL_DETECTION, createdByUserId: ownerActor.userId });

      await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } })).status === ExtractionJobStatus.FAILED);
      const final = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(final.errorCode).toBe("NO_HANDLER_REGISTERED");
    });

    it("cancels a running job and does not let a late handler resolution overwrite the cancellation", async () => {
      const queue = new LocalJobQueue();
      const gate = deferred<void>();
      queue.registerHandler(ExtractionEngineType.OBJECT_DETECTION, async (_job, ctx) => {
        await gate.promise;
        expect(await ctx.isCancelled()).toBe(true);
        return { resultSummary: { shouldNotBeApplied: true } };
      });

      const job = await queue.enqueue({ companyId, projectId, projectFileId, engineType: ExtractionEngineType.OBJECT_DETECTION, createdByUserId: ownerActor.userId });
      await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } })).status === ExtractionJobStatus.RUNNING);

      const cancelled = await queue.cancel(companyId, job.id);
      expect(cancelled.status).toBe(ExtractionJobStatus.CANCELLED);

      gate.resolve();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const final = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(final.status).toBe(ExtractionJobStatus.CANCELLED);
      expect(final.resultSummaryJson).toBeNull();
    });

    it("rejects cancelling a job that is already terminal", async () => {
      const queue = new LocalJobQueue();
      queue.registerHandler(ExtractionEngineType.PHOTO_ANALYSIS, async () => ({ resultSummary: {} }));
      const job = await queue.enqueue({ companyId, projectId, projectFileId, engineType: ExtractionEngineType.PHOTO_ANALYSIS, createdByUserId: ownerActor.userId });
      await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } })).status === ExtractionJobStatus.COMPLETED);

      await expect(queue.cancel(companyId, job.id)).rejects.toThrow(AppError);
    });

    it("recovers a stale RUNNING job (simulated crash) by resetting it to QUEUED and reprocessing", async () => {
      const queue = new LocalJobQueue();
      queue.registerHandler(ExtractionEngineType.VECTOR_EXTRACTION, async () => ({ resultSummary: { recovered: true } }));
      const job = await queue.enqueue({ companyId, projectId, projectFileId, engineType: ExtractionEngineType.VECTOR_EXTRACTION, createdByUserId: ownerActor.userId });
      await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } })).status === ExtractionJobStatus.COMPLETED);

      // Simulate a process death mid-job: force the completed job back to RUNNING directly in the DB.
      await prisma.extractionJob.update({
        where: { id: job.id },
        data: {
          status: ExtractionJobStatus.RUNNING,
          completedAt: null,
          resultSummaryJson: undefined,
          updatedAt: new Date(Date.now() - 6 * 60 * 1000),
        },
      });

      await queue.recoverStaleJobs();
      await waitFor(
        async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } })).status === ExtractionJobStatus.COMPLETED,
        10_000,
      );
      const final = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
      expect((final.resultSummaryJson as { recovered?: boolean })?.recovered).toBe(true);
    });
  });

  describe("extraction-job-service (real global queue singleton, tenant isolation + RBAC)", () => {
    let jobId: string;

    beforeAll(async () => {
      const row = await prisma.extractionJob.create({
        data: { companyId, projectId, projectFileId, engineType: ExtractionEngineType.FILE_PREPROCESSING, createdByUserId: ownerActor.userId, status: ExtractionJobStatus.QUEUED },
      });
      jobId = row.id;
    });

    it("lists jobs for a file scoped to the company", async () => {
      const jobs = await listExtractionJobsForFile(ownerActor, projectFileId);
      expect(jobs.some((j) => j.id === jobId)).toBe(true);
    });

    it("gets a single job by id", async () => {
      const job = await getExtractionJob(ownerActor, jobId);
      expect(job.id).toBe(jobId);
      expect(job.status).toBe("QUEUED");
    });

    it("enforces tenant isolation on job list/detail/cancel", async () => {
      await expect(listExtractionJobsForFile(ownerActorOtherCompany, projectFileId)).rejects.toThrow(NotFoundError);
      await expect(getExtractionJob(ownerActorOtherCompany, jobId)).rejects.toThrow(NotFoundError);
      await expect(cancelExtractionJob(ownerActorOtherCompany, jobId)).rejects.toThrow(NotFoundError);
    });

    it("rejects cancellation from a role without files:manage", async () => {
      await expect(cancelExtractionJob(reviewerActor, jobId)).rejects.toThrow(PermissionDeniedError);
    });

    it("cancels a queued job via the service", async () => {
      const result = await cancelExtractionJob(ownerActor, jobId);
      expect(result.status).toBe("CANCELLED");
    });
  });
});
