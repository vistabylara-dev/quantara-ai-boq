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
import { getBOQ, updateBOQ } from "../src/lib/repositories/boq-repository";
import { confirmAiDraftQuantities, generateAiDraftBoq } from "../src/lib/services/ai-draft-boq-service";
import {
  advanceTayqanWorkOrder,
  answerTayqanWorkOrderBlocker,
  type WorkProgress,
} from "../src/lib/services/tayqan-work-order-service";

/**
 * TAYQAN-AI-DRAFT-LOOP-FIX — reproduces and closes the "Check again" loop
 * reported against the AI Draft BOQ review gate.
 *
 * ROOT CAUSE CONFIRMED AS H1, empirically, not by re-reading code: TAYQAN
 * generates its AI Draft with quantityMode: "TAYQAN_MEASUREMENT_PROPOSAL",
 * which sets useQuantaraMeasurementIntelligence to false — so an item whose
 * extracted entity never had a measured quantity (entity.quantity === null),
 * and which TAYQAN's own measurement reasoner did not produce a calculation
 * for, gets NO AI-suggested-measurement marker and NO TAYQAN calculation.
 * confirmAiDraftQuantities's four auto-confirm conditions (manuallyReviewed/
 * aiSuggested/tayqanCalculated/quantityMatchesExtraction) can then never be
 * satisfied for that item — it is structurally unconfirmable by the "Confirm
 * Remaining Draft Quantities" button, forever, with zero indication to the
 * user of which row is the problem. H2 (sourceReference round-trip) and H3
 * (staleness) were traced and ruled out: syncSectionItems's quantityChanged
 * detection is a straightforward Decimal/unit comparison that fires
 * correctly on a genuine edit, and answerTayqanWorkOrderBlocker's RETRY path
 * reloads the order and re-reads the BOQ fresh on every "Check again" — there
 * is no caching layer to go stale. A direct manual edit+save of the exact
 * row already works correctly via the standard MANUAL_CONFIRMED path; the
 * bug is that nothing ever tells the user that's the only way out, or which
 * row needs it.
 */

const RUN_ID = `${Date.now()}-${process.pid}-ai-draft-loop`;

describe("TAYQAN-AI-DRAFT-LOOP-FIX: AI Draft review 'Check again' loop (integration, real local Postgres)", () => {
  let companyId: string;
  let userId: string;
  let projectId: string;
  let projectSlug: string;
  let projectFileId: string;
  let entitlementId: string;

  function actor(): CurrentActor {
    return {
      userId,
      companyId,
      role: UserRole.COMPANY_OWNER,
      fullName: "AI Draft Loop Owner",
      email: `ai-draft-loop-${RUN_ID}@example.com`,
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

  beforeAll(async () => {
    const industry = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    const company = await prisma.company.create({
      data: { legalName: `AI Draft Loop Co ${RUN_ID}`, tradeName: "AI Draft Loop Co", email: `ai-draft-loop-co-${RUN_ID}@example.com` },
    });
    companyId = company.id;
    const [user, client] = await Promise.all([
      prisma.user.create({
        data: {
          companyId, email: `ai-draft-loop-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash",
          fullName: "AI Draft Loop Owner", role: UserRole.COMPANY_OWNER, emailVerifiedAt: new Date(),
        },
      }),
      prisma.client.create({ data: { companyId, name: "AI Draft Loop Client", email: `ai-draft-loop-client-${RUN_ID}@example.com` } }),
    ]);
    userId = user.id;
    const project = await prisma.project.create({
      data: {
        companyId, clientId: client.id, industryEngineId: industry.id,
        slug: `ai-draft-loop-${RUN_ID}`, reference: `AI-DRAFT-LOOP-${RUN_ID}`, name: "AI Draft Loop Project",
      },
    });
    projectId = project.id;
    projectSlug = project.slug;
    const file = await prisma.projectFile.create({
      data: {
        companyId, projectId, uploadedByUserId: userId, originalName: "ai-draft-loop.pdf", safeFileName: "ai-draft-loop.pdf",
        storageKey: `tests/${RUN_ID}/ai-draft-loop.pdf`, mimeType: "application/pdf", extension: "pdf", fileSize: 100, checksum: `checksum-ai-draft-loop-${RUN_ID}`,
      },
    });
    projectFileId = file.id;
    const entitlement = await prisma.tayqanHireEntitlement.create({
      data: { companyId, purchasedByUserId: userId, plan: "MONTHLY", status: TayqanHireStatus.ACTIVE, priceCode: "tayqan_monthly_2499", expiresAt: null },
    });
    entitlementId = entitlement.id;
  });

  it("reproduces H1, proves the fix names the specific pending item, and proves a genuine manual edit+save (not the bulk button) is what actually clears it", async () => {
    // ---- Set up: an entity with NO measured quantity — the exact H1 shape ----
    const entity = await prisma.extractedEntity.create({
      data: {
        companyId, projectId, projectFileId,
        entityType: ExtractedEntityType.WALL_FINISH,
        label: `Unmeasured wall finish ${RUN_ID}`,
        quantity: null,
        unit: null,
        confidence: 70,
        extractionMethod: ExtractionMethod.VISION_MODEL,
        sourceReference: "A-101",
        status: ExtractedEntityStatus.EXTRACTED,
      },
    });

    const boq = await prisma.bOQ.create({
      data: { companyId, projectId, title: `AI Draft Loop BOQ ${RUN_ID}`, revisionNumber: 1, version: 1 },
    });

    // ---- Mirrors prepareTayqanAiDraft exactly: real generateAiDraftBoq call, TAYQAN's own mode ----
    const draftResult = await generateAiDraftBoq(actor(), projectSlug, {
      targetBoqId: boq.id,
      quantityMode: "TAYQAN_MEASUREMENT_PROPOSAL",
    });
    // >=1, not ===1: generateAiDraftBoq scans every EXTRACTED/NEEDS_REVIEW/etc.
    // entity in the project, not just the one this test just created — it may
    // also pick up a still-EXTRACTED entity left behind by a sibling test in
    // this same describe block sharing the same project. The item this test
    // actually cares about is located below by matching entity.label, not by
    // this count.
    expect(draftResult.addedCount).toBeGreaterThanOrEqual(1);

    const afterGenerate = await getBOQ(companyId, boq.id);
    const draftedItem = afterGenerate.sections.flatMap((s) => s.items).find((i) => i.description === entity.label)!;
    expect(draftedItem).toBeDefined();
    expect(draftedItem.quantity).toBe(0); // getAiDraftQuantityValue(null) === 0 — this is the item that will be stuck

    const provenanceRow = await prisma.bOQItemQuantityProvenance.findFirstOrThrow({ where: { boqItemId: draftedItem.id } });
    expect(provenanceRow.sourceType).toBe(QuantityProvenanceSource.LEGACY_UNVERIFIED);
    expect(provenanceRow.confirmedAt).toBeNull();

    // ---- Work order at BOQ_ASSEMBLY with aiDraft populated, exactly as prepareTayqanAiDraft leaves it ----
    const aiDraft: NonNullable<WorkProgress["aiDraft"]> = {
      boqId: boq.id,
      addedCount: draftResult.addedCount,
      skippedCount: draftResult.skippedCount,
      alreadyPresentCount: draftResult.alreadyPresentCount,
      unreviewedAddedCount: draftResult.unreviewedAddedCount,
      reviewedAddedCount: draftResult.reviewedAddedCount,
    };
    const session = await createIntakeSession();
    const order = await prisma.tayqanWorkOrder.create({
      data: {
        companyId, projectId, boqId: boq.id,
        intakeSessionId: session.id, hireEntitlementId: entitlementId, createdByUserId: userId,
        status: TayqanWorkStatus.RUNNING, stage: TayqanWorkStage.BOQ_ASSEMBLY,
        desiredDeliverable: "COMPLETE_BOQ_FROM_SOURCES", includeRates: false,
        startIdempotencyKey: `ai-draft-loop-${RUN_ID}`,
        progressJson: JSON.parse(JSON.stringify({ aiDraft })),
      },
    });

    // ---- 1st "Check again" equivalent: fresh RUNNING order, first evaluation ----
    const firstBlock = await advanceTayqanWorkOrder(actor(), projectId, order.id);
    expect(firstBlock.status).toBe("NEEDS_INPUT");
    expect(firstBlock.blocker?.i18nKey).toBe("tayqan.hire.workflow.draftReadyForReview");
    // THE FIX: the blocker now names the specific item, not just a count.
    expect(firstBlock.blocker?.pendingItems).toBeDefined();
    expect(firstBlock.blocker?.pendingItems?.some((p) => p.id === draftedItem.id)).toBe(true);

    // ---- User tries the natural, expected action: "Confirm Remaining Draft Quantities" ----
    const confirmResult = await confirmAiDraftQuantities(actor(), boq.id);
    expect(confirmResult.confirmedCount).toBe(0); // proves H1: the button cannot touch this item
    // THE FIX: the response now names which item was skipped, not just a count.
    expect(confirmResult.skippedItems.some((s) => s.id === draftedItem.id)).toBe(true);

    // ---- Real "Check again": answerTayqanWorkOrderBlocker with RETRY (what the UI button actually calls) ----
    const secondCheck = await answerTayqanWorkOrderBlocker(actor(), projectSlug, { workOrderId: order.id, action: "RETRY" });
    // Confirms the loop: identical block, same item still named — not a stale
    // cache issue (H3 ruled out — this is a freshly re-evaluated result).
    expect(secondCheck.status).toBe("NEEDS_INPUT");
    expect(secondCheck.blocker?.i18nKey).toBe("tayqan.hire.workflow.draftReadyForReview");
    expect(secondCheck.blocker?.pendingItems?.some((p) => p.id === draftedItem.id)).toBe(true);

    // ---- The ACTUAL working fix path: a genuine manual edit+save of this exact row ----
    const current = await getBOQ(companyId, boq.id);
    const toEdit = current.sections.flatMap((s) => s.items).find((i) => i.id === draftedItem.id)!;
    toEdit.quantity = 12;
    toEdit.unit = "m2";
    await updateBOQ(companyId, boq.id, current);

    const provenanceAfterEdit = await prisma.bOQItemQuantityProvenance.findFirstOrThrow({ where: { boqItemId: draftedItem.id } });
    expect(provenanceAfterEdit.sourceType).toBe(QuantityProvenanceSource.MANUAL_CONFIRMED);
    expect(provenanceAfterEdit.confirmedAt).not.toBeNull();

    // ---- Check again, for real this time: pendingQuantityCount must reach 0 and the gate must clear ----
    const thirdCheck = await answerTayqanWorkOrderBlocker(actor(), projectSlug, { workOrderId: order.id, action: "RETRY" });
    expect(thirdCheck.blocker?.i18nKey).not.toBe("tayqan.hire.workflow.draftReadyForReview");
  });

  it("a genuinely unconfirmed AI Draft item (freshly generated, never touched) still correctly blocks — the professional-review guarantee is not weakened", async () => {
    const entity = await prisma.extractedEntity.create({
      data: {
        companyId, projectId, projectFileId,
        entityType: ExtractedEntityType.DOOR,
        label: `Never-touched door ${RUN_ID}`,
        quantity: null,
        unit: null,
        confidence: 65,
        extractionMethod: ExtractionMethod.VISION_MODEL,
        sourceReference: "A-102",
        status: ExtractedEntityStatus.EXTRACTED,
      },
    });

    const boq = await prisma.bOQ.create({
      data: { companyId, projectId, title: `Never Touched BOQ ${RUN_ID}`, revisionNumber: 2, version: 1 },
    });

    const draftResult = await generateAiDraftBoq(actor(), projectSlug, {
      targetBoqId: boq.id,
      quantityMode: "TAYQAN_MEASUREMENT_PROPOSAL",
    });
    // >=1, not ===1: generateAiDraftBoq scans every EXTRACTED/NEEDS_REVIEW/etc.
    // entity in the project, not just the one this test just created — it may
    // also pick up a still-EXTRACTED entity left behind by a sibling test in
    // this same describe block sharing the same project. The item this test
    // actually cares about is located below by matching entity.label, not by
    // this count.
    expect(draftResult.addedCount).toBeGreaterThanOrEqual(1);

    const afterGenerate = await getBOQ(companyId, boq.id);
    const draftedItem = afterGenerate.sections.flatMap((s) => s.items).find((i) => i.description === entity.label)!;

    const aiDraft: NonNullable<WorkProgress["aiDraft"]> = {
      boqId: boq.id,
      addedCount: draftResult.addedCount,
      skippedCount: draftResult.skippedCount,
      alreadyPresentCount: draftResult.alreadyPresentCount,
      unreviewedAddedCount: draftResult.unreviewedAddedCount,
      reviewedAddedCount: draftResult.reviewedAddedCount,
    };
    const session = await createIntakeSession();
    const order = await prisma.tayqanWorkOrder.create({
      data: {
        companyId, projectId, boqId: boq.id,
        intakeSessionId: session.id, hireEntitlementId: entitlementId, createdByUserId: userId,
        status: TayqanWorkStatus.RUNNING, stage: TayqanWorkStage.BOQ_ASSEMBLY,
        desiredDeliverable: "COMPLETE_BOQ_FROM_SOURCES", includeRates: false,
        startIdempotencyKey: `ai-draft-loop-untouched-${RUN_ID}`,
        progressJson: JSON.parse(JSON.stringify({ aiDraft })),
      },
    });

    // Even calling "Confirm Remaining Draft Quantities" first — the same
    // real action a customer would take — must not silently wave this item
    // through without a real confirmedByUserId/confirmedAt.
    await confirmAiDraftQuantities(actor(), boq.id);

    const state = await advanceTayqanWorkOrder(actor(), projectId, order.id);
    expect(state.status).toBe("NEEDS_INPUT");
    expect(state.blocker?.i18nKey).toBe("tayqan.hire.workflow.draftReadyForReview");
    expect(state.blocker?.pendingItems?.some((p) => p.id === draftedItem.id)).toBe(true);

    const provenance = await prisma.bOQItemQuantityProvenance.findFirstOrThrow({ where: { boqItemId: draftedItem.id } });
    expect(provenance.confirmedAt).toBeNull();
    expect(provenance.confirmedByUserId).toBeNull();
  });
});
