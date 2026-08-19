import {
  TayqanHireStatus,
  TayqanIntakeStatus,
  TayqanWorkStage,
  TayqanWorkStatus,
  UserRole,
} from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { prisma } from "../src/lib/db/prisma";
import { AppError } from "../src/lib/errors/app-error";
import { advanceTayqanWorkOrder } from "../src/lib/services/tayqan-work-order-service";

/**
 * TAYQAN AUDIT FIX 3 — proves the new FAILED transition in
 * advanceSourceProcessing (via advanceTayqanWorkOrder): a genuinely terminal
 * error (a whitelisted AppError code) transitions the order to FAILED with a
 * real blockerMessage/TayqanWorkEvent, while a transient-style error (an
 * unlisted AppError code, or a plain Error — e.g. representative of a rate
 * limit/timeout from the AI reasoner) leaves the existing propagate/retry
 * behavior completely unchanged. Also proves the FAILED early-return in
 * advanceTayqanWorkOrder is reachable and short-circuits before any further
 * stage logic runs.
 *
 * prepareTayqanMeasurementProposals is mocked (tayqan-work-order-service.ts
 * imports only that one named export from tayqan-measurement-service.ts) so
 * these tests exercise real Postgres end to end for the work order itself
 * without needing a full extraction-job/AI-reasoner pipeline.
 */
const prepareTayqanMeasurementProposalsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/services/tayqan-measurement-service", () => ({
  prepareTayqanMeasurementProposals: prepareTayqanMeasurementProposalsMock,
}));

const RUN_ID = `${Date.now()}-${process.pid}`;

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
  async function createWorkOrder() {
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
        progressJson: {},
      },
    });
  }

  beforeAll(async () => {
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
  });

  afterAll(async () => {
    await prisma.tayqanWorkEvent.deleteMany({ where: { companyId } });
    await prisma.tayqanWorkOrder.deleteMany({ where: { companyId } });
    await prisma.tayqanIntakeMessage.deleteMany({ where: { companyId } });
    await prisma.tayqanIntakeSession.deleteMany({ where: { companyId } });
    await prisma.tayqanHireEntitlement.deleteMany({ where: { companyId } });
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

  it("a transient-style error (unlisted AppError code) does NOT transition to FAILED — it propagates unchanged, exactly like before this fix", async () => {
    const order = await createWorkOrder();
    // Representative of an AI-reasoner-side error (e.g. a rate limit) —
    // deliberately NOT in TAYQAN_TERMINAL_MEASUREMENT_ERROR_CODES.
    const transientError = new AppError("TAYQAN_MEASUREMENT_RATE_LIMITED", "The AI provider rate-limited this request.", 429);
    prepareTayqanMeasurementProposalsMock.mockRejectedValueOnce(transientError);

    await expect(advanceTayqanWorkOrder(actor(), projectId, order.id)).rejects.toBe(transientError);

    const dbOrder = await prisma.tayqanWorkOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(dbOrder.status).toBe(TayqanWorkStatus.RUNNING);
    expect(dbOrder.completedAt).toBeNull();
    const failedEvent = await prisma.tayqanWorkEvent.findFirst({ where: { workOrderId: order.id, eventType: "WORK_FAILED" } });
    expect(failedEvent).toBeNull();
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
