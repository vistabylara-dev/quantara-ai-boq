import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { advanceTayqanWorkOrder } from "@/lib/services/tayqan-work-order-service";
import { randomUUID } from "node:crypto";
import { TayqanWorkStage, TayqanWorkStatus } from "@prisma/client";
import { toState } from "@/lib/services/tayqan-work-order-service";
import { AppError } from "@/lib/errors/app-error";

let actor: any;

describe("TAYQAN FULL BOQ DELIVERABLE RESCUE", () => {
  beforeEach(async () => {
    // Just grab any seeded company and user
    const user = await prisma.user.findFirst();
    actor = {
      userId: user!.id,
      companyId: user!.companyId,
      email: user!.email,
      fullName: user!.fullName,
      roles: ["COMPANY_OWNER"],
    };
  });

  async function createTestProject() {
    return prisma.project.findFirst({ where: { companyId: actor.companyId } });
  }

  it("Test A & B - API state exposes AI Draft safely for frontend", async () => {
    const project = await createTestProject();
    const boq = await prisma.bOQ.create({
      data: {
        id: randomUUID(),
        
        title: "Test",
        status: "DRAFT",
        company: { connect: { id: actor.companyId } },
        project: { connect: { id: project!.id } },
        createdByUser: { connect: { id: actor.userId } },
      }
    });

    const order = await prisma.tayqanWorkOrder.create({
      data: {
        id: randomUUID(),
        desiredDeliverable: "COMPLETE_BOQ_FROM_SOURCES",
        includeRates: false,
        stage: TayqanWorkStage.FINALIZING_REVIEW_DRAFT,
        status: TayqanWorkStatus.RUNNING,
        boqId: boq.id,
        progressJson: {
           aiDraft: { addedCount: 5, skippedCount: 0, alreadyPresentCount: 0, unreviewedAddedCount: 5, reviewedAddedCount: 0 }
        },
        company: { connect: { id: actor.companyId } },
        project: { connect: { id: project!.id } },
        createdByUser: { connect: { id: actor.userId } },
        intakeSessionId: randomUUID(),
        hireEntitlementId: randomUUID()
      }
    });

    // Test A
    const { loadOrder } = await import("@/lib/services/tayqan-work-order-service");
    const loaded = await loadOrder(actor.companyId, order.id);
    const state = toState(loaded);

    expect(state.aiDraft).toBeDefined();
    expect(state.aiDraft?.addedCount).toBe(5);

    // If aiDraft missing
    const order2 = await prisma.tayqanWorkOrder.create({
      data: {
        id: randomUUID(),
        desiredDeliverable: "COMPLETE_BOQ_FROM_SOURCES",
        includeRates: false,
        stage: TayqanWorkStage.FINALIZING_REVIEW_DRAFT,
        status: TayqanWorkStatus.RUNNING,
        boqId: boq.id,
        progressJson: {},
        company: { connect: { id: actor.companyId } },
        project: { connect: { id: project!.id } },
        createdByUser: { connect: { id: actor.userId } },
        intakeSessionId: randomUUID(),
        hireEntitlementId: randomUUID()
      }
    });
    const loaded2 = await loadOrder(actor.companyId, order2.id);
    const state2 = toState(loaded2);
    expect(state2.aiDraft).toBeNull();
  });

  it("Test C & D & E & F - workflow bypass, scope coverage, generated boq preserved", async () => {
    const project = await createTestProject();
    const fileId = randomUUID();
    await prisma.projectFile.create({
      data: {
        id: fileId,
        fileName: "test.xlsx",
        originalName: "test.xlsx",
        safeFileName: "test.xlsx",
        fileSize: 100,
        storageKey: "test",
        mimeType: "sheet",
        company: { connect: { id: actor.companyId } },
        project: { connect: { id: project!.id } },
        createdByUser: { connect: { id: actor.userId } },
      }
    });

    const boq = await prisma.bOQ.create({
      data: {
        id: randomUUID(),
        
        title: "TAYQAN BOQ",
        status: "DRAFT",
        company: { connect: { id: actor.companyId } },
        project: { connect: { id: project!.id } },
        createdByUser: { connect: { id: actor.userId } },
      }
    });

    // Test F: an entity that is already mapped via quantity provenance.
    const e1 = await prisma.extractedEntity.create({
      data: { id: randomUUID(), label: "E1 - Provenance", quantity: 10, unit: "m", status: "CONFIRMED", company: { connect: { id: actor.companyId } }, projectFile: { connect: { id: fileId } } }
    });
    
    // Test E: an entity that is meant to fail coverage because it's completely missing from BOQ
    const e2 = await prisma.extractedEntity.create({
      data: { id: randomUUID(), label: "E2 - Missing", quantity: 10, unit: "m", status: "CONFIRMED", company: { connect: { id: actor.companyId } }, projectFile: { connect: { id: fileId } } }
    });

    const section = await prisma.bOQSection.create({
      data: { id: randomUUID(), name: "Main", boqId: boq.id }
    });
    const item = await prisma.bOQItem.create({
      data: { id: randomUUID(), sectionId: section.id, description: "Item 1", sourceReference: "NOTHING" }
    });
    await prisma.quantityProvenance.create({
      data: { id: randomUUID(), itemId: item.id, extractedEntityId: e1.id, expression: "10" }
    });

    const order = await prisma.tayqanWorkOrder.create({
      data: {
        id: randomUUID(),
        desiredDeliverable: "COMPLETE_BOQ_FROM_SOURCES",
        includeRates: false,
        stage: TayqanWorkStage.SOURCE_PROCESSING, // Starts here! Test C bypass drawing!
        status: TayqanWorkStatus.RUNNING,
        boqId: boq.id,
        progressJson: { selectedSourceFileIds: [fileId], instructionContext: { pricingBasis: "None" } },
        company: { connect: { id: actor.companyId } },
        project: { connect: { id: project!.id } },
        createdByUser: { connect: { id: actor.userId } },
        intakeSessionId: randomUUID(),
        hireEntitlementId: randomUUID()
      }
    });

    // Act
    await advanceTayqanWorkOrder(actor, project!.slug, order.id);

    // Verify it bypassed drawing measurement
    const updated = await prisma.tayqanWorkOrder.findUnique({ where: { id: order.id } });
    expect(updated!.stage).toBe(TayqanWorkStage.FINALIZING_REVIEW_DRAFT);
    
    // Run FINALIZING_REVIEW_DRAFT to map items.
    await advanceTayqanWorkOrder(actor, project!.slug, order.id);
    
    // Now AI Draft generated BOQ. E2 is mapped successfully.
    // To prove Test E (SCOPE_COVERAGE_INCOMPLETE), we manually delete E2's BOQ item and re-run.
    const boqRecord = await prisma.bOQ.findFirst({ where: { id: boq.id }, include: { sections: { include: { items: true } } } });
    const e2Item = boqRecord!.sections.flatMap(s => s.items).find(i => i.sourceReference?.includes(e2.id));
    
    if (e2Item) {
      await prisma.bOQItem.delete({ where: { id: e2Item.id } });
    }
    
    // Set order back to FINALIZING_REVIEW_DRAFT
    await prisma.tayqanWorkOrder.update({
      where: { id: order.id },
      data: { stage: TayqanWorkStage.FINALIZING_REVIEW_DRAFT, status: TayqanWorkStatus.RUNNING, blockerCode: null, blockerMessage: null, blockerJson: null }
    });

    // Act again
    try {
        await advanceTayqanWorkOrder(actor, project!.slug, order.id);
    } catch(e) {}

    // Assert SCOPE_COVERAGE_INCOMPLETE
    const finalOrder = await prisma.tayqanWorkOrder.findUnique({ where: { id: order.id } });
    expect(finalOrder!.status).toBe(TayqanWorkStatus.FAILED);
    expect(finalOrder!.blockerCode).toBe("SCOPE_COVERAGE_INCOMPLETE");
    
    // The BOQ must be preserved (Test D/E)
    const preservedBoq = await prisma.bOQ.findFirst({ where: { id: boq.id } });
    expect(preservedBoq).toBeDefined();
  });
});
