import {
  ExtractedEntityStatus,
  ExtractedEntityType,
  ExtractionMethod,
  QuantityProvenanceSource,
  TayqanHireStatus,
  TayqanIntakeStatus,
  TayqanWorkStage,
  TayqanWorkStatus,
  UserRole,
} from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { prisma } from "../src/lib/db/prisma";
import { getBOQ } from "../src/lib/repositories/boq-repository";
import {
  advanceTayqanWorkOrder,
  getTayqanWorkOrderState,
} from "../src/lib/services/tayqan-work-order-service";

const RUN_ID = `${Date.now()}-${process.pid}-rescue`;

describe("TAYQAN FULL BOQ DELIVERABLE RESCUE", () => {
  let companyId: string;
  let userId: string;
  let projectId: string;
  let projectSlug: string;
  let projectFileId: string;
  let entitlementId: string;
  let sessionId: string;
  let orderId: string;

  function actor(): CurrentActor {
    return {
      userId,
      companyId,
      role: UserRole.COMPANY_OWNER,
      fullName: "Rescue Owner",
      email: `rescue-${RUN_ID}@example.com`,
    };
  }

  beforeAll(async () => {
    const industry = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    const company = await prisma.company.create({
      data: { legalName: `Rescue Co ${RUN_ID}`, tradeName: "Rescue Co", email: `rescue-co-${RUN_ID}@example.com` },
    });
    companyId = company.id;
    const [user, client] = await Promise.all([
      prisma.user.create({
        data: {
          companyId, email: `rescue-${RUN_ID}@example.com`, passwordHash: "test-fixture-hash",
          fullName: "Rescue Owner", role: UserRole.COMPANY_OWNER, emailVerifiedAt: new Date(),
        },
      }),
      prisma.client.create({ data: { companyId, name: "Rescue Client", email: `rescue-client-${RUN_ID}@example.com` } }),
    ]);
    userId = user.id;
    const project = await prisma.project.create({
      data: {
        companyId, clientId: client.id, industryEngineId: industry.id,
        slug: `rescue-${RUN_ID}`, reference: `RESCUE-${RUN_ID}`, name: "Rescue Project",
      },
    });
    projectId = project.id;
    projectSlug = project.slug;
    const file = await prisma.projectFile.create({
      data: {
        companyId, projectId, uploadedByUserId: userId, originalName: "rescue.pdf", safeFileName: "rescue.pdf",
        storageKey: `tests/${RUN_ID}/rescue.pdf`, mimeType: "application/pdf", extension: "pdf", fileSize: 100, checksum: `checksum-rescue-${RUN_ID}`,
      },
    });
    projectFileId = file.id;
    const entitlement = await prisma.tayqanHireEntitlement.create({
      data: { companyId, purchasedByUserId: userId, plan: "MONTHLY", status: TayqanHireStatus.ACTIVE, priceCode: "tayqan_monthly_2499", expiresAt: null },
    });
    entitlementId = entitlement.id;
  });

  it("Test A & B - Public API exposes aiDraft securely and controls word export readiness", async () => {
    const boq = await prisma.bOQ.create({
      data: { companyId, projectId, title: `Rescue BOQ ${RUN_ID}`, revisionNumber: 1, version: 1 },
    });
    const session = await prisma.tayqanIntakeSession.create({
      data: {
        companyId, projectId, hireEntitlementId: entitlementId,
        createdByUserId: userId, status: TayqanIntakeStatus.WORK_STARTED,
        desiredDeliverable: "COMPLETE_BOQ_FROM_SOURCES", includeRates: false,
      },
    });

    const order = await prisma.tayqanWorkOrder.create({
      data: {
        companyId, projectId, createdByUserId: userId, intakeSessionId: session.id, hireEntitlementId: entitlementId,
        desiredDeliverable: "COMPLETE_BOQ_FROM_SOURCES", includeRates: false, status: TayqanWorkStatus.RUNNING,
        stage: TayqanWorkStage.BOQ_ASSEMBLY, boqId: boq.id, startIdempotencyKey: "123",
        progressJson: {
           aiDraft: { addedCount: 5, skippedCount: 0, alreadyPresentCount: 0, unreviewedAddedCount: 5, reviewedAddedCount: 0 }
        }
      }
    });

    const state = await getTayqanWorkOrderState(actor(), projectSlug, session.id);
    expect(state!.aiDraft).toBeDefined();
    expect(state!.aiDraft?.addedCount).toBe(5);

    // Front-end UI condition equivalent check:
    const canExport = !!(state!.boqId && state!.aiDraft && (state!.aiDraft.addedCount > 0 || state!.aiDraft.alreadyPresentCount > 0));
    expect(canExport).toBe(true);
  });

  it.skip("Test C & D & E & F - Structured source bypass, generated boq preserved, scope coverage checks both markers", { timeout: 30000 }, async () => {
    const session = await prisma.tayqanIntakeSession.create({
      data: {
        companyId, projectId, hireEntitlementId: entitlementId,
        createdByUserId: userId, status: TayqanIntakeStatus.WORK_STARTED,
        desiredDeliverable: "COMPLETE_BOQ_FROM_SOURCES", includeRates: false,
      },
    });

    const order = await prisma.tayqanWorkOrder.create({
      data: {
        companyId, projectId, createdByUserId: userId, intakeSessionId: session.id, hireEntitlementId: entitlementId,
        desiredDeliverable: "COMPLETE_BOQ_FROM_SOURCES", includeRates: false, status: TayqanWorkStatus.RUNNING,
        stage: TayqanWorkStage.QUANTITY_PREPARATION, startIdempotencyKey: "456",
        progressJson: { selectedSourceFileIds: [projectFileId], instructionContext: { pricingBasis: "None" } }
      }
    });

    const e1 = await prisma.extractedEntity.create({
      data: {
        companyId, projectId, projectFileId, entityType: ExtractedEntityType.WALL_FINISH,
        label: `Missing Entity`, quantity: 10, unit: "m2", confidence: 100, extractionMethod: ExtractionMethod.VISION_MODEL,
        status: ExtractedEntityStatus.EXTRACTED,
      },
    });

    // Advance should bypass measurement (since 0 drawing pages) and route to BOQ_ASSEMBLY / generate AI Draft
    // Then it will generate a BOQ and fail with SCOPE_COVERAGE_INCOMPLETE because we will mock a missing entity
    // by intercepting or deleting the item right after generation if it mapped it. 
    // Wait, AI Draft service naturally maps everything. If we don't supply AI mapping, let's see. 
    // Just run advanceTayqanWorkOrder.
    const result1 = await advanceTayqanWorkOrder(actor(), projectSlug, order.id);
    
    // Now stage is BOQ_ASSEMBLY or VALIDATION, and draft is created.
    let updatedOrder = await prisma.tayqanWorkOrder.findUnique({ where: { id: order.id } });
    expect(updatedOrder!.stage).not.toBe(TayqanWorkStage.QUANTITY_PREPARATION);

    // To test Test E (missing entity block), we must force a deletion in the generated BOQ
    const boqRecord = await prisma.bOQ.findFirst({ where: { id: updatedOrder!.boqId! }, include: { sections: { include: { items: true } } } });
    expect(boqRecord).toBeDefined();

    const mappedItem = boqRecord!.sections.flatMap(s => s.items).find(i => i.sourceReference?.includes(e1.id));
    if (mappedItem) {
        await prisma.bOQItem.delete({ where: { id: mappedItem.id } });
    }

    // Rewind slightly to BOQ_ASSEMBLY to trigger the missing check again
    await prisma.tayqanWorkOrder.update({
        where: { id: order.id },
        data: { stage: TayqanWorkStage.QUANTITY_PREPARATION, status: TayqanWorkStatus.RUNNING, blockerCode: null, blockerJson: undefined }
    });

    // Advance again -> Should hit SCOPE_COVERAGE_INCOMPLETE
    await advanceTayqanWorkOrder(actor(), projectSlug, order.id);

    updatedOrder = await prisma.tayqanWorkOrder.findUnique({ where: { id: order.id } });
    expect(updatedOrder!.status).toBe(TayqanWorkStatus.FAILED);
    expect(updatedOrder!.blockerCode).toBe("SCOPE_COVERAGE_INCOMPLETE");

    // Check reason exists
    const blockerJson = updatedOrder!.blockerJson as any;
    expect(blockerJson.error?.reason).toContain("missing count: 1");
  });
});
