import {
  UserRole,
  WorkerPlannerMode,
  WorkerRunEventType,
  WorkerRunStatus,
} from "@prisma/client";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { prisma } from "../src/lib/db/prisma";
import { ConflictError, NotFoundError } from "../src/lib/errors/app-error";
import {
  claimNextWorkerRun,
  drainWorkerRuns,
  enqueueWorkerReview,
  getWorkerRunForCompany,
  processClaimedWorkerRun,
} from "../src/lib/services/worker-runner-service";
import { reviewExistingBOQ } from "../src/lib/services/worker-review-service";
import type { WorkerPlanner } from "../src/lib/worker/openai-worker-planner";

const RUN_ID = `${Date.now()}-${process.pid}`;
const DETERMINISTIC_ENV = { ...process.env, WORKER_AI_PLANNER_ENABLED: "false" };
const AI_ENV = {
  ...process.env,
  WORKER_AI_PLANNER_ENABLED: "true",
  OPENAI_API_KEY: "test-only-openai-key",
  WORKER_AI_MODEL: "test-worker-model",
};

describe("Worker V1 durable runner (integration, real local Postgres)", () => {
  let companyAId: string;
  let companyBId: string;
  let userAId: string;
  let userBId: string;
  let projectAId: string;
  let nextRevisionNumber = 1;

  function actorA(): CurrentActor {
    return {
      userId: userAId,
      companyId: companyAId,
      role: UserRole.COMPANY_OWNER,
      fullName: "Worker V1 Owner A",
      email: `worker-v1-a-${RUN_ID}@example.com`,
    };
  }

  async function createBOQ(label: string) {
    const revisionNumber = nextRevisionNumber;
    nextRevisionNumber += 1;
    return prisma.bOQ.create({
      data: {
        companyId: companyAId,
        projectId: projectAId,
        title: `${label} ${RUN_ID}`,
        revisionNumber,
        version: 1,
        verifiedVersion: 1,
        verifiedAt: new Date("2026-08-13T12:00:00.000Z"),
      },
    });
  }

  function successfulPlanner(): WorkerPlanner {
    return vi.fn<WorkerPlanner>(async (input) => ({
      provider: "openai",
      model: "test-worker-model",
      providerResponseId: "resp_worker_v1_test",
      plan: {
        summary: "A qualified reviewer should resolve the deterministic material question.",
        priority: "HIGH",
        actions: [{
          kind: "REVIEW_MATERIAL_QUESTION",
          subjectType: "WorkerMaterialQuestion",
          subjectId: input.context.materialQuestions[0]?.id ?? input.context.assignment.boqId,
          rationale: "The deterministic review found an unresolved material scope question.",
        }],
        cautions: ["This plan is advisory and cannot change governed BOQ records."],
        requiresHumanReview: true,
      },
      usage: { input_tokens: 20, output_tokens: 15 },
    }));
  }

  beforeAll(async () => {
    const industry = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    const [companyA, companyB] = await Promise.all([
      prisma.company.create({
        data: {
          legalName: `Worker V1 Company A ${RUN_ID}`,
          tradeName: "Worker V1 A",
          email: `worker-v1-company-a-${RUN_ID}@example.com`,
        },
      }),
      prisma.company.create({
        data: {
          legalName: `Worker V1 Company B ${RUN_ID}`,
          tradeName: "Worker V1 B",
          email: `worker-v1-company-b-${RUN_ID}@example.com`,
        },
      }),
    ]);
    companyAId = companyA.id;
    companyBId = companyB.id;
    const [userA, userB, clientA] = await Promise.all([
      prisma.user.create({
        data: {
          companyId: companyAId,
          email: `worker-v1-a-${RUN_ID}@example.com`,
          passwordHash: "test-fixture-not-a-real-hash",
          fullName: "Worker V1 Owner A",
          role: UserRole.COMPANY_OWNER,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.user.create({
        data: {
          companyId: companyBId,
          email: `worker-v1-b-${RUN_ID}@example.com`,
          passwordHash: "test-fixture-not-a-real-hash",
          fullName: "Worker V1 Owner B",
          role: UserRole.COMPANY_OWNER,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.client.create({
        data: {
          companyId: companyAId,
          name: "Worker V1 Client A",
          email: `worker-v1-client-a-${RUN_ID}@example.com`,
        },
      }),
    ]);
    userAId = userA.id;
    userBId = userB.id;
    const project = await prisma.project.create({
      data: {
        companyId: companyAId,
        clientId: clientA.id,
        industryEngineId: industry.id,
        slug: `worker-v1-${RUN_ID}`,
        reference: `WORKER-V1-${RUN_ID}`,
        name: "Worker V1 Project A",
      },
    });
    projectAId = project.id;
  });

  it("enqueues idempotently and completes without model calls when AI is disabled", async () => {
    const boq = await createBOQ("Idempotent deterministic review");
    const before = await prisma.bOQ.findUniqueOrThrow({ where: { id: boq.id } });
    const key = `worker-v1-idempotent-${RUN_ID}`;
    const first = await enqueueWorkerReview(actorA(), boq.id, key, DETERMINISTIC_ENV);
    const second = await enqueueWorkerReview(actorA(), boq.id, key, DETERMINISTIC_ENV);

    expect(second.id).toBe(first.id);
    expect(first.plannerMode).toBe(WorkerPlannerMode.DETERMINISTIC_ONLY);
    const result = await drainWorkerRuns({
      runnerId: `runner-idempotent-${RUN_ID}`,
      limit: 1,
      env: DETERMINISTIC_ENV,
    });
    expect(result.claimedCount).toBe(1);
    const completed = await getWorkerRunForCompany(companyAId, first.id);
    expect(completed.status).toBe(WorkerRunStatus.COMPLETED);
    expect(completed.resultAssignment?.id).toBe(first.id);
    expect(completed.advisoryPlan).toBeNull();
    expect(completed.events.map((event) => event.eventType)).toContain(WorkerRunEventType.AI_PLANNER_SKIPPED);
    expect(await prisma.workerAssignment.count({ where: { id: first.id } })).toBe(1);
    expect(await prisma.bOQ.findUniqueOrThrow({ where: { id: boq.id } })).toEqual(before);
  });

  it("allows only one concurrent claimant for a queued run", async () => {
    const boq = await createBOQ("Atomic claim review");
    const queued = await enqueueWorkerReview(actorA(), boq.id, `worker-v1-claim-${RUN_ID}`, DETERMINISTIC_ENV);
    const now = new Date();
    const [left, right] = await Promise.all([
      claimNextWorkerRun(`runner-left-${RUN_ID}`, now),
      claimNextWorkerRun(`runner-right-${RUN_ID}`, now),
    ]);
    const claims = [left, right].filter((entry) => entry !== null);
    expect(claims).toHaveLength(1);
    expect(claims[0]?.id).toBe(queued.id);
    await processClaimedWorkerRun(claims[0]!);
    expect((await getWorkerRunForCompany(companyAId, queued.id)).status).toBe(WorkerRunStatus.COMPLETED);
  });

  it("reclaims an expired lease and reuses the same deterministic assignment after a crash", async () => {
    const boq = await createBOQ("Crash recovery review");
    const queued = await enqueueWorkerReview(actorA(), boq.id, `worker-v1-crash-${RUN_ID}`, DETERMINISTIC_ENV);
    const firstClaimAt = new Date();
    const firstClaim = await claimNextWorkerRun(`runner-crash-first-${RUN_ID}`, firstClaimAt, 15);
    expect(firstClaim?.id).toBe(queued.id);

    const assignment = await reviewExistingBOQ(actorA(), boq.id, firstClaim!.createdAt, {
      assignmentId: firstClaim!.id,
      expectedBoqVersion: firstClaim!.sourceBoqVersion,
      lease: { workerRunId: firstClaim!.id, leaseOwner: firstClaim!.leaseOwner },
    });
    expect(assignment.id).toBe(queued.id);

    const reclaimed = await claimNextWorkerRun(
      `runner-crash-second-${RUN_ID}`,
      new Date(firstClaimAt.getTime() + 16_000),
      30,
    );
    expect(reclaimed).toMatchObject({ id: queued.id, attempts: 2 });
    await processClaimedWorkerRun(reclaimed!);

    const completed = await getWorkerRunForCompany(companyAId, queued.id);
    expect(completed.status).toBe(WorkerRunStatus.COMPLETED);
    expect(completed.resultAssignment?.id).toBe(assignment.id);
    expect(await prisma.workerAssignment.count({ where: { id: queued.id } })).toBe(1);
  });

  it("calls the bounded planner once, stores an immutable advisory plan, and enforces tenant isolation", async () => {
    const boq = await createBOQ("Bounded AI review");
    const queued = await enqueueWorkerReview(actorA(), boq.id, `worker-v1-ai-${RUN_ID}`, AI_ENV);
    const planner = successfulPlanner();
    await drainWorkerRuns({
      runnerId: `runner-ai-${RUN_ID}`,
      limit: 1,
      planner,
      env: AI_ENV,
    });

    expect(planner).toHaveBeenCalledTimes(1);
    const completed = await getWorkerRunForCompany(companyAId, queued.id);
    expect(completed.status).toBe(WorkerRunStatus.COMPLETED);
    expect(completed.plannerMode).toBe(WorkerPlannerMode.BOUNDED_AI);
    expect(completed.advisoryPlan).toMatchObject({
      provider: "openai",
      model: "test-worker-model",
      providerResponseId: "resp_worker_v1_test",
    });
    await expect(getWorkerRunForCompany(companyBId, queued.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(prisma.workerAIPlan.update({
      where: { workerRunId: queued.id },
      data: { model: "attempted-overwrite" },
    })).rejects.toThrow(/immutable/i);
    await expect(prisma.workerRun.update({
      where: { id: queued.id },
      data: { attempts: 1 },
    })).rejects.toThrow(/immutable/i);
  });

  it("bounds retries and fails terminally without duplicating the assignment", async () => {
    const boq = await createBOQ("Bounded retry review");
    const queued = await enqueueWorkerReview(actorA(), boq.id, `worker-v1-retry-${RUN_ID}`, AI_ENV);
    const failingPlanner = vi.fn<WorkerPlanner>(async () => {
      throw new Error("simulated provider outage");
    });

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (attempt > 1) {
        await prisma.workerRun.update({
          where: { id: queued.id },
          data: { availableAt: new Date(0) },
        });
      }
      const claim = await claimNextWorkerRun(`runner-retry-${attempt}-${RUN_ID}`);
      expect(claim).toMatchObject({ id: queued.id, attempts: attempt });
      await processClaimedWorkerRun(claim!, failingPlanner);
    }

    const failed = await getWorkerRunForCompany(companyAId, queued.id);
    expect(failed.status).toBe(WorkerRunStatus.FAILED);
    expect(failed.execution.attempts).toBe(3);
    expect(failed.failure?.code).toBe("WORKER_RUN_FAILED");
    expect(failingPlanner).toHaveBeenCalledTimes(3);
    expect(await prisma.workerAssignment.count({ where: { id: queued.id } })).toBe(1);
    expect(failed.events.filter((event) => event.eventType === WorkerRunEventType.RETRY_SCHEDULED)).toHaveLength(2);
    expect(failed.events.at(-1)?.eventType).toBe(WorkerRunEventType.RUN_FAILED);
  });

  it("rejects cross-target idempotency reuse", async () => {
    const [firstBoq, secondBoq] = await Promise.all([
      createBOQ("Idempotency target A"),
      createBOQ("Idempotency target B"),
    ]);
    const key = `worker-v1-target-${RUN_ID}`;
    const queued = await enqueueWorkerReview(actorA(), firstBoq.id, key, DETERMINISTIC_ENV);
    await expect(enqueueWorkerReview(actorA(), secondBoq.id, key, DETERMINISTIC_ENV))
      .rejects.toBeInstanceOf(ConflictError);
    await drainWorkerRuns({ runnerId: `runner-target-${RUN_ID}`, env: DETERMINISTIC_ENV });
    expect((await getWorkerRunForCompany(companyAId, queued.id)).status).toBe(WorkerRunStatus.COMPLETED);
    expect(userBId).toBeTruthy();
  });
});
