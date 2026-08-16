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
  canOfferRehire,
  capabilityTranslationKey,
  deriveStage,
  isReviewStale,
  presentAssignmentStatus,
  presentRunStatus,
  statusTranslationKey,
  type TayqanPresentationState,
} from "../src/lib/worker/tayqan-presentation";
import { nextHireIdempotencyKey, type HireAttemptKeyState } from "../src/lib/worker/tayqan-hire-attempt";
import {
  getWorkerDefinition,
  listWorkerDefinitions,
  TAYQAN_WORKER_DEFINITION,
} from "../src/lib/worker/worker-definitions";

/** Reads a dotted path (e.g. "tayqan.status.working") out of a dictionary object — mirrors src/lib/i18n/translate.ts's readPath, kept local since that function isn't exported. */
function readDictionaryPath(dictionary: unknown, key: string): string | undefined {
  const parts = key.split(".");
  let node: unknown = dictionary;
  for (const part of parts) {
    if (node == null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

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
    expect(TAYQAN_WORKER_DEFINITION.titleKey.length).toBeGreaterThan(0);
    expect(TAYQAN_WORKER_DEFINITION.status).toBe("AVAILABLE");
    expect(TAYQAN_WORKER_DEFINITION.capabilityKeys.length).toBeGreaterThan(0);
    expect(TAYQAN_WORKER_DEFINITION.supportedAssignmentTypes).toContain("REVIEW_EXISTING_BOQ");
  });

  it("exposes no hard-coded English presentation text — title and capabilities are i18n keys, not prose", () => {
    expect(TAYQAN_WORKER_DEFINITION).not.toHaveProperty("title");
    expect(TAYQAN_WORKER_DEFINITION).not.toHaveProperty("capabilities");
    expect(TAYQAN_WORKER_DEFINITION.titleKey).toMatch(/^tayqan\./);
    for (const capabilityKey of TAYQAN_WORKER_DEFINITION.capabilityKeys) {
      // A semantic id (e.g. "reviewExistingBoq"), never a rendered English sentence.
      expect(capabilityKey).toMatch(/^[a-z][a-zA-Z]*$/);
    }
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

  it("builds timeline entries as dictionary keys (not pre-rendered English labels), only from the events it was given, never fabricating extras", () => {
    const events = [
      { eventType: WorkerEventType.ASSIGNMENT_CREATED, createdAt: "2026-08-14T00:00:00.000Z" },
      { eventType: WorkerEventType.REVIEW_COMPLETED, createdAt: "2026-08-14T00:00:05.000Z" },
    ];
    const timeline = buildAssignmentTimeline(events);
    expect(timeline).toHaveLength(events.length);
    expect(timeline.map((entry) => entry.createdAt)).toEqual(events.map((event) => event.createdAt));
    // Every entry is a dot-path into the dictionary, never English prose.
    for (const entry of timeline) {
      expect(entry.i18nKey).toMatch(/^tayqan\.timeline\.[a-zA-Z]+$/);
      expect(readDictionaryPath(en, entry.i18nKey)).toBeTruthy();
      expect(readDictionaryPath(ar, entry.i18nKey)).toBeTruthy();
    }
    expect(buildAssignmentTimeline([])).toEqual([]);

    const runEvents = [{ eventType: WorkerRunEventType.RUN_ENQUEUED, createdAt: "2026-08-14T00:00:00.000Z" }];
    const runTimeline = buildRunTimeline(runEvents);
    expect(runTimeline).toHaveLength(1);
    expect(runTimeline[0]!.i18nKey).toMatch(/^tayqan\.timeline\.[a-zA-Z]+$/);
    expect(buildRunTimeline([])).toEqual([]);
  });

  it("picks a singular vs. plural key (with a count var) when a material-questions-opened event carries a count", () => {
    const one = buildAssignmentTimeline([{
      eventType: WorkerEventType.MATERIAL_QUESTIONS_OPENED,
      createdAt: "2026-08-14T00:00:00.000Z",
      payload: { materialQuestionCount: 1 },
    }]);
    expect(one[0]).toMatchObject({ i18nKey: "tayqan.timeline.materialQuestionsOpenedOne", vars: { count: 1 } });

    const many = buildAssignmentTimeline([{
      eventType: WorkerEventType.MATERIAL_QUESTIONS_OPENED,
      createdAt: "2026-08-14T00:00:00.000Z",
      payload: { materialQuestionCount: 3 },
    }]);
    expect(many[0]).toMatchObject({ i18nKey: "tayqan.timeline.materialQuestionsOpenedOther", vars: { count: 3 } });

    const noCount = buildAssignmentTimeline([{
      eventType: WorkerEventType.MATERIAL_QUESTIONS_OPENED,
      createdAt: "2026-08-14T00:00:00.000Z",
    }]);
    expect(noCount[0]).toMatchObject({ i18nKey: "tayqan.timeline.materialQuestionsOpened" });
  });

  it("resolves every TayqanPresentationState to a dictionary key with a real, non-empty translation in both locales", () => {
    const states: TayqanPresentationState[] = [
      "WORKING", "WAITING_FOR_YOU", "READY_FOR_REVIEW", "COMPLETED", "NEEDS_ATTENTION", "CANCELLED",
    ];
    for (const state of states) {
      const key = statusTranslationKey(state);
      expect(key).toMatch(/^tayqan\.status\.[a-zA-Z]+$/);
      expect(readDictionaryPath(en, key)).toBeTruthy();
      expect(readDictionaryPath(ar, key)).toBeTruthy();
    }
  });

  it("resolves every TAYQAN capability id to a dictionary key with a real, non-empty translation in both locales", () => {
    for (const capabilityKey of TAYQAN_WORKER_DEFINITION.capabilityKeys) {
      const key = capabilityTranslationKey(capabilityKey);
      expect(key).toBe(`tayqan.capabilities.${capabilityKey}`);
      expect(readDictionaryPath(en, key)).toBeTruthy();
      expect(readDictionaryPath(ar, key)).toBeTruthy();
    }
  });

  it("does not flag staleness when the BOQ version is unchanged since the latest run's source snapshot", () => {
    expect(isReviewStale({ boqVersion: 3, revisionNumber: 2 }, { version: 3, revisionNumber: 2 })).toBe(false);
  });

  it("flags staleness once the current BOQ version differs from the latest run's source snapshot (version is the strongest detector, not revisionNumber alone)", () => {
    expect(isReviewStale({ boqVersion: 3, revisionNumber: 2 }, { version: 4, revisionNumber: 2 })).toBe(true);
    // Revision number is display-only — a version bump is what actually
    // signals a governed BOQ mutation happened since the review.
    expect(isReviewStale({ boqVersion: 3, revisionNumber: 5 }, { version: 3, revisionNumber: 5 })).toBe(false);
  });

  it("only offers a rehire when the latest run is fully resolved (READY_FOR_REVIEW) — never during an active or unresolved review, never for FAILED/CANCELLED", () => {
    expect(canOfferRehire("READY_FOR_REVIEW")).toBe(true);
    expect(canOfferRehire("WORKING")).toBe(false);
    expect(canOfferRehire("WAITING_FOR_YOU")).toBe(false);
    expect(canOfferRehire("COMPLETED")).toBe(false);
    expect(canOfferRehire("NEEDS_ATTENTION")).toBe(false);
    expect(canOfferRehire("CANCELLED")).toBe(false);
    expect(canOfferRehire(null)).toBe(false);
  });
});

describe("TAYQAN-1 hire idempotency-key state machine (pure function)", () => {
  function counter() {
    let n = 0;
    return () => `key-${(n += 1)}`;
  }

  it("mints a key on the first attempt for a BOQ", () => {
    const generate = counter();
    const key = nextHireIdempotencyKey("boq-A", null, generate);
    expect(key).toBe("key-1");
  });

  it("reuses the same key on an uncertain retry for the same BOQ (lost response, response was never seen)", () => {
    const generate = counter();
    const first = nextHireIdempotencyKey("boq-A", null, generate);
    const pending: HireAttemptKeyState = { boqId: "boq-A", key: first };
    const retry = nextHireIdempotencyKey("boq-A", pending, generate);
    expect(retry).toBe(first);
    // generate() must not even be called again once a pending key exists.
    expect(generate()).toBe("key-2");
  });

  it("mints a fresh key when the BOQ selection changes, even if a previous attempt is still pending", () => {
    const generate = counter();
    const first = nextHireIdempotencyKey("boq-A", null, generate);
    const pending: HireAttemptKeyState = { boqId: "boq-A", key: first };
    const forOtherBoq = nextHireIdempotencyKey("boq-B", pending, generate);
    expect(forOtherBoq).not.toBe(first);
  });

  it("mints a fresh key for a later, genuinely new hire once the previous attempt is resolved (state cleared to null)", () => {
    const generate = counter();
    const first = nextHireIdempotencyKey("boq-A", null, generate);
    // Simulate resolution: the page clears hireAttempt to null once the run
    // is definitively observed (success, or a confirmed-via-lookup run).
    const resolved: HireAttemptKeyState = null;
    const later = nextHireIdempotencyKey("boq-A", resolved, generate);
    expect(later).not.toBe(first);
  });
});

describe("TAYQAN-1 EN/AR dictionary keys", () => {
  const TAYQAN_FLAT_KEYS = [
    "eyebrow", "tagline", "selectBoq", "available", "capabilitiesTitle", "briefTitle",
    "objectiveLabel", "objectivePlaceholder", "instructionsLabel", "instructionsPlaceholder",
    "hiring", "hireCta", "assignmentTitle", "questionsTitle", "recommendedAction",
    "affectedSubject", "answerPlaceholder", "answerAcknowledged", "answerWillCorrect",
    "answerExplain", "needsYourDecision", "findingsTitle", "advisoryTitle",
    "advisoryDisclaimer", "timelineTitle", "completedNote", "loading", "unavailable",
    "noBoqTitle", "noBoqDescription", "roleTitle", "revisionLabel", "fallbackAnswerNote",
    "staleTitle", "staleCurrentLabel", "staleLastReviewedLabel", "reviewUpdatedCta",
  ] as const;

  const TAYQAN_NESTED_KEYS = [
    "stats.items", "stats.quantityConfirmed", "stats.rateConfirmed", "stats.criticalIssues",
    "stats.warnings", "stats.revisionEvidence",
    "status.working", "status.waitingForYou", "status.readyForReview", "status.completed",
    "status.needsAttention", "status.cancelled",
    "timeline.assignmentCreated", "timeline.inspectionStarted", "timeline.workspaceCaptured",
    "timeline.decisionsRecorded", "timeline.materialQuestionsOpened", "timeline.materialQuestionsOpenedOne",
    "timeline.materialQuestionsOpenedOther", "timeline.materialQuestionAnswered", "timeline.reviewCompleted",
    "timeline.reviewNeedsInput", "timeline.reviewFailed", "timeline.runEnqueued", "timeline.leaseAcquired",
    "timeline.retryScheduled", "timeline.deterministicReviewLinked", "timeline.aiPlannerSkipped",
    "timeline.aiPlanRecorded", "timeline.runCompleted", "timeline.runFailed",
    "capabilities.reviewExistingBoq", "capabilities.quantityProvenance", "capabilities.rateProvenance",
    "capabilities.verificationIssues", "capabilities.revisionEvidence", "capabilities.materialQuestions",
    "capabilities.qaFindings",
  ] as const;

  it("has every required flat TAYQAN key present as a non-empty string in both English and Arabic", () => {
    for (const key of TAYQAN_FLAT_KEYS) {
      expect(typeof en.tayqan[key]).toBe("string");
      expect((en.tayqan[key] as string).length).toBeGreaterThan(0);
      expect(typeof ar.tayqan[key]).toBe("string");
      expect((ar.tayqan[key] as string).length).toBeGreaterThan(0);
    }
  });

  it("has every required nested TAYQAN key (stats/status/timeline/capabilities) present in both locales", () => {
    for (const key of TAYQAN_NESTED_KEYS) {
      const enValue = readDictionaryPath(en.tayqan, key);
      const arValue = readDictionaryPath(ar.tayqan, key);
      expect(enValue, `en.tayqan.${key}`).toBeTruthy();
      expect(arValue, `ar.tayqan.${key}`).toBeTruthy();
    }
  });

  it("has an actual Arabic translation (not byte-identical to English) for TAYQAN prose, brand name aside", () => {
    for (const key of TAYQAN_FLAT_KEYS) {
      expect(ar.tayqan[key]).not.toBe(en.tayqan[key]);
    }
    for (const key of TAYQAN_NESTED_KEYS) {
      const enValue = readDictionaryPath(en.tayqan, key);
      const arValue = readDictionaryPath(ar.tayqan, key);
      expect(arValue).not.toBe(enValue);
    }
  });

  it("the Arabic TAYQAN screen introduces no English-only presentation strings beyond the TAYQAN brand/technical identifiers", () => {
    // Everything the page renders through t() must now resolve through the
    // dictionary — this walks every ar.tayqan.* leaf and asserts it isn't
    // plain untranslated English prose. "TAYQAN" itself (the brand) and bare
    // technical identifiers are allowed to contain Latin letters.
    const LATIN_PROSE = /[A-Za-z]{2,}/;
    const ALLOWED_LATIN_IDENTIFIERS = [
      "TAYQAN",
      "Quantara",
      "Stripe",
      "MEP",
      "HVAC",
      "ELV",
      "Hardscape",
      "Softscape",
    ] as const;

    function walk(node: unknown, path: string, offenders: string[]) {
      if (typeof node === "string") {
        // Strip approved brand/technical identifiers and {vars} interpolation
        // placeholders before checking for stray English prose. The allow-list
        // is intentionally narrow so genuine untranslated English still fails.
        const withoutVars = node.replace(/\{\w+\}/g, "");
        const withoutAllowedIdentifiers = ALLOWED_LATIN_IDENTIFIERS.reduce(
          (value, identifier) => value.split(identifier).join(""),
          withoutVars,
        );
        if (LATIN_PROSE.test(withoutAllowedIdentifiers)) offenders.push(`${path} = ${JSON.stringify(node)}`);
        return;
      }
      if (node && typeof node === "object") {
        for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
          walk(value, path ? `${path}.${key}` : key, offenders);
        }
      }
    }
    const offenders: string[] = [];
    walk(ar.tayqan, "tayqan", offenders);
    expect(offenders).toEqual([]);
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

  it("a successful first hire plus a retry with the same key (simulating a lost response) cannot create a second WorkerRun", async () => {
    const boq = await createBOQ(companyAId, projectAId, "Lost response retry");
    const key = `worker-tayqan-lost-response-${RUN_ID}`;

    // First hire genuinely succeeds server-side...
    const first = await enqueueWorkerReview(actorA(), boq.id, key, DETERMINISTIC_ENV);
    // ...but the client never saw the response and retries with the SAME
    // key (per the "reuse the same key on an uncertain retry" rule in
    // src/lib/worker/tayqan-hire-attempt.ts — this call reproduces exactly
    // what the UI sends on that retry).
    const retry = await enqueueWorkerReview(actorA(), boq.id, key, DETERMINISTIC_ENV);

    expect(retry.id).toBe(first.id);
    expect(await prisma.workerRun.count({ where: { companyId: companyAId, boqId: boq.id } })).toBe(1);

    await drainWorkerRuns({ runnerId: `runner-tayqan-lost-response-${RUN_ID}`, limit: 1, env: DETERMINISTIC_ENV });
    expect(await prisma.workerRun.count({ where: { companyId: companyAId, boqId: boq.id } })).toBe(1);
  });

  it("a later, genuinely new hire (a different BOQ, per tayqan-hire-attempt's own-BOQ-scoped key) is not blocked by an earlier pending key", async () => {
    const [firstBoq, laterBoq] = await Promise.all([
      createBOQ(companyAId, projectAId, "Earlier pending hire"),
      createBOQ(companyAId, projectAId, "Later legitimate hire"),
    ]);
    const earlierKey = `worker-tayqan-earlier-${RUN_ID}`;
    const laterKey = `worker-tayqan-later-${RUN_ID}`;
    expect(earlierKey).not.toBe(laterKey);

    const earlier = await enqueueWorkerReview(actorA(), firstBoq.id, earlierKey, DETERMINISTIC_ENV);
    const later = await enqueueWorkerReview(actorA(), laterBoq.id, laterKey, DETERMINISTIC_ENV);

    expect(later.id).not.toBe(earlier.id);
    expect(await prisma.workerRun.count({ where: { companyId: companyAId, boqId: firstBoq.id } })).toBe(1);
    expect(await prisma.workerRun.count({ where: { companyId: companyAId, boqId: laterBoq.id } })).toBe(1);

    await drainWorkerRuns({ runnerId: `runner-tayqan-earlier-later-${RUN_ID}`, limit: 2, env: DETERMINISTIC_ENV });
  });

  it("still completes an ordinary REVIEW_EXISTING_BOQ assignment when hired through TAYQAN's enqueue path", async () => {
    const boq = await createBOQ(companyAId, projectAId, "TAYQAN clear review");
    const run = await enqueueWorkerReview(actorA(), boq.id, `worker-tayqan-clear-${RUN_ID}`, DETERMINISTIC_ENV);
    await drainWorkerRuns({ runnerId: `runner-tayqan-clear-${RUN_ID}`, limit: 1, env: DETERMINISTIC_ENV });

    const completed = await getWorkerRunForCompany(companyAId, run.id);
    expect(completed.status).toBe(WorkerRunStatus.COMPLETED);
    expect(completed.resultAssignment?.id).toBeTruthy();
  });

  it("same-BOQ rehire: a version change after a completed review creates a second WorkerRun with a new key, matching the new BOQ version, while the first run stays intact", async () => {
    const boq = await createBOQ(companyAId, projectAId, "Same-BOQ rehire");

    const firstKey = `worker-tayqan-rehire-first-${RUN_ID}`;
    const first = await enqueueWorkerReview(actorA(), boq.id, firstKey, DETERMINISTIC_ENV);
    await drainWorkerRuns({ runnerId: `runner-tayqan-rehire-first-${RUN_ID}`, limit: 1, env: DETERMINISTIC_ENV });
    const firstCompleted = await getWorkerRunForCompany(companyAId, first.id);
    expect(firstCompleted.status).toBe(WorkerRunStatus.COMPLETED);
    expect(firstCompleted.source.boqVersion).toBe(1);

    // Simulate the engineer editing the BOQ after TAYQAN's first review —
    // exactly the "version" bump a real governed edit already produces.
    // revisionNumber is left alone: it identifies a formal revision (R01,
    // R02, ...) which createBOQ's shared counter also allocates sequentially
    // across this whole test file, and version — not revisionNumber — is
    // the staleness detector under test here.
    const revisedBoq = await prisma.bOQ.update({
      where: { id: boq.id },
      data: { version: { increment: 1 } },
    });
    expect(isReviewStale(
      { boqVersion: firstCompleted.source.boqVersion, revisionNumber: firstCompleted.source.revisionNumber },
      { version: revisedBoq.version, revisionNumber: revisedBoq.revisionNumber },
    )).toBe(true);

    // The UI mints a fresh key for this genuinely new hire (hireAttempt was
    // cleared when the first hire succeeded) — this reproduces that key here.
    const secondKey = `worker-tayqan-rehire-second-${RUN_ID}`;
    expect(secondKey).not.toBe(firstKey);
    const second = await enqueueWorkerReview(actorA(), boq.id, secondKey, DETERMINISTIC_ENV);
    expect(second.id).not.toBe(first.id);
    await drainWorkerRuns({ runnerId: `runner-tayqan-rehire-second-${RUN_ID}`, limit: 1, env: DETERMINISTIC_ENV });

    const secondCompleted = await getWorkerRunForCompany(companyAId, second.id);
    expect(secondCompleted.status).toBe(WorkerRunStatus.COMPLETED);
    expect(secondCompleted.source.boqVersion).toBe(revisedBoq.version);

    // Two independent rows now exist for the same BOQ; the first is untouched.
    expect(await prisma.workerRun.count({ where: { companyId: companyAId, boqId: boq.id } })).toBe(2);
    const firstStillIntact = await prisma.workerRun.findUniqueOrThrow({ where: { id: first.id } });
    expect(firstStillIntact.status).toBe(WorkerRunStatus.COMPLETED);
    expect(firstStillIntact.sourceBoqVersion).toBe(1);

    // The status-lookup endpoint the UI polls now surfaces the newer run.
    const latest = await getLatestWorkerRunForBoq(companyAId, boq.id, "REVIEW_EXISTING_BOQ");
    expect(latest?.id).toBe(second.id);
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
