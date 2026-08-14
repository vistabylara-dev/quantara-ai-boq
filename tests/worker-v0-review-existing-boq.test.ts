import {
  BOQItemStatus,
  UserRole,
  WorkerAssignmentStatus,
  WorkerDecisionCode,
  WorkerEventType,
  WorkerMaterialQuestionStatus,
  WorkerMaterialQuestionType,
  WorkerReviewConclusion,
} from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { prisma } from "../src/lib/db/prisma";
import { ConflictError, NotFoundError } from "../src/lib/errors/app-error";
import {
  answerWorkerMaterialQuestion,
  getWorkerAssignmentWorkspace,
  reviewExistingBOQ,
} from "../src/lib/services/worker-review-service";
import {
  inspectExistingBOQ,
  REVIEW_EXISTING_BOQ_INSPECTION_VERSION,
  type ReviewExistingBOQInput,
} from "../src/lib/worker/review-existing-boq";

const RUN_ID = `${Date.now()}-${process.pid}`;
const INSPECTION_AS_OF = new Date("2026-08-13T12:00:00.000Z");

function deterministicInput(): ReviewExistingBOQInput {
  return {
    inspectionAsOf: INSPECTION_AS_OF.toISOString(),
    boq: {
      id: "00000000-0000-4000-8000-000000000101",
      projectId: "00000000-0000-4000-8000-000000000102",
      title: "Deterministic BOQ",
      revisionNumber: 1,
      version: 2,
      verifiedVersion: 2,
      status: "CALCULATED",
      isLocked: false,
    },
    sectionCount: 1,
    items: [{
      id: "00000000-0000-4000-8000-000000000103",
      sectionId: "00000000-0000-4000-8000-000000000104",
      sectionCode: "A",
      sectionSortOrder: 1,
      sortOrder: 1,
      itemNumber: 1,
      itemCode: "ITEM-1",
      description: "Governed item",
      status: "CONFIRMED",
      quantity: "2",
      unit: "ea",
      unitCost: "10",
      freightCost: "0",
      installationCost: "0",
      additionalCost: "0",
      marginMode: "MARKUP",
      marginPercentage: "5",
      quantityProvenance: {
        id: "00000000-0000-4000-8000-000000000105",
        sourceType: "MANUAL_CONFIRMED",
        quantitySnapshot: "2.000000",
        unitSnapshot: "ea",
        confirmedAt: "2026-08-12T12:00:00.000Z",
      },
      rateProvenance: {
        id: "00000000-0000-4000-8000-000000000106",
        sourceType: "MANUAL_CONFIRMED",
        unitCostSnapshot: "10.0000",
        freightCostSnapshot: "0.0000",
        installationCostSnapshot: "0.0000",
        additionalCostSnapshot: "0.0000",
        marginModeSnapshot: "MARKUP",
        marginPercentageSnapshot: "5.0000",
        sourceExpiryDate: null,
        confirmedAt: "2026-08-12T12:00:00.000Z",
      },
    }],
    verificationExceptions: [],
    revisionSnapshotId: null,
    revisionEvidenceItemIds: [],
  };
}

describe("Worker V0 deterministic REVIEW_EXISTING_BOQ inspector", () => {
  it("produces the same structured decision for the same governed input without mutating it", () => {
    const input = deterministicInput();
    const before = JSON.stringify(input);
    const first = inspectExistingBOQ(input);
    const second = inspectExistingBOQ(input);

    expect(first).toEqual(second);
    expect(JSON.stringify(input)).toBe(before);
    expect(first).toMatchObject({
      conclusion: WorkerReviewConclusion.CLEAR,
      status: WorkerAssignmentStatus.COMPLETED,
      decisions: [{ code: WorkerDecisionCode.BOQ_REVIEW_CLEAR }],
    });
    expect(first.summary).toMatchObject({
      inspectionVersion: REVIEW_EXISTING_BOQ_INSPECTION_VERSION,
      activeItemCount: 1,
      confirmedQuantityCount: 1,
      confirmedRateCount: 1,
      materialQuestionCount: 0,
    });
  });

  it("asks typed material questions instead of inventing missing quantity or rate evidence", () => {
    const input = deterministicInput();
    input.items[0]!.quantityProvenance = null;
    input.items[0]!.rateProvenance = {
      ...input.items[0]!.rateProvenance!,
      sourceType: "LEGACY_UNVERIFIED",
      confirmedAt: null,
    };

    const result = inspectExistingBOQ(input);
    expect(result.conclusion).toBe(WorkerReviewConclusion.NEEDS_INPUT);
    expect(result.decisions.map((decision) => decision.code)).toEqual([
      WorkerDecisionCode.QUANTITY_PROVENANCE_MISSING,
      WorkerDecisionCode.RATE_PROVENANCE_UNCONFIRMED,
    ]);
    expect(result.decisions.map((decision) => decision.question?.questionType)).toEqual([
      WorkerMaterialQuestionType.CONFIRM_QUANTITY_PROVENANCE,
      WorkerMaterialQuestionType.CONFIRM_RATE_PROVENANCE,
    ]);
  });

  it("treats warnings as observations but locked-revision evidence gaps as material", () => {
    const input = deterministicInput();
    input.boq.isLocked = true;
    input.verificationExceptions = [{
      id: "00000000-0000-4000-8000-000000000107",
      boqItemId: input.items[0]!.id,
      type: "LOW_CONFIDENCE",
      severity: "WARNING",
      message: "Review confidence.",
      resolved: false,
    }];

    const result = inspectExistingBOQ(input);
    expect(result.decisions.map((decision) => decision.code)).toContain(
      WorkerDecisionCode.UNRESOLVED_WARNING_EXCEPTION,
    );
    expect(result.decisions.map((decision) => decision.code)).toContain(
      WorkerDecisionCode.LOCKED_REVISION_SNAPSHOT_MISSING,
    );
    expect(result.decisions.find(
      (decision) => decision.code === WorkerDecisionCode.LOCKED_REVISION_SNAPSHOT_MISSING,
    )?.question?.questionType).toBe(WorkerMaterialQuestionType.RESTORE_LOCKED_REVISION_EVIDENCE);
    expect(result.status).toBe(WorkerAssignmentStatus.NEEDS_INPUT);
  });
});

describe("Worker V0 persistence and read-only authority (integration, real local Postgres)", () => {
  let companyAId: string;
  let companyBId: string;
  let userAId: string;
  let userBId: string;
  let projectAId: string;
  let projectBId: string;
  let clearBoqId: string;
  let clearItemId: string;
  let needsInputBoqId: string;
  let needsInputItemId: string;

  function actorA(): CurrentActor {
    return {
      userId: userAId,
      companyId: companyAId,
      role: UserRole.COMPANY_OWNER,
      fullName: "Worker V0 Owner A",
      email: `worker-v0-a-${RUN_ID}@example.com`,
    };
  }

  beforeAll(async () => {
    const [companyA, companyB] = await Promise.all([
      prisma.company.create({
        data: {
          legalName: `Worker V0 Company A ${RUN_ID}`,
          tradeName: "Worker V0 A",
          email: `worker-v0-company-a-${RUN_ID}@example.com`,
        },
      }),
      prisma.company.create({
        data: {
          legalName: `Worker V0 Company B ${RUN_ID}`,
          tradeName: "Worker V0 B",
          email: `worker-v0-company-b-${RUN_ID}@example.com`,
        },
      }),
    ]);
    companyAId = companyA.id;
    companyBId = companyB.id;
    const industry = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    const [userA, userB, clientA, clientB] = await Promise.all([
      prisma.user.create({
        data: {
          companyId: companyAId,
          email: `worker-v0-a-${RUN_ID}@example.com`,
          passwordHash: "test-fixture-not-a-real-hash",
          fullName: "Worker V0 Owner A",
          role: UserRole.COMPANY_OWNER,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.user.create({
        data: {
          companyId: companyBId,
          email: `worker-v0-b-${RUN_ID}@example.com`,
          passwordHash: "test-fixture-not-a-real-hash",
          fullName: "Worker V0 Owner B",
          role: UserRole.COMPANY_OWNER,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.client.create({
        data: {
          companyId: companyAId,
          name: "Worker V0 Client A",
          email: `worker-v0-client-a-${RUN_ID}@example.com`,
        },
      }),
      prisma.client.create({
        data: {
          companyId: companyBId,
          name: "Worker V0 Client B",
          email: `worker-v0-client-b-${RUN_ID}@example.com`,
        },
      }),
    ]);
    userAId = userA.id;
    userBId = userB.id;
    const [projectA, projectB] = await Promise.all([
      prisma.project.create({
        data: {
          companyId: companyAId,
          clientId: clientA.id,
          industryEngineId: industry.id,
          slug: `worker-v0-a-${RUN_ID}`,
          reference: `WORKER-V0-A-${RUN_ID}`,
          name: "Worker V0 Project A",
        },
      }),
      prisma.project.create({
        data: {
          companyId: companyBId,
          clientId: clientB.id,
          industryEngineId: industry.id,
          slug: `worker-v0-b-${RUN_ID}`,
          reference: `WORKER-V0-B-${RUN_ID}`,
          name: "Worker V0 Project B",
        },
      }),
    ]);
    projectAId = projectA.id;
    projectBId = projectB.id;

    const [clearBoq, needsInputBoq] = await Promise.all([
      prisma.bOQ.create({
        data: {
          companyId: companyAId,
          projectId: projectAId,
          title: "Governed review BOQ",
          revisionNumber: 1,
          version: 2,
          verifiedVersion: 2,
          verifiedAt: INSPECTION_AS_OF,
        },
      }),
      prisma.bOQ.create({
        data: {
          companyId: companyAId,
          projectId: projectAId,
          title: "Needs-input review BOQ",
          revisionNumber: 2,
          version: 1,
          verifiedVersion: 1,
          verifiedAt: INSPECTION_AS_OF,
        },
      }),
    ]);
    clearBoqId = clearBoq.id;
    needsInputBoqId = needsInputBoq.id;
    const [clearSection, needsInputSection] = await Promise.all([
      prisma.bOQSection.create({
        data: {
          companyId: companyAId,
          boqId: clearBoqId,
          code: "CLEAR",
          title: "Clear",
          sortOrder: 1,
        },
      }),
      prisma.bOQSection.create({
        data: {
          companyId: companyAId,
          boqId: needsInputBoqId,
          code: "INPUT",
          title: "Needs input",
          sortOrder: 1,
        },
      }),
    ]);
    const [clearItem, needsInputItem] = await Promise.all([
      prisma.bOQItem.create({
        data: {
          companyId: companyAId,
          sectionId: clearSection.id,
          itemNumber: 1,
          itemCode: `CLEAR-${RUN_ID}`,
          category: "General",
          description: "Confirmed governed item",
          quantity: 2,
          unit: "ea",
          unitCost: 10,
          landedCost: 10,
          marginPercentage: 5,
          sellingRate: 10.5,
          totalAmount: 21,
          status: BOQItemStatus.CONFIRMED,
          sortOrder: 1,
        },
      }),
      prisma.bOQItem.create({
        data: {
          companyId: companyAId,
          sectionId: needsInputSection.id,
          itemNumber: 1,
          itemCode: `MISSING-${RUN_ID}`,
          category: "General",
          description: "Item awaiting governed evidence",
          quantity: 3,
          unit: "ea",
          unitCost: 12,
          landedCost: 12,
          marginPercentage: 5,
          sellingRate: 12.6,
          totalAmount: 37.8,
          status: BOQItemStatus.NEEDS_REVIEW,
          sortOrder: 1,
        },
      }),
    ]);
    clearItemId = clearItem.id;
    needsInputItemId = needsInputItem.id;
    await Promise.all([
      prisma.bOQItemQuantityProvenance.create({
        data: {
          companyId: companyAId,
          projectId: projectAId,
          boqItemId: clearItemId,
          sourceType: "MANUAL_CONFIRMED",
          quantitySnapshot: 2,
          unitSnapshot: "ea",
          confirmedByUserId: userAId,
          confirmedByName: "Worker V0 Owner A",
          confirmedAt: INSPECTION_AS_OF,
        },
      }),
      prisma.bOQItemRateProvenance.create({
        data: {
          companyId: companyAId,
          projectId: projectAId,
          boqItemId: clearItemId,
          sourceType: "MANUAL_CONFIRMED",
          unitCostSnapshot: 10,
          freightCostSnapshot: 0,
          installationCostSnapshot: 0,
          additionalCostSnapshot: 0,
          marginModeSnapshot: "MARKUP",
          marginPercentageSnapshot: 5,
          confirmedByUserId: userAId,
          confirmedByName: "Worker V0 Owner A",
          confirmedAt: INSPECTION_AS_OF,
        },
      }),
    ]);
  });

  async function governedSnapshot(boqId: string) {
    return {
      boq: await prisma.bOQ.findUniqueOrThrow({ where: { id: boqId } }),
      items: await prisma.bOQItem.findMany({
        where: { section: { boqId } },
        orderBy: { id: "asc" },
      }),
      quantityProvenance: await prisma.bOQItemQuantityProvenance.findMany({
        where: { boqItem: { section: { boqId } } },
        orderBy: { id: "asc" },
      }),
      rateProvenance: await prisma.bOQItemRateProvenance.findMany({
        where: { boqItem: { section: { boqId } } },
        orderBy: { id: "asc" },
      }),
      verificationExceptions: await prisma.verificationException.findMany({
        where: { boqId },
        orderBy: { id: "asc" },
      }),
      revisionEvidence: await prisma.bOQRevisionItemEvidence.findMany({
        where: { boqRevisionSnapshotId: { in: await prisma.bOQRevisionSnapshot.findMany({
          where: { boqId },
          select: { id: true },
        }).then((rows) => rows.map((row) => row.id)) } },
        orderBy: { id: "asc" },
      }),
    };
  }

  it("persists a clear assignment, decision, workspace and event ledger without mutating governed records", async () => {
    const before = await governedSnapshot(clearBoqId);
    const assignment = await reviewExistingBOQ(actorA(), clearBoqId, INSPECTION_AS_OF);
    const after = await governedSnapshot(clearBoqId);

    expect(after).toEqual(before);
    expect(assignment).toMatchObject({
      assignmentType: "REVIEW_EXISTING_BOQ",
      status: WorkerAssignmentStatus.COMPLETED,
      inspectionVersion: REVIEW_EXISTING_BOQ_INSPECTION_VERSION,
      workspace: {
        conclusion: WorkerReviewConclusion.CLEAR,
        activeItemCount: 1,
        confirmedQuantityCount: 1,
        confirmedRateCount: 1,
      },
      decisions: [{ code: WorkerDecisionCode.BOQ_REVIEW_CLEAR }],
      materialQuestions: [],
    });
    expect(assignment.events.map((event) => event.eventType)).toEqual([
      WorkerEventType.ASSIGNMENT_CREATED,
      WorkerEventType.INSPECTION_STARTED,
      WorkerEventType.WORKSPACE_CAPTURED,
      WorkerEventType.DECISIONS_RECORDED,
      WorkerEventType.REVIEW_COMPLETED,
    ]);
  });

  it("persists typed material questions and records answers as coordination-only", async () => {
    const before = await governedSnapshot(needsInputBoqId);
    const assignment = await reviewExistingBOQ(actorA(), needsInputBoqId, INSPECTION_AS_OF);
    expect(await governedSnapshot(needsInputBoqId)).toEqual(before);
    expect(assignment.status).toBe(WorkerAssignmentStatus.NEEDS_INPUT);
    expect(assignment.decisions.map((decision) => decision.code)).toEqual([
      WorkerDecisionCode.QUANTITY_PROVENANCE_MISSING,
      WorkerDecisionCode.RATE_PROVENANCE_MISSING,
    ]);
    expect(assignment.materialQuestions.map((question) => question.questionType)).toEqual([
      WorkerMaterialQuestionType.CONFIRM_QUANTITY_PROVENANCE,
      WorkerMaterialQuestionType.CONFIRM_RATE_PROVENANCE,
    ]);

    const question = assignment.materialQuestions[0]!;
    const answered = await answerWorkerMaterialQuestion(actorA(), assignment.id, question.id, {
      answerType: "WILL_CORRECT_SOURCE",
      note: "A quantity surveyor will confirm the retained source evidence.",
    });
    expect(await governedSnapshot(needsInputBoqId)).toEqual(before);
    expect(answered.status).toBe(WorkerAssignmentStatus.NEEDS_INPUT);
    expect(answered.materialQuestions.find((entry) => entry.id === question.id)).toMatchObject({
      status: WorkerMaterialQuestionStatus.ANSWERED,
      answer: {
        answerType: "WILL_CORRECT_SOURCE",
        effect: "COORDINATION_ONLY",
        governedSourceChanged: false,
      },
    });
    expect(answered.events.at(-1)?.eventType).toBe(WorkerEventType.MATERIAL_QUESTION_ANSWERED);
    expect(await prisma.bOQItemQuantityProvenance.findUnique({ where: { boqItemId: needsInputItemId } })).toBeNull();
    await expect(answerWorkerMaterialQuestion(actorA(), assignment.id, question.id, {
      answerType: "ACKNOWLEDGED",
      note: "Second answer must not overwrite the first.",
    })).rejects.toBeInstanceOf(ConflictError);
  });

  it("enforces tenant boundaries and an immutable worker ledger in the database", async () => {
    const assignment = await reviewExistingBOQ(actorA(), clearBoqId, INSPECTION_AS_OF);
    await expect(getWorkerAssignmentWorkspace(companyBId, assignment.id)).rejects.toBeInstanceOf(NotFoundError);

    await expect(prisma.workerAssignment.create({
      data: {
        companyId: companyBId,
        projectId: projectBId,
        boqId: clearBoqId,
        assignmentType: "REVIEW_EXISTING_BOQ",
        status: WorkerAssignmentStatus.RUNNING,
        inspectionVersion: REVIEW_EXISTING_BOQ_INSPECTION_VERSION,
        inspectionAsOf: INSPECTION_AS_OF,
        sourceBoqVersion: 2,
        sourceRevisionNumber: 1,
        requestedByUserId: userBId,
        requestedByName: "Worker V0 Owner B",
      },
    })).rejects.toThrow(/tenant and project/i);

    await expect(prisma.workerDecision.update({
      where: { id: assignment.decisions[0]!.id },
      data: { summary: "Attempted overwrite" },
    })).rejects.toThrow(/immutable/i);
    await expect(prisma.workerEvent.delete({
      where: { id: assignment.events[0]!.id },
    })).rejects.toThrow(/immutable/i);
    const workspace = await prisma.workerReviewWorkspace.findUniqueOrThrow({
      where: { assignmentId: assignment.id },
    });
    await expect(prisma.workerReviewWorkspace.update({
      where: { id: workspace.id },
      data: { conclusion: WorkerReviewConclusion.NEEDS_INPUT },
    })).rejects.toThrow(/immutable/i);
    await expect(prisma.workerAssignment.delete({
      where: { id: assignment.id },
    })).rejects.toThrow(/cannot be deleted/i);
  });
});
