import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ExtractedEntityStatus,
  ExtractedEntityType,
  ExtractionMethod,
  TayqanHireStatus,
  TayqanIntakeStatus,
  TayqanWorkStage,
  TayqanWorkStatus,
  UserRole,
  WorkerRunStatus,
} from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { prisma } from "../src/lib/db/prisma";
import { ConflictError } from "../src/lib/errors/app-error";
import {
  tayqanMeasurementExceptionIsDangerous,
  tayqanMeasurementExceptionKey,
  TAYQAN_DANGEROUS_MEASUREMENT_EXCEPTION_KINDS,
} from "../src/lib/tayqan/tayqan-measurement-contract";
import {
  acceptTayqanWorkOrderDeliverable,
  advanceTayqanWorkOrder,
  unresolvedDangerousMeasurementExceptions,
  type WorkProgress,
} from "../src/lib/services/tayqan-work-order-service";
import { drainWorkerRuns, enqueueWorkerReview } from "../src/lib/services/worker-runner-service";

const root = path.resolve(__dirname, "..");
// This repo's Windows checkouts use CRLF line endings — normalize so the
// plain "\n"-based boundary searches below aren't silently broken by a
// stray "\r" (a real, previously-encountered failure mode in this repo).
const read = (...parts: string[]) => readFileSync(path.join(root, ...parts), "utf8").replace(/\r\n/g, "\n");
const RUN_ID = `${Date.now()}-${process.pid}`;
const DETERMINISTIC_ENV = { ...process.env, WORKER_AI_PLANNER_ENABLED: "false" };

/** Extracts one top-level function's body by name, tolerant of an "export " prefix and CRLF-normalized input. */
function functionBody(source: string, functionName: string): string {
  const startMarker = new RegExp(`\\b(?:export )?(?:async )?function ${functionName}\\b`);
  const startMatch = startMarker.exec(source);
  if (!startMatch) throw new Error(`functionBody: could not find function "${functionName}"`);
  const start = startMatch.index;
  const nextTopLevelFn = /\n(?:export )?(?:async )?function [A-Za-z0-9_]+/g;
  nextTopLevelFn.lastIndex = start + startMatch[0].length;
  const next = nextTopLevelFn.exec(source);
  return next ? source.slice(start, next.index) : source.slice(start);
}

async function expectConflict(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(ConflictError);
  try {
    await promise;
    throw new Error("expected promise to reject");
  } catch (error) {
    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).code).toBe(code);
  }
}

describe("TAYQAN PR1 completion correctness — pure gating logic (no database)", () => {
  it("classifies exactly the mission-2 minimum plus SCOPE_GAP as dangerous", () => {
    // TAYQAN-AUDIT-FIX-1 added SPEC_DRAWING_CONFLICT, DOUBLE_COUNT_RISK, and
    // UNIT_OR_DIMENSION_ANOMALY to this set — see that fix's PR description
    // for the evidence behind each addition. CROSS_PAGE_CONFLICT was
    // deliberately left informational (see the doc comment on
    // TAYQAN_DANGEROUS_MEASUREMENT_EXCEPTION_KINDS).
    expect([...TAYQAN_DANGEROUS_MEASUREMENT_EXCEPTION_KINDS].sort()).toEqual(
      [
        "COMPOSITE_SCOPE_REQUIRES_SPLIT", "DOUBLE_COUNT_RISK", "METHOD_SELECTION_UNCERTAIN", "PLAN_SCHEDULE_MISMATCH",
        "REVISION_CONFLICT", "SCOPE_GAP", "SPEC_DRAWING_CONFLICT", "SUPPORTING_CHECK_MISMATCH", "UNIT_OR_DIMENSION_ANOMALY",
      ].sort(),
    );
    expect(tayqanMeasurementExceptionIsDangerous("SCOPE_GAP")).toBe(true);
    expect(tayqanMeasurementExceptionIsDangerous("SPEC_DRAWING_CONFLICT")).toBe(true);
    expect(tayqanMeasurementExceptionIsDangerous("DOUBLE_COUNT_RISK")).toBe(true);
    expect(tayqanMeasurementExceptionIsDangerous("UNIT_OR_DIMENSION_ANOMALY")).toBe(true);
    expect(tayqanMeasurementExceptionIsDangerous("CROSS_PAGE_CONFLICT")).toBe(false);
    expect(tayqanMeasurementExceptionIsDangerous("INSUFFICIENT_EVIDENCE")).toBe(false);
  });

  it("derives a stable, order-independent exception key", () => {
    const a = tayqanMeasurementExceptionKey({ kind: "SCOPE_GAP", message: "Missing item", pageIds: ["p1", "p2"] });
    const b = tayqanMeasurementExceptionKey({ kind: "SCOPE_GAP", message: "Missing item", pageIds: ["p2", "p1"] });
    const different = tayqanMeasurementExceptionKey({ kind: "SCOPE_GAP", message: "A different item", pageIds: ["p1"] });
    expect(a).toBe(b);
    expect(a).not.toBe(different);
  });

  function progress(overrides: Partial<WorkProgress> = {}): WorkProgress {
    return {
      measurementExceptions: [
        { key: "e1", kind: "SCOPE_GAP", message: "Missing quantity", pageIds: [], relatedEntityId: "entity-1", createdAt: new Date().toISOString() },
        { key: "e2", kind: "INSUFFICIENT_EVIDENCE", message: "Informational only", pageIds: [], relatedEntityId: null, createdAt: new Date().toISOString() },
      ],
      ...overrides,
    };
  }

  it("blocks only on dangerous, unresolved exceptions — informational ones never block", () => {
    const gate = unresolvedDangerousMeasurementExceptions(progress());
    expect(gate.blocking).toBe(true);
    expect(gate.exceptions).toHaveLength(1);
    expect(gate.exceptions[0]!.kind).toBe("SCOPE_GAP");
  });

  it("unblocks once a governed resolution exists for the dangerous exception's exact key", () => {
    const resolved = progress({
      measurementExceptionResolutions: {
        e1: { reason: "Confirmed out of scope on site.", actorUserId: "u1", actorName: "Alex", resolvedAt: new Date().toISOString() },
      },
    });
    expect(unresolvedDangerousMeasurementExceptions(resolved).blocking).toBe(false);
  });

  it("does not treat a resolution for a different (stale) exception key as covering the current one", () => {
    const staleResolution = progress({
      measurementExceptionResolutions: {
        "some-other-run-key": { reason: "n/a", actorUserId: "u1", actorName: "Alex", resolvedAt: new Date().toISOString() },
      },
    });
    expect(unresolvedDangerousMeasurementExceptions(staleResolution).blocking).toBe(true);
  });

  it("does not block when there is no ledger at all", () => {
    expect(unresolvedDangerousMeasurementExceptions({}).blocking).toBe(false);
  });
});

describe("TAYQAN PR1 completion correctness — implementation structure", () => {
  it("closes the raw-extraction bypass in resolveQuantity and gates advanceQuantityPreparation on genuine sources only", () => {
    const source = read("src", "lib", "services", "tayqan-work-order-service.ts");
    expect(source).not.toContain("if (entity.quantity && entity.unit) return { quantity: entity.quantity.toNumber()");
    expect(source).not.toContain("if (entity.quantity && entity.unit) continue;");
    expect(source).toContain("withMeasurementException(nextProgress, {");
    expect(source).toContain('kind: "SCOPE_GAP"');
  });

  it("never fabricates a BOQ row when resolveQuantity finds no genuine source — it skips instead", () => {
    const source = read("src", "lib", "services", "tayqan-work-order-service.ts");
    const fnBody = functionBody(source, "resolveQuantity");
    expect(fnBody).not.toContain('throw new ConflictError("QUANTITY_REQUIRED"');
    expect(fnBody).toContain("return null;");

    const assemblyBody = functionBody(source, "advanceBoqAssembly");
    expect(assemblyBody).toContain("if (!quantity) {");
    expect(assemblyBody).toContain("continue;");
  });

  it("gates Draft handoff, BOQ assembly, and final QA behind unresolvedDangerousMeasurementExceptions", () => {
    const source = read("src", "lib", "services", "tayqan-work-order-service.ts");
    for (const fn of ["prepareTayqanAiDraft", "advanceBoqAssembly", "advanceValidation"]) {
      const body = functionBody(source, fn);
      expect(body.indexOf("unresolvedDangerousMeasurementExceptions("), `${fn} missing the gate`).toBeGreaterThan(-1);
    }
  });

  it("checks QA staleness against the current BOQ version/revision before trusting an existing run", () => {
    const source = read("src", "lib", "services", "tayqan-work-order-service.ts");
    const body = functionBody(source, "advanceValidation");
    expect(body).toContain("existingRun.source.boqVersion !== boq.version");
    expect(body).toContain("existingRun.source.revisionNumber !== boq.revisionNumber");
    expect(body).toContain("FINAL_QA_INVALIDATED_STALE_BOQ");
  });

  it("does not set completedAt or mark the intake session COMPLETED on reaching READY_FOR_ACCEPTANCE", () => {
    const source = read("src", "lib", "services", "tayqan-work-order-service.ts");
    const body = functionBody(source, "advanceValidation");
    expect(body).not.toContain("completedAt: new Date()");
    expect(body).not.toContain("TayqanIntakeStatus.COMPLETED");
  });

  it("exposes an explicit, RBAC-checked accept route and never touches BOQ.status/isLocked/verifiedVersion in the accept handler", () => {
    const route = read("src", "app", "api", "projects", "[projectId]", "tayqan", "work-order", "accept", "route.ts");
    expect(route).toContain('requireCapability(actor, "verification:manage")');
    expect(route).toContain("acceptTayqanWorkOrderDeliverable");

    const source = read("src", "lib", "services", "tayqan-work-order-service.ts");
    const body = functionBody(source, "acceptTayqanWorkOrderDeliverable");
    expect(body).toContain("TayqanWorkStatus.READY_FOR_ACCEPTANCE");
    expect(body).toContain("unresolvedDangerousMeasurementExceptions(parseProgress(order.progressJson))");
    expect(body).toContain("run.source.boqVersion !== boq.version");
    expect(body).toContain("TayqanWorkStatus.COMPLETED");
    expect(body).toContain("TayqanIntakeStatus.COMPLETED");
    expect(body).not.toMatch(/BOQStatus\.|isLocked:\s*true|verifiedVersion:|lockedAt:/);
  });
});

describe("TAYQAN PR1 completion correctness — integration (real local Postgres)", () => {
  let companyId: string;
  let userId: string;
  let projectId: string;
  let projectFileId: string;
  let entitlementId: string;
  let nextRevisionNumber = 1;

  function actor(): CurrentActor {
    return {
      userId,
      companyId,
      role: UserRole.COMPANY_OWNER,
      fullName: "PR1 Completion Owner",
      email: `pr1-completion-${RUN_ID}@example.com`,
    };
  }

  async function createIntakeSession() {
    return prisma.tayqanIntakeSession.create({
      data: {
        companyId,
        projectId,
        hireEntitlementId: entitlementId,
        createdByUserId: userId,
        status: TayqanIntakeStatus.WORK_STARTED,
        desiredDeliverable: "QUANTITY_TAKEOFF",
        includeRates: false,
      },
    });
  }

  async function createWorkOrder(overrides: {
    stage: TayqanWorkStage;
    status?: TayqanWorkStatus;
    boqId?: string | null;
    qaWorkerRunId?: string | null;
    progress?: WorkProgress;
  }) {
    const session = await createIntakeSession();
    return prisma.tayqanWorkOrder.create({
      data: {
        companyId,
        projectId,
        boqId: overrides.boqId ?? null,
        intakeSessionId: session.id,
        hireEntitlementId: entitlementId,
        createdByUserId: userId,
        status: overrides.status ?? TayqanWorkStatus.RUNNING,
        stage: overrides.stage,
        desiredDeliverable: "QUANTITY_TAKEOFF",
        includeRates: false,
        startIdempotencyKey: `pr1-completion-${RUN_ID}-${Math.random()}`,
        qaWorkerRunId: overrides.qaWorkerRunId ?? null,
        progressJson: JSON.parse(JSON.stringify(overrides.progress ?? {})),
      },
    });
  }

  async function createEntity(quantity: number | null, unit: string | null) {
    return prisma.extractedEntity.create({
      data: {
        companyId,
        projectId,
        projectFileId,
        entityType: ExtractedEntityType.WALL_FINISH,
        label: `PR1 raw extraction item ${RUN_ID}-${Math.random()}`,
        quantity,
        unit,
        confidence: 90,
        extractionMethod: ExtractionMethod.VISION_MODEL,
        sourceReference: "A-101",
        status: ExtractedEntityStatus.CONFIRMED,
        confirmedByUserId: userId,
        confirmedAt: new Date(),
      },
    });
  }

  async function createEmptyBoq(title: string) {
    const revisionNumber = nextRevisionNumber;
    nextRevisionNumber += 1;
    return prisma.bOQ.create({
      data: { companyId, projectId, title: `${title} ${RUN_ID}-${Math.random()}`, revisionNumber, version: 1 },
    });
  }

  /** Mirrors the established "CLEAR" (zero material question) fixture recipe from worker-v0-review-existing-boq.test.ts. */
  async function createCleanBoq() {
    const boq = await createEmptyBoq("Clean acceptance BOQ");
    const section = await prisma.bOQSection.create({
      data: { companyId, boqId: boq.id, code: "CLEAR", title: "Clear", sortOrder: 1 },
    });
    const item = await prisma.bOQItem.create({
      data: {
        companyId, sectionId: section.id, itemNumber: 1, itemCode: `CLEAR-${RUN_ID}-${Math.random()}`,
        category: "General", description: "Confirmed governed item", quantity: 2, unit: "ea",
        unitCost: 10, landedCost: 10, marginPercentage: 5, sellingRate: 10.5, totalAmount: 21,
        status: "CONFIRMED", sortOrder: 1,
      },
    });
    await Promise.all([
      prisma.bOQItemQuantityProvenance.create({
        data: {
          companyId, projectId, boqItemId: item.id, sourceType: "MANUAL_CONFIRMED",
          quantitySnapshot: 2, unitSnapshot: "ea", confirmedByUserId: userId, confirmedByName: "PR1 Completion Owner", confirmedAt: new Date(),
        },
      }),
      prisma.bOQItemRateProvenance.create({
        data: {
          companyId, projectId, boqItemId: item.id, sourceType: "MANUAL_CONFIRMED",
          unitCostSnapshot: 10, freightCostSnapshot: 0, installationCostSnapshot: 0, additionalCostSnapshot: 0,
          marginModeSnapshot: "MARKUP", marginPercentageSnapshot: 5, confirmedByUserId: userId, confirmedByName: "PR1 Completion Owner", confirmedAt: new Date(),
        },
      }),
    ]);
    return boq;
  }

  /** Runs a real deterministic QA review to completion and returns the COMPLETED WorkerRun DTO. */
  async function runCompletedQa(boqId: string, key: string) {
    await enqueueWorkerReview(actor(), boqId, key, DETERMINISTIC_ENV, { assignmentObjective: "PR1 completion-safety test QA." });
    for (let sweep = 0; sweep < 10; sweep += 1) {
      const result = await drainWorkerRuns({ runnerId: `pr1-runner-${RUN_ID}-${sweep}`, limit: 5, env: DETERMINISTIC_ENV });
      if (result.claimedCount === 0) break;
    }
    const { getLatestWorkerRunForBoq } = await import("../src/lib/services/worker-runner-service");
    const run = await getLatestWorkerRunForBoq(companyId, boqId, "REVIEW_EXISTING_BOQ");
    if (!run || run.status !== WorkerRunStatus.COMPLETED) {
      throw new Error(`Expected a COMPLETED QA run for fixture BOQ ${boqId}, got: ${run?.status}`);
    }
    return run;
  }

  beforeAll(async () => {
    for (let sweep = 0; sweep < 20; sweep += 1) {
      const result = await drainWorkerRuns({ runnerId: `pr1-sweep-${RUN_ID}-${sweep}`, limit: 5, env: DETERMINISTIC_ENV });
      if (result.claimedCount === 0) break;
    }

    const industry = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    const company = await prisma.company.create({
      data: { legalName: `PR1 Completion Co ${RUN_ID}`, tradeName: "PR1 Completion", email: `pr1-completion-co-${RUN_ID}@example.com` },
    });
    companyId = company.id;
    const [user, client] = await Promise.all([
      prisma.user.create({
        data: {
          companyId, email: `pr1-completion-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash",
          fullName: "PR1 Completion Owner", role: UserRole.COMPANY_OWNER, emailVerifiedAt: new Date(),
        },
      }),
      prisma.client.create({ data: { companyId, name: "PR1 Completion Client", email: `pr1-completion-client-${RUN_ID}@example.com` } }),
    ]);
    userId = user.id;
    const project = await prisma.project.create({
      data: {
        companyId, clientId: client.id, industryEngineId: industry.id,
        slug: `pr1-completion-${RUN_ID}`, reference: `PR1-COMPLETION-${RUN_ID}`, name: "PR1 Completion Project",
      },
    });
    projectId = project.id;
    const file = await prisma.projectFile.create({
      data: {
        companyId, projectId, uploadedByUserId: userId, originalName: "pr1.pdf", safeFileName: "pr1.pdf",
        storageKey: `tests/${RUN_ID}/pr1.pdf`, mimeType: "application/pdf", extension: "pdf", fileSize: 100, checksum: `checksum-pr1-${RUN_ID}`,
      },
    });
    projectFileId = file.id;
    const entitlement = await prisma.tayqanHireEntitlement.create({
      data: { companyId, purchasedByUserId: userId, plan: "MONTHLY", status: TayqanHireStatus.ACTIVE, priceCode: "tayqan_monthly_2499", expiresAt: null },
    });
    entitlementId = entitlement.id;
  });

  it("mission 1: raw entity.quantity/unit alone never produces a BOQ row — it becomes a blocking SCOPE_GAP exception instead", async () => {
    const entity = await createEntity(5, "m2");
    const boq = await createEmptyBoq("Mission 1 BOQ");
    const order = await createWorkOrder({ stage: TayqanWorkStage.QUANTITY_PREPARATION, boqId: boq.id });

    const state = await advanceTayqanWorkOrder(actor(), projectId, order.id);

    const imported = await prisma.bOQItemQuantityProvenance.findFirst({ where: { extractedEntityId: entity.id } });
    expect(imported).toBeNull();

    expect(state.status).toBe("NEEDS_INPUT");
    expect(state.blocker?.kind).toBe("MEASUREMENT_EXCEPTIONS");
    expect(state.measurementExceptions.unresolvedDangerousCount).toBeGreaterThan(0);
    const gap = state.measurementExceptions.exceptions.find((exception) => exception.relatedEntityId === entity.id);
    expect(gap).toBeDefined();
    expect(gap?.kind).toBe("SCOPE_GAP");
    expect(gap?.dangerous).toBe(true);
    expect(gap?.resolution).toBeNull();
  });

  it("mission 2: an unresolved dangerous exception blocks BOQ_ASSEMBLY and VALIDATION, not just QUANTITY_PREPARATION", async () => {
    const boq = await createEmptyBoq("Mission 2 BOQ");
    const dangerousException = {
      key: "manually-seeded-dangerous",
      kind: "REVISION_CONFLICT",
      message: "Two conflicting drawing revisions for the same sheet.",
      pageIds: [],
      relatedEntityId: null,
      createdAt: new Date().toISOString(),
    };

    const assemblyOrder = await createWorkOrder({
      stage: TayqanWorkStage.BOQ_ASSEMBLY,
      boqId: boq.id,
      progress: { measurementExceptions: [dangerousException] },
    });
    const assemblyState = await advanceTayqanWorkOrder(actor(), projectId, assemblyOrder.id);
    expect(assemblyState.status).toBe("NEEDS_INPUT");
    expect(assemblyState.blocker?.kind).toBe("MEASUREMENT_EXCEPTIONS");
    expect(await prisma.bOQ.findFirst({ where: { id: boq.id } })).toMatchObject({ status: "DRAFT", isLocked: false });

    const validationOrder = await createWorkOrder({
      stage: TayqanWorkStage.VALIDATION,
      boqId: boq.id,
      progress: { measurementExceptions: [dangerousException] },
    });
    const validationState = await advanceTayqanWorkOrder(actor(), projectId, validationOrder.id);
    expect(validationState.status).toBe("NEEDS_INPUT");
    expect(validationState.blocker?.kind).toBe("MEASUREMENT_EXCEPTIONS");
    // Never even reaches enqueueing a QA run while the dangerous exception is unresolved.
    expect(validationState.qaWorkerRunId).toBeNull();
  });

  it("TAYQAN-AUDIT-FIX-1: each newly-dangerous exception kind blocks BOQ_ASSEMBLY and VALIDATION unresolved, and unblocks once resolved", async () => {
    const newlyDangerousKinds = ["SPEC_DRAWING_CONFLICT", "DOUBLE_COUNT_RISK", "UNIT_OR_DIMENSION_ANOMALY"] as const;

    for (const kind of newlyDangerousKinds) {
      const boq = await createEmptyBoq(`Audit fix 1 ${kind} BOQ`);
      const exceptionKey = `audit-fix-1-${kind}`;
      const exception = {
        key: exceptionKey,
        kind,
        message: `Fixture ${kind} exception for audit-fix-1 gating coverage.`,
        pageIds: [],
        relatedEntityId: null,
        createdAt: new Date().toISOString(),
      };

      const assemblyOrder = await createWorkOrder({
        stage: TayqanWorkStage.BOQ_ASSEMBLY,
        boqId: boq.id,
        progress: { measurementExceptions: [exception] },
      });
      const assemblyState = await advanceTayqanWorkOrder(actor(), projectId, assemblyOrder.id);
      expect(assemblyState.status).toBe("NEEDS_INPUT");
      expect(assemblyState.blocker?.kind).toBe("MEASUREMENT_EXCEPTIONS");

      const validationOrder = await createWorkOrder({
        stage: TayqanWorkStage.VALIDATION,
        boqId: boq.id,
        progress: { measurementExceptions: [exception] },
      });
      const validationState = await advanceTayqanWorkOrder(actor(), projectId, validationOrder.id);
      expect(validationState.status).toBe("NEEDS_INPUT");
      expect(validationState.blocker?.kind).toBe("MEASUREMENT_EXCEPTIONS");
      expect(validationState.qaWorkerRunId).toBeNull();

      // Resolved (a governed resolution exists for this exact exception key)
      // must unblock the identical stage that was blocking a moment ago.
      const resolvedOrder = await createWorkOrder({
        stage: TayqanWorkStage.BOQ_ASSEMBLY,
        boqId: boq.id,
        progress: {
          measurementExceptions: [exception],
          measurementExceptionResolutions: {
            [exceptionKey]: {
              reason: `Reviewed and confirmed safe for ${kind}.`,
              actorUserId: userId,
              actorName: "PR1 Completion Owner",
              resolvedAt: new Date().toISOString(),
            },
          },
        },
      });
      const resolvedState = await advanceTayqanWorkOrder(actor(), projectId, resolvedOrder.id);
      expect(resolvedState.blocker?.kind).not.toBe("MEASUREMENT_EXCEPTIONS");
    }
  });

  it("mission 4: editing the BOQ after QA completed forces a fresh QA run before acceptance is reachable again", async () => {
    const boq = await createCleanBoq();
    const staleRun = await runCompletedQa(boq.id, `pr1-stale-qa-${RUN_ID}`);
    await prisma.bOQ.update({ where: { id: boq.id }, data: { version: { increment: 1 } } });

    const order = await createWorkOrder({ stage: TayqanWorkStage.VALIDATION, boqId: boq.id, qaWorkerRunId: staleRun.id });
    const state = await advanceTayqanWorkOrder(actor(), projectId, order.id);

    expect(state.status).not.toBe("READY_FOR_ACCEPTANCE");
    expect(state.qaWorkerRunId).not.toBe(staleRun.id);
    const invalidation = await prisma.tayqanWorkEvent.findFirst({
      where: { workOrderId: order.id, eventType: "FINAL_QA_INVALIDATED_STALE_BOQ" },
    });
    expect(invalidation).not.toBeNull();
  });

  it("mission 5: the accept route rejects with a distinct error for each unmet precondition", async () => {
    const boq = await createCleanBoq();
    const runningOrder = await createWorkOrder({ stage: TayqanWorkStage.BOQ_ASSEMBLY, status: TayqanWorkStatus.RUNNING, boqId: boq.id });
    await expectConflict(acceptTayqanWorkOrderDeliverable(actor(), projectId, runningOrder.id), "TAYQAN_NOT_READY_FOR_ACCEPTANCE");

    const freshRun = await runCompletedQa(boq.id, `pr1-accept-precondition-${RUN_ID}`);
    const dangerousOrder = await createWorkOrder({
      stage: TayqanWorkStage.READY_FOR_ACCEPTANCE,
      status: TayqanWorkStatus.READY_FOR_ACCEPTANCE,
      boqId: boq.id,
      qaWorkerRunId: freshRun.id,
      progress: {
        measurementExceptions: [{ key: "unresolved-dangerous", kind: "SCOPE_GAP", message: "Still open", pageIds: [], relatedEntityId: null, createdAt: new Date().toISOString() }],
      },
    });
    await expectConflict(acceptTayqanWorkOrderDeliverable(actor(), projectId, dangerousOrder.id), "TAYQAN_MEASUREMENT_EXCEPTIONS_UNRESOLVED");

    const staleBoq = await createCleanBoq();
    const staleRun = await runCompletedQa(staleBoq.id, `pr1-accept-stale-${RUN_ID}`);
    await prisma.bOQ.update({ where: { id: staleBoq.id }, data: { version: { increment: 1 } } });
    const staleOrder = await createWorkOrder({
      stage: TayqanWorkStage.READY_FOR_ACCEPTANCE, status: TayqanWorkStatus.READY_FOR_ACCEPTANCE, boqId: staleBoq.id, qaWorkerRunId: staleRun.id,
    });
    await expectConflict(acceptTayqanWorkOrderDeliverable(actor(), projectId, staleOrder.id), "TAYQAN_FINAL_QA_STALE");
  });

  it("mission 5: acceptance succeeds only when every precondition holds, records the exact snapshot, completes the work order/intake, and never touches BOQ.status/isLocked/verifiedVersion", async () => {
    const boq = await createCleanBoq();
    const run = await runCompletedQa(boq.id, `pr1-accept-success-${RUN_ID}`);
    const order = await createWorkOrder({
      stage: TayqanWorkStage.READY_FOR_ACCEPTANCE, status: TayqanWorkStatus.READY_FOR_ACCEPTANCE, boqId: boq.id, qaWorkerRunId: run.id,
    });

    const before = await prisma.bOQ.findUniqueOrThrow({ where: { id: boq.id } });
    const state = await acceptTayqanWorkOrderDeliverable(actor(), projectId, order.id);
    const after = await prisma.bOQ.findUniqueOrThrow({ where: { id: boq.id } });

    expect(state.status).toBe("COMPLETED");
    expect(state.completedAt).not.toBeNull();

    const acceptance = await prisma.tayqanDeliverableAcceptance.findUnique({ where: { workOrderId: order.id } });
    expect(acceptance).toMatchObject({
      companyId, projectId, boqId: boq.id,
      boqVersion: before.version, boqRevisionNumber: before.revisionNumber,
      qaWorkerRunId: run.id, acceptedByUserId: userId, acceptedByName: "PR1 Completion Owner",
    });

    const session = await prisma.tayqanIntakeSession.findUniqueOrThrow({ where: { id: order.intakeSessionId } });
    expect(session.status).toBe(TayqanIntakeStatus.COMPLETED);

    expect(after).toMatchObject({
      status: before.status, isLocked: before.isLocked, lockedAt: before.lockedAt,
      verifiedVersion: before.verifiedVersion, verifiedAt: before.verifiedAt, version: before.version,
    });

    // Cannot double-accept.
    await expectConflict(acceptTayqanWorkOrderDeliverable(actor(), projectId, order.id), "TAYQAN_NOT_READY_FOR_ACCEPTANCE");
  });
});
