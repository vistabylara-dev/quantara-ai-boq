import { randomUUID } from "node:crypto";
import {
  Prisma,
  VerificationSeverity,
  WorkerAssignmentStatus,
  WorkerAssignmentType,
  WorkerEventType,
  WorkerMaterialQuestionStatus,
} from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import {
  inspectExistingBOQ,
  REVIEW_EXISTING_BOQ_INSPECTION_VERSION,
} from "@/lib/worker/review-existing-boq";

const workerAssignmentInclude = {
  workspace: true,
  decisions: { orderBy: { sequenceNumber: "asc" } },
  materialQuestions: { orderBy: { createdAt: "asc" } },
  events: { orderBy: { sequenceNumber: "asc" } },
} satisfies Prisma.WorkerAssignmentInclude;

export type WorkerAssignmentRecord = Prisma.WorkerAssignmentGetPayload<{
  include: typeof workerAssignmentInclude;
}>;

function assignmentDTO(assignment: WorkerAssignmentRecord) {
  return {
    id: assignment.id,
    assignmentType: assignment.assignmentType,
    status: assignment.status,
    companyId: assignment.companyId,
    projectId: assignment.projectId,
    boqId: assignment.boqId,
    inspectionVersion: assignment.inspectionVersion,
    inspectionAsOf: assignment.inspectionAsOf.toISOString(),
    source: {
      boqVersion: assignment.sourceBoqVersion,
      verifiedVersion: assignment.sourceVerifiedVersion,
      revisionNumber: assignment.sourceRevisionNumber,
    },
    requestedBy: {
      userId: assignment.requestedByUserId,
      name: assignment.requestedByName,
    },
    startedAt: assignment.startedAt.toISOString(),
    completedAt: assignment.completedAt?.toISOString() ?? null,
    failure: assignment.failureCode
      ? { code: assignment.failureCode, message: assignment.failureMessage }
      : null,
    workspace: assignment.workspace
      ? {
          conclusion: assignment.workspace.conclusion,
          sectionCount: assignment.workspace.sectionCount,
          itemCount: assignment.workspace.itemCount,
          activeItemCount: assignment.workspace.activeItemCount,
          confirmedQuantityCount: assignment.workspace.confirmedQuantityCount,
          confirmedRateCount: assignment.workspace.confirmedRateCount,
          unresolvedCriticalCount: assignment.workspace.unresolvedCriticalCount,
          unresolvedWarningCount: assignment.workspace.unresolvedWarningCount,
          revisionEvidenceCount: assignment.workspace.revisionEvidenceCount,
          summary: assignment.workspace.summaryJson,
          items: assignment.workspace.itemsJson,
          capturedAt: assignment.workspace.createdAt.toISOString(),
        }
      : null,
    decisions: assignment.decisions.map((decision) => ({
      id: decision.id,
      sequenceNumber: decision.sequenceNumber,
      code: decision.code,
      outcome: decision.outcome,
      severity: decision.severity,
      subjectType: decision.subjectType,
      subjectId: decision.subjectId,
      summary: decision.summary,
      rationale: decision.rationaleJson,
      evidenceRefs: decision.evidenceRefsJson,
      createdAt: decision.createdAt.toISOString(),
    })),
    materialQuestions: assignment.materialQuestions.map((question) => ({
      id: question.id,
      decisionId: question.decisionId,
      questionType: question.questionType,
      status: question.status,
      subjectType: question.subjectType,
      subjectId: question.subjectId,
      prompt: question.prompt,
      whyMaterial: question.whyMaterial,
      recommendedAction: question.recommendedAction,
      answer: question.answerJson,
      answeredByUserId: question.answeredByUserId,
      answeredAt: question.answeredAt?.toISOString() ?? null,
      createdAt: question.createdAt.toISOString(),
    })),
    events: assignment.events.map((event) => ({
      id: event.id,
      sequenceNumber: event.sequenceNumber,
      eventType: event.eventType,
      payload: event.payloadJson,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export async function getWorkerAssignmentRecord(
  companyId: string,
  assignmentId: string,
  db: typeof prisma | Prisma.TransactionClient = prisma,
) {
  const assignment = await db.workerAssignment.findFirst({
    where: { id: assignmentId, companyId },
    include: workerAssignmentInclude,
  });
  if (!assignment) throw new NotFoundError("Worker assignment not found.");
  return assignment;
}

export async function getWorkerAssignmentWorkspace(companyId: string, assignmentId: string) {
  return assignmentDTO(await getWorkerAssignmentRecord(companyId, assignmentId));
}

export type ReviewExistingBOQOptions = {
  assignmentId?: string;
  expectedBoqVersion?: number;
  lease?: {
    workerRunId: string;
    leaseOwner: string;
  };
};

export async function reviewExistingBOQ(
  actor: CurrentActor,
  boqId: string,
  inspectionAsOf = new Date(),
  options: ReviewExistingBOQOptions = {},
) {
  if (Number.isNaN(inspectionAsOf.getTime())) {
    throw new ConflictError("INVALID_INSPECTION_TIME", "A valid deterministic inspection time is required.");
  }

  const assignmentId = options.assignmentId ?? randomUUID();

  const existingAssignment = await prisma.workerAssignment.findUnique({
    where: { id: assignmentId },
    select: { companyId: true, boqId: true, assignmentType: true },
  });
  if (existingAssignment) {
    if (
      existingAssignment.companyId !== actor.companyId
      || existingAssignment.boqId !== boqId
      || existingAssignment.assignmentType !== WorkerAssignmentType.REVIEW_EXISTING_BOQ
    ) {
      throw new ConflictError(
        "WORKER_ASSIGNMENT_ID_CONFLICT",
        "The requested worker assignment identity belongs to a different governed review.",
      );
    }
    return getWorkerAssignmentWorkspace(actor.companyId, assignmentId);
  }

  await prisma.$transaction(async (tx) => {
    if (options.lease) {
      const leaseRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id"
        FROM "WorkerRun"
        WHERE "id" = CAST(${options.lease.workerRunId} AS uuid)
          AND "companyId" = CAST(${actor.companyId} AS uuid)
          AND "boqId" = CAST(${boqId} AS uuid)
          AND "status" = 'RUNNING'
          AND "leaseOwner" = ${options.lease.leaseOwner}
          AND "leaseExpiresAt" > CURRENT_TIMESTAMP
        FOR UPDATE
      `);
      if (!leaseRows.length) {
        throw new ConflictError("WORKER_LEASE_LOST", "The durable worker lease is no longer active.");
      }
    }

    const assignmentCreatedByAnotherAttempt = await tx.workerAssignment.findUnique({
      where: { id: assignmentId },
      select: { companyId: true, boqId: true, assignmentType: true },
    });
    if (assignmentCreatedByAnotherAttempt) {
      if (
        assignmentCreatedByAnotherAttempt.companyId !== actor.companyId
        || assignmentCreatedByAnotherAttempt.boqId !== boqId
        || assignmentCreatedByAnotherAttempt.assignmentType !== WorkerAssignmentType.REVIEW_EXISTING_BOQ
      ) {
        throw new ConflictError(
          "WORKER_ASSIGNMENT_ID_CONFLICT",
          "The requested worker assignment identity belongs to a different governed review.",
        );
      }
      return;
    }

    const boq = await tx.bOQ.findFirst({
      where: { id: boqId, companyId: actor.companyId },
      include: {
        sections: {
          orderBy: { sortOrder: "asc" },
          include: {
            items: {
              orderBy: { sortOrder: "asc" },
              include: {
                quantityProvenance: true,
                rateProvenance: true,
              },
            },
          },
        },
        verificationExceptions: true,
      },
    });
    if (!boq) throw new NotFoundError("BOQ not found.");
    if (options.expectedBoqVersion !== undefined && boq.version !== options.expectedBoqVersion) {
      throw new ConflictError(
        "BOQ_CHANGED_AFTER_ENQUEUE",
        "The BOQ changed after this review was queued. Enqueue a new review for the current version.",
      );
    }

    const revisionSnapshot = await tx.bOQRevisionSnapshot.findFirst({
      where: {
        companyId: actor.companyId,
        projectId: boq.projectId,
        boqId: boq.id,
        revisionNumber: boq.revisionNumber,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    const revisionEvidence = revisionSnapshot
      ? await tx.bOQRevisionItemEvidence.findMany({
          where: {
            companyId: actor.companyId,
            projectId: boq.projectId,
            boqRevisionSnapshotId: revisionSnapshot.id,
          },
          select: { boqItemId: true },
          orderBy: { boqItemId: "asc" },
        })
      : [];

    const result = inspectExistingBOQ({
      inspectionAsOf,
      boq: {
        id: boq.id,
        projectId: boq.projectId,
        title: boq.title,
        revisionNumber: boq.revisionNumber,
        version: boq.version,
        verifiedVersion: boq.verifiedVersion,
        status: boq.status,
        isLocked: boq.isLocked,
      },
      sectionCount: boq.sections.length,
      items: boq.sections.flatMap((section) =>
        section.items.map((item) => ({
          id: item.id,
          sectionId: section.id,
          sectionCode: section.code,
          sectionSortOrder: section.sortOrder,
          sortOrder: item.sortOrder,
          itemNumber: item.itemNumber,
          itemCode: item.itemCode,
          description: item.description,
          status: item.status,
          quantity: item.quantity.toString(),
          unit: item.unit,
          unitCost: item.unitCost.toString(),
          freightCost: item.freightCost.toString(),
          installationCost: item.installationCost.toString(),
          additionalCost: item.additionalCost.toString(),
          marginMode: item.marginMode,
          marginPercentage: item.marginPercentage.toString(),
          quantityProvenance: item.quantityProvenance
            ? {
                id: item.quantityProvenance.id,
                sourceType: item.quantityProvenance.sourceType,
                quantitySnapshot: item.quantityProvenance.quantitySnapshot.toString(),
                unitSnapshot: item.quantityProvenance.unitSnapshot,
                confirmedAt: item.quantityProvenance.confirmedAt,
              }
            : null,
          rateProvenance: item.rateProvenance
            ? {
                id: item.rateProvenance.id,
                sourceType: item.rateProvenance.sourceType,
                unitCostSnapshot: item.rateProvenance.unitCostSnapshot.toString(),
                freightCostSnapshot: item.rateProvenance.freightCostSnapshot.toString(),
                installationCostSnapshot: item.rateProvenance.installationCostSnapshot.toString(),
                additionalCostSnapshot: item.rateProvenance.additionalCostSnapshot.toString(),
                marginModeSnapshot: item.rateProvenance.marginModeSnapshot,
                marginPercentageSnapshot: item.rateProvenance.marginPercentageSnapshot.toString(),
                sourceExpiryDate: item.rateProvenance.sourceExpiryDate,
                confirmedAt: item.rateProvenance.confirmedAt,
              }
            : null,
        }))),
      verificationExceptions: boq.verificationExceptions.map((exception) => ({
        id: exception.id,
        boqItemId: exception.boqItemId,
        type: exception.type,
        severity: exception.severity,
        message: exception.message,
        resolved: exception.resolved,
      })),
      revisionSnapshotId: revisionSnapshot?.id ?? null,
      revisionEvidenceItemIds: revisionEvidence.map((entry) => entry.boqItemId),
    });

    const startedAt = new Date();
    await tx.workerAssignment.create({
      data: {
        id: assignmentId,
        companyId: actor.companyId,
        projectId: boq.projectId,
        boqId: boq.id,
        assignmentType: WorkerAssignmentType.REVIEW_EXISTING_BOQ,
        status: WorkerAssignmentStatus.RUNNING,
        inspectionVersion: REVIEW_EXISTING_BOQ_INSPECTION_VERSION,
        inspectionAsOf,
        sourceBoqVersion: boq.version,
        sourceVerifiedVersion: boq.verifiedVersion,
        sourceRevisionNumber: boq.revisionNumber,
        requestedByUserId: actor.userId,
        requestedByName: actor.fullName,
        startedAt,
      },
    });

    const summary = result.summary;
    await tx.workerReviewWorkspace.create({
      data: {
        companyId: actor.companyId,
        projectId: boq.projectId,
        boqId: boq.id,
        assignmentId,
        conclusion: result.conclusion,
        sectionCount: boq.sections.length,
        itemCount: boq.sections.reduce((count, section) => count + section.items.length, 0),
        activeItemCount: Number(summary.activeItemCount),
        confirmedQuantityCount: Number(summary.confirmedQuantityCount),
        confirmedRateCount: Number(summary.confirmedRateCount),
        unresolvedCriticalCount: Number(summary.unresolvedCriticalCount),
        unresolvedWarningCount: Number(summary.unresolvedWarningCount),
        revisionEvidenceCount: revisionEvidence.length,
        summaryJson: result.summary,
        itemsJson: result.items,
      },
    });

    const decisionRows = result.decisions.map((decision, index) => ({
      id: randomUUID(),
      companyId: actor.companyId,
      projectId: boq.projectId,
      boqId: boq.id,
      assignmentId,
      sequenceNumber: index + 1,
      code: decision.code,
      outcome: decision.outcome,
      severity: decision.severity,
      subjectType: decision.subjectType,
      subjectId: decision.subjectId,
      summary: decision.summary,
      rationaleJson: decision.rationale,
      evidenceRefsJson: decision.evidenceRefs,
    }));
    await tx.workerDecision.createMany({ data: decisionRows });

    const questionRows = result.decisions.flatMap((decision, index) => {
      if (!decision.question) return [];
      const decisionId = decisionRows[index]?.id;
      if (!decisionId) throw new Error("Worker decision identity was not created.");
      return [{
        companyId: actor.companyId,
        projectId: boq.projectId,
        boqId: boq.id,
        assignmentId,
        decisionId,
        questionType: decision.question.questionType,
        status: WorkerMaterialQuestionStatus.OPEN,
        subjectType: decision.question.subjectType,
        subjectId: decision.question.subjectId,
        prompt: decision.question.prompt,
        whyMaterial: decision.question.whyMaterial,
        recommendedAction: decision.question.recommendedAction,
      }];
    });
    if (questionRows.length) {
      await tx.workerMaterialQuestion.createMany({ data: questionRows });
    }

    const eventRows = [
      {
        sequenceNumber: 1,
        eventType: WorkerEventType.ASSIGNMENT_CREATED,
        payloadJson: {
          assignmentType: WorkerAssignmentType.REVIEW_EXISTING_BOQ,
          sourceBoqVersion: boq.version,
        },
      },
      {
        sequenceNumber: 2,
        eventType: WorkerEventType.INSPECTION_STARTED,
        payloadJson: {
          inspectionVersion: REVIEW_EXISTING_BOQ_INSPECTION_VERSION,
          inspectionAsOf: inspectionAsOf.toISOString(),
        },
      },
      {
        sequenceNumber: 3,
        eventType: WorkerEventType.WORKSPACE_CAPTURED,
        payloadJson: {
          activeItemCount: Number(summary.activeItemCount),
          conclusion: result.conclusion,
        },
      },
      {
        sequenceNumber: 4,
        eventType: WorkerEventType.DECISIONS_RECORDED,
        payloadJson: { decisionCount: result.decisions.length },
      },
      ...(questionRows.length
        ? [{
            sequenceNumber: 5,
            eventType: WorkerEventType.MATERIAL_QUESTIONS_OPENED,
            payloadJson: { materialQuestionCount: questionRows.length },
          }]
        : []),
      {
        sequenceNumber: questionRows.length ? 6 : 5,
        eventType: result.status === "NEEDS_INPUT"
          ? WorkerEventType.REVIEW_NEEDS_INPUT
          : WorkerEventType.REVIEW_COMPLETED,
        payloadJson: {
          conclusion: result.conclusion,
          materialQuestionCount: questionRows.length,
        },
      },
    ];
    await tx.workerEvent.createMany({
      data: eventRows.map((event) => ({
        companyId: actor.companyId,
        projectId: boq.projectId,
        boqId: boq.id,
        assignmentId,
        sequenceNumber: event.sequenceNumber,
        eventType: event.eventType,
        payloadJson: event.payloadJson,
      })),
    });

    await tx.workerAssignment.update({
      where: { id: assignmentId },
      data: {
        status: result.status === "NEEDS_INPUT"
          ? WorkerAssignmentStatus.NEEDS_INPUT
          : WorkerAssignmentStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

  return getWorkerAssignmentWorkspace(actor.companyId, assignmentId);
}

export type WorkerQuestionAnswerInput = {
  answerType: "ACKNOWLEDGED" | "WILL_CORRECT_SOURCE" | "EXPLAINED_WITH_NOTE";
  note: string;
};

export async function answerWorkerMaterialQuestion(
  actor: CurrentActor,
  assignmentId: string,
  questionId: string,
  input: WorkerQuestionAnswerInput,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id"
      FROM "WorkerAssignment"
      WHERE "id" = CAST(${assignmentId} AS uuid)
        AND "companyId" = CAST(${actor.companyId} AS uuid)
      FOR UPDATE
    `);
    const question = await tx.workerMaterialQuestion.findFirst({
      where: {
        id: questionId,
        assignmentId,
        companyId: actor.companyId,
      },
    });
    if (!question) throw new NotFoundError("Worker material question not found.");
    if (question.status !== WorkerMaterialQuestionStatus.OPEN) {
      throw new ConflictError("WORKER_QUESTION_ALREADY_ANSWERED", "This material question already has an answer.");
    }

    const answeredAt = new Date();
    await tx.workerMaterialQuestion.update({
      where: { id: question.id },
      data: {
        status: WorkerMaterialQuestionStatus.ANSWERED,
        answeredByUserId: actor.userId,
        answerJson: {
          answerType: input.answerType,
          note: input.note,
          effect: "COORDINATION_ONLY",
          governedSourceChanged: false,
        },
        answeredAt,
      },
    });
    const lastEvent = await tx.workerEvent.findFirst({
      where: { assignmentId, companyId: actor.companyId },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });
    await tx.workerEvent.create({
      data: {
        companyId: actor.companyId,
        projectId: question.projectId,
        boqId: question.boqId,
        assignmentId,
        sequenceNumber: (lastEvent?.sequenceNumber ?? 0) + 1,
        eventType: WorkerEventType.MATERIAL_QUESTION_ANSWERED,
        payloadJson: {
          questionId: question.id,
          answerType: input.answerType,
          effect: "COORDINATION_ONLY",
          requiresNewReview: true,
        },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return getWorkerAssignmentWorkspace(actor.companyId, assignmentId);
}
