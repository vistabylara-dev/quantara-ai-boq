import { randomUUID } from "node:crypto";
import {
  Prisma,
  WorkerAssignmentType,
  WorkerPlannerMode,
  WorkerRunEventType,
  WorkerRunStatus,
} from "@prisma/client";
import { z } from "zod";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { loadWorkerAIPlannerConfig } from "@/lib/config/security-secrets";
import { prisma } from "@/lib/db/prisma";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors/app-error";
import {
  getWorkerAssignmentRecord,
  reviewExistingBOQ,
} from "@/lib/services/worker-review-service";
import {
  buildBoundedPlannerInput,
  createOpenAIWorkerPlanner,
  WORKER_AI_PLANNER_VERSION,
  type WorkerPlanner,
} from "@/lib/worker/openai-worker-planner";

const DEFAULT_MAXIMUM_ATTEMPTS = 3;
const DEFAULT_LEASE_SECONDS = 90;
const MAX_DRAIN_LIMIT = 5;

export const workerRunIdempotencyKeySchema = z.string()
  .min(8)
  .max(200)
  .refine((value) => value === value.trim(), "Idempotency-Key cannot have leading or trailing whitespace.");

const workerRunInclude = {
  events: { orderBy: { sequenceNumber: "asc" } },
  aiPlan: true,
  resultAssignment: {
    select: { id: true, status: true, inspectionVersion: true, completedAt: true },
  },
} satisfies Prisma.WorkerRunInclude;

type WorkerRunWithRelations = Prisma.WorkerRunGetPayload<{ include: typeof workerRunInclude }>;

type RunIdentity = {
  id: string;
  companyId: string;
  projectId: string;
  boqId: string;
};

type ClaimedWorkerRun = RunIdentity & {
  assignmentType: WorkerAssignmentType;
  idempotencyKey: string;
  status: WorkerRunStatus;
  plannerMode: WorkerPlannerMode;
  sourceBoqVersion: number;
  sourceVerifiedVersion: number | null;
  sourceRevisionNumber: number;
  maximumAttempts: number;
  attempts: number;
  availableAt: Date;
  leaseOwner: string;
  leaseExpiresAt: Date;
  lastHeartbeatAt: Date;
  requestedByUserId: string;
  requestedByName: string;
  resultAssignmentId: string | null;
  startedAt: Date;
  completedAt: Date | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function runDTO(run: WorkerRunWithRelations) {
  return {
    id: run.id,
    assignmentType: run.assignmentType,
    status: run.status,
    plannerMode: run.plannerMode,
    companyId: run.companyId,
    projectId: run.projectId,
    boqId: run.boqId,
    idempotencyKey: run.idempotencyKey,
    source: {
      boqVersion: run.sourceBoqVersion,
      verifiedVersion: run.sourceVerifiedVersion,
      revisionNumber: run.sourceRevisionNumber,
    },
    execution: {
      attempts: run.attempts,
      maximumAttempts: run.maximumAttempts,
      availableAt: run.availableAt.toISOString(),
      leaseOwner: run.leaseOwner,
      leaseExpiresAt: run.leaseExpiresAt?.toISOString() ?? null,
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
    },
    failure: run.failureCode
      ? { code: run.failureCode, message: run.failureMessage }
      : null,
    resultAssignment: run.resultAssignment
      ? {
          id: run.resultAssignment.id,
          status: run.resultAssignment.status,
          inspectionVersion: run.resultAssignment.inspectionVersion,
          completedAt: run.resultAssignment.completedAt?.toISOString() ?? null,
        }
      : null,
    advisoryPlan: run.aiPlan
      ? {
          id: run.aiPlan.id,
          plannerVersion: run.aiPlan.plannerVersion,
          provider: run.aiPlan.provider,
          model: run.aiPlan.model,
          providerResponseId: run.aiPlan.providerResponseId,
          contextSha256: run.aiPlan.contextSha256,
          plan: run.aiPlan.planJson,
          createdAt: run.aiPlan.createdAt.toISOString(),
        }
      : null,
    events: run.events.map((event) => ({
      id: event.id,
      sequenceNumber: event.sequenceNumber,
      eventType: event.eventType,
      payload: event.payloadJson,
      createdAt: event.createdAt.toISOString(),
    })),
    requestedBy: { userId: run.requestedByUserId, name: run.requestedByName },
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

async function getRunRecord(companyId: string, runId: string) {
  const run = await prisma.workerRun.findFirst({
    where: { id: runId, companyId },
    include: workerRunInclude,
  });
  if (!run) throw new NotFoundError("Worker run not found.");
  return run;
}

export async function getWorkerRunForCompany(companyId: string, runId: string) {
  return runDTO(await getRunRecord(companyId, runId));
}

async function appendRunEvent(
  tx: Prisma.TransactionClient,
  run: RunIdentity,
  eventType: WorkerRunEventType,
  payloadJson: Prisma.InputJsonObject,
) {
  const latest = await tx.workerRunEvent.findFirst({
    where: { workerRunId: run.id },
    orderBy: { sequenceNumber: "desc" },
    select: { sequenceNumber: true },
  });
  return tx.workerRunEvent.create({
    data: {
      companyId: run.companyId,
      projectId: run.projectId,
      boqId: run.boqId,
      workerRunId: run.id,
      sequenceNumber: (latest?.sequenceNumber ?? 0) + 1,
      eventType,
      payloadJson,
    },
  });
}

async function appendRunEventOnce(
  tx: Prisma.TransactionClient,
  run: RunIdentity,
  eventType: WorkerRunEventType,
  payloadJson: Prisma.InputJsonObject,
) {
  const exists = await tx.workerRunEvent.findFirst({
    where: { workerRunId: run.id, eventType },
    select: { id: true },
  });
  if (!exists) await appendRunEvent(tx, run, eventType, payloadJson);
}

export async function enqueueWorkerReview(
  actor: CurrentActor,
  boqId: string,
  idempotencyKeyInput: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const idempotencyKey = workerRunIdempotencyKeySchema.parse(idempotencyKeyInput);
  const plannerConfig = loadWorkerAIPlannerConfig(env);
  const plannerMode = plannerConfig.enabled ? WorkerPlannerMode.BOUNDED_AI : WorkerPlannerMode.DETERMINISTIC_ONLY;
  const boq = await prisma.bOQ.findFirst({
    where: { id: boqId, companyId: actor.companyId },
    select: { id: true, projectId: true, version: true, verifiedVersion: true, revisionNumber: true },
  });
  if (!boq) throw new NotFoundError("BOQ not found.");

  const existing = await prisma.workerRun.findUnique({
    where: {
      companyId_assignmentType_idempotencyKey: {
        companyId: actor.companyId,
        assignmentType: WorkerAssignmentType.REVIEW_EXISTING_BOQ,
        idempotencyKey,
      },
    },
  });
  if (existing) {
    if (existing.boqId !== boqId) {
      throw new ConflictError("IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key already targets another BOQ review.");
    }
    return getWorkerRunForCompany(actor.companyId, existing.id);
  }

  const runId = randomUUID();
  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.workerRun.create({
        data: {
          id: runId,
          companyId: actor.companyId,
          projectId: boq.projectId,
          boqId: boq.id,
          assignmentType: WorkerAssignmentType.REVIEW_EXISTING_BOQ,
          idempotencyKey,
          plannerMode,
          sourceBoqVersion: boq.version,
          sourceVerifiedVersion: boq.verifiedVersion,
          sourceRevisionNumber: boq.revisionNumber,
          maximumAttempts: DEFAULT_MAXIMUM_ATTEMPTS,
          requestedByUserId: actor.userId,
          requestedByName: actor.fullName,
        },
      });
      await appendRunEvent(tx, created, WorkerRunEventType.RUN_ENQUEUED, {
        assignmentType: WorkerAssignmentType.REVIEW_EXISTING_BOQ,
        plannerMode,
        sourceBoqVersion: boq.version,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const raced = await prisma.workerRun.findUnique({
      where: {
        companyId_assignmentType_idempotencyKey: {
          companyId: actor.companyId,
          assignmentType: WorkerAssignmentType.REVIEW_EXISTING_BOQ,
          idempotencyKey,
        },
      },
    });
    if (!raced || raced.boqId !== boqId) {
      throw new ConflictError("IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key already targets another BOQ review.");
    }
    return getWorkerRunForCompany(actor.companyId, raced.id);
  }
  return getWorkerRunForCompany(actor.companyId, runId);
}

async function reapExpiredExhaustedRuns(tx: Prisma.TransactionClient, now: Date) {
  for (let index = 0; index < 10; index += 1) {
    const rows = await tx.$queryRaw<RunIdentity[]>(Prisma.sql`
      SELECT "id", "companyId", "projectId", "boqId"
      FROM "WorkerRun"
      WHERE "status" = 'RUNNING'
        AND "leaseExpiresAt" <= ${now}
        AND "attempts" >= "maximumAttempts"
      ORDER BY "leaseExpiresAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);
    const run = rows[0];
    if (!run) return;
    await tx.workerRun.update({
      where: { id: run.id },
      data: {
        status: WorkerRunStatus.FAILED,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastHeartbeatAt: null,
        completedAt: now,
        failureCode: "WORKER_LEASE_EXHAUSTED",
        failureMessage: "The durable worker lease expired after the maximum number of attempts.",
      },
    });
    await appendRunEvent(tx, run, WorkerRunEventType.RUN_FAILED, {
      failureCode: "WORKER_LEASE_EXHAUSTED",
      attemptsExhausted: true,
    });
  }
}

export async function claimNextWorkerRun(
  runnerId: string,
  now = new Date(),
  leaseSeconds = DEFAULT_LEASE_SECONDS,
): Promise<ClaimedWorkerRun | null> {
  if (runnerId.trim().length < 8 || runnerId.trim().length > 200) throw new Error("Runner identity is invalid.");
  if (!Number.isInteger(leaseSeconds) || leaseSeconds < 15 || leaseSeconds > 900) throw new Error("Worker lease duration is invalid.");
  const leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1_000);

  return prisma.$transaction(async (tx) => {
    await reapExpiredExhaustedRuns(tx, now);
    const rows = await tx.$queryRaw<ClaimedWorkerRun[]>(Prisma.sql`
      WITH candidate AS (
        SELECT "id"
        FROM "WorkerRun"
        WHERE (
          ("status" = 'QUEUED' AND "availableAt" <= ${now})
          OR ("status" = 'RUNNING' AND "leaseExpiresAt" <= ${now})
        )
          AND "attempts" < "maximumAttempts"
        ORDER BY "availableAt" ASC, "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE "WorkerRun" run
      SET "status" = 'RUNNING',
          "attempts" = run."attempts" + 1,
          "leaseOwner" = ${runnerId.trim()},
          "leaseExpiresAt" = ${leaseExpiresAt},
          "lastHeartbeatAt" = ${now},
          "startedAt" = COALESCE(run."startedAt", ${now}),
          "updatedAt" = ${now}
      FROM candidate
      WHERE run."id" = candidate."id"
      RETURNING run.*
    `);
    const claimed = rows[0];
    if (!claimed) return null;
    await appendRunEvent(tx, claimed, WorkerRunEventType.LEASE_ACQUIRED, {
      attempt: claimed.attempts,
      runnerId: runnerId.trim(),
      leaseExpiresAt: leaseExpiresAt.toISOString(),
    });
    return claimed;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

export async function heartbeatWorkerRun(
  runId: string,
  leaseOwner: string,
  now = new Date(),
  leaseSeconds = DEFAULT_LEASE_SECONDS,
) {
  const leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1_000);
  const updated = await prisma.workerRun.updateMany({
    where: {
      id: runId,
      status: WorkerRunStatus.RUNNING,
      leaseOwner,
      leaseExpiresAt: { gt: now },
    },
    data: { lastHeartbeatAt: now, leaseExpiresAt },
  });
  if (updated.count !== 1) throw new ConflictError("WORKER_LEASE_LOST", "The durable worker lease is no longer active.");
  return leaseExpiresAt;
}

async function linkDeterministicAssignment(run: ClaimedWorkerRun, assignmentId: string) {
  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "WorkerRun"
      WHERE "id" = CAST(${run.id} AS uuid)
        AND "status" = 'RUNNING'
        AND "leaseOwner" = ${run.leaseOwner}
        AND "leaseExpiresAt" > CURRENT_TIMESTAMP
      FOR UPDATE
    `);
    if (!locked.length) throw new ConflictError("WORKER_LEASE_LOST", "The durable worker lease is no longer active.");
    await tx.workerRun.update({ where: { id: run.id }, data: { resultAssignmentId: assignmentId } });
    await appendRunEventOnce(tx, run, WorkerRunEventType.DETERMINISTIC_REVIEW_LINKED, { assignmentId });
    if (run.plannerMode === WorkerPlannerMode.DETERMINISTIC_ONLY) {
      await appendRunEventOnce(tx, run, WorkerRunEventType.AI_PLANNER_SKIPPED, {
        reason: "FEATURE_DISABLED_AT_ENQUEUE",
      });
    }
  });
}

async function persistAIPlan(run: ClaimedWorkerRun, assignmentId: string, planner: WorkerPlanner) {
  const existing = await prisma.workerAIPlan.findUnique({ where: { workerRunId: run.id } });
  if (existing) return;
  await heartbeatWorkerRun(run.id, run.leaseOwner);
  const assignment = await getWorkerAssignmentRecord(run.companyId, assignmentId);
  const boundedInput = buildBoundedPlannerInput(assignment);
  const result = await planner(boundedInput);

  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "WorkerRun"
      WHERE "id" = CAST(${run.id} AS uuid)
        AND "status" = 'RUNNING'
        AND "leaseOwner" = ${run.leaseOwner}
        AND "leaseExpiresAt" > CURRENT_TIMESTAMP
      FOR UPDATE
    `);
    if (!locked.length) throw new ConflictError("WORKER_LEASE_LOST", "The durable worker lease is no longer active.");
    const alreadyPersisted = await tx.workerAIPlan.findUnique({ where: { workerRunId: run.id } });
    if (!alreadyPersisted) {
      await tx.workerAIPlan.create({
        data: {
          companyId: run.companyId,
          projectId: run.projectId,
          boqId: run.boqId,
          workerRunId: run.id,
          assignmentId,
          plannerVersion: WORKER_AI_PLANNER_VERSION,
          provider: result.provider,
          model: result.model,
          providerResponseId: result.providerResponseId,
          contextSha256: boundedInput.contextSha256,
          contextSummaryJson: boundedInput.context as unknown as Prisma.InputJsonObject,
          planJson: result.plan as unknown as Prisma.InputJsonObject,
          ...(result.usage === null ? {} : { usageJson: result.usage }),
        },
      });
      await appendRunEventOnce(tx, run, WorkerRunEventType.AI_PLAN_RECORDED, {
        plannerVersion: WORKER_AI_PLANNER_VERSION,
        provider: result.provider,
        model: result.model,
        contextSha256: boundedInput.contextSha256,
      });
    }
  });
}

function safeFailure(error: unknown) {
  if (error instanceof AppError) return { code: error.code.slice(0, 100), message: error.message.slice(0, 500) };
  return { code: "WORKER_RUN_FAILED", message: "The worker run could not be completed." };
}

async function settleFailedAttempt(run: ClaimedWorkerRun, error: unknown): Promise<WorkerRunStatus | null> {
  const failure = safeFailure(error);
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const locked = await tx.workerRun.findFirst({
      where: {
        id: run.id,
        status: WorkerRunStatus.RUNNING,
        leaseOwner: run.leaseOwner,
        leaseExpiresAt: { gt: now },
      },
    });
    if (!locked) return null;
    if (locked.attempts < locked.maximumAttempts) {
      const delaySeconds = Math.min(300, 5 * (2 ** Math.max(0, locked.attempts - 1)));
      const availableAt = new Date(now.getTime() + delaySeconds * 1_000);
      await tx.workerRun.update({
        where: { id: run.id },
        data: {
          status: WorkerRunStatus.QUEUED,
          availableAt,
          leaseOwner: null,
          leaseExpiresAt: null,
          lastHeartbeatAt: null,
        },
      });
      await appendRunEvent(tx, run, WorkerRunEventType.RETRY_SCHEDULED, {
        failedAttempt: locked.attempts,
        nextAttempt: locked.attempts + 1,
        availableAt: availableAt.toISOString(),
        failureCode: failure.code,
      });
      return WorkerRunStatus.QUEUED;
    }
    await tx.workerRun.update({
      where: { id: run.id },
      data: {
        status: WorkerRunStatus.FAILED,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastHeartbeatAt: null,
        completedAt: now,
        failureCode: failure.code,
        failureMessage: failure.message,
      },
    });
    await appendRunEvent(tx, run, WorkerRunEventType.RUN_FAILED, {
      failureCode: failure.code,
      attemptsExhausted: true,
    });
    return WorkerRunStatus.FAILED;
  });
}

async function completeWorkerRun(run: ClaimedWorkerRun, assignmentId: string) {
  await prisma.$transaction(async (tx) => {
    const locked = await tx.workerRun.findFirst({
      where: { id: run.id, status: WorkerRunStatus.RUNNING, leaseOwner: run.leaseOwner },
    });
    if (!locked || !locked.leaseExpiresAt || locked.leaseExpiresAt.getTime() <= Date.now()) {
      throw new ConflictError("WORKER_LEASE_LOST", "The durable worker lease is no longer active.");
    }
    const completedAt = new Date();
    await tx.workerRun.update({
      where: { id: run.id },
      data: {
        status: WorkerRunStatus.COMPLETED,
        resultAssignmentId: assignmentId,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastHeartbeatAt: null,
        completedAt,
      },
    });
    await appendRunEvent(tx, run, WorkerRunEventType.RUN_COMPLETED, { assignmentId });
  });
}

export async function processClaimedWorkerRun(run: ClaimedWorkerRun, planner?: WorkerPlanner) {
  try {
    const user = await prisma.user.findFirst({
      where: { id: run.requestedByUserId, companyId: run.companyId, isActive: true },
      select: { id: true, companyId: true, role: true, fullName: true, email: true },
    });
    if (!user) throw new Error("Worker requester is unavailable.");
    const actor: CurrentActor = {
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
    };

    const assignment = await reviewExistingBOQ(actor, run.boqId, run.createdAt, {
      assignmentId: run.id,
      expectedBoqVersion: run.sourceBoqVersion,
      lease: { workerRunId: run.id, leaseOwner: run.leaseOwner },
    });
    await linkDeterministicAssignment(run, assignment.id);

    if (run.plannerMode === WorkerPlannerMode.BOUNDED_AI) {
      if (!planner) throw new Error("Bounded AI planner is unavailable for this queued run.");
      await persistAIPlan(run, assignment.id, planner);
    }

    await completeWorkerRun(run, assignment.id);
    return { runId: run.id, status: WorkerRunStatus.COMPLETED, assignmentId: assignment.id };
  } catch (error) {
    const status = await settleFailedAttempt(run, error);
    return { runId: run.id, status: status ?? WorkerRunStatus.RUNNING, assignmentId: run.resultAssignmentId };
  }
}

export type DrainWorkerRunsOptions = {
  runnerId: string;
  limit?: number;
  leaseSeconds?: number;
  planner?: WorkerPlanner;
  env?: NodeJS.ProcessEnv;
};

export async function drainWorkerRuns(options: DrainWorkerRunsOptions) {
  const limit = options.limit ?? 1;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_DRAIN_LIMIT) throw new Error("Worker drain limit is invalid.");
  const config = loadWorkerAIPlannerConfig(options.env ?? process.env);
  const planner = options.planner ?? (config.enabled ? createOpenAIWorkerPlanner(config) : undefined);
  const processed: Array<Awaited<ReturnType<typeof processClaimedWorkerRun>>> = [];

  for (let index = 0; index < limit; index += 1) {
    const claimed = await claimNextWorkerRun(options.runnerId, new Date(), options.leaseSeconds);
    if (!claimed) break;
    processed.push(await processClaimedWorkerRun(claimed, planner));
  }
  return { runnerId: options.runnerId, claimedCount: processed.length, processed };
}
