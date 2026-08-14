import {
  UserRole,
  WorkerAssignmentStatus,
  WorkerEventType,
  WorkerMaterialQuestionStatus,
  WorkerPlannerMode,
  WorkerRunEventType,
  WorkerRunStatus,
} from "@prisma/client";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import ar from "../src/lib/i18n/dictionaries/ar";
import en from "../src/lib/i18n/dictionaries/en";
import { prisma } from "../src/lib/db/prisma";
import { ConflictError, NotFoundError } from "../src/lib/errors/app-error";
import { answerWorkerMaterialQuestion, reviewExistingBOQ } from "../src/lib/services/worker-review-service";
import {
  drainWorkerRuns,
  enqueueWorkerReview,
  getLatestWorkerRunForBoq,
  getWorkerRunForCompany,
} from "../src/lib/services/worker-runner-service";
import type { WorkerPlanner } from "../src/lib/worker/openai-worker-planner";
import {
  buildAssignmentTimeline,
  buildRunTimeline,
  deriveStage,
  presentAssignmentStatus,
  presentRunStatus,
} from "../src/lib/worker/tayqan-presentation";
import {
  getWorkerDefinition,
  listWorkerDefinitions,
  TAYQAN_WORKER_DEFINITION,
} from "../src/lib/worker/worker-definitions";

const RUN_ID = `${Date.now()}-${process.pid}`;
const DETERMINISTIC_ENV = { ...process.env, WORKER_AI_PLANNER_ENABLED: "false" };
const AI_ENV = {
  ...process.env,
  WORKER_AI_PLANNER_ENABLED: "true",
  OPENAI_API_KEY: "test-only-openai-key",
  WORKER_AI_MODEL: "test-tayqan-model",
};

describe("TAYQAN-1 worker definition registry", () => {
  it("defines exactly one canonical, AVAILABLE TAYQAN worker with a non-empty identity", () => {
    expect(TAYQAN_WORKER_DEFINITION.key).toBe("tayqan");
    expect(TAYQAN_WORKER_DEFINITION.name).toBe("TAYQAN");
    expect(TAYQAN_WORKER_DEFINITION.title.length).toBeGreaterThan(0);
    expect(TAYQAN_WORKER_DEFINITION.status).toBe("AVAILABLE");
    expect(TAYQAN_WORKER_DEFINITION.capabilities.length).toBeGreaterThan(0);
    expect(TAYQAN_WORKER_DEFINITION.supportedAssignmentTypes).toContain("REVIEW_EXISTING_BOQ");
  });

  it("is resolvable by key and appears exactly once in the registry listing", () => {
    expect(getWorkerDefinition("tayqan")).toEqual(TAYQAN_WORKER_DEFINITION);
    expect(getWorkerDefinition("nonexistent-worker")).toBeNull();
    const all = listWorkerDefinitions();
    expect(all.filter((definition) => definition.key === "tayqan")).toHaveLength(1);
  });
});

describe("TAYQAN-1 presentation mapping (pure functions)", () => {
  it("maps every WorkerRunStatus and WorkerAssignmentStatus value to a defined presentation state", () => {
    for (const status of Object.values(WorkerRunStatus)) {
      expect(() => presentRunStatus(status)).not.toThrow();
      expect(presentRunStatus(status)).toBeTruthy();
    }
    for (const status of Object.values(WorkerAssignmentStatus)) {
      expect(() => presentAssignmentStatus(status, false)).not.toThrow();
      expect(presentAssignmentStatus(status, true)).toBeTruthy();
    }
  });

  it("shows COMPLETED assignments with unanswered material questions as WAITING_FOR_YOU, not READY_FOR_REVIEW", () => {
    expect(presentAssignmentStatus(WorkerAssignmentStatus.COMPLETED, true)).toBe("WAITING_FOR_YOU");
    expect(presentAssignmentStatus(WorkerAssignmentStatus.COMPLETED, false)).toBe("READY_FOR_REVIEW");
  });

  it("derives a stage strictly from the persisted event types it is given, never inventing one", () => {
    expect(deriveStage({ runEventTypes: [], assignmentEventTypes: [] })).toBeNull();
    expect(deriveStage({ runEventTypes: ["RUN_ENQUEUED"], assignmentEventTypes: [] })).toBe("PLANNING");
    expect(deriveStage({ runEventTypes: [], assignmentEventTypes: ["ASSIGNMENT_CREATED"] })).toBe("REVIEWING_BOQ");
    expect(deriveStage({ runEventTypes: [], assignmentEventTypes: ["DECISIONS_RECORDED"] })).toBe("QA_REVIEW");
  });

  it("builds timeline entries only from the events it was given, in the same order, never fabricating extras", () => {
    const events = [
      { eventType: WorkerEventType.ASSIGNMENT_CREATED, createdAt: "2026-08-14T00:00:00.000Z" },
      { eventType: WorkerEventType.REVIEW_COMPLETED, createdAt: "2026-08-14T00:00:05.000Z" },
    ];
    const timeline = buildAssignmentTimeline(events);
    expect(timeline).toHaveLength(events.length);
    expect(timeline.map((entry) => entry.createdAt)).toEqual(events.map((event) => event.createdAt));
    expect(buildAssignmentTimeline([])).toEqual([]);

    const runEvents = [{ eventType: WorkerRunEventType.RUN_ENQUEUED, createdAt: "2026-08-14T00:00:00.000Z" }];
    expect(buildRunTimeline(runEvents)).toHaveLength(1);
    expect(buildRunTimeline([])).toEqual([]);
  });
});

describe("TAYQAN-1 EN/AR dictionary keys", () => {
  const TAYQAN_KEYS = [
    "eyebrow", "tagline", "selectBoq", "available", "capabilitiesTitle", "briefTitle",
    "objectiveLabel", "objectivePlaceholder", "instructionsLabel", "instructionsPlaceholder",
    "hiring", "hireCta", "assignmentTitle", "questionsTitle", "recommendedAction",
    "affectedSubject", "answerPlaceholder", "answerAcknowledged", "answerWillCorrect",
    "answerExplain", "needsYourDecision", "findingsTitle", "advisoryTitle",
    "advisoryDisclaimer", "timelineTitle", "completedNote",
  ] as const;

  it("has every required TAYQAN key present as a non-empty string in both English and Arabic", () => {
    for (const key of TAYQAN_KEYS) {
      expect(typeof en.tayqan[key]).toBe("string");
      expect((en.tayqan[key] as string).length).toBeGreaterThan(0);
      expect(typeof ar.tayqan[key]).toBe("string");
      expect((ar.tayqan[key] as string).length).toBeGreaterThan(0);
    }
  });

  it("has an actual Arabic translation (not byte-identical to English) for TAYQAN prose", () => {
    for (const key of TAYQAN_KEYS) {
      expect(ar.tayqan[key]).not.toBe(en.tayqan[key]);
    }
  });
});

describe("TAYQAN-1 hire flow and assignment lifecycle (integration, real local Postgres)", () => {
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
      fullName: "TAYQAN Owner A",
      email: `worker-tayqan-a-${RUN_ID}@example.com`,
    };
  }

  function actorB(): CurrentActor {
    return {
      userId: userBId,
      companyId: companyBId,
      role: UserRole.COMPANY_OWNER,
      fullName: "TAYQAN Owner B",
      email: `worker-tayqan-b-${RUN_ID}@example.com`,
    };
  }

  async function createBOQ(companyId: string, projectId: string, label: string) {
    const revisionNumber = nextRevisionNumber;
    nextRevisionNumber += 1;
    return prisma.bOQ.create({
      data: {
        companyId,
        projectId,
        title: `${label} ${RUN_ID}`,
        revisionNumber,
        version: 1,
        verifiedVersion: 1,
        verifiedAt: new Date("2026-08-14T12:00:00.000Z"),
      },
    });
  }

  beforeAll(async () => {
    // claimNextWorkerRun claims the globally oldest QUEUED WorkerRun (a real
    // shared FIFO queue, not scoped to this test's own rows) — sweep out any
    // backlog left behind by a previous (e.g. interrupted) test invocation
    // against this local database so every drainWorkerRuns() call below is
    // guaranteed to claim the run this test itself just enqueued.
    for (let sweep = 0; sweep < 20; sweep += 1) {
      const result = await drainWorkerRuns({ runnerId: `sweep-${RUN_ID}-${sweep}`, limit: 5, env: DETERMINISTIC_ENV });
      if (result.claimedCount === 0) break;
    }

    const industry = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    const [companyA, companyB] = await Promise.all([
      prisma.company.create({
        data: {
          legalName: `TAYQAN Company A ${RUN_ID}`,
          tradeName: "TAYQAN A",
          email: `worker-tayqan-company-a-${RUN_ID}@example.com`,
        },
      }),
      prisma.company.create({
        data: {
          legalName: `TAYQAN Company B ${RUN_ID}`,
          tradeName: "TAYQAN B",
          email: `worker-tayqan-company-b-${RUN_ID}@example.com`,
        },
      }),
    ]);
    companyAId = companyA.id;
    companyBId = companyB.id;
    const [userA, userB, clientA, clientB] = await Promise.all([
      prisma.user.create({
        data: {
          companyId: companyAId,
          email: `worker-tayqan-a-${RUN_ID}@example.com`,
          passwordHash: "test-fixture-not-a-real-hash",
          fullName: "TAYQAN Owner A",
          role: UserRole.COMPANY_OWNER,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.user.create({
        data: {
          companyId: companyBId,
          email: `worker-tayqan-b-${RUN_ID}@example.com`,
          passwordHash: "test-fixture-not-a-real-hash",
          fullName: "TAYQAN Owner B",
          role: UserRole.COMPANY_OWNER,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.client.create({
        data: {
          companyId: companyAId,
          name: "TAYQAN Client A",
          email: `worker-tayqan-client-a-${RUN_ID}@example.com`,
        },
      }),
      prisma.client.create({
        data: {
          companyId: companyBId,
          name: "TAYQAN Client B",
          email: `worker-tayqan-client-b-${RUN_ID}@example.com`,
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
        slug: `worker-tayqan-a-${RUN_ID}`,
        reference: `WORKER-TAYQAN-A-${RUN_ID}`,
        name: "TAYQAN Project A",
      },
    });
    projectAId = project.id;
    await prisma.project.create({
      data: {
        companyId: companyBId,
        clientId: clientB.id,
        industryEngineId: industry.id,
        slug: `worker-tayqan-b-${RUN_ID}`,
        reference: `WORKER-TAYQAN-B-${RUN_ID}`,
        name: "TAYQAN Project B",
      },
    });
  });

  it("hires TAYQAN for the caller's own BOQ and persists the brief unchanged", async () => {
    const boq = await createBOQ(companyAId, projectAId, "Hire own BOQ");
    expect(await getLatestWorkerRunForBoq(companyAId, boq.id, "REVIEW_EXISTING_BOQ")).toBeNull();

    const run = await enqueueWorkerReview(
      actorA(),
      boq.id,
      `worker-tayqan-hire-${RUN_ID}`,
      DETERMINISTIC_ENV,
      { assignmentObjective: "Review before tender submission.", specialInstructions: "Focus on MEP quantities." },
    );

    expect(run.brief).toEqual({
      assignmentObjective: "Review before tender submission.",
      specialInstructions: "Focus on MEP quantities.",
    });
    const latest = await getLatestWorkerRunForBoq(companyAId, boq.id, "REVIEW_EXISTING_BOQ");
    expect(latest?.id).toBe(run.id);
    expect(latest?.brief).toEqual(run.brief);

    // Drain immediately so this run doesn't sit QUEUED and get claimed by an
    // unrelated drainWorkerRuns() call in a later test (claimNextWorkerRun
    // picks the globally oldest queued run, not one scoped to this test).
    await drainWorkerRuns({ runnerId: `runner-tayqan-hire-${RUN_ID}`, limit: 1, env: DETERMINISTIC_ENV });
  });

  it("does not allow hiring TAYQAN against another company's BOQ", async () => {
    const boqA = await createBOQ(companyAId, projectAId, "Cross-tenant target");
    await expect(
      enqueueWorkerReview(actorB(), boqA.id, `worker-tayqan-cross-hire-${RUN_ID}`, DETERMINISTIC_ENV),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await getLatestWorkerRunForBoq(companyBId, boqA.id, "REVIEW_EXISTING_BOQ")).toBeNull();
  });

  it("is idempotency-safe: hiring twice with the same key returns the same run and keeps the original brief", async () => {
    const boq = await createBOQ(companyAId, projectAId, "Duplicate hire");
    const key = `worker-tayqan-dup-${RUN_ID}`;
    const first = await enqueueWorkerReview(actorA(), boq.id, key, DETERMINISTIC_ENV, {
      assignmentObjective: "First brief.",
    });
    const second = await enqueueWorkerReview(actorA(), boq.id, key, DETERMINISTIC_ENV, {
      assignmentObjective: "A different brief that must not overwrite the first.",
    });

    expect(second.id).toBe(first.id);
    expect(second.brief.assignmentObjective).toBe("First brief.");
    const runs = await prisma.workerRun.count({ where: { companyId: companyAId, boqId: boq.id } });
    expect(runs).toBe(1);

    await drainWorkerRuns({ runnerId: `runner-tayqan-dup-${RUN_ID}`, limit: 1, env: DETERMINISTIC_ENV });
  });

  it("still completes an ordinary REVIEW_EXISTING_BOQ assignment when hired through TAYQAN's enqueue path", async () => {
    const boq = await createBOQ(companyAId, projectAId, "TAYQAN clear review");
    const run = await enqueueWorkerReview(actorA(), boq.id, `worker-tayqan-clear-${RUN_ID}`, DETERMINISTIC_ENV);
    await drainWorkerRuns({ runnerId: `runner-tayqan-clear-${RUN_ID}`, limit: 1, env: DETERMINISTIC_ENV });

    const completed = await getWorkerRunForCompany(companyAId, run.id);
    expect(completed.status).toBe(WorkerRunStatus.COMPLETED);
    expect(completed.resultAssignment?.id).toBeTruthy();
  });

  it("still opens material questions and lets the hiring user answer their own question", async () => {
    const boq = await createBOQ(companyAId, projectAId, "TAYQAN needs-input review");
    const section = await prisma.bOQSection.create({
      data: { companyId: companyAId, boqId: boq.id, code: "A", title: "Section A", sortOrder: 1 },
    });
    await prisma.bOQItem.create({
      data: {
        companyId: companyAId,
        sectionId: section.id,
        itemNumber: 1,
        itemCode: `TAYQAN-Q-${RUN_ID}`,
        category: "General",
        description: "Item missing governed evidence",
        quantity: 3,
        unit: "ea",
        unitCost: 12,
        landedCost: 12,
        marginPercentage: 5,
        sellingRate: 12.6,
        totalAmount: 37.8,
        status: "NEEDS_REVIEW",
        sortOrder: 1,
      },
    });

    const assignment = await reviewExistingBOQ(actorA(), boq.id, new Date("2026-08-14T12:00:00.000Z"));
    expect(assignment.status).toBe(WorkerAssignmentStatus.NEEDS_INPUT);
    expect(assignment.materialQuestions.length).toBeGreaterThan(0);
    const question = assignment.materialQuestions[0]!;

    const answered = await answerWorkerMaterialQuestion(actorA(), assignment.id, question.id, {
      answerType: "ACKNOWLEDGED",
      note: "TAYQAN's owner reviewed this.",
    });
    expect(answered.materialQuestions.find((entry) => entry.id === question.id)?.status).toBe(
      WorkerMaterialQuestionStatus.ANSWERED,
    );
  });

  it("denies answering a material question that belongs to another company's assignment", async () => {
    const boq = await createBOQ(companyAId, projectAId, "TAYQAN cross-tenant question");
    const section = await prisma.bOQSection.create({
      data: { companyId: companyAId, boqId: boq.id, code: "A", title: "Section A", sortOrder: 1 },
    });
    await prisma.bOQItem.create({
      data: {
        companyId: companyAId,
        sectionId: section.id,
        itemNumber: 1,
        itemCode: `TAYQAN-XQ-${RUN_ID}`,
        category: "General",
        description: "Item missing governed evidence",
        quantity: 4,
        unit: "ea",
        unitCost: 8,
        landedCost: 8,
        marginPercentage: 5,
        sellingRate: 8.4,
        totalAmount: 33.6,
        status: "NEEDS_REVIEW",
        sortOrder: 1,
      },
    });
    const assignment = await reviewExistingBOQ(actorA(), boq.id, new Date("2026-08-14T12:00:00.000Z"));
    const question = assignment.materialQuestions[0]!;

    await expect(
      answerWorkerMaterialQuestion(actorB(), assignment.id, question.id, {
        answerType: "ACKNOWLEDGED",
        note: "Attempted cross-tenant answer.",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const untouched = await prisma.workerMaterialQuestion.findUniqueOrThrow({ where: { id: question.id } });
    expect(untouched.status).toBe(WorkerMaterialQuestionStatus.OPEN);
  });

  it("builds an activity timeline containing exactly the persisted run and assignment events, nothing invented", async () => {
    const boq = await createBOQ(companyAId, projectAId, "TAYQAN timeline");
    const run = await enqueueWorkerReview(actorA(), boq.id, `worker-tayqan-timeline-${RUN_ID}`, DETERMINISTIC_ENV);
    await drainWorkerRuns({ runnerId: `runner-tayqan-timeline-${RUN_ID}`, limit: 1, env: DETERMINISTIC_ENV });
    const completed = await getWorkerRunForCompany(companyAId, run.id);

    const runTimeline = buildRunTimeline(completed.events);
    expect(runTimeline).toHaveLength(completed.events.length);

    const assignment = await prisma.workerAssignment.findFirstOrThrow({ where: { id: completed.resultAssignment!.id } });
    const persistedAssignmentEvents = await prisma.workerEvent.findMany({
      where: { assignmentId: assignment.id },
      orderBy: { sequenceNumber: "asc" },
    });
    const assignmentTimeline = buildAssignmentTimeline(
      persistedAssignmentEvents.map((event) => ({ eventType: event.eventType, createdAt: event.createdAt.toISOString() })),
    );
    expect(assignmentTimeline).toHaveLength(persistedAssignmentEvents.length);
  });

  it("keeps the bounded AI planner strictly advisory: it never mutates BOQ quantity/rate and always requires human review", async () => {
    const boq = await createBOQ(companyAId, projectAId, "TAYQAN AI advisory");
    const section = await prisma.bOQSection.create({
      data: { companyId: companyAId, boqId: boq.id, code: "A", title: "Section A", sortOrder: 1 },
    });
    const item = await prisma.bOQItem.create({
      data: {
        companyId: companyAId,
        sectionId: section.id,
        itemNumber: 1,
        itemCode: `TAYQAN-AI-${RUN_ID}`,
        category: "General",
        description: "Item missing governed evidence",
        quantity: 5,
        unit: "ea",
        unitCost: 20,
        landedCost: 20,
        marginPercentage: 5,
        sellingRate: 21,
        totalAmount: 105,
        status: "NEEDS_REVIEW",
        sortOrder: 1,
      },
    });
    const before = await prisma.bOQItem.findUniqueOrThrow({ where: { id: item.id } });

    const planner = vi.fn<WorkerPlanner>(async (input) => ({
      provider: "openai",
      model: "test-tayqan-model",
      providerResponseId: "resp_tayqan_test",
      plan: {
        summary: "A qualified QS should resolve the missing evidence.",
        priority: "HIGH",
        actions: [{
          kind: "REVIEW_MATERIAL_QUESTION",
          subjectType: "WorkerMaterialQuestion",
          subjectId: input.context.materialQuestions[0]?.id ?? input.context.assignment.boqId,
          rationale: "Deterministic review flagged this evidence as material.",
        }],
        cautions: ["Advisory only."],
        requiresHumanReview: true,
      },
      usage: { input_tokens: 10, output_tokens: 8 },
    }));

    const run = await enqueueWorkerReview(actorA(), boq.id, `worker-tayqan-ai-${RUN_ID}`, AI_ENV);
    await drainWorkerRuns({ runnerId: `runner-tayqan-ai-${RUN_ID}`, limit: 1, planner, env: AI_ENV });

    const completed = await getWorkerRunForCompany(companyAId, run.id);
    expect(completed.plannerMode).toBe(WorkerPlannerMode.BOUNDED_AI);
    expect(completed.advisoryPlan?.plan).toMatchObject({ requiresHumanReview: true });

    const after = await prisma.bOQItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.quantity.toString()).toBe(before.quantity.toString());
    expect(after.unitCost.toString()).toBe(before.unitCost.toString());
    expect(after.sellingRate.toString()).toBe(before.sellingRate.toString());
    expect(after.status).toBe(before.status);
  });

  it("rejects hiring TAYQAN for a BOQ id that does not exist for the caller's company", async () => {
    await expect(
      enqueueWorkerReview(actorA(), "00000000-0000-4000-8000-000000000999", `worker-tayqan-missing-${RUN_ID}`, DETERMINISTIC_ENV),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects an oversized brief at the schema layer rather than truncating it silently", async () => {
    const { workerHireBriefSchema } = await import("../src/lib/validation/worker-route-schemas");
    expect(() => workerHireBriefSchema.parse({ assignmentObjective: "x".repeat(2_001) })).toThrow();
    expect(() => workerHireBriefSchema.parse({ specialInstructions: "x".repeat(2_001) })).toThrow();
    expect(workerHireBriefSchema.parse({}).assignmentObjective).toBeUndefined();
  });
});
