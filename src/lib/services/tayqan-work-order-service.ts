import { randomUUID } from "node:crypto";
import {
  ExtractionEngineType,
  ExtractionJobStatus,
  ExtractedEntityStatus,
  Prisma,
  QuantityProvenanceSource,
  RateProvenanceSource,
  TayqanIntakeMessageRole,
  TayqanIntakeStatus,
  TayqanWorkStage,
  TayqanWorkStatus,
  WorkerRunStatus,
} from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { prisma } from "@/lib/db/prisma";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { getSourceProcessingCapability } from "@/lib/files/source-processing-capability";
import { getAiDraftExtractedEntityId } from "@/lib/guidance/ai-draft-boq";
import { extractionJobQueue } from "@/lib/jobs/extraction-worker";
import {
  createProjectBOQ,
  getBOQRecord,
} from "@/lib/repositories/boq-repository";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { parseRevisionNumber } from "@/lib/revisions/revision-number";
import { generateAiDraftBoq } from "@/lib/services/ai-draft-boq-service";
import { prepareTayqanMeasurementProposals } from "@/lib/services/tayqan-measurement-service";
import {
  TAYQAN_MEASUREMENT_VERSION,
  tayqanMeasurementExceptionIsDangerous,
  tayqanMeasurementExceptionKey,
} from "@/lib/tayqan/tayqan-measurement-contract";
import {
  confirmExtractedEntity,
  correctExtractedEntity,
  rejectExtractedEntity,
} from "@/lib/services/extracted-entity-service";
import { importExtractedEntityToBoq } from "@/lib/services/extraction-to-boq-service";
import {
  assertTayqanAccessEntitlement,
  getTayqanIntakeConversationContext,
} from "@/lib/services/tayqan-hire-service";
import {
  enqueueWorkerReview,
  getWorkerRunForCompany,
} from "@/lib/services/worker-runner-service";
import { getWorkerAssignmentWorkspace } from "@/lib/services/worker-review-service";
import { TAYQAN_RATE_QUESTION_TYPES } from "@/lib/tayqan/tayqan-workflow-contract";

type GoverningInstructionContext = {
  projectCategory: string | null;
  categoryScope: string | null;
  measurementStandard: string | null;
  exclusions: string | null;
  deadlineText: string | null;
  specialInstructions: string | null;
  pricingBasis: string | null;
  authoritativeSourcePolicy: string | null;
};

export type WorkProgress = {
  quantityOverrides?: Record<string, { quantity: number; unit: string; note: string }>;
  rateOverrides?: Record<string, { unitCost: number; sourceNote: string }>;

  /**
   * B1: immutable snapshot of what the customer told TAYQAN
   * before work began. Stored inside the EXISTING progressJson
   * so Prisma/schema remain untouched.
   */
  instructionContext?: GoverningInstructionContext;

  /**
   * Source evidence is frozen to these ProjectFile ids after
   * SOURCE_DISCOVERY. This prevents unrelated project evidence
   * or a later file upload from silently entering this job.
   */
  selectedSourceFileIds?: string[];

  /**
   * Draft-first handoff state. Kept inside the EXISTING progressJson so
   * there is no Prisma/schema change. The normal Quantara AI Draft service
   * remains the single implementation of draft creation.
   */
  aiDraft?: {
    boqId: string;
    addedCount: number;
    skippedCount: number;
    alreadyPresentCount: number;
    unreviewedAddedCount: number;
    reviewedAddedCount: number;
  };

  /** Senior TAYQAN measurement checkpoint; stored in existing progressJson, never schema. */
  tayqanMeasurement?: {
    version: string;
    measuredSubjectCount: number;
    createdCalculationCount: number;
    reusedCalculationCount: number;
    exceptionCount: number;
    provider: string;
    model: string;
    seniorReview: {
      clusterReviewCount: number;
      globalReviewApplied: boolean;
      acceptedSubjectCount: number;
      rejectedSubjectCount: number;
      findingCount: number;
      evidencePageCoveragePercent: number;
    };
    /** Small UI/status preview; the complete register is persisted in batched work events. */
    exceptions: Array<{
      kind: string;
      message: string;
      pageIds: string[];
    }>;
    exceptionRegisterRunId: string;
    exceptionRegisterBatchCount: number;
    exceptionPreviewTruncated: boolean;
  };

  /**
   * PR1 correctness/completion-safety mission 2: the unified, queryable
   * measurement-exception ledger. Populated from two sources — mirrored from
   * the TAYQAN reasoner's own exceptions (draft-first pipeline, see
   * tayqanMeasurement.exceptions above) and synthesized directly by
   * advanceQuantityPreparation for entities that reach QUANTITY_PREPARATION
   * with no genuine quantity source (mission 1's SCOPE_GAP). This is the
   * single structure unresolvedDangerousMeasurementExceptions() reads to
   * gate progression — see that function for the gate itself.
   */
  measurementExceptions?: Array<{
    key: string;
    kind: string;
    message: string;
    pageIds: string[];
    relatedEntityId: string | null;
    createdAt: string;
  }>;
  /** Governed, audited resolutions keyed by measurementExceptions[].key. */
  measurementExceptionResolutions?: Record<string, {
    reason: string;
    actorUserId: string;
    actorName: string;
    resolvedAt: string;
  }>;
};

type WorkBlocker = {
  kind: "ACTION" | "ENTITY_REVIEW" | "QUANTITY_REQUIRED" | "RATE_REQUIRED" | "QA_QUESTION" | "MEASUREMENT_EXCEPTIONS" | "ERROR";
  i18nKey: string;
  actionHref?: string;
  entity?: {
    id: string;
    label: string;
    quantity: number | null;
    unit: string | null;
    sourceReference: string | null;
    confidence: number;
  };
  qa?: {
    assignmentId: string;
    questionId: string;
    questionType: string;
    prompt: string;
    whyMaterial: string;
    recommendedAction: string;
  };
  /**
   * TAYQAN-AI-DRAFT-LOOP-FIX: names which specific BOQ item(s) are still
   * blocking AI_DRAFT_REVIEW_REQUIRED, so "Check again" never repeats the
   * same generic message with zero indication of what to fix. Bounded (see
   * advanceAiDraftProfessionalReview) — never the full list on a large BOQ.
   */
  pendingItems?: Array<{ id: string; itemCode: string; description: string }>;
  /**
   * TAYQAN AUDIT FIX 3: populated only on a genuine FAILED transition (see
   * fail() below) — the real, specific cause behind the generic ERROR-kind
   * i18n message, interpolated into it via {reason}. `code` is the
   * originating AppError's machine-readable code, kept alongside for
   * support/debugging.
   */
  error?: { code: string; reason: string };
};

function jsonObject(value: unknown): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

function parseProgress(value: Prisma.JsonValue | null): WorkProgress {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as unknown as WorkProgress;
}

function instructionContextFromProgress(
  progress: WorkProgress,
): GoverningInstructionContext | null {
  return progress.instructionContext ?? null;
}

/**
 * PR1 mission 2: idempotently records a measurement exception into the
 * unified ledger, keyed by content so the same underlying gap is never
 * duplicated across repeated advance passes. Returns the SAME progress
 * object (by reference) when the exception is already present, so callers
 * can cheaply detect "did anything change" via reference equality.
 */
function withMeasurementException(
  progress: WorkProgress,
  exception: { kind: string; message: string; pageIds: string[]; relatedEntityId: string | null },
): WorkProgress {
  const key = tayqanMeasurementExceptionKey(exception);
  const existing = progress.measurementExceptions ?? [];
  if (existing.some((item) => item.key === key)) return progress;
  return {
    ...progress,
    measurementExceptions: [
      ...existing,
      { ...exception, key, createdAt: new Date().toISOString() },
    ],
  };
}

/**
 * PR1 mission 2: the single source of truth for "can this work order
 * advance". Every dangerous-kind exception in the ledger (see
 * TAYQAN_DANGEROUS_MEASUREMENT_EXCEPTION_KINDS) blocks until a governed
 * resolution exists for its exact key — resolving is never a silent status
 * flip, see resolveTayqanMeasurementException below.
 */
export function unresolvedDangerousMeasurementExceptions(
  progress: WorkProgress,
): {
  exceptions: NonNullable<WorkProgress["measurementExceptions"]>;
  blocking: boolean;
} {
  const exceptions = progress.measurementExceptions ?? [];
  const resolutions = progress.measurementExceptionResolutions ?? {};
  const unresolved = exceptions.filter(
    (exception) => tayqanMeasurementExceptionIsDangerous(exception.kind) && !resolutions[exception.key],
  );
  return { exceptions: unresolved, blocking: unresolved.length > 0 };
}

type InstructionSession = {
  id: string;
  measurementStandard: string | null;
  exclusions: string | null;
  deadlineText: string | null;
  specialInstructions: string | null;
  pricingBasis: string | null;
  authoritativeSourcePolicy: string | null;
};

async function buildGoverningInstructionContext(
  actor: CurrentActor,
  session: InstructionSession,
): Promise<GoverningInstructionContext> {
  const conversation =
    await getTayqanIntakeConversationContext(
      actor.companyId,
      session.id,
    );

  return {
    projectCategory:
      conversation.projectCategory,

    categoryScope:
      conversation.categoryScope,

    measurementStandard:
      session.measurementStandard,

    exclusions:
      session.exclusions,

    deadlineText:
      session.deadlineText,

    specialInstructions:
      session.specialInstructions,

    pricingBasis:
      session.pricingBasis,

    authoritativeSourcePolicy:
      session.authoritativeSourcePolicy,
  };
}

type InstructionWorkOrder = {
  id: string;
  companyId: string;
  intakeSessionId: string;
  stage: TayqanWorkStage;
  progressJson: Prisma.JsonValue | null;
  pricingBasis: string | null;
  authoritativeSourcePolicy: string | null;
};

async function ensureInstructionContext(
  actor: CurrentActor,
  order: InstructionWorkOrder,
): Promise<GoverningInstructionContext> {
  const progress =
    parseProgress(order.progressJson);

  const existing =
    instructionContextFromProgress(progress);

  if (existing) return existing;

  const session =
    await prisma.tayqanIntakeSession.findFirst({
      where: {
        id: order.intakeSessionId,
        companyId: actor.companyId,
      },

      select: {
        id: true,
        measurementStandard: true,
        exclusions: true,
        deadlineText: true,
        specialInstructions: true,
        pricingBasis: true,
        authoritativeSourcePolicy: true,
      },
    });

  if (!session) {
    throw new NotFoundError(
      "TAYQAN intake session not found for this work order.",
    );
  }

  const context =
    await buildGoverningInstructionContext(
      actor,
      session,
    );

  await prisma.tayqanWorkOrder.update({
    where: { id: order.id },

    data: {
      progressJson: jsonObject({
        ...progress,
        instructionContext: context,
      }),
    },
  });

  await appendWorkEvent(
    actor.companyId,
    order.id,
    order.stage,
    "WORK_INSTRUCTIONS_SNAPSHOTTED",
    {
      projectCategory:
        context.projectCategory,

      categoryScope:
        context.categoryScope,

      measurementStandard:
        context.measurementStandard,

      authoritativeSourcePolicy:
        context.authoritativeSourcePolicy,

      hasExclusions:
        Boolean(context.exclusions?.trim()),

      hasSpecialInstructions:
        Boolean(
          context.specialInstructions?.trim(),
        ),

      hasDeadline:
        Boolean(context.deadlineText?.trim()),
    },
  );

  return context;
}

function sourceFileIdsFromProgress(
  order: { progressJson: Prisma.JsonValue | null },
): string[] {
  return (
    parseProgress(order.progressJson)
      .selectedSourceFileIds ?? []
  );
}

const TAYQAN_MEASUREMENT_LEASE_CODE = "TAYQAN_MEASUREMENT_RUNNING";
const TAYQAN_MEASUREMENT_LEASE_STALE_MS = 15 * 60 * 1_000;
const TAYQAN_EXCEPTION_EVENT_BATCH_SIZE = 25;

async function claimTayqanMeasurementLease(
  actor: CurrentActor,
  order: Awaited<ReturnType<typeof loadOrder>>,
): Promise<string | null> {
  const leaseToken = `tayqan-measurement:${randomUUID()}`;
  const now = new Date();
  const staleBefore = new Date(now.getTime() - TAYQAN_MEASUREMENT_LEASE_STALE_MS);
  const claimed = await prisma.tayqanWorkOrder.updateMany({
    where: {
      id: order.id, companyId: actor.companyId, status: TayqanWorkStatus.RUNNING, stage: TayqanWorkStage.SOURCE_PROCESSING,
      OR: [{ blockerCode: null }, { blockerCode: TAYQAN_MEASUREMENT_LEASE_CODE, lastAdvancedAt: { lt: staleBefore } }],
    },
    data: { blockerCode: TAYQAN_MEASUREMENT_LEASE_CODE, blockerMessage: leaseToken, blockerJson: Prisma.DbNull, lastAdvancedAt: now },
  });
  if (claimed.count !== 1) return null;
  await appendWorkEvent(actor.companyId, order.id, order.stage, "TAYQAN_MEASUREMENT_LEASE_ACQUIRED", { staleAfterMinutes: TAYQAN_MEASUREMENT_LEASE_STALE_MS / 60_000 });
  return leaseToken;
}

async function heartbeatTayqanMeasurementLease(actor: CurrentActor, orderId: string, leaseToken: string) {
  const refreshed = await prisma.tayqanWorkOrder.updateMany({
    where: { id: orderId, companyId: actor.companyId, blockerCode: TAYQAN_MEASUREMENT_LEASE_CODE, blockerMessage: leaseToken },
    data: { lastAdvancedAt: new Date() },
  });
  if (refreshed.count !== 1) throw new ConflictError("TAYQAN_MEASUREMENT_LEASE_LOST", "TAYQAN measurement execution ownership changed; this request will not persist a competing result.");
}

async function releaseTayqanMeasurementLease(actor: CurrentActor, orderId: string, leaseToken: string) {
  await prisma.tayqanWorkOrder.updateMany({
    where: { id: orderId, companyId: actor.companyId, blockerCode: TAYQAN_MEASUREMENT_LEASE_CODE, blockerMessage: leaseToken },
    data: { blockerCode: null, blockerMessage: null, blockerJson: Prisma.DbNull, lastAdvancedAt: new Date() },
  });
}

function pricingBasisAllowsMatchedCatalogue(
  order: {
    progressJson: Prisma.JsonValue | null;
    pricingBasis: string | null;
  },
): boolean {
  const context =
    instructionContextFromProgress(
      parseProgress(order.progressJson),
    );

  const basis =
    (
      context?.pricingBasis
      ?? order.pricingBasis
      ?? ""
    )
      .trim()
      .toLocaleLowerCase();

  // If no explicit basis exists, retain the existing
  // governed matched-catalogue behavior.
  if (!basis) return true;

  /**
   * Only automatically consume a matched catalogue rate
   * when the customer explicitly requested a catalogue/
   * company-rate basis. Any other free-text basis (supplier
   * quotation, tender quote, client schedule, etc.) must
   * fall back to RATE_REQUIRED rather than silently using
   * the wrong commercial source.
   */
  return (
    basis.includes("catalogue")
    || basis.includes("catalog")
    || basis.includes("company rate")
    || basis.includes("company pricing")
  );
}

function governingQaInstructions(
  order: {
    progressJson: Prisma.JsonValue | null;
    pricingBasis: string | null;
    authoritativeSourcePolicy: string | null;
  },
): string {
  const progress =
    parseProgress(order.progressJson);

  const context =
    instructionContextFromProgress(progress);

  const lines = [
    "Do not lock, issue, approve, submit, or contractually certify the BOQ.",

    context?.projectCategory
      ? `Project category: ${context.projectCategory}.`
      : null,

    context?.categoryScope
      ? `Project responsibility scope: ${context.categoryScope}.`
      : null,

    context?.measurementStandard
      ? `Measurement standard requested by customer: ${context.measurementStandard}.`
      : null,

    context?.pricingBasis
      ? `Pricing basis requested by customer: ${context.pricingBasis}.`
      : null,

    context?.authoritativeSourcePolicy
      ? `Source authority policy: ${context.authoritativeSourcePolicy}.`
      : (
          order.authoritativeSourcePolicy
            ? `Source authority policy: ${order.authoritativeSourcePolicy}.`
            : null
        ),

    context?.exclusions?.trim()
      ? `Customer exclusions: ${context.exclusions.trim()}`
      : null,

    context?.deadlineText?.trim()
      ? `Customer deadline/context: ${context.deadlineText.trim()}`
      : null,

    context?.specialInstructions?.trim()
      ? `Customer special instructions: ${context.specialInstructions.trim()}`
      : null,

    progress.selectedSourceFileIds?.length
      ? `This work order is scoped to ${progress.selectedSourceFileIds.length} frozen project source file(s).`
      : null,

    "Review evidence, quantities, rates when applicable, unresolved verification issues, and compliance with the governing customer instructions above.",
  ].filter(
    (line): line is string =>
      Boolean(line),
  );

  return lines.join("\n");
}

function blockerFromJson(value: Prisma.JsonValue | null): WorkBlocker | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as unknown as WorkBlocker;
}

async function appendWorkEvent(
  companyId: string,
  workOrderId: string,
  stage: TayqanWorkStage,
  eventType: string,
  payload: Record<string, unknown> = {},
) {
  await prisma.tayqanWorkEvent.create({
    data: {
      companyId,
      workOrderId,
      stage,
      eventType,
      payloadJson: jsonObject(payload),
    },
  });
}

async function persistConversationStatus(
  companyId: string,
  sessionId: string,
  i18nKey: string,
  vars: Record<string, string | number> = {},
) {
  const latest = await prisma.tayqanIntakeMessage.findFirst({
    where: { companyId, sessionId, role: TayqanIntakeMessageRole.TAYQAN },
    orderBy: { createdAt: "desc" },
  });
  const structured = latest?.structuredDataJson;
  const previousKey = structured && typeof structured === "object" && !Array.isArray(structured)
    ? (structured as Record<string, unknown>).i18nKey
    : null;
  if (previousKey === i18nKey) return;
  await prisma.tayqanIntakeMessage.create({
    data: {
      companyId,
      sessionId,
      role: TayqanIntakeMessageRole.TAYQAN,
      message: i18nKey,
      structuredDataJson: jsonObject({ kind: "WORK_STATUS", i18nKey, vars }),
    },
  });
}

async function updateOrder(
  actor: CurrentActor,
  orderId: string,
  data: Prisma.TayqanWorkOrderUpdateInput,
  eventType: string,
  payload: Record<string, unknown> = {},
) {
  const updated = await prisma.tayqanWorkOrder.update({ where: { id: orderId }, data });
  await appendWorkEvent(actor.companyId, orderId, updated.stage, eventType, payload);
  return updated;
}

/**
 * PR1 mission 3: the exception-ledger view the work-order panel renders.
 * Every entry carries whether it's dangerous (gates progression, see
 * unresolvedDangerousMeasurementExceptions) and its resolution if any, so
 * the UI can distinguish "informational" from "must act" without
 * duplicating the gating logic itself.
 */
function measurementExceptionsSummary(progress: WorkProgress) {
  const exceptions = progress.measurementExceptions ?? [];
  const resolutions = progress.measurementExceptionResolutions ?? {};
  const dangerous = exceptions.filter((exception) => tayqanMeasurementExceptionIsDangerous(exception.kind));
  const unresolvedDangerous = dangerous.filter((exception) => !resolutions[exception.key]);
  return {
    totalCount: exceptions.length,
    dangerousCount: dangerous.length,
    unresolvedDangerousCount: unresolvedDangerous.length,
    exceptions: exceptions.map((exception) => ({
      key: exception.key,
      kind: exception.kind,
      message: exception.message,
      pageIds: exception.pageIds,
      relatedEntityId: exception.relatedEntityId,
      dangerous: tayqanMeasurementExceptionIsDangerous(exception.kind),
      resolution: resolutions[exception.key] ?? null,
    })),
  };
}

function toState(order: Awaited<ReturnType<typeof loadOrder>>) {
  return {
    id: order.id,
    status: order.status,
    stage: order.stage,
    projectId: order.projectId,
    boqId: order.boqId,
    intakeSessionId: order.intakeSessionId,
    hireEntitlementId: order.hireEntitlementId,
    desiredDeliverable: order.desiredDeliverable,
    includeRates: order.includeRates,
    pricingBasis: order.pricingBasis,
    blockerCode: order.blockerCode,
    blockerMessage: order.blockerMessage,
    blocker: blockerFromJson(order.blockerJson),
    qaWorkerRunId: order.qaWorkerRunId,
    measurementExceptions: measurementExceptionsSummary(parseProgress(order.progressJson)),
    startedAt: order.startedAt.toISOString(),
    lastAdvancedAt: order.lastAdvancedAt.toISOString(),
    completedAt: order.completedAt?.toISOString() ?? null,
    events: order.events.map((event) => ({
      id: event.id,
      stage: event.stage,
      eventType: event.eventType,
      payload: event.payloadJson,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

async function loadOrder(companyId: string, orderId: string) {
  const order = await prisma.tayqanWorkOrder.findFirst({
    where: { id: orderId, companyId },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) throw new NotFoundError("TAYQAN work order not found.");
  return order;
}

async function getSessionForWork(actor: CurrentActor, projectId: string, sessionId: string) {
  const entitlement = await assertTayqanAccessEntitlement(actor);
  const project = await getProjectRecord(actor.companyId, projectId);
  const session = await prisma.tayqanIntakeSession.findFirst({
    where: {
      id: sessionId,
      companyId: actor.companyId,
      projectId: project.id,
      hireEntitlementId: entitlement.id,
    },
  });
  if (!session) throw new NotFoundError("TAYQAN intake session not found.");
  if (session.status !== TayqanIntakeStatus.READY && session.status !== TayqanIntakeStatus.WORK_STARTED) {
    throw new ConflictError("TAYQAN_INTAKE_NOT_READY", "Complete TAYQAN's intake before starting the work order.");
  }
  return { entitlement, project, session };
}

export async function startOrResumeTayqanWorkOrder(
  actor: CurrentActor,
  projectIdentifier: string,
  sessionId: string,
  idempotencyKey: string,
) {
  if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    throw new AppError("INVALID_IDEMPOTENCY_KEY", "A valid Idempotency-Key is required.", 400);
  }
  const { entitlement, project, session } = await getSessionForWork(actor, projectIdentifier, sessionId);

  const existing =
    await prisma.tayqanWorkOrder.findUnique({
      where: {
        intakeSessionId: session.id,
      },
    });

  if (existing) {
    const loaded =
      await loadOrder(
        actor.companyId,
        existing.id,
      );

    await ensureInstructionContext(
      actor,
      loaded,
    );

    return toState(
      await loadOrder(
        actor.companyId,
        existing.id,
      ),
    );
  }

  const instructionContext =
    await buildGoverningInstructionContext(
      actor,
      session,
    );

  let initialStage: TayqanWorkStage = TayqanWorkStage.SOURCE_DISCOVERY;
  if (session.desiredDeliverable === "REVIEW_EXISTING_BOQ") initialStage = TayqanWorkStage.VALIDATION;

  let created;
  try {
    created = await prisma.tayqanWorkOrder.create({
      data: {
        companyId: actor.companyId,
        projectId: project.id,
        boqId: session.boqId,
        intakeSessionId: session.id,
        hireEntitlementId: entitlement.id,
        createdByUserId: actor.userId,
        status: TayqanWorkStatus.RUNNING,
        stage: initialStage,
        desiredDeliverable: session.desiredDeliverable ?? "UNKNOWN",
        includeRates: session.includeRates ?? false,
        pricingBasis: session.pricingBasis,
        authoritativeSourcePolicy: session.authoritativeSourcePolicy,
        startIdempotencyKey: idempotencyKey,

        progressJson: jsonObject({
          instructionContext,
        }),
      },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const raced = await prisma.tayqanWorkOrder.findUnique({ where: { intakeSessionId: session.id } });
    if (!raced) throw error;
    created = raced;
  }

  await prisma.tayqanIntakeSession.update({
    where: { id: session.id },
    data: { status: TayqanIntakeStatus.WORK_STARTED },
  });
  await appendWorkEvent(actor.companyId, created.id, created.stage, "WORK_ORDER_CREATED", {
    desiredDeliverable: created.desiredDeliverable,
    includeRates: created.includeRates,
  });
  await persistConversationStatus(actor.companyId, session.id, "tayqan.hire.workflow.workOrderStarted");
  return toState(await loadOrder(actor.companyId, created.id));
}

async function block(
  actor: CurrentActor,
  order: Awaited<ReturnType<typeof loadOrder>>,
  code: string,
  i18nKey: string,
  blocker: WorkBlocker,
) {
  const updated = await updateOrder(
    actor,
    order.id,
    {
      status: TayqanWorkStatus.NEEDS_INPUT,
      blockerCode: code,
      blockerMessage: i18nKey,
      blockerJson: jsonObject(blocker),
      lastAdvancedAt: new Date(),
    },
    "WORK_BLOCKED",
    { code, i18nKey },
  );
  await persistConversationStatus(actor.companyId, order.intakeSessionId, i18nKey);
  return toState(await loadOrder(actor.companyId, updated.id));
}

/**
 * TAYQAN AUDIT FIX 3 — a narrow, evidence-based allowlist of AppError codes
 * thrown by prepareTayqanMeasurementProposals's buildEvidenceBundle/
 * AI-configuration check (tayqan-measurement-service.ts), all read directly
 * rather than guessed. Every one of these fires BEFORE the AI reasoner call
 * and is deterministic given the work order's already-FROZEN state
 * (selectedSourceFileIds, boqId, project.id): a retry against unchanged
 * persisted state reproduces the identical error every time.
 *
 * Deliberately EXCLUDED (left transient/ambiguous, unchanged propagate/retry
 * behavior — see the PR description for the full reasoning):
 * - Anything the reasoner call itself throws (rate limits, timeouts,
 *   network — openai-tayqan-measurement-reasoner.ts is a protected,
 *   unmodified file; these must stay retryable per this mission's own
 *   example).
 * - Errors from evaluateTayqanMeasurementSubject (plain Error, no code) —
 *   these validate the AI's PROPOSED subject, which differs per call, so a
 *   retry can plausibly get a different, valid result next time.
 * - TAYQAN_MEASUREMENT_LEASE_LOST — a genuine concurrent-execution race,
 *   not a permanent failure.
 * - Every AppError code thrown by generateAiDraftBoq/importExtractedEntityToBoq
 *   (ai-draft-boq-service.ts / extraction-to-boq-service.ts) — reading both
 *   files found their error surface is a genuine mix of "reload and try
 *   again" optimistic-concurrency conflicts (e.g. CONCURRENT_WRITE_CONFLICT,
 *   AI_DRAFT_ENTITY_IMPORT_CONFLICT) and human-actionable preconditions
 *   (e.g. AI_DRAFT_REQUIRES_EDITABLE_BOQ — fixed by creating a new editable
 *   revision, not "broken forever"), with no signal as clean as the AI
 *   NOT_CONFIGURED / frozen-scope-precondition split found here. Confidently
 *   separating those in the time available for this pass was not possible —
 *   reported as an explicit scoping decision in the PR rather than guessed.
 */
const TAYQAN_TERMINAL_MEASUREMENT_ERROR_CODES = new Set([
  "TAYQAN_MEASUREMENT_PROJECT_MISMATCH",
  "TAYQAN_MEASUREMENT_SOURCES_REQUIRED",
  "TAYQAN_MEASUREMENT_SOURCE_SCOPE_INVALID",
  "TAYQAN_MEASUREMENT_PAGES_REQUIRED",
  "TAYQAN_MEASUREMENT_AI_NOT_CONFIGURED",
  "TAYQAN_MEASUREMENT_PAGE_TOO_LARGE",
]);

function isTerminalTayqanMeasurementError(error: unknown): error is AppError {
  return error instanceof AppError && TAYQAN_TERMINAL_MEASUREMENT_ERROR_CODES.has(error.code);
}

/**
 * TAYQAN AUDIT FIX 3 — the terminal counterpart to block(): transitions the
 * work order to FAILED, a real TAYQAN_TERMINAL_WORK_STATUSES member that,
 * until this fix, was declared but never assigned anywhere (see
 * advanceTayqanWorkOrder's existing FAILED early-return, now actually
 * reachable). Only ever called for errors classified genuinely terminal by
 * isTerminalTayqanMeasurementError — never a blanket catch-all. Mirrors
 * block()'s i18n-key message pattern exactly (blockerMessage is a
 * translation KEY, not literal text) and additionally logs the real
 * underlying error via console.error and the WORK_FAILED event payload, so
 * support can find the actual cause without it ever having to appear in the
 * customer-facing message itself.
 */
async function fail(
  actor: CurrentActor,
  order: Awaited<ReturnType<typeof loadOrder>>,
  code: string,
  i18nKey: string,
  blocker: WorkBlocker,
  error: AppError,
) {
  console.error(
    `[TAYQAN-WORK-ORDER] work order ${order.id} FAILED at stage ${order.stage}: ${error.code} — ${error.message}`,
  );
  const updated = await updateOrder(
    actor,
    order.id,
    {
      status: TayqanWorkStatus.FAILED,
      blockerCode: code,
      blockerMessage: i18nKey,
      blockerJson: jsonObject(blocker),
      completedAt: new Date(),
      lastAdvancedAt: new Date(),
    },
    "WORK_FAILED",
    { code, i18nKey, errorCode: error.code, errorMessage: error.message },
  );
  await persistConversationStatus(actor.companyId, order.intakeSessionId, i18nKey, {
    reason: error.message.slice(0, 300),
  });
  return toState(await loadOrder(actor.companyId, updated.id));
}

async function moveStage(
  actor: CurrentActor,
  order: Awaited<ReturnType<typeof loadOrder>>,
  stage: TayqanWorkStage,
  eventType: string,
) {
  await updateOrder(
    actor,
    order.id,
    {
      status: TayqanWorkStatus.RUNNING,
      stage,
      blockerCode: null,
      blockerMessage: null,
      blockerJson: Prisma.DbNull,
      lastAdvancedAt: new Date(),
    },
    eventType,
    { toStage: stage },
  );
  return loadOrder(actor.companyId, order.id);
}

async function ensureWorkingBoq(
  actor: CurrentActor,
  projectSlug: string,
  order: Awaited<ReturnType<typeof loadOrder>>,
) {
  if (order.boqId) {
    const existing = await prisma.bOQ.findFirst({
      where: { id: order.boqId, companyId: actor.companyId, projectId: order.projectId },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundError("TAYQAN target BOQ not found.");
    if (["LOCKED", "ISSUED", "APPROVED"].includes(existing.status)) {
      throw new ConflictError("TAYQAN_TARGET_BOQ_LOCKED", "TAYQAN cannot modify a locked, issued, or approved BOQ revision.");
    }
    return existing.id;
  }

  const created = await createProjectBOQ(actor.companyId, projectSlug, {
    title: `TAYQAN Working BOQ`,
  });
  await updateOrder(actor, order.id, { boqId: created.databaseId }, "WORKING_BOQ_RESOLVED", {
    boqId: created.databaseId,
  });
  return created.databaseId;
}

/**
 * PR2 gap 4: prefers a real, deterministic revision-number comparison over
 * upload-recency when one reliably exists for every file competing for a
 * given drawing number. parseRevisionNumber (src/lib/revisions/revision-number.ts)
 * is a real, tested parser reused exactly as written — but it's scoped to
 * BOQ revision numbers ("R01", "R02", ...), a different domain from
 * arbitrary drawing-office revision conventions ("A", "P2", "Issue 3", ...).
 * When a drawing's revision string genuinely matches that strict format for
 * every competing file, the numeric comparison is real and deterministic,
 * so it wins. The moment any competing file's revision string doesn't
 * match, this falls back to the existing upload-recency rule (first in
 * createdAt-desc order) for that drawing number specifically — never a
 * guessed semantic ordering between arbitrary revision strings.
 */
export function pickLatestRevisionFileIdPerDrawing(
  filesNewestFirst: readonly { id: string; drawingNumber: string | null; revisionNumber: string | null }[],
): Map<string, string> {
  const groups = new Map<string, Array<(typeof filesNewestFirst)[number]>>();
  for (const file of filesNewestFirst) {
    const drawingNumber = file.drawingNumber?.trim();
    if (!drawingNumber) continue;
    const group = groups.get(drawingNumber) ?? [];
    group.push(file);
    groups.set(drawingNumber, group);
  }

  const winnerIdByDrawingNumber = new Map<string, string>();
  for (const [drawingNumber, group] of groups) {
    // group preserves the same newest-first order as filesNewestFirst.
    const parsed = group.map((file) => {
      try {
        return { file, revision: parseRevisionNumber(file.revisionNumber ?? "") as number | null };
      } catch {
        return { file, revision: null as number | null };
      }
    });

    const allParsed = parsed.every((entry) => entry.revision !== null);
    const winner = allParsed
      ? parsed.reduce((best, entry) => (entry.revision! > best.revision! ? entry : best))
      : parsed[0]!;
    winnerIdByDrawingNumber.set(drawingNumber, winner.file.id);
  }
  return winnerIdByDrawingNumber;
}

async function sourceRequirements(
  actor: CurrentActor,
  order: Awaited<ReturnType<typeof loadOrder>>,
) {
  const context =
    await ensureInstructionContext(
      actor,
      order,
    );

  const progress =
    parseProgress(order.progressJson);

  const allFiles =
    await prisma.projectFile.findMany({
      where: {
        companyId: actor.companyId,
        projectId: order.projectId,
        status: { not: "ARCHIVED" },
      },

      // Newest upload first. Project revision identifiers
      // are arbitrary strings, so TAYQAN must not invent
      // an A/B/C/P01 ordering algorithm.
      orderBy: {
        createdAt: "desc",
      },
    });

  const frozenIds =
    progress.selectedSourceFileIds ?? [];

  let files =
    frozenIds.length > 0
      ? allFiles.filter(
          (file) =>
            frozenIds.includes(file.id),
        )
      : allFiles;

  const groups =
    new Map<
      string,
      {
        revisions: Set<string>;
        fileIds: string[];
      }
    >();

  for (const file of allFiles) {
    const drawingNumber =
      file.drawingNumber?.trim();

    if (!drawingNumber) continue;

    const group =
      groups.get(drawingNumber)
      ?? {
        revisions: new Set<string>(),
        fileIds: [],
      };

    group.revisions.add(
      file.revisionNumber?.trim()
      || "UNSPECIFIED",
    );

    group.fileIds.push(file.id);

    groups.set(
      drawingNumber,
      group,
    );
  }

  const conflicts =
    [...groups.entries()]
      .filter(
        ([, group]) =>
          group.revisions.size > 1,
      )
      .map(
        ([drawingNumber, group]) => ({
          drawingNumber,
          revisions:
            [...group.revisions],

          fileIds:
            [...group.fileIds],
        }),
      );

  if (
    frozenIds.length === 0
    && context.authoritativeSourcePolicy
      === "USE_LATEST_REVISION"
  ) {
    const winnerIdByDrawingNumber =
      pickLatestRevisionFileIdPerDrawing(allFiles);

    const seenDrawings =
      new Set<string>();

    files = allFiles.filter((file) => {
      const drawingNumber =
        file.drawingNumber?.trim();

      // Files without a drawing number are not
      // silently discarded.
      if (!drawingNumber) return true;

      if (
        seenDrawings.has(
          drawingNumber,
        )
      ) {
        return false;
      }

      seenDrawings.add(
        drawingNumber,
      );

      return file.id === winnerIdByDrawingNumber.get(drawingNumber);
    });
  }

  const requirements =
    files.map((file) => {
      const capability =
        getSourceProcessingCapability(
          file.extension,
        );

      const engines:
        ExtractionEngineType[] = [];

      if (
        file.classification === "UNKNOWN"
        || file.status === "UPLOADED"
      ) {
        engines.push(
          ExtractionEngineType
            .DOCUMENT_CLASSIFICATION,
        );
      }

      if (capability.canRenderPages) {
        engines.push(
          ExtractionEngineType
            .FILE_PREPROCESSING,
        );
      }

      if (capability.canExtractTables) {
        engines.push(
          ExtractionEngineType
            .TABLE_EXTRACTION,
        );
      }

      return {
        file,
        engines,
      };
    });

  return {
    requirements,

    selectedSourceFileIds:
      files.map((file) => file.id),

    conflicts:
      frozenIds.length === 0
      && context.authoritativeSourcePolicy
        === "ASK_ON_EACH_CONFLICT"
        ? conflicts
        : [],

    context,
  };
}

async function advanceSourceDiscovery(
  actor: CurrentActor,
  projectSlug: string,
  order: Awaited<ReturnType<typeof loadOrder>>,
) {
  const sourceState =
    await sourceRequirements(
      actor,
      order,
    );

  if (sourceState.conflicts.length > 0) {
    return block(
      actor,
      order,
      "SOURCE_REVISION_CONFLICT",
      "tayqan.hire.workflow.sourceRevisionConflict",
      {
        kind: "ACTION",
        i18nKey:
          "tayqan.hire.workflow.sourceRevisionConflict",
        actionHref:
          `/projects/${projectSlug}/files`,
      },
    );
  }

  if (
    sourceState.requirements.length === 0
  ) {
    return block(
      actor,
      order,
      "TAYQAN_SOURCES_REQUIRED",
      "tayqan.hire.workflow.sourcesRequired",
      {
        kind: "ACTION",
        i18nKey:
          "tayqan.hire.workflow.sourcesRequired",
        actionHref:
          `/projects/${projectSlug}/files`,
      },
    );
  }

  let workingOrder = order;

  const progress =
    parseProgress(order.progressJson);

  if (
    (
      progress.selectedSourceFileIds
      ?? []
    ).length === 0
  ) {
    await updateOrder(
      actor,
      order.id,
      {
        progressJson: jsonObject({
          ...progress,

          selectedSourceFileIds:
            sourceState
              .selectedSourceFileIds,
        }),
      },

      "SOURCE_SCOPE_SNAPSHOTTED",

      {
        selectedSourceFileIds:
          sourceState
            .selectedSourceFileIds,

        authoritativeSourcePolicy:
          sourceState.context
            .authoritativeSourcePolicy,

        selectionRule:
          sourceState.context
            .authoritativeSourcePolicy
            === "USE_LATEST_REVISION"
            ? "NEWEST_UPLOADED_PER_DRAWING_NUMBER"
            : "ALL_NON_ARCHIVED_PROJECT_SOURCES",
      },
    );

    workingOrder =
      await loadOrder(
        actor.companyId,
        order.id,
      );
  }

  await ensureWorkingBoq(
    actor,
    projectSlug,
    workingOrder,
  );

  const next =
    await moveStage(
      actor,

      await loadOrder(
        actor.companyId,
        order.id,
      ),

      TayqanWorkStage.SOURCE_PROCESSING,
      "SOURCE_DISCOVERY_COMPLETE",
    );

  return advanceSourceProcessing(
    actor,
    projectSlug,
    next,
  );
}

async function advanceSourceProcessing(actor: CurrentActor, projectSlug: string, order: Awaited<ReturnType<typeof loadOrder>>) {
  await import("@/lib/jobs/register-handlers");
  const {
    requirements,
    conflicts,
  } = await sourceRequirements(
    actor,
    order,
  );

  if (conflicts.length > 0) {
    return block(
      actor,
      order,
      "SOURCE_REVISION_CONFLICT",
      "tayqan.hire.workflow.sourceRevisionConflict",
      {
        kind: "ACTION",
        i18nKey:
          "tayqan.hire.workflow.sourceRevisionConflict",
        actionHref:
          `/projects/${projectSlug}/files`,
      },
    );
  }

  let pending = 0;
  let queued = 0;

  for (const { file, engines } of requirements) {
    for (const engineType of engines) {
      const latest = await prisma.extractionJob.findFirst({
        where: { companyId: actor.companyId, projectFileId: file.id, engineType },
        orderBy: { createdAt: "desc" },
      });
      if (latest) {
        if (latest.status === ExtractionJobStatus.COMPLETED || latest.status === ExtractionJobStatus.NEEDS_REVIEW) continue;
        if (latest.status === ExtractionJobStatus.QUEUED || latest.status === ExtractionJobStatus.RUNNING) {
          pending += 1;
          continue;
        }
        if (latest.status === ExtractionJobStatus.NEEDS_INPUT) {
          return block(actor, order, "SOURCE_JOB_NEEDS_INPUT", "tayqan.hire.workflow.sourceNeedsInput", {
            kind: "ACTION",
            i18nKey: "tayqan.hire.workflow.sourceNeedsInput",
            actionHref: `/projects/${projectSlug}/files`,
          });
        }
        if (latest.status === ExtractionJobStatus.FAILED || latest.status === ExtractionJobStatus.CANCELLED) {
          return block(actor, order, "SOURCE_JOB_FAILED", "tayqan.hire.workflow.sourceFailed", {
            kind: "ACTION",
            i18nKey: "tayqan.hire.workflow.sourceFailed",
            actionHref: `/projects/${projectSlug}/files`,
          });
        }
      }

      const job = await extractionJobQueue.enqueue({
        companyId: actor.companyId,
        projectId: order.projectId,
        projectFileId: file.id,
        engineType,
        createdByUserId: actor.userId,
      });
      queued += 1;
      if (job.status === ExtractionJobStatus.QUEUED || job.status === ExtractionJobStatus.RUNNING) pending += 1;
    }
  }

  if (pending > 0) {
    await updateOrder(actor, order.id, { status: TayqanWorkStatus.RUNNING, lastAdvancedAt: new Date() }, "SOURCE_PROCESSING_WAITING", { pending, queued });
    await persistConversationStatus(actor.companyId, order.intakeSessionId, "tayqan.hire.workflow.sourceProcessing", { count: pending });
    return toState(await loadOrder(actor.companyId, order.id));
  }

  if (usesDraftFirstWorkflow(order)) {
    let measuredOrder = order;
    const progress = parseProgress(order.progressJson);

    if (progress.tayqanMeasurement?.version !== TAYQAN_MEASUREMENT_VERSION) {
      const leaseToken = await claimTayqanMeasurementLease(actor, order);
      if (!leaseToken) return toState(await loadOrder(actor.companyId, order.id));

      try {
        const leasedOrder = await loadOrder(actor.companyId, order.id);
        const leasedProgress = parseProgress(leasedOrder.progressJson);
        if (leasedProgress.tayqanMeasurement?.version === TAYQAN_MEASUREMENT_VERSION) {
          await releaseTayqanMeasurementLease(actor, order.id, leaseToken);
          return prepareTayqanAiDraft(actor, projectSlug, leasedOrder);
        }

        const frozenSourceFileIds = sourceFileIdsFromProgress(leasedOrder);
        
        const drawingPagesCount = await prisma.drawingPage.count({
          where: { companyId: actor.companyId, projectFileId: { in: frozenSourceFileIds } },
        });
        
        const extractedEntitiesCount = await prisma.extractedEntity.count({
          where: {
            companyId: actor.companyId,
            projectFileId: { in: frozenSourceFileIds },
            status: { in: ["EXTRACTED", "NEEDS_REVIEW", "CONFIRMED", "CORRECTED"] },
          },
        });
        
        if (drawingPagesCount === 0 && extractedEntitiesCount > 0) {
           await releaseTayqanMeasurementLease(actor, order.id, leaseToken);
           return prepareTayqanAiDraft(actor, projectSlug, leasedOrder);
        }

        const measurement = await prepareTayqanMeasurementProposals(
          actor, projectSlug,
          {
            projectId: leasedOrder.projectId,
            sourceFileIds: sourceFileIdsFromProgress(leasedOrder),
            governingContext: leasedProgress.instructionContext ?? null,
            // PR2 gap 2: leasedOrder.boqId is already frozen for
            // UPDATE_EXISTING_BOQ — the intake flow blocks work-order
            // creation until a target BOQ is selected (deliverableNeedsExistingBoq
            // in tayqan-hire-service.ts), so this is stable for the whole
            // measurement pass, exactly like sourceFileIds.
            targetBoqId: leasedOrder.desiredDeliverable === "UPDATE_EXISTING_BOQ" ? leasedOrder.boqId : null,
          },
          { onProgress: async () => heartbeatTayqanMeasurementLease(actor, order.id, leaseToken) },
        );
        const measurementExceptions = measurement.exceptions.slice(0, 50).map((exception) => ({ kind: exception.kind, message: exception.message, pageIds: exception.pageIds }));
        // PR1 mission 2: mirror every reasoner exception into the unified,
        // gateable ledger (not just the truncated UI preview above) so
        // dangerous-kind exceptions from the draft-first pipeline gate
        // Draft handoff and final QA exactly like mission 1's SCOPE_GAP
        // exceptions do for the non-draft-first pipeline.
        const ledgerExceptions = measurement.exceptions.map((exception) => {
          const key = tayqanMeasurementExceptionKey(exception);
          return { key, kind: exception.kind, message: exception.message, pageIds: exception.pageIds, relatedEntityId: exception.relatedEntityId, createdAt: new Date().toISOString() };
        });
        const existingLedgerKeys = new Set((leasedProgress.measurementExceptions ?? []).map((exception) => exception.key));
        const mergedLedger = [
          ...(leasedProgress.measurementExceptions ?? []),
          ...ledgerExceptions.filter((exception) => !existingLedgerKeys.has(exception.key)),
        ];
        const exceptionBatches = Array.from(
          { length: Math.ceil(measurement.exceptions.length / TAYQAN_EXCEPTION_EVENT_BATCH_SIZE) },
          (_, index) => measurement.exceptions.slice(index * TAYQAN_EXCEPTION_EVENT_BATCH_SIZE, (index + 1) * TAYQAN_EXCEPTION_EVENT_BATCH_SIZE),
        );
        for (let index = 0; index < exceptionBatches.length; index += 1) {
          const batch = exceptionBatches[index]!;
          await appendWorkEvent(actor.companyId, order.id, leasedOrder.stage, "TAYQAN_MEASUREMENT_EXCEPTION_REGISTER", {
            version: TAYQAN_MEASUREMENT_VERSION, registerRunId: leaseToken, batchIndex: index + 1, batchCount: exceptionBatches.length, totalExceptionCount: measurement.exceptions.length,
            exceptions: batch.map((exception) => ({ kind: exception.kind, message: exception.message, pageIds: exception.pageIds, relatedEntityId: exception.relatedEntityId })),
          });
        }
        const completionPayload = {
          version: TAYQAN_MEASUREMENT_VERSION, measuredSubjectCount: measurement.measuredSubjectCount, createdCalculationCount: measurement.createdCalculationCount,
          reusedCalculationCount: measurement.reusedCalculationCount, exceptionCount: measurement.exceptionCount,
          exceptionKinds: [...new Set(measurement.exceptions.map((exception) => exception.kind))], seniorReview: measurement.seniorReview,
          exceptionRegisterRunId: leaseToken, exceptionRegisterBatchCount: exceptionBatches.length,
        };
        await prisma.$transaction(async (tx) => {
          const completed = await tx.tayqanWorkOrder.updateMany({
            where: { id: order.id, companyId: actor.companyId, blockerCode: TAYQAN_MEASUREMENT_LEASE_CODE, blockerMessage: leaseToken },
            data: {
              progressJson: jsonObject({ ...leasedProgress, measurementExceptions: mergedLedger, tayqanMeasurement: {
                version: TAYQAN_MEASUREMENT_VERSION, measuredSubjectCount: measurement.measuredSubjectCount, createdCalculationCount: measurement.createdCalculationCount, reusedCalculationCount: measurement.reusedCalculationCount,
                exceptionCount: measurement.exceptionCount, provider: measurement.provider, model: measurement.model, seniorReview: measurement.seniorReview, exceptions: measurementExceptions,
                exceptionRegisterRunId: leaseToken, exceptionRegisterBatchCount: exceptionBatches.length, exceptionPreviewTruncated: measurement.exceptions.length > measurementExceptions.length,
              } }),
              blockerCode: null, blockerMessage: null, blockerJson: Prisma.DbNull, lastAdvancedAt: new Date(),
            },
          });
          if (completed.count !== 1) throw new ConflictError("TAYQAN_MEASUREMENT_LEASE_LOST", "TAYQAN measurement execution ownership changed before completion; competing results were not committed to the work order.");
          await tx.tayqanWorkEvent.create({ data: { companyId: actor.companyId, workOrderId: order.id, stage: leasedOrder.stage, eventType: "TAYQAN_MEASUREMENT_COMPLETE", payloadJson: jsonObject(completionPayload) } });
        });
        await persistConversationStatus(actor.companyId, order.intakeSessionId, "tayqan.hire.workflow.measurementComplete", { count: measurement.measuredSubjectCount });
        measuredOrder = await loadOrder(actor.companyId, order.id);
      } catch (error) {
        await releaseTayqanMeasurementLease(actor, order.id, leaseToken);
        if (isTerminalTayqanMeasurementError(error)) {
          return fail(
            actor,
            order,
            "TAYQAN_MEASUREMENT_TERMINAL_ERROR",
            "tayqan.hire.workflow.workOrderFailed",
            {
              kind: "ERROR",
              i18nKey: "tayqan.hire.workflow.workOrderFailed",
              error: { code: error.code, reason: error.message.slice(0, 300) },
            },
            error,
          );
        }
        throw error;
      }
    }

    return prepareTayqanAiDraft(actor, projectSlug, measuredOrder);
  }

  const next = await moveStage(actor, order, TayqanWorkStage.EVIDENCE_REVIEW, "SOURCE_PROCESSING_COMPLETE");
  return advanceEvidenceReview(actor, projectSlug, next);
}

function entityBlocker(entity: {
  id: string;
  label: string;
  quantity: Prisma.Decimal | null;
  unit: string | null;
  sourceReference: string | null;
  confidence: Prisma.Decimal;
}): WorkBlocker["entity"] {
  return {
    id: entity.id,
    label: entity.label,
    quantity: entity.quantity?.toNumber() ?? null,
    unit: entity.unit,
    sourceReference: entity.sourceReference,
    confidence: entity.confidence.toNumber(),
  };
}

function sourceScopedEntityFilter(
  order: {
    progressJson: Prisma.JsonValue | null;
  },
) {
  const sourceFileIds =
    sourceFileIdsFromProgress(order);

  return sourceFileIds.length > 0
    ? {
        projectFileId: {
          in: sourceFileIds,
        },
      }
    : {};
}

function usesDraftFirstWorkflow(
  order: {
    desiredDeliverable: string;
  },
): boolean {
  return (
    order.desiredDeliverable === "COMPLETE_BOQ_FROM_SOURCES"
    || order.desiredDeliverable === "UPDATE_EXISTING_BOQ"
  );
}

function aiDraftBoqHref(
  projectSlug: string,
  summary: WorkProgress["aiDraft"],
): string {
  const params = new URLSearchParams({
    aiDraft: "1",
    added: String(summary?.addedCount ?? 0),
    skipped: String(summary?.skippedCount ?? 0),
    existing: String(summary?.alreadyPresentCount ?? 0),
  });

  return `/projects/${projectSlug}/boq?${params.toString()}`;
}

async function prepareTayqanAiDraft(
  actor: CurrentActor,
  projectSlug: string,
  order: Awaited<ReturnType<typeof loadOrder>>,
) {


  const boqId =
    await ensureWorkingBoq(
      actor,
      projectSlug,
      order,
    );

  const selectedSourceFileIds =
    sourceFileIdsFromProgress(order);

  const result =
    await generateAiDraftBoq(
      actor,
      projectSlug,
      {
        targetBoqId: boqId,
        projectFileIds: selectedSourceFileIds,
        quantityMode: "TAYQAN_MEASUREMENT_PROPOSAL",
      },
    );

  const progress =
    parseProgress(order.progressJson);

  const aiDraft: NonNullable<
    WorkProgress["aiDraft"]
  > = {
    boqId: result.boqId,
    addedCount: result.addedCount,
    skippedCount: result.skippedCount,
    alreadyPresentCount:
      result.alreadyPresentCount,
    unreviewedAddedCount:
      result.unreviewedAddedCount,
    reviewedAddedCount:
      result.reviewedAddedCount,
  };

  await updateOrder(
    actor,
    order.id,
    {
      boqId,
      progressJson: jsonObject({
        ...progress,
        aiDraft,
      }),
      lastAdvancedAt: new Date(),
    },
    "AI_DRAFT_BOQ_GENERATED",
    {
      ...aiDraft,
      selectedSourceCount:
        selectedSourceFileIds.length,
    },
  );

  const loaded =
    await loadOrder(
      actor.companyId,
      order.id,
    );

  // NO SILENT SCOPE OMISSION invariant
  const activeEntities = await prisma.extractedEntity.findMany({
    where: {
      companyId: actor.companyId,
      projectFileId: { in: selectedSourceFileIds },
      status: { in: ["EXTRACTED", "NEEDS_REVIEW", "CONFIRMED", "CORRECTED"] },
    }
  });

  const usableEntities = activeEntities.filter(e => e.label && e.label.trim().length > 0);
  
  const boq = await getBOQRecord(actor.companyId, boqId);
  
  const representedEntityIds = new Set(
    boq!.sections.flatMap(s => s.items)
      .map(i => i.quantityProvenance?.extractedEntityId ?? getAiDraftExtractedEntityId(i.sourceReference))
      .filter(id => id !== null)
  );

  const missingEntities = usableEntities.filter(e => !representedEntityIds.has(e.id));
  
  if (missingEntities.length > 0) {
    return fail(actor, loaded, "SCOPE_COVERAGE_INCOMPLETE", "tayqan.hire.workflow.scopeCoverageIncomplete", {
      kind: "ERROR",
      i18nKey: "tayqan.hire.workflow.scopeCoverageIncomplete",
      error: { code: "SCOPE_COVERAGE_INCOMPLETE" }
    }, new AppError("SCOPE_COVERAGE_INCOMPLETE", `eligible entity count: ${usableEntities.length}, represented entity count: ${representedEntityIds.size}, missing count: ${missingEntities.length}, missing entity IDs: ${missingEntities.map(e => e.id).join(', ')}`, 500));
  }

  // DANGEROUS EXCEPTIONS GATE MOVED HERE
  const gate = unresolvedDangerousMeasurementExceptions(parseProgress(loaded.progressJson));
  if (gate.blocking) {
    return block(actor, loaded, "MEASUREMENT_EXCEPTIONS_UNRESOLVED", "tayqan.hire.workflow.measurementExceptionsUnresolved", {
      kind: "MEASUREMENT_EXCEPTIONS",
      i18nKey: "tayqan.hire.workflow.measurementExceptionsUnresolved",
    });
  }

  if (
    aiDraft.addedCount === 0
    && aiDraft.alreadyPresentCount === 0
  ) {
    return block(
      actor,
      loaded,
      "AI_DRAFT_NO_USABLE_ITEMS",
      "tayqan.hire.workflow.draftNoUsableItems",
      {
        kind: "ACTION",
        i18nKey:
          "tayqan.hire.workflow.draftNoUsableItems",
        actionHref:
          `/projects/${projectSlug}/extractions`,
      },
    );
  }

  const assembly =
    await moveStage(
      actor,
      loaded,
      TayqanWorkStage.BOQ_ASSEMBLY,
      "AI_DRAFT_BOQ_READY_FOR_REVIEW",
    );

  return block(
    actor,
    assembly,
    "AI_DRAFT_REVIEW_REQUIRED",
    "tayqan.hire.workflow.draftReadyForReview",
    {
      kind: "ACTION",
      i18nKey:
        "tayqan.hire.workflow.draftReadyForReview",
      actionHref:
        aiDraftBoqHref(
          projectSlug,
          aiDraft,
        ),
    },
  );
}

async function advanceAiDraftProfessionalReview(
  actor: CurrentActor,
  projectSlug: string,
  order: Awaited<ReturnType<typeof loadOrder>>,
) {
  if (!order.boqId) {
    throw new ConflictError(
      "TAYQAN_BOQ_REQUIRED",
      "TAYQAN needs a working BOQ before professional review.",
    );
  }

  const boq =
    await getBOQRecord(
      actor.companyId,
      order.boqId,
    );

  const aiDraftItems =
    boq.sections
      .flatMap((section) => section.items)
      .filter(
        (item) =>
          getAiDraftExtractedEntityId(
            item.sourceReference,
          ) !== null,
      );

  if (aiDraftItems.length === 0) {
    return block(
      actor,
      order,
      "AI_DRAFT_NO_USABLE_ITEMS",
      "tayqan.hire.workflow.draftNoUsableItems",
      {
        kind: "ACTION",
        i18nKey:
          "tayqan.hire.workflow.draftNoUsableItems",
        actionHref:
          `/projects/${projectSlug}/extractions`,
      },
    );
  }

  const pendingAiDraftItems =
    aiDraftItems.filter((item) => {
      const provenance =
        item.quantityProvenance;

      return (
        !provenance
        || provenance.sourceType
          === QuantityProvenanceSource
            .LEGACY_UNVERIFIED
        || provenance.confirmedAt === null
      );
    });

  const pendingQuantityCount = pendingAiDraftItems.length;

  if (pendingQuantityCount > 0) {
    return block(
      actor,
      order,
      "AI_DRAFT_REVIEW_REQUIRED",
      "tayqan.hire.workflow.draftReadyForReview",
      {
        kind: "ACTION",
        i18nKey:
          "tayqan.hire.workflow.draftReadyForReview",
        actionHref:
          aiDraftBoqHref(
            projectSlug,
            parseProgress(order.progressJson)
              .aiDraft,
          ),
        // TAYQAN-AI-DRAFT-LOOP-FIX: name which item(s), not just a count —
        // bounded the same way confirmAiDraftQuantities's skippedItems is.
        pendingItems: pendingAiDraftItems
          .slice(0, 10)
          .map((item) => ({
            id: item.id,
            itemCode: item.itemCode,
            description: item.description,
          })),
      },
    );
  }

  const remainingExtractionCount =
    await prisma.extractedEntity.count({
      where: {
        companyId: actor.companyId,
        projectId: order.projectId,
        ...sourceScopedEntityFilter(order),
        status: {
          in: [
            ExtractedEntityStatus.EXTRACTED,
            ExtractedEntityStatus.NEEDS_REVIEW,
          ],
        },
      },
    });

  if (remainingExtractionCount > 0) {
    return block(
      actor,
      order,
      "AI_DRAFT_EXCEPTIONS_REMAIN",
      "tayqan.hire.workflow.draftExceptionsRemain",
      {
        kind: "ACTION",
        i18nKey:
          "tayqan.hire.workflow.draftExceptionsRemain",
        actionHref:
          `/projects/${projectSlug}/extractions`,
      },
    );
  }

  if (order.includeRates) {
    const pendingRateCount =
      aiDraftItems.filter((item) => {
        const provenance =
          item.rateProvenance;

        return (
          !provenance
          || provenance.sourceType
            === RateProvenanceSource
              .LEGACY_UNVERIFIED
          || provenance.confirmedAt === null
        );
      }).length;

    if (pendingRateCount > 0) {
      return block(
        actor,
        order,
        "AI_DRAFT_RATES_REMAIN",
        "tayqan.hire.workflow.draftRatesRemain",
        {
          kind: "ACTION",
          i18nKey:
            "tayqan.hire.workflow.draftRatesRemain",
          actionHref:
            aiDraftBoqHref(
              projectSlug,
              parseProgress(order.progressJson)
                .aiDraft,
            ),
        },
      );
    }
  }

  const next =
    await moveStage(
      actor,
      order,
      TayqanWorkStage.VALIDATION,
      "AI_DRAFT_PROFESSIONAL_REVIEW_COMPLETE",
    );

  return advanceValidation(
    actor,
    projectSlug,
    next,
  );
}

async function advanceEvidenceReview(
  actor: CurrentActor,
  projectSlug: string,
  order: Awaited<ReturnType<typeof loadOrder>>,
) {
  const sourceFilter =
    sourceScopedEntityFilter(order);

  const reviewable =
    await prisma.extractedEntity.findFirst({
      where: {
        companyId: actor.companyId,
        projectId: order.projectId,

        ...sourceFilter,

        status: {
          in: [
            ExtractedEntityStatus.EXTRACTED,
            ExtractedEntityStatus.NEEDS_REVIEW,
          ],
        },
      },

      orderBy: {
        createdAt: "asc",
      },
    });

  if (reviewable) {
    return block(
      actor,
      order,
      "EVIDENCE_REVIEW_REQUIRED",
      "tayqan.hire.workflow.reviewEvidence",
      {
        kind: "ENTITY_REVIEW",
        i18nKey:
          "tayqan.hire.workflow.reviewEvidence",
        entity:
          entityBlocker(reviewable),
      },
    );
  }

  const usableCount =
    await prisma.extractedEntity.count({
      where: {
        companyId: actor.companyId,
        projectId: order.projectId,

        ...sourceFilter,

        status: {
          in: [
            ExtractedEntityStatus.CONFIRMED,
            ExtractedEntityStatus.CORRECTED,
            ExtractedEntityStatus.IMPORTED,
          ],
        },
      },
    });

  if (usableCount === 0) {
    return block(
      actor,
      order,
      "NO_CONFIRMED_EVIDENCE",
      "tayqan.hire.workflow.noEvidence",
      {
        kind: "ACTION",
        i18nKey:
          "tayqan.hire.workflow.noEvidence",
        actionHref:
          `/projects/${projectSlug}/files`,
      },
    );
  }

  const next =
    await moveStage(
      actor,
      order,
      TayqanWorkStage
        .QUANTITY_PREPARATION,
      "EVIDENCE_REVIEW_COMPLETE",
    );

  return advanceQuantityPreparation(
    actor,
    projectSlug,
    next,
  );
}

async function activeEvidence(
  actor: CurrentActor,
  order: Awaited<ReturnType<typeof loadOrder>>,
) {
  const sourceFilter =
    sourceScopedEntityFilter(order);

  return prisma.extractedEntity.findMany({
    where: {
      companyId: actor.companyId,
      projectId: order.projectId,

      ...sourceFilter,

      status: {
        in: [
          ExtractedEntityStatus.CONFIRMED,
          ExtractedEntityStatus.CORRECTED,
        ],
      },
    },

    orderBy: {
      createdAt: "asc",
    },
  });
}

async function advanceQuantityPreparation(actor: CurrentActor, projectSlug: string, order: Awaited<ReturnType<typeof loadOrder>>) {
  const progress = parseProgress(order.progressJson);
  const entities = await activeEvidence(actor, order);
  let nextProgress = progress;
  for (const entity of entities) {
    const confirmedCalculation = await prisma.quantityCalculation.findFirst({
      where: { companyId: actor.companyId, projectId: order.projectId, extractedEntityId: entity.id, status: "CONFIRMED" },
      orderBy: { updatedAt: "desc" },
    });
    if (confirmedCalculation) continue;
    if (nextProgress.quantityOverrides?.[entity.id]) continue;
    if (!entity.quantity || !entity.unit) {
      return block(actor, order, "QUANTITY_REQUIRED", "tayqan.hire.workflow.quantityRequired", {
        kind: "QUANTITY_REQUIRED",
        i18nKey: "tayqan.hire.workflow.quantityRequired",
        entity: entityBlocker(entity),
      });
    }
    // PR1 mission 1: raw entity.quantity/entity.unit alone is extraction
    // output, never a genuine measurement. It no longer silently satisfies
    // quantity preparation — it becomes a visible, gating SCOPE_GAP
    // exception (mission 2) instead of a fabricated BOQ row.
    nextProgress = withMeasurementException(nextProgress, {
      kind: "SCOPE_GAP",
      message: `TAYQAN found no confirmed quantity calculation or professional override for "${entity.label}". Raw extracted values alone are not a genuine measurement.`,
      pageIds: [],
      relatedEntityId: entity.id,
    });
  }

  if (nextProgress !== progress) {
    await prisma.tayqanWorkOrder.update({ where: { id: order.id }, data: { progressJson: jsonObject(nextProgress) } });
  }

  const gate = unresolvedDangerousMeasurementExceptions(nextProgress);
  if (gate.blocking) {
    return block(actor, order, "MEASUREMENT_EXCEPTIONS_UNRESOLVED", "tayqan.hire.workflow.measurementExceptionsUnresolved", {
      kind: "MEASUREMENT_EXCEPTIONS",
      i18nKey: "tayqan.hire.workflow.measurementExceptionsUnresolved",
    });
  }

  const nextStage = order.includeRates ? TayqanWorkStage.RATE_PREPARATION : TayqanWorkStage.BOQ_ASSEMBLY;
  const next = await moveStage(actor, order, nextStage, "QUANTITY_PREPARATION_COMPLETE");
  return order.includeRates
    ? advanceRatePreparation(actor, projectSlug, next)
    : advanceBoqAssembly(actor, projectSlug, next);
}

async function resolvedRate(
  actor: CurrentActor,
  order: Awaited<ReturnType<typeof loadOrder>>,
  entity: {
    matchedCatalogueItemId: string | null;
  },
  progress: WorkProgress,
  entityId: string,
) {
  const override =
    progress.rateOverrides?.[entityId];

  if (override) {
    return {
      unitCost: override.unitCost,
      sourceNote: override.sourceNote,
    };
  }

  if (
    !pricingBasisAllowsMatchedCatalogue(
      order,
    )
  ) {
    return null;
  }

  if (!entity.matchedCatalogueItemId) {
    return null;
  }
  const rate = await prisma.rateCatalogueItem.findFirst({
    where: {
      id: entity.matchedCatalogueItemId,
      companyId: actor.companyId,
      status: "ACTIVE",
      OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
    },
  });
  if (!rate) return null;
  return {
    unitCost: rate.sellingRate.toNumber(),
    sourceNote: rate.sourceReference || rate.supplierQuotationReference || `Rate catalogue ${rate.itemCode}`,
  };
}

async function advanceRatePreparation(actor: CurrentActor, projectSlug: string, order: Awaited<ReturnType<typeof loadOrder>>) {
  const progress = parseProgress(order.progressJson);
  const entities = await activeEvidence(actor, order);
  for (const entity of entities) {
    const rate =
      await resolvedRate(
        actor,
        order,
        entity,
        progress,
        entity.id,
      );
    if (rate) continue;
    return block(actor, order, "RATE_REQUIRED", "tayqan.hire.workflow.rateRequired", {
      kind: "RATE_REQUIRED",
      i18nKey: "tayqan.hire.workflow.rateRequired",
      entity: entityBlocker(entity),
    });
  }
  const next = await moveStage(actor, order, TayqanWorkStage.BOQ_ASSEMBLY, "RATE_PREPARATION_COMPLETE");
  return advanceBoqAssembly(actor, projectSlug, next);
}

async function getOrCreateTayqanSection(actor: CurrentActor, boqId: string) {
  const code = "TAYQAN";
  const existing = await prisma.bOQSection.findFirst({ where: { boqId, companyId: actor.companyId, code } });
  if (existing) return existing;
  const last = await prisma.bOQSection.findFirst({ where: { boqId, companyId: actor.companyId }, orderBy: { sortOrder: "desc" } });
  try {
    return await prisma.bOQSection.create({
      data: {
        companyId: actor.companyId,
        boqId,
        code,
        title: "TAYQAN Working Items",
        description: "Items assembled by TAYQAN from reviewed project evidence. Final professional acceptance is still required.",
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const raced = await prisma.bOQSection.findFirst({ where: { boqId, companyId: actor.companyId, code } });
    if (!raced) throw error;
    return raced;
  }
}

/**
 * PR1 mission 1: raw entity.quantity/entity.unit alone is no longer a valid
 * resolution — only a CONFIRMED QuantityCalculation or an explicit human
 * quantityOverrides entry counts as a genuine quantity source. Returns null
 * (never fabricates) when neither exists; advanceBoqAssembly's caller must
 * skip the entity rather than import a bare-extraction row.
 */
async function resolveQuantity(actor: CurrentActor, order: Awaited<ReturnType<typeof loadOrder>>, entity: Awaited<ReturnType<typeof activeEvidence>>[number], progress: WorkProgress) {
  const calculation = await prisma.quantityCalculation.findFirst({
    where: { companyId: actor.companyId, projectId: order.projectId, extractedEntityId: entity.id, status: "CONFIRMED" },
    orderBy: { updatedAt: "desc" },
  });
  if (calculation) return { quantity: calculation.resultValue.toNumber(), unit: calculation.resultUnit, calculationId: calculation.id };
  const override = progress.quantityOverrides?.[entity.id];
  if (override) return { quantity: override.quantity, unit: override.unit, calculationId: undefined };
  return null;
}

async function advanceBoqAssembly(actor: CurrentActor, projectSlug: string, order: Awaited<ReturnType<typeof loadOrder>>) {
  // PR1 mission 2: real exception gate before BOQ_ASSEMBLY too — defense in
  // depth alongside the gate in advanceQuantityPreparation, in case this
  // stage is ever re-entered directly (e.g. RATE_PREPARATION -> here) after
  // a dangerous exception appeared.
  const gate = unresolvedDangerousMeasurementExceptions(parseProgress(order.progressJson));
  if (gate.blocking) {
    return block(actor, order, "MEASUREMENT_EXCEPTIONS_UNRESOLVED", "tayqan.hire.workflow.measurementExceptionsUnresolved", {
      kind: "MEASUREMENT_EXCEPTIONS",
      i18nKey: "tayqan.hire.workflow.measurementExceptionsUnresolved",
    });
  }

  const boqId = await ensureWorkingBoq(actor, projectSlug, order);
  const section = await getOrCreateTayqanSection(actor, boqId);
  const progress = parseProgress(order.progressJson);
  const entities = await activeEvidence(actor, order);

  for (const entity of entities) {
    const alreadyImported = await prisma.bOQItemQuantityProvenance.findFirst({
      where: { companyId: actor.companyId, projectId: order.projectId, extractedEntityId: entity.id },
      select: { boqItemId: true },
    });
    if (alreadyImported) continue;

    const quantity = await resolveQuantity(actor, order, entity, progress);
    if (!quantity) {
      // Should not normally be reached — the QUANTITY_PREPARATION gate
      // already stops ungrounded entities here — but never fabricate or
      // crash the whole assembly loop over one still-ungrounded item.
      continue;
    }
    const rate =
      order.includeRates
        ? await resolvedRate(
            actor,
            order,
            entity,
            progress,
            entity.id,
          )
        : null;
    if (order.includeRates && !rate) throw new ConflictError("RATE_REQUIRED", "A reviewed rate is required before BOQ assembly.");
    const max = await prisma.bOQItem.aggregate({
      where: { sectionId: section.id },
      _max: { itemNumber: true },
    });
    await importExtractedEntityToBoq(
      actor,
      boqId,
      entity.id,
      {
        sectionId: section.id,
        itemNumber: (max._max.itemNumber ?? 0) + 1,
        itemCode: entity.categoryKey || `TQ-${entity.id.slice(0, 8).toUpperCase()}`,
        category: entity.entityType,
        description: entity.label,
        specification: entity.sourceText || "",
        unit: quantity.unit,
        quantity: quantity.quantity,
        unitCost: rate?.unitCost ?? 0,
        marginPercentage: 0,
        ...(quantity.calculationId ? { quantityCalculationId: quantity.calculationId } : {}),
      },
      { id: order.projectId },
    );
    await appendWorkEvent(actor.companyId, order.id, order.stage, "EVIDENCE_IMPORTED_TO_BOQ", {
      entityId: entity.id,
      boqId,
      quantity: quantity.quantity,
      unit: quantity.unit,
      rateSource: rate?.sourceNote ?? "QUANTITIES_ONLY",
    });
  }

  const next = await moveStage(actor, await loadOrder(actor.companyId, order.id), TayqanWorkStage.VALIDATION, "BOQ_ASSEMBLY_COMPLETE");
  return advanceValidation(actor, projectSlug, next);
}

async function advanceValidation(actor: CurrentActor, _projectSlug: string, order: Awaited<ReturnType<typeof loadOrder>>) {
  // PR1 mission 2: real exception gate before final QA too — mirrors the
  // gate in prepareTayqanAiDraft. A dangerous exception discovered (or left
  // unresolved) after the BOQ was assembled must still block advancement
  // into/through final QA, not just the earlier assembly gates.
  const gate = unresolvedDangerousMeasurementExceptions(parseProgress(order.progressJson));
  if (gate.blocking) {
    return block(actor, order, "MEASUREMENT_EXCEPTIONS_UNRESOLVED", "tayqan.hire.workflow.measurementExceptionsUnresolved", {
      kind: "MEASUREMENT_EXCEPTIONS",
      i18nKey: "tayqan.hire.workflow.measurementExceptionsUnresolved",
    });
  }

  if (!order.boqId) throw new ConflictError("TAYQAN_BOQ_REQUIRED", "TAYQAN needs a working BOQ before final QA.");
  const boq = await prisma.bOQ.findFirst({ where: { id: order.boqId, companyId: actor.companyId } });
  if (!boq) throw new NotFoundError("TAYQAN working BOQ not found.");

  let qaRunId = order.qaWorkerRunId;
  if (qaRunId) {
    // PR1 mission 4: never trust an existing QA run without first checking
    // it still reviewed the CURRENT BOQ. If the BOQ changed since this run
    // was enqueued, the result is stale — drop it and re-enqueue fresh
    // against the current version rather than accepting stale QA.
    const existingRun = await getWorkerRunForCompany(actor.companyId, qaRunId);
    if (existingRun.source.boqVersion !== boq.version || existingRun.source.revisionNumber !== boq.revisionNumber) {
      await updateOrder(actor, order.id, { qaWorkerRunId: null }, "FINAL_QA_INVALIDATED_STALE_BOQ", {
        previousQaWorkerRunId: qaRunId,
        qaReviewedBoqVersion: existingRun.source.boqVersion,
        qaReviewedRevisionNumber: existingRun.source.revisionNumber,
        currentBoqVersion: boq.version,
        currentRevisionNumber: boq.revisionNumber,
      });
      await persistConversationStatus(actor.companyId, order.intakeSessionId, "tayqan.hire.workflow.finalQaStaleBoqChanged");
      qaRunId = null;
    }
  }

  if (!qaRunId) {
    const run = await enqueueWorkerReview(
      actor,
      order.boqId,
      `tayqan-work-order:${order.id}:qa:v${boq.version}`,
      process.env,
      {
        assignmentObjective:
          "Final governed QA for the paid TAYQAN work order before human acceptance.",

        specialInstructions:
          governingQaInstructions(order),
      },
    );
    qaRunId = run.id;
    await updateOrder(actor, order.id, { qaWorkerRunId: qaRunId }, "FINAL_QA_ENQUEUED", { qaWorkerRunId: qaRunId });
    await persistConversationStatus(actor.companyId, order.intakeSessionId, "tayqan.hire.workflow.finalQaRunning");
    return toState(await loadOrder(actor.companyId, order.id));
  }

  const run = await getWorkerRunForCompany(actor.companyId, qaRunId);
  if (run.status === WorkerRunStatus.QUEUED || run.status === WorkerRunStatus.RUNNING) {
    return toState(await loadOrder(actor.companyId, order.id));
  }
  if (run.status !== WorkerRunStatus.COMPLETED || !run.resultAssignment) {
    return block(actor, order, "FINAL_QA_FAILED", "tayqan.hire.workflow.finalQaFailed", {
      kind: "ERROR",
      i18nKey: "tayqan.hire.workflow.finalQaFailed",
    });
  }

  const assignment = await getWorkerAssignmentWorkspace(actor.companyId, run.resultAssignment.id);
  const openQuestions = assignment.materialQuestions.filter((question) => {
    if (question.status !== "OPEN") return false;
    if (!order.includeRates && TAYQAN_RATE_QUESTION_TYPES.has(question.questionType)) return false;
    return true;
  });
  const question = openQuestions[0];
  if (question) {
    return block(actor, order, "FINAL_QA_NEEDS_INPUT", "tayqan.hire.workflow.qaQuestion", {
      kind: "QA_QUESTION",
      i18nKey: "tayqan.hire.workflow.qaQuestion",
      qa: {
        assignmentId: assignment.id,
        questionId: question.id,
        questionType: question.questionType,
        prompt: question.prompt,
        whyMaterial: question.whyMaterial,
        recommendedAction: question.recommendedAction,
      },
    });
  }

  // PR1 mission 5: reaching READY_FOR_ACCEPTANCE means "ready for a human to
  // review and decide" — it is NOT completion. The work order's completedAt
  // and the intake session's own completion status are set only by explicit
  // acceptance (see acceptTayqanWorkOrderDeliverable below), never as a side
  // effect of QA passing.
  await updateOrder(
    actor,
    order.id,
    {
      status: TayqanWorkStatus.READY_FOR_ACCEPTANCE,
      stage: TayqanWorkStage.READY_FOR_ACCEPTANCE,
      blockerCode: null,
      blockerMessage: null,
      blockerJson: Prisma.DbNull,
      lastAdvancedAt: new Date(),
    },
    "READY_FOR_ACCEPTANCE",
    { boqId: order.boqId, qaWorkerRunId: qaRunId },
  );
  await persistConversationStatus(actor.companyId, order.intakeSessionId, "tayqan.hire.workflow.readyForAcceptance");
  return toState(await loadOrder(actor.companyId, order.id));
}

export async function advanceTayqanWorkOrder(actor: CurrentActor, projectIdentifier: string, orderId: string) {
  await assertTayqanAccessEntitlement(actor);
  const project = await getProjectRecord(actor.companyId, projectIdentifier);
  let order = await loadOrder(actor.companyId, orderId);
  if (order.projectId !== project.id) throw new AppError("TAYQAN_WORK_PROJECT_MISMATCH", "This TAYQAN work order belongs to another project.", 403);
  if (order.status === TayqanWorkStatus.READY_FOR_ACCEPTANCE || order.status === TayqanWorkStatus.COMPLETED) return toState(order);
  if (order.status === TayqanWorkStatus.FAILED || order.status === TayqanWorkStatus.CANCELLED) return toState(order);
  if (order.status === TayqanWorkStatus.NEEDS_INPUT) return toState(order);

  switch (order.stage) {
    case TayqanWorkStage.SOURCE_DISCOVERY:
      return advanceSourceDiscovery(actor, project.slug, order);
    case TayqanWorkStage.SOURCE_PROCESSING:
      return advanceSourceProcessing(actor, project.slug, order);
    case TayqanWorkStage.EVIDENCE_REVIEW:
      if (
        usesDraftFirstWorkflow(order)
        && !parseProgress(order.progressJson)
          .aiDraft
      ) {
        return prepareTayqanAiDraft(
          actor,
          project.slug,
          order,
        );
      }
      return advanceEvidenceReview(actor, project.slug, order);
    case TayqanWorkStage.QUANTITY_PREPARATION:
      return advanceQuantityPreparation(actor, project.slug, order);
    case TayqanWorkStage.RATE_PREPARATION:
      return advanceRatePreparation(actor, project.slug, order);
    case TayqanWorkStage.BOQ_ASSEMBLY:
      if (
        parseProgress(order.progressJson)
          .aiDraft
      ) {
        return advanceAiDraftProfessionalReview(
          actor,
          project.slug,
          order,
        );
      }
      return advanceBoqAssembly(actor, project.slug, order);
    case TayqanWorkStage.VALIDATION:
      return advanceValidation(actor, project.slug, order);
    case TayqanWorkStage.READY_FOR_ACCEPTANCE:
      return toState(order);
    default:
      throw new AppError("TAYQAN_WORK_STAGE_INVALID", "TAYQAN work order is in an unsupported stage.", 500);
  }
}

export async function getTayqanWorkOrderState(actor: CurrentActor, projectIdentifier: string, sessionId: string) {
  const project = await getProjectRecord(actor.companyId, projectIdentifier);
  const order = await prisma.tayqanWorkOrder.findFirst({ where: { companyId: actor.companyId, projectId: project.id, intakeSessionId: sessionId } });
  return order ? toState(await loadOrder(actor.companyId, order.id)) : null;
}

function mergeProgress(progress: WorkProgress, patch: WorkProgress): WorkProgress {
  return {
    ...progress,
    ...patch,
    quantityOverrides: { ...(progress.quantityOverrides ?? {}), ...(patch.quantityOverrides ?? {}) },
    rateOverrides: { ...(progress.rateOverrides ?? {}), ...(patch.rateOverrides ?? {}) },
  };
}

/**
 * PR1 mission 3: governed, audited resolution for a single measurement
 * exception. Never a silent status flip — requires a written reason and
 * records actor identity + timestamp as a durable TayqanWorkEvent, using the
 * existing progressJson/TayqanWorkEvent pattern (no new Prisma fields).
 * Reachable even when the work order isn't currently blocked on this
 * specific exception, since exceptions are always visible via
 * toState().measurementExceptions, not only while actively blocking.
 */
async function resolveTayqanMeasurementException(
  actor: CurrentActor,
  projectSlug: string,
  order: Awaited<ReturnType<typeof loadOrder>>,
  input: { exceptionKey?: string; note?: string },
) {
  const progress = parseProgress(order.progressJson);
  const exceptionKey = input.exceptionKey?.trim();
  const reason = input.note?.trim();
  if (!exceptionKey) {
    throw new AppError("TAYQAN_EXCEPTION_KEY_REQUIRED", "A measurement exception key is required.", 400);
  }
  if (!reason) {
    throw new AppError("TAYQAN_EXCEPTION_REASON_REQUIRED", "A written professional reason is required to resolve a TAYQAN measurement exception.", 400);
  }
  const exception = (progress.measurementExceptions ?? []).find((item) => item.key === exceptionKey);
  if (!exception) {
    throw new NotFoundError("TAYQAN measurement exception not found in the current ledger.");
  }
  if (progress.measurementExceptionResolutions?.[exceptionKey]) {
    throw new ConflictError("TAYQAN_EXCEPTION_ALREADY_RESOLVED", "This measurement exception has already been resolved.");
  }

  const resolvedAt = new Date();
  const nextProgress: WorkProgress = {
    ...progress,
    measurementExceptionResolutions: {
      ...(progress.measurementExceptionResolutions ?? {}),
      [exceptionKey]: { reason, actorUserId: actor.userId, actorName: actor.fullName, resolvedAt: resolvedAt.toISOString() },
    },
  };
  await prisma.tayqanWorkOrder.update({ where: { id: order.id }, data: { progressJson: jsonObject(nextProgress) } });
  await appendWorkEvent(actor.companyId, order.id, order.stage, "TAYQAN_MEASUREMENT_EXCEPTION_RESOLVED", {
    exceptionKey,
    kind: exception.kind,
    reason,
    actorUserId: actor.userId,
    actorName: actor.fullName,
    resolvedAt: resolvedAt.toISOString(),
  });
  await prisma.tayqanIntakeMessage.create({
    data: {
      companyId: actor.companyId,
      sessionId: order.intakeSessionId,
      role: TayqanIntakeMessageRole.USER,
      message: reason,
      structuredDataJson: jsonObject({ kind: "MEASUREMENT_EXCEPTION_RESOLVED", exceptionKey, exceptionKind: exception.kind }),
    },
  });

  const reloaded = await loadOrder(actor.companyId, order.id);
  const blocker = blockerFromJson(reloaded.blockerJson);
  if (reloaded.status === TayqanWorkStatus.NEEDS_INPUT && blocker?.kind === "MEASUREMENT_EXCEPTIONS") {
    const gate = unresolvedDangerousMeasurementExceptions(parseProgress(reloaded.progressJson));
    if (!gate.blocking) {
      await updateOrder(actor, reloaded.id, {
        status: TayqanWorkStatus.RUNNING,
        blockerCode: null,
        blockerMessage: null,
        blockerJson: Prisma.DbNull,
        lastAdvancedAt: new Date(),
      }, "WORK_BLOCKER_RESOLVED", { action: "RESOLVE_MEASUREMENT_EXCEPTION" });
      const running = await loadOrder(actor.companyId, reloaded.id);
      return advanceTayqanWorkOrder(actor, projectSlug, running.id);
    }
  }
  return toState(reloaded);
}

export async function answerTayqanWorkOrderBlocker(
  actor: CurrentActor,
  projectIdentifier: string,
  input: {
    workOrderId: string;
    action: "CONFIRM_ENTITY" | "CORRECT_ENTITY" | "REJECT_ENTITY" | "SET_QUANTITY" | "SET_RATE" | "ANSWER_QA" | "RETRY" | "RESOLVE_MEASUREMENT_EXCEPTION";
    entityId?: string;
    quantity?: number;
    unit?: string;
    unitCost?: number;
    note?: string;
    label?: string;
    qaAnswerType?: "ACKNOWLEDGED" | "WILL_CORRECT_SOURCE" | "EXPLAINED_WITH_NOTE";
    exceptionKey?: string;
  },
) {
  await assertTayqanAccessEntitlement(actor);
  const project = await getProjectRecord(actor.companyId, projectIdentifier);
  let order = await loadOrder(actor.companyId, input.workOrderId);
  if (order.projectId !== project.id) throw new AppError("TAYQAN_WORK_PROJECT_MISMATCH", "This work order belongs to another project.", 403);

  if (input.action === "RESOLVE_MEASUREMENT_EXCEPTION") {
    return resolveTayqanMeasurementException(actor, project.slug, order, input);
  }

  if (order.status !== TayqanWorkStatus.NEEDS_INPUT && input.action !== "RETRY") {
    throw new ConflictError("TAYQAN_WORK_NOT_WAITING", "TAYQAN is not waiting for this answer.");
  }
  const blocker = blockerFromJson(order.blockerJson);
  const progress = parseProgress(order.progressJson);

  if (input.action === "CONFIRM_ENTITY") {
    if (!blocker?.entity?.id) throw new ConflictError("TAYQAN_BLOCKER_CHANGED", "The current TAYQAN blocker is not an evidence review.");
    await confirmExtractedEntity(actor, blocker.entity.id);
  } else if (input.action === "CORRECT_ENTITY") {
    if (!blocker?.entity?.id) throw new ConflictError("TAYQAN_BLOCKER_CHANGED", "The current TAYQAN blocker is not an evidence review.");
    await correctExtractedEntity(actor, blocker.entity.id, {
      ...(input.label ? { label: input.label } : {}),
      ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
      ...(input.unit ? { unit: input.unit } : {}),
      reason: input.note?.trim() || "Corrected during the TAYQAN paid work-order review.",
    });
  } else if (input.action === "REJECT_ENTITY") {
    if (!blocker?.entity?.id) throw new ConflictError("TAYQAN_BLOCKER_CHANGED", "The current TAYQAN blocker is not an evidence review.");
    await rejectExtractedEntity(actor, blocker.entity.id, input.note?.trim() || "Rejected during TAYQAN review.");
  } else if (input.action === "SET_QUANTITY") {
    const entityId = blocker?.entity?.id;
    if (!entityId || !(input.quantity !== undefined && input.quantity >= 0) || !input.unit?.trim()) {
      throw new AppError("TAYQAN_QUANTITY_INPUT_INVALID", "Quantity and unit are required.", 400);
    }
    const next = mergeProgress(progress, { quantityOverrides: { [entityId]: { quantity: input.quantity, unit: input.unit.trim(), note: input.note?.trim() || "User-confirmed in TAYQAN conversation." } } });
    await prisma.tayqanWorkOrder.update({ where: { id: order.id }, data: { progressJson: jsonObject(next) } });
  } else if (input.action === "SET_RATE") {
    const entityId = blocker?.entity?.id;
    if (!entityId || !(input.unitCost !== undefined && input.unitCost >= 0)) {
      throw new AppError("TAYQAN_RATE_INPUT_INVALID", "A valid unit cost is required.", 400);
    }
    const next = mergeProgress(progress, { rateOverrides: { [entityId]: { unitCost: input.unitCost, sourceNote: input.note?.trim() || "User-confirmed rate in TAYQAN conversation." } } });
    await prisma.tayqanWorkOrder.update({ where: { id: order.id }, data: { progressJson: jsonObject(next) } });
  } else if (input.action === "ANSWER_QA") {
    if (!blocker?.qa) throw new ConflictError("TAYQAN_BLOCKER_CHANGED", "The current blocker is not a QA question.");
    const { answerWorkerMaterialQuestion } = await import("@/lib/services/worker-review-service");
    await answerWorkerMaterialQuestion(actor, blocker.qa.assignmentId, blocker.qa.questionId, {
      answerType: input.qaAnswerType ?? "EXPLAINED_WITH_NOTE",
      note: input.note?.trim() || "Answered through the TAYQAN paid work-order conversation.",
    });
  } else if (input.action !== "RETRY") {
    throw new AppError("TAYQAN_WORK_ACTION_INVALID", "Unsupported TAYQAN work-order action.", 400);
  }

  await prisma.tayqanIntakeMessage.create({
    data: {
      companyId: actor.companyId,
      sessionId: order.intakeSessionId,
      role: TayqanIntakeMessageRole.USER,
      message: input.note?.trim() || input.action,
      structuredDataJson: jsonObject({ kind: "WORK_ANSWER", action: input.action, entityId: input.entityId ?? blocker?.entity?.id ?? null }),
    },
  });
  await updateOrder(actor, order.id, {
    status: TayqanWorkStatus.RUNNING,
    blockerCode: null,
    blockerMessage: null,
    blockerJson: Prisma.DbNull,
    lastAdvancedAt: new Date(),
  }, "WORK_BLOCKER_RESOLVED", { action: input.action });
  order = await loadOrder(actor.companyId, order.id);
  return advanceTayqanWorkOrder(actor, project.slug, order.id);
}

/**
 * PR1 mission 5: explicit final professional acceptance of TAYQAN's
 * deliverable. Deliberately NOT equivalent to locking, issuing, approving,
 * or certifying the BOQ — this route only records that a human engineer
 * reviewed and accepted TAYQAN's work at a specific, verified BOQ version.
 * BOQ.status/locked/verifiedVersion are never touched here.
 */
export async function acceptTayqanWorkOrderDeliverable(
  actor: CurrentActor,
  projectIdentifier: string,
  workOrderId: string,
) {
  await assertTayqanAccessEntitlement(actor);
  const project = await getProjectRecord(actor.companyId, projectIdentifier);
  const order = await loadOrder(actor.companyId, workOrderId);
  if (order.projectId !== project.id) {
    throw new AppError("TAYQAN_WORK_PROJECT_MISMATCH", "This work order belongs to another project.", 403);
  }
  if (order.status !== TayqanWorkStatus.READY_FOR_ACCEPTANCE) {
    throw new ConflictError("TAYQAN_NOT_READY_FOR_ACCEPTANCE", "TAYQAN's deliverable is not yet ready for professional acceptance.");
  }
  if (!order.boqId) {
    throw new ConflictError("TAYQAN_BOQ_REQUIRED", "TAYQAN needs a working BOQ before acceptance.");
  }
  if (!order.qaWorkerRunId) {
    throw new ConflictError("TAYQAN_FINAL_QA_REQUIRED", "TAYQAN's final QA has not run for this work order.");
  }

  const gate = unresolvedDangerousMeasurementExceptions(parseProgress(order.progressJson));
  if (gate.blocking) {
    throw new ConflictError("TAYQAN_MEASUREMENT_EXCEPTIONS_UNRESOLVED", "Unresolved TAYQAN measurement exceptions remain; acceptance is blocked.");
  }

  const boq = await prisma.bOQ.findFirst({ where: { id: order.boqId, companyId: actor.companyId } });
  if (!boq) throw new NotFoundError("TAYQAN working BOQ not found.");

  const run = await getWorkerRunForCompany(actor.companyId, order.qaWorkerRunId);
  if (run.status !== WorkerRunStatus.COMPLETED || !run.resultAssignment) {
    throw new ConflictError("TAYQAN_FINAL_QA_NOT_COMPLETE", "TAYQAN's final QA has not completed successfully.");
  }
  // PR1 mission 5: re-check freshness at the moment of acceptance, not just
  // at the earlier READY_FOR_ACCEPTANCE transition — the BOQ could have
  // changed in between.
  if (run.source.boqVersion !== boq.version || run.source.revisionNumber !== boq.revisionNumber) {
    throw new ConflictError(
      "TAYQAN_FINAL_QA_STALE",
      "The BOQ changed after final QA reviewed it. Re-run final QA against the current BOQ before accepting.",
    );
  }

  const acceptedAt = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.tayqanDeliverableAcceptance.create({
        data: {
          companyId: actor.companyId,
          projectId: order.projectId,
          boqId: order.boqId!,
          workOrderId: order.id,
          boqVersion: boq.version,
          boqRevisionNumber: boq.revisionNumber,
          qaWorkerRunId: order.qaWorkerRunId!,
          acceptedByUserId: actor.userId,
          acceptedByName: actor.fullName,
          acceptedAt,
        },
      });
      await tx.tayqanWorkOrder.update({
        where: { id: order.id },
        data: { status: TayqanWorkStatus.COMPLETED, completedAt: acceptedAt, lastAdvancedAt: acceptedAt },
      });
      await tx.tayqanIntakeSession.update({
        where: { id: order.intakeSessionId },
        data: { status: TayqanIntakeStatus.COMPLETED, completedAt: acceptedAt },
      });
      await tx.tayqanWorkEvent.create({
        data: {
          companyId: actor.companyId,
          workOrderId: order.id,
          stage: order.stage,
          eventType: "TAYQAN_DELIVERABLE_ACCEPTED",
          payloadJson: jsonObject({
            workOrderId: order.id,
            boqId: order.boqId,
            boqVersion: boq.version,
            revisionNumber: boq.revisionNumber,
            qaWorkerRunId: order.qaWorkerRunId,
            acceptedByUserId: actor.userId,
            acceptedByName: actor.fullName,
            acceptedAt: acceptedAt.toISOString(),
          }),
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("TAYQAN_ALREADY_ACCEPTED", "This TAYQAN deliverable has already been accepted.");
    }
    throw error;
  }

  await persistConversationStatus(actor.companyId, order.intakeSessionId, "tayqan.hire.workflow.deliverableAccepted");
  return toState(await loadOrder(actor.companyId, order.id));
}
