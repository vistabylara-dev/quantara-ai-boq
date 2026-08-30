import {
  TayqanHireStatus,
  TayqanIntakeStatus,
  TayqanWorkStage,
  TayqanWorkStatus,
  UserRole,
} from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { prisma } from "../src/lib/db/prisma";
import { AppError } from "../src/lib/errors/app-error";
import {
  advanceTayqanWorkOrder,
  answerTayqanWorkOrderBlocker,
} from "../src/lib/services/tayqan-work-order-service";
import type { TayqanMeasurementReasonerResult } from "../src/lib/tayqan/tayqan-measurement-reasoner";
import { requireIsolatedLocalTestDatabase } from "./helpers/require-isolated-test-database";

/**
 * TAYQAN AUDIT FIX 3 — proves the new FAILED transition in
 * advanceSourceProcessing (via advanceTayqanWorkOrder): a genuinely terminal
 * error (a whitelisted AppError code) transitions the order to FAILED with a
 * real blockerMessage/TayqanWorkEvent, while a bounded paid-pass failure
 * becomes a resumable NEEDS_INPUT blocker and an unrelated plain network
 * error retains the existing propagation behavior. Also proves the FAILED early-return in
 * advanceTayqanWorkOrder is reachable and short-circuits before any further
 * stage logic runs.
 *
 * prepareTayqanMeasurementProposals is mocked (tayqan-work-order-service.ts
 * imports only that one named export from tayqan-measurement-service.ts) so
 * these tests exercise real Postgres end to end for the work order itself
 * without needing a full extraction-job/AI-reasoner pipeline. Exhausted
 * paid-pass failures are preserved as explicit retry blockers so the UI
 * cannot call the expensive advance route every three seconds indefinitely;
 * unrelated network errors keep their previous resumable propagation path.
 */
const prepareTayqanMeasurementProposalsMock = vi.hoisted(() => vi.fn());
const generateAiDraftBoqMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/services/tayqan-measurement-service", () => ({
  prepareTayqanMeasurementProposals: prepareTayqanMeasurementProposalsMock,
}));
vi.mock("@/lib/services/ai-draft-boq-service", () => ({
  generateAiDraftBoq: generateAiDraftBoqMock,
}));

const RUN_ID = `${Date.now()}-${process.pid}`;
const MOCK_REASONER_RESULT: TayqanMeasurementReasonerResult = {
  provider: "mock-provider",
  model: "mock-model",
  responseIds: ["mock-paid-response"],
  plan: { subjects: [], exceptions: [] },
  seniorReview: {
    clusterReviewCount: 0,
    globalReviewApplied: false,
    acceptedSubjectCount: 0,
    rejectedSubjectCount: 0,
    findingCount: 0,
    evidencePageCoveragePercent: 100,
  },
};
const MOCK_MEASUREMENT_RESULT = {
  measuredSubjectCount: 0,
  createdEntityCount: 0,
  reusedEntityCount: 0,
  createdCalculationCount: 0,
  reusedCalculationCount: 0,
  exceptionCount: 0,
  exceptions: [],
  provider: MOCK_REASONER_RESULT.provider,
  model: MOCK_REASONER_RESULT.model,
  seniorReview: MOCK_REASONER_RESULT.seniorReview,
};

type MockPrepareOptions = {
  replayReasonerResult?: TayqanMeasurementReasonerResult;
  onReasonerStart?: () => Promise<void>;
  onReasonerResult?: (result: TayqanMeasurementReasonerResult) => Promise<void>;
};

describe("TAYQAN AUDIT FIX 3: work order FAILED state (integration, real local Postgres)", () => {
  let companyId: string;
  let userId: string;
  let projectId: string;
  let entitlementId: string;

  function actor(): CurrentActor {
    return {
      userId,
      companyId,
      role: UserRole.COMPANY_OWNER,
      fullName: "Audit Fix 3 Owner",
      email: `audit-fix-3-${RUN_ID}@example.com`,
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
        desiredDeliverable: "COMPLETE_BOQ_FROM_SOURCES",
        includeRates: false,
      },
    });
  }

  /**
   * Zero ProjectFile rows for the project means sourceRequirements() returns
   * empty requirements/conflicts trivially (verified by reading
   * tayqan-work-order-service.ts's sourceRequirements) — advanceSourceProcessing
   * reaches the draft-first measurement-lease branch with pending === 0
   * without needing any real extraction-job fixture.
   */
  async function createWorkOrder(selectedSourceFileIds: string[] = []) {
    const session = await createIntakeSession();
    return prisma.tayqanWorkOrder.create({
      data: {
        companyId,
        projectId,
        boqId: null,
        intakeSessionId: session.id,
        hireEntitlementId: entitlementId,
        createdByUserId: userId,
        status: TayqanWorkStatus.RUNNING,
        stage: TayqanWorkStage.SOURCE_PROCESSING,
        desiredDeliverable: "COMPLETE_BOQ_FROM_SOURCES",
        includeRates: false,
        startIdempotencyKey: `audit-fix-3-${RUN_ID}-${Math.random()}`,
        progressJson: selectedSourceFileIds.length > 0
          ? { selectedSourceFileIds }
          : {},
      },
    });
  }

  async function createFrozenSource(checksum: string) {
    return prisma.projectFile.create({
      data: {
        companyId,
        projectId,
        uploadedByUserId: userId,
        originalName: `paid-retry-${RUN_ID}.txt`,
        safeFileName: `paid-retry-${RUN_ID}.txt`,
        storageKey: `tests/${RUN_ID}/paid-retry-${Math.random()}.txt`,
        mimeType: "text/plain",
        extension: "txt",
        fileSize: 32,
        checksum,
        classification: "TECHNICAL_REPORT",
        status: "COMPLETED",
      },
    });
  }

  beforeAll(async () => {
    requireIsolatedLocalTestDatabase();
    const industry = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    const company = await prisma.company.create({
      data: { legalName: `Audit Fix 3 Co ${RUN_ID}`, tradeName: "Audit Fix 3", email: `audit-fix-3-co-${RUN_ID}@example.com` },
    });
    companyId = company.id;
    const [user, client] = await Promise.all([
      prisma.user.create({
        data: {
          companyId, email: `audit-fix-3-owner-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash",
          fullName: "Audit Fix 3 Owner", role: UserRole.COMPANY_OWNER, emailVerifiedAt: new Date(),
        },
      }),
      prisma.client.create({ data: { companyId, name: "Audit Fix 3 Client", email: `audit-fix-3-client-${RUN_ID}@example.com` } }),
    ]);
    userId = user.id;
    const project = await prisma.project.create({
      data: {
        companyId, clientId: client.id, industryEngineId: industry.id,
        slug: `audit-fix-3-${RUN_ID}`, reference: `AUDIT-FIX-3-${RUN_ID}`, name: "Audit Fix 3 Project",
      },
    });
    projectId = project.id;
    const entitlement = await prisma.tayqanHireEntitlement.create({
      data: { companyId, purchasedByUserId: userId, plan: "MONTHLY", status: TayqanHireStatus.ACTIVE, priceCode: "tayqan_monthly_2499", expiresAt: null },
    });
    entitlementId = entitlement.id;
  });

  beforeEach(() => {
    prepareTayqanMeasurementProposalsMock.mockReset();
    generateAiDraftBoqMock.mockReset();
    generateAiDraftBoqMock.mockImplementation(
      async (_actor, _project, input: { targetBoqId: string }) => ({
        boqId: input.targetBoqId,
        addedCount: 0,
        skippedCount: 0,
        alreadyPresentCount: 0,
        unreviewedAddedCount: 0,
        reviewedAddedCount: 0,
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (!companyId) return;
    await prisma.tayqanWorkEvent.deleteMany({ where: { companyId } });
    await prisma.tayqanWorkOrder.deleteMany({ where: { companyId } });
    await prisma.tayqanIntakeMessage.deleteMany({ where: { companyId } });
    await prisma.tayqanIntakeSession.deleteMany({ where: { companyId } });
    await prisma.tayqanHireEntitlement.deleteMany({ where: { companyId } });
    await prisma.projectFile.deleteMany({ where: { companyId } });
    await prisma.project.deleteMany({ where: { companyId } });
    await prisma.client.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  it("a genuinely terminal error transitions the work order to FAILED with a real blockerMessage and a TayqanWorkEvent", async () => {
    const order = await createWorkOrder();
    const terminalError = new AppError(
      "TAYQAN_MEASUREMENT_SOURCES_REQUIRED",
      "TAYQAN needs the frozen source-file scope before measuring the drawings.",
      409,
    );
    prepareTayqanMeasurementProposalsMock.mockRejectedValueOnce(terminalError);

    const result = await advanceTayqanWorkOrder(actor(), projectId, order.id);

    expect(result.status).toBe("FAILED");
    expect(result.blockerMessage).toBe("tayqan.hire.workflow.workOrderFailed");
    expect(result.blockerCode).toBe("TAYQAN_MEASUREMENT_TERMINAL_ERROR");
    expect(result.blocker).toMatchObject({
      kind: "ERROR",
      i18nKey: "tayqan.hire.workflow.workOrderFailed",
      error: { code: "TAYQAN_MEASUREMENT_SOURCES_REQUIRED", reason: terminalError.message },
    });

    const dbOrder = await prisma.tayqanWorkOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(dbOrder.status).toBe(TayqanWorkStatus.FAILED);
    expect(dbOrder.completedAt).not.toBeNull();

    const failedEvent = await prisma.tayqanWorkEvent.findFirst({
      where: { workOrderId: order.id, eventType: "WORK_FAILED" },
      orderBy: { createdAt: "desc" },
    });
    expect(failedEvent).not.toBeNull();
    expect(failedEvent!.payloadJson).toMatchObject({
      code: "TAYQAN_MEASUREMENT_TERMINAL_ERROR",
      errorCode: "TAYQAN_MEASUREMENT_SOURCES_REQUIRED",
      errorMessage: terminalError.message,
    });
  });

  it.each([
    ["TAYQAN_MEASUREMENT_AI_REQUEST_REJECTED", "HTTP 429 rejection"],
    ["TAYQAN_MEASUREMENT_AI_RESPONSE_INCOMPLETE", "incomplete response"],
    ["TAYQAN_MEASUREMENT_AI_RESPONSE_INVALID", "invalid structured response"],
    ["TAYQAN_MEASUREMENT_AI_REFUSED", "provider refusal"],
    ["TAYQAN_MEASUREMENT_AI_TIMEOUT", "controlled timeout"],
    ["TAYQAN_MEASUREMENT_AI_UNAVAILABLE", "provider unavailable"],
    ["TAYQAN_MEASUREMENT_AI_EXECUTION_FAILED", "wrapped provider execution failure"],
    ["TAYQAN_MEASUREMENT_PERSISTENCE_FAILED", "post-provider measurement persistence failure"],
    ["TAYQAN_MEASUREMENT_AUDIT_PERSISTENCE_FAILED", "post-provider audit persistence failure"],
    ["TAYQAN_MEASUREMENT_CHECKPOINT_PERSISTENCE_FAILED", "post-provider checkpoint persistence failure"],
  ])("a %s %s becomes a durable retry blocker instead of remaining in an automatic polling loop", async (code, reason) => {
    const order = await createWorkOrder();
    const providerError = new AppError(
      code,
      `TAYQAN provider-stage failure: ${reason}.`,
      503,
    );
    prepareTayqanMeasurementProposalsMock.mockRejectedValueOnce(providerError);

    const result = await advanceTayqanWorkOrder(actor(), projectId, order.id);

    expect(result.status).toBe("NEEDS_INPUT");
    expect(result.blockerCode).toBe("TAYQAN_MEASUREMENT_PROVIDER_RETRY_REQUIRED");
    expect(result.blocker).toMatchObject({
      kind: "ERROR",
      i18nKey: "tayqan.hire.workflow.measurementProviderRetryRequired",
      error: {
        code,
        reason: providerError.message,
      },
    });
    const dbOrder = await prisma.tayqanWorkOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(dbOrder.status).toBe(TayqanWorkStatus.NEEDS_INPUT);
    expect(dbOrder.completedAt).toBeNull();
    const failedEvent = await prisma.tayqanWorkEvent.findFirst({ where: { workOrderId: order.id, eventType: "WORK_FAILED" } });
    expect(failedEvent).toBeNull();
    const blockedEvent = await prisma.tayqanWorkEvent.findFirst({ where: { workOrderId: order.id, eventType: "WORK_BLOCKED" } });
    expect(blockedEvent).not.toBeNull();

    prepareTayqanMeasurementProposalsMock.mockClear();
    const second = await advanceTayqanWorkOrder(actor(), projectId, order.id);
    expect(second.status).toBe("NEEDS_INPUT");
    expect(prepareTayqanMeasurementProposalsMock).not.toHaveBeenCalled();
  });

  it.each([
    "TAYQAN_MEASUREMENT_PERSISTENCE_FAILED",
    "TAYQAN_MEASUREMENT_AUDIT_PERSISTENCE_FAILED",
    "TAYQAN_MEASUREMENT_PROVIDER_RESULT_CHECKPOINT_FAILED",
  ])("the real Retry action replays a checkpoint after %s and never repeats the paid call", async (failureCode) => {
    const order = await createWorkOrder();
    let paidProviderCallCount = 0;
    let firstPass = true;
    prepareTayqanMeasurementProposalsMock.mockImplementation(
      async (_actor, _project, _input, options: MockPrepareOptions = {}) => {
        if (options.replayReasonerResult) {
          expect(options.replayReasonerResult).toEqual(MOCK_REASONER_RESULT);
          return MOCK_MEASUREMENT_RESULT;
        }

        await options.onReasonerStart?.();
        paidProviderCallCount += 1;
        await options.onReasonerResult?.(MOCK_REASONER_RESULT);
        if (firstPass) {
          firstPass = false;
          throw new AppError(
            failureCode,
            `Controlled ${failureCode} after provider success.`,
            503,
          );
        }
        throw new Error("provider execution repeated instead of replaying the checkpoint");
      },
    );

    const blocked = await advanceTayqanWorkOrder(actor(), projectId, order.id);
    expect(blocked).toMatchObject({
      status: "NEEDS_INPUT",
      blockerCode: "TAYQAN_MEASUREMENT_PROVIDER_RETRY_REQUIRED",
    });
    expect(paidProviderCallCount).toBe(1);
    const checkpointed = await prisma.tayqanWorkOrder.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(checkpointed.progressJson).toMatchObject({
      tayqanMeasurementProviderAttempt: {
        checkpointVersion: 1,
        workOrderId: order.id,
        companyId,
        projectId,
      },
      tayqanMeasurementProviderResult: {
        checkpointVersion: 1,
        workOrderId: order.id,
        companyId,
        projectId,
        result: MOCK_REASONER_RESULT,
      },
    });

    await answerTayqanWorkOrderBlocker(actor(), projectId, {
      workOrderId: order.id,
      action: "RETRY",
      note: "Retry local persistence only",
    });

    expect(paidProviderCallCount).toBe(1);
    expect(prepareTayqanMeasurementProposalsMock).toHaveBeenCalledTimes(2);
    const completed = await prisma.tayqanWorkOrder.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(completed.progressJson).toMatchObject({
      tayqanMeasurement: {
        version: expect.any(String),
        provider: MOCK_REASONER_RESULT.provider,
        model: MOCK_REASONER_RESULT.model,
      },
    });
    expect(completed.progressJson).not.toMatchObject({
      tayqanMeasurementProviderAttempt: expect.anything(),
    });
    expect(completed.progressJson).not.toMatchObject({
      tayqanMeasurementProviderResult: expect.anything(),
    });
    await expect(prisma.tayqanWorkEvent.count({
      where: {
        workOrderId: order.id,
        eventType: "TAYQAN_MEASUREMENT_PROVIDER_ATTEMPT_STARTED",
      },
    })).resolves.toBe(1);
    await expect(prisma.tayqanWorkEvent.count({
      where: {
        workOrderId: order.id,
        eventType: "TAYQAN_MEASUREMENT_PROVIDER_RESULT_CHECKPOINTED",
      },
    })).resolves.toBe(1);
    await expect(prisma.tayqanWorkEvent.count({
      where: {
        workOrderId: order.id,
        eventType: "TAYQAN_MEASUREMENT_COMPLETE",
      },
    })).resolves.toBe(1);
  });

  it("rejects a checkpoint whose frozen source checksum changed and never falls back to the paid provider", async () => {
    const source = await createFrozenSource(`checksum-before-${RUN_ID}`);
    const order = await createWorkOrder([source.id]);
    let paidProviderCallCount = 0;
    prepareTayqanMeasurementProposalsMock.mockImplementation(
      async (_actor, _project, _input, options: MockPrepareOptions = {}) => {
        if (options.replayReasonerResult) {
          throw new Error("a checksum-mismatched result must not be replayed");
        }
        await options.onReasonerStart?.();
        paidProviderCallCount += 1;
        await options.onReasonerResult?.(MOCK_REASONER_RESULT);
        throw new AppError(
          "TAYQAN_MEASUREMENT_PERSISTENCE_FAILED",
          "Controlled downstream failure after the paid result.",
          503,
        );
      },
    );

    const blocked = await advanceTayqanWorkOrder(actor(), projectId, order.id);
    expect(blocked.status).toBe("NEEDS_INPUT");
    const checkpointed = await prisma.tayqanWorkOrder.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(checkpointed.progressJson).toMatchObject({
      tayqanMeasurementProviderAttempt: {
        sourceFiles: [{ id: source.id, checksum: `checksum-before-${RUN_ID}` }],
      },
      tayqanMeasurementProviderResult: {
        sourceFiles: [{ id: source.id, checksum: `checksum-before-${RUN_ID}` }],
      },
    });

    await prisma.projectFile.update({
      where: { id: source.id },
      data: { checksum: `checksum-after-${RUN_ID}` },
    });
    const failed = await answerTayqanWorkOrderBlocker(actor(), projectId, {
      workOrderId: order.id,
      action: "RETRY",
    });

    expect(failed).toMatchObject({
      status: "FAILED",
      blockerCode: "TAYQAN_MEASUREMENT_PROVIDER_RESULT_REPLAY_INVALID",
      blocker: {
        error: { code: "TAYQAN_MEASUREMENT_PROVIDER_RESULT_REPLAY_INVALID" },
      },
    });
    expect(paidProviderCallCount).toBe(1);
    expect(prepareTayqanMeasurementProposalsMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed on a malformed attempt marker instead of treating it as no prior paid attempt", async () => {
    const order = await createWorkOrder();
    await prisma.tayqanWorkOrder.update({
      where: { id: order.id },
      data: {
        progressJson: { tayqanMeasurementProviderAttempt: false },
      },
    });

    const failed = await advanceTayqanWorkOrder(actor(), projectId, order.id);

    expect(failed).toMatchObject({
      status: "FAILED",
      blockerCode: "TAYQAN_MEASUREMENT_PROVIDER_RESULT_REPLAY_INVALID",
      blocker: {
        error: { code: "TAYQAN_MEASUREMENT_PROVIDER_RESULT_REPLAY_INVALID" },
      },
    });
    expect(prepareTayqanMeasurementProposalsMock).not.toHaveBeenCalled();
    await expect(answerTayqanWorkOrderBlocker(actor(), projectId, {
      workOrderId: order.id,
      action: "RETRY",
    })).rejects.toMatchObject({
      code: "TAYQAN_MEASUREMENT_PROVIDER_RETRY_UNSAFE",
    });
  });

  it("the real Retry action replays after the work-order completion checkpoint fails", async () => {
    const order = await createWorkOrder();
    let paidProviderCallCount = 0;
    prepareTayqanMeasurementProposalsMock.mockImplementation(
      async (_actor, _project, _input, options: MockPrepareOptions = {}) => {
        if (options.replayReasonerResult) return MOCK_MEASUREMENT_RESULT;

        await options.onReasonerStart?.();
        paidProviderCallCount += 1;
        await options.onReasonerResult?.(MOCK_REASONER_RESULT);
        await prisma.tayqanWorkOrder.update({
          where: { id: order.id },
          data: { blockerMessage: "controlled-lost-lease-before-completion" },
        });
        return MOCK_MEASUREMENT_RESULT;
      },
    );

    const blocked = await advanceTayqanWorkOrder(actor(), projectId, order.id);
    expect(blocked).toMatchObject({
      status: "NEEDS_INPUT",
      blockerCode: "TAYQAN_MEASUREMENT_PROVIDER_RETRY_REQUIRED",
      blocker: {
        error: { code: "TAYQAN_MEASUREMENT_LEASE_LOST" },
      },
    });

    await answerTayqanWorkOrderBlocker(actor(), projectId, {
      workOrderId: order.id,
      action: "RETRY",
    });

    expect(paidProviderCallCount).toBe(1);
    await expect(prisma.tayqanWorkEvent.count({
      where: {
        workOrderId: order.id,
        eventType: "TAYQAN_MEASUREMENT_COMPLETE",
      },
    })).resolves.toBe(1);
  });

  it("a failed immediate provider-result checkpoint leaves an incomplete attempt in support state and the real Retry action cannot pay again", async () => {
    const order = await createWorkOrder();
    let paidProviderCallCount = 0;
    prepareTayqanMeasurementProposalsMock.mockImplementation(
      async (_actor, _project, _input, options: MockPrepareOptions = {}) => {
        await options.onReasonerStart?.();
        paidProviderCallCount += 1;
        await prisma.tayqanWorkOrder.update({
          where: { id: order.id },
          data: { blockerMessage: "controlled-lost-lease-before-provider-checkpoint" },
        });
        try {
          await options.onReasonerResult?.(MOCK_REASONER_RESULT);
        } catch {
          throw new AppError(
            "TAYQAN_MEASUREMENT_PROVIDER_RESULT_CHECKPOINT_FAILED",
            "The paid result could not be durably checkpointed.",
            503,
          );
        }
        throw new Error("checkpoint unexpectedly succeeded");
      },
    );

    const failed = await advanceTayqanWorkOrder(actor(), projectId, order.id);
    expect(failed).toMatchObject({
      status: "FAILED",
      blockerCode: "TAYQAN_MEASUREMENT_PROVIDER_ATTEMPT_INCOMPLETE",
      blocker: {
        error: { code: "TAYQAN_MEASUREMENT_PROVIDER_ATTEMPT_INCOMPLETE" },
      },
    });
    expect(paidProviderCallCount).toBe(1);
    await expect(answerTayqanWorkOrderBlocker(actor(), projectId, {
      workOrderId: order.id,
      action: "RETRY",
    })).rejects.toMatchObject({
      code: "TAYQAN_MEASUREMENT_PROVIDER_RETRY_UNSAFE",
    });
    expect(paidProviderCallCount).toBe(1);
    expect(prepareTayqanMeasurementProposalsMock).toHaveBeenCalledTimes(1);
    await expect(prisma.tayqanWorkEvent.count({
      where: {
        workOrderId: order.id,
        eventType: "TAYQAN_MEASUREMENT_PROVIDER_ATTEMPT_STARTED",
      },
    })).resolves.toBe(1);
    await expect(prisma.tayqanWorkEvent.count({
      where: {
        workOrderId: order.id,
        eventType: "TAYQAN_MEASUREMENT_PROVIDER_RESULT_CHECKPOINTED",
      },
    })).resolves.toBe(0);
  });

  it("a later multi-call reasoner failure after the first paid subcall leaves a terminal attempt and the real Retry action cannot pay again", async () => {
    const order = await createWorkOrder();
    let paidProviderSubcallCount = 0;
    prepareTayqanMeasurementProposalsMock.mockImplementation(
      async (_actor, _project, _input, options: MockPrepareOptions = {}) => {
        expect(options.replayReasonerResult).toBeUndefined();
        await options.onReasonerStart?.();
        paidProviderSubcallCount += 1;
        throw new AppError(
          "TAYQAN_MEASUREMENT_AI_EXECUTION_FAILED",
          "The first paid cluster completed, then a later checker call failed ambiguously.",
          503,
        );
      },
    );

    const failed = await advanceTayqanWorkOrder(actor(), projectId, order.id);

    expect(failed).toMatchObject({
      status: "FAILED",
      blockerCode: "TAYQAN_MEASUREMENT_PROVIDER_ATTEMPT_INCOMPLETE",
      blocker: {
        error: { code: "TAYQAN_MEASUREMENT_PROVIDER_ATTEMPT_INCOMPLETE" },
      },
    });
    expect(paidProviderSubcallCount).toBe(1);
    await expect(prisma.tayqanWorkOrder.findUniqueOrThrow({
      where: { id: order.id },
    })).resolves.toMatchObject({
      progressJson: {
        tayqanMeasurementProviderAttempt: {
          checkpointVersion: 1,
          workOrderId: order.id,
          companyId,
          projectId,
        },
      },
    });
    await expect(answerTayqanWorkOrderBlocker(actor(), projectId, {
      workOrderId: order.id,
      action: "RETRY",
      note: "Do not repeat an ambiguous paid attempt",
    })).rejects.toMatchObject({
      code: "TAYQAN_MEASUREMENT_PROVIDER_RETRY_UNSAFE",
    });
    expect(paidProviderSubcallCount).toBe(1);
    expect(prepareTayqanMeasurementProposalsMock).toHaveBeenCalledTimes(1);
  });

  it("a stale-lease takeover stops on an incomplete provider attempt before constructing or invoking another reasoner", async () => {
    const order = await createWorkOrder();
    let paidProviderSubcallCount = 0;
    prepareTayqanMeasurementProposalsMock.mockImplementation(
      async (_actor, _project, _input, options: MockPrepareOptions = {}) => {
        await options.onReasonerStart?.();
        paidProviderSubcallCount += 1;
        throw new AppError(
          "TAYQAN_MEASUREMENT_AI_EXECUTION_FAILED",
          "A worker stopped after its first paid cluster call.",
          503,
        );
      },
    );

    const first = await advanceTayqanWorkOrder(actor(), projectId, order.id);
    expect(first.blockerCode).toBe("TAYQAN_MEASUREMENT_PROVIDER_ATTEMPT_INCOMPLETE");
    expect(paidProviderSubcallCount).toBe(1);

    await prisma.tayqanWorkOrder.update({
      where: { id: order.id },
      data: {
        status: TayqanWorkStatus.RUNNING,
        stage: TayqanWorkStage.SOURCE_PROCESSING,
        blockerCode: "TAYQAN_MEASUREMENT_RUNNING",
        blockerMessage: "tayqan-measurement:stale-worker-recovery",
        completedAt: null,
        lastAdvancedAt: new Date(Date.now() - 16 * 60 * 1_000),
      },
    });
    prepareTayqanMeasurementProposalsMock.mockClear();
    prepareTayqanMeasurementProposalsMock.mockImplementation(async () => {
      throw new Error("a stale takeover must stop before preparing another reasoner");
    });

    const recovered = await advanceTayqanWorkOrder(actor(), projectId, order.id);

    expect(recovered).toMatchObject({
      status: "FAILED",
      blockerCode: "TAYQAN_MEASUREMENT_PROVIDER_ATTEMPT_INCOMPLETE",
      blocker: {
        error: { code: "TAYQAN_MEASUREMENT_PROVIDER_ATTEMPT_INCOMPLETE" },
      },
    });
    expect(prepareTayqanMeasurementProposalsMock).not.toHaveBeenCalled();
    expect(paidProviderSubcallCount).toBe(1);
    await expect(prisma.tayqanWorkEvent.count({
      where: {
        workOrderId: order.id,
        eventType: "TAYQAN_MEASUREMENT_PROVIDER_ATTEMPT_STARTED",
      },
    })).resolves.toBe(1);
  });

  it("the real Retry action cannot clear an active measurement lease and start a concurrent paid call", async () => {
    const order = await createWorkOrder();
    await prisma.tayqanWorkOrder.update({
      where: { id: order.id },
      data: {
        blockerCode: "TAYQAN_MEASUREMENT_RUNNING",
        blockerMessage: "tayqan-measurement:controlled-active-lease",
      },
    });

    await expect(answerTayqanWorkOrderBlocker(actor(), projectId, {
      workOrderId: order.id,
      action: "RETRY",
    })).rejects.toMatchObject({
      code: "TAYQAN_MEASUREMENT_ALREADY_RUNNING",
    });
    expect(prepareTayqanMeasurementProposalsMock).not.toHaveBeenCalled();
    await expect(prisma.tayqanWorkOrder.findUniqueOrThrow({
      where: { id: order.id },
    })).resolves.toMatchObject({
      status: TayqanWorkStatus.RUNNING,
      blockerCode: "TAYQAN_MEASUREMENT_RUNNING",
      blockerMessage: "tayqan-measurement:controlled-active-lease",
    });
  });

  it("a transient-style error (a plain Error, not an AppError at all) also does NOT transition to FAILED", async () => {
    const order = await createWorkOrder();
    const networkError = new Error("ETIMEDOUT: connection to the AI provider timed out");
    prepareTayqanMeasurementProposalsMock.mockRejectedValueOnce(networkError);

    await expect(advanceTayqanWorkOrder(actor(), projectId, order.id)).rejects.toBe(networkError);

    const dbOrder = await prisma.tayqanWorkOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(dbOrder.status).toBe(TayqanWorkStatus.RUNNING);
    const failedEvent = await prisma.tayqanWorkEvent.findFirst({ where: { workOrderId: order.id, eventType: "WORK_FAILED" } });
    expect(failedEvent).toBeNull();
  });

  it("a FAILED work order is a genuine terminal state — advanceTayqanWorkOrder's early-return short-circuits before any stage logic runs again", async () => {
    const order = await createWorkOrder();
    const terminalError = new AppError("TAYQAN_MEASUREMENT_AI_NOT_CONFIGURED", "TAYQAN drawing measurement requires the configured server-side AI provider.", 503);
    prepareTayqanMeasurementProposalsMock.mockRejectedValueOnce(terminalError);

    const first = await advanceTayqanWorkOrder(actor(), projectId, order.id);
    expect(first.status).toBe("FAILED");

    const eventCountBeforeSecondCall = await prisma.tayqanWorkEvent.count({ where: { workOrderId: order.id } });
    prepareTayqanMeasurementProposalsMock.mockClear();

    const second = await advanceTayqanWorkOrder(actor(), projectId, order.id);

    expect(second.status).toBe("FAILED");
    expect(second.blockerMessage).toBe(first.blockerMessage);
    // No further stage logic ran: the measurement mock was never called
    // again, and no new TayqanWorkEvent rows were created by this call.
    expect(prepareTayqanMeasurementProposalsMock).not.toHaveBeenCalled();
    const eventCountAfterSecondCall = await prisma.tayqanWorkEvent.count({ where: { workOrderId: order.id } });
    expect(eventCountAfterSecondCall).toBe(eventCountBeforeSecondCall);
  });
});
