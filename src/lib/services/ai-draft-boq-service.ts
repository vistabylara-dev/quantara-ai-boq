import {
  BOQItemStatus,
  BOQStatus,
  BoqItemSourceType,
  MarginMode,
  Prisma,
  QuantityProvenanceSource,
  RateProvenanceSource,
} from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { calculateBOQItem } from "@/lib/calculations/boq-calculator";
import { prisma } from "@/lib/db/prisma";
import { assertBOQEditable } from "@/lib/domain/boq-guards";
import { ConflictError } from "@/lib/errors/app-error";
import {
  chooseAiDraftSection,
  formatAiDraftCategory,
  getAiDraftExtractedEntityId,
  isAiDraftCandidateUsable,
  summarizeAiDraftCandidates,
  type AiDraftCandidate,
  type AiDraftSection,
} from "@/lib/guidance/ai-draft-boq";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import {
  createProjectBOQ,
  getBOQRecord,
} from "@/lib/repositories/boq-repository";
import { getProjectRecord } from "@/lib/repositories/project-repository";

const AI_DRAFT_FALLBACK_CODE = "AI-DRAFT";
const REVIEWABLE_ENTITY_STATUSES = new Set(["EXTRACTED", "NEEDS_REVIEW"]);
const REVIEWED_ENTITY_STATUSES = new Set(["CONFIRMED", "CORRECTED", "IMPORTED"]);

function extractionMarker(entityId: string): string {
  return `EXTRACTED_ENTITY:${entityId}`;
}

function toCandidate(entity: {
  id: string;
  entityType: string;
  label: string;
  quantity: Prisma.Decimal | null;
  unit: string | null;
  confidence: Prisma.Decimal;
  sourceText: string | null;
  status: string;
}): AiDraftCandidate {
  return {
    id: entity.id,
    entityType: entity.entityType,
    label: entity.label,
    quantity: entity.quantity?.toNumber() ?? null,
    unit: entity.unit,
    confidence: entity.confidence.toNumber(),
    sourceText: entity.sourceText,
    status: entity.status,
  };
}

function sectionView(section: {
  id: string;
  code: string;
  title: string;
  description: string;
}): AiDraftSection {
  return {
    id: section.id,
    code: section.code,
    title: section.title,
    description: section.description,
  };
}

function assertAiDraftEditable(boq: Awaited<ReturnType<typeof getBOQRecord>>) {
  if (
    boq.isLocked
    || boq.status === BOQStatus.LOCKED
    || boq.status === BOQStatus.ISSUED
    || boq.status === BOQStatus.APPROVED
  ) {
    throw new ConflictError(
      "AI_DRAFT_REQUIRES_EDITABLE_BOQ",
      "The latest BOQ revision is locked. Create a new editable revision before generating another AI Draft.",
    );
  }
  assertBOQEditable(boq, "edit");
}

export async function generateAiDraftBoq(actor: CurrentActor, projectIdentifier: string) {
  requireCapability(actor, "boq:edit");
  const project = await getProjectRecord(actor.companyId, projectIdentifier);

  const latest = await prisma.bOQ.findFirst({
    where: { companyId: actor.companyId, projectId: project.id },
    orderBy: { revisionNumber: "desc" },
    select: { id: true },
  });

  const targetBoqId = latest?.id
    ?? (await createProjectBOQ(actor.companyId, project.id)).id;

  return prisma.$transaction(async (tx) => {
    const current = await getBOQRecord(actor.companyId, targetBoqId, tx);
    assertAiDraftEditable(current);

    const rows = await tx.extractedEntity.findMany({
      where: {
        companyId: actor.companyId,
        projectId: project.id,
        status: { in: ["EXTRACTED", "NEEDS_REVIEW", "CONFIRMED", "CORRECTED"] },
      },
      orderBy: [{ projectFileId: "asc" }, { createdAt: "asc" }],
    });

    const candidates = rows.map(toCandidate);
    const summary = summarizeAiDraftCandidates(candidates);

    const currentItems = current.sections.flatMap((section) => section.items);
    const alreadyPresentIds = new Set(
      currentItems
        .map((item) =>
          item.quantityProvenance?.extractedEntityId
          ?? getAiDraftExtractedEntityId(item.sourceReference),
        )
        .filter((value): value is string => Boolean(value)),
    );

    const toAdd = rows
      .map((row) => ({ row, candidate: toCandidate(row) }))
      .filter(({ row, candidate }) =>
        !alreadyPresentIds.has(row.id) && isAiDraftCandidateUsable(candidate),
      );

    if (toAdd.length === 0) {
      return {
        boqId: current.id,
        addedCount: 0,
        skippedCount: summary.skippedCount,
        alreadyPresentCount: alreadyPresentIds.size,
        unreviewedAddedCount: 0,
        reviewedAddedCount: 0,
      };
    }

    const businessSections = current.sections
      .filter((section) => section.code !== AI_DRAFT_FALLBACK_CODE)
      .map(sectionView);

    const needsFallbackSection = toAdd.some(({ candidate }) =>
      chooseAiDraftSection(businessSections, candidate) === null,
    );

    const claimed = await tx.bOQ.updateMany({
      where: {
        id: current.id,
        companyId: actor.companyId,
        isLocked: false,
        version: current.version,
      },
      data: {
        status: BOQStatus.NEEDS_VERIFICATION,
        version: { increment: 1 },
        verifiedVersion: null,
        verifiedAt: null,
      },
    });

    if (claimed.count !== 1) {
      throw new ConflictError(
        "CONCURRENT_WRITE_CONFLICT",
        "The BOQ changed while Quantara was preparing the AI Draft. Reload and try again.",
      );
    }

    let fallbackSectionId = current.sections.find(
      (section) => section.code === AI_DRAFT_FALLBACK_CODE,
    )?.id ?? null;

    if (needsFallbackSection && !fallbackSectionId) {
      const created = await tx.bOQSection.create({
        data: {
          companyId: actor.companyId,
          boqId: current.id,
          code: AI_DRAFT_FALLBACK_CODE,
          title: "AI Draft - Review",
          description:
            "Extracted project items that could not be matched safely to an existing industry BOQ section. Professional review required.",
          sortOrder:
            Math.max(0, ...current.sections.map((section) => section.sortOrder)) + 1,
        },
        select: { id: true },
      });
      fallbackSectionId = created.id;
    }

    const nextSortOrderBySection = new Map<string, number>();
    for (const section of current.sections) {
      nextSortOrderBySection.set(section.id, section.items.length + 1);
    }
    if (fallbackSectionId && !nextSortOrderBySection.has(fallbackSectionId)) {
      nextSortOrderBySection.set(fallbackSectionId, 1);
    }

    let itemNumber = Math.max(
      0,
      ...currentItems.map((item) => item.itemNumber),
    );
    let reviewedAddedCount = 0;
    let unreviewedAddedCount = 0;

    for (const { row, candidate } of toAdd) {
      const matchedSectionId = chooseAiDraftSection(businessSections, candidate);
      const sectionId = matchedSectionId ?? fallbackSectionId;

      if (!sectionId) {
        throw new ConflictError(
          "AI_DRAFT_SECTION_UNAVAILABLE",
          "Quantara could not identify a safe BOQ section for the AI Draft item.",
        );
      }

      itemNumber += 1;
      const sortOrder = nextSortOrderBySection.get(sectionId) ?? 1;
      nextSortOrderBySection.set(sectionId, sortOrder + 1);

      const quantity = new Prisma.Decimal(row.quantity!);
      const zero = new Prisma.Decimal(0);
      const marginMode = MarginMode.MARKUP;
      const amounts = calculateBOQItem({
        quantity,
        unitCost: zero,
        freightCost: zero,
        installationCost: zero,
        additionalCost: zero,
        marginMode,
        marginPercentage: zero,
      });

      const marker = extractionMarker(row.id);
      const retainedSourceReference = row.sourceReference?.trim();
      const sourceReference = retainedSourceReference
        ? `${retainedSourceReference} | ${marker}`
        : marker;

      const item = await tx.bOQItem.create({
        data: {
          companyId: actor.companyId,
          sectionId,
          itemNumber,
          itemCode: `AI-${row.id.replace(/-/g, "").slice(0, 16).toUpperCase()}`,
          category: matchedSectionId
            ? current.sections.find((section) => section.id === matchedSectionId)?.title
              ?? formatAiDraftCategory(row.entityType)
            : formatAiDraftCategory(row.entityType),
          description: row.label,
          specification: row.sourceText ?? "",
          quantity,
          unit: row.unit!.trim(),
          unitCost: zero,
          freightCost: zero,
          installationCost: zero,
          additionalCost: zero,
          ...amounts,
          marginMode,
          marginPercentage: zero,
          wastagePercentage: zero,
          taxApplicable: true,
          sourceReference,
          confidenceScore: row.confidence,
          status: BOQItemStatus.DRAFT,
          notes:
            "AI Draft from extracted project evidence. Professional quantity review and commercial rate selection are still required.",
          sortOrder,
          sourceType: BoqItemSourceType.IMPORT,
        },
      });

      const previouslyReviewed = (
        (row.status === "CONFIRMED" || row.status === "CORRECTED")
        && row.confirmedAt !== null
      );

      await tx.bOQItemQuantityProvenance.create({
        data: {
          companyId: actor.companyId,
          projectId: project.id,
          boqItemId: item.id,
          sourceType: previouslyReviewed
            ? QuantityProvenanceSource.REVIEWED_EXTRACTION
            : QuantityProvenanceSource.LEGACY_UNVERIFIED,
          extractedEntityId: row.id,
          projectFileId: row.projectFileId,
          quantitySnapshot: quantity,
          unitSnapshot: row.unit!.trim(),
          confirmedByUserId: previouslyReviewed ? row.confirmedByUserId : null,
          confirmedByName: previouslyReviewed
            ? "Previously reviewed extraction"
            : "AI draft - professional review pending",
          confirmedAt: previouslyReviewed ? row.confirmedAt : null,
        },
      });

      await tx.bOQItemRateProvenance.create({
        data: {
          companyId: actor.companyId,
          projectId: project.id,
          boqItemId: item.id,
          sourceType: RateProvenanceSource.LEGACY_UNVERIFIED,
          unitCostSnapshot: zero,
          freightCostSnapshot: zero,
          installationCostSnapshot: zero,
          additionalCostSnapshot: zero,
          marginModeSnapshot: marginMode,
          marginPercentageSnapshot: zero,
          currencySnapshot: current.project.currency,
          confirmedByUserId: null,
          confirmedByName: "AI draft - rate selection pending",
          confirmedAt: null,
        },
      });

      if (previouslyReviewed) {
        const imported = await tx.extractedEntity.updateMany({
          where: {
            id: row.id,
            companyId: actor.companyId,
            projectId: project.id,
            status: { in: ["CONFIRMED", "CORRECTED"] },
          },
          data: { status: "IMPORTED" },
        });
        if (imported.count !== 1) {
          throw new ConflictError(
            "AI_DRAFT_ENTITY_IMPORT_CONFLICT",
            "A reviewed extraction changed while the AI Draft was being prepared. Reload and try again.",
          );
        }

        await createAuditLog(actor.companyId, {
          entityType: "ExtractedEntity",
          entityId: row.id,
          action: "ENTITY_IMPORTED_TO_BOQ",
          actorName: actor.fullName,
          payload: { boqId: current.id, source: "AI_DRAFT" },
        }, tx);
        reviewedAddedCount += 1;
      } else {
        unreviewedAddedCount += 1;
      }

      await createAuditLog(actor.companyId, {
        entityType: "BOQItem",
        entityId: item.id,
        action: "AI_DRAFT_ITEM_ADDED",
        actorName: actor.fullName,
        payload: {
          boqId: current.id,
          extractedEntityId: row.id,
          quantity: quantity.toString(),
          unit: row.unit!.trim(),
          confidence: row.confidence.toString(),
          rateAutomaticallyApplied: false,
        },
      }, tx);
    }

    await createAuditLog(actor.companyId, {
      entityType: "BOQ",
      entityId: current.id,
      action: "AI_DRAFT_GENERATED",
      actorName: actor.fullName,
      payload: {
        projectId: project.id,
        addedCount: toAdd.length,
        skippedCount: summary.skippedCount,
        alreadyPresentCount: alreadyPresentIds.size,
        reviewedAddedCount,
        unreviewedAddedCount,
        ratesAutomaticallyApplied: false,
      },
    }, tx);

    return {
      boqId: current.id,
      addedCount: toAdd.length,
      skippedCount: summary.skippedCount,
      alreadyPresentCount: alreadyPresentIds.size,
      unreviewedAddedCount,
      reviewedAddedCount,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function confirmAiDraftQuantities(actor: CurrentActor, boqId: string) {
  requireCapability(actor, "verification:manage");

  return prisma.$transaction(async (tx) => {
    const current = await getBOQRecord(actor.companyId, boqId, tx);
    assertAiDraftEditable(current);

    const linkedItems = current.sections
      .flatMap((section) => section.items)
      .flatMap((item) => {
        const provenance = item.quantityProvenance;
        const extractedEntityId =
          provenance?.extractedEntityId
          ?? getAiDraftExtractedEntityId(item.sourceReference);

        if (!provenance || !extractedEntityId) return [];

        const unreviewedAiQuantity =
          provenance.sourceType === QuantityProvenanceSource.LEGACY_UNVERIFIED;
        const manuallyReviewedAiQuantity =
          provenance.sourceType === QuantityProvenanceSource.MANUAL_CONFIRMED
          && provenance.confirmedAt !== null
          && getAiDraftExtractedEntityId(item.sourceReference) !== null;

        if (!unreviewedAiQuantity && !manuallyReviewedAiQuantity) return [];

        return [{
          item,
          provenance,
          extractedEntityId,
          manuallyReviewedAiQuantity,
        }];
      });

    if (linkedItems.length === 0) {
      return { confirmedCount: 0, skippedCount: 0, remainingCount: 0 };
    }

    const entityIds = linkedItems.map((entry) => entry.extractedEntityId);

    const entities = await tx.extractedEntity.findMany({
      where: {
        id: { in: entityIds },
        companyId: actor.companyId,
        projectId: current.projectId,
      },
    });
    const entityById = new Map(entities.map((entity) => [entity.id, entity]));

    const now = new Date();
    let confirmedCount = 0;
    let skippedCount = 0;

    for (const {
      item,
      provenance,
      extractedEntityId,
      manuallyReviewedAiQuantity,
    } of linkedItems) {
      const entity = entityById.get(extractedEntityId);

      if (!entity) {
        skippedCount += 1;
        continue;
      }

      if (entity.status === "IMPORTED") {
        confirmedCount += 1;
        continue;
      }

      const quantityMatchesExtraction =
        entity.quantity !== null
        && entity.quantity.equals(item.quantity)
        && (entity.unit ?? "").trim() === item.unit.trim();

      if (!manuallyReviewedAiQuantity && !quantityMatchesExtraction) {
        skippedCount += 1;
        continue;
      }

      const extractionWasCorrectedInBoq =
        manuallyReviewedAiQuantity && !quantityMatchesExtraction;

      if (REVIEWABLE_ENTITY_STATUSES.has(entity.status)) {
        const original = {
          label: entity.label,
          quantity: entity.quantity?.toNumber() ?? null,
          unit: entity.unit,
        };

        const claimedEntity = await tx.extractedEntity.updateMany({
          where: {
            id: entity.id,
            companyId: actor.companyId,
            projectId: current.projectId,
            status: { in: ["EXTRACTED", "NEEDS_REVIEW"] },
          },
          data: {
            status: "IMPORTED",
            ...(extractionWasCorrectedInBoq
              ? {
                  quantity: item.quantity,
                  unit: item.unit,
                  correctionJson: {
                    original,
                    corrected: {
                      quantity: item.quantity.toNumber(),
                      unit: item.unit,
                    },
                    correctedByUserId: actor.userId,
                    correctedAt: now.toISOString(),
                    reason: "Corrected during AI Draft BOQ review.",
                  },
                }
              : {}),
            confirmedByUserId: actor.userId,
            confirmedAt: now,
          },
        });

        if (claimedEntity.count !== 1) {
          throw new ConflictError(
            "AI_DRAFT_ENTITY_CONFIRMATION_CONFLICT",
            "An extracted item changed while AI Draft quantities were being confirmed. Reload and try again.",
          );
        }

        await createAuditLog(actor.companyId, {
          entityType: "ExtractedEntity",
          entityId: entity.id,
          action: extractionWasCorrectedInBoq ? "ENTITY_CORRECTED" : "ENTITY_CONFIRMED",
          actorName: actor.fullName,
          payload: extractionWasCorrectedInBoq
            ? {
                original,
                corrected: {
                  quantity: item.quantity.toNumber(),
                  unit: item.unit,
                },
                reason: "Corrected during AI Draft BOQ review.",
              }
            : { source: "AI_DRAFT_BOQ_REVIEW" },
        }, tx);

        await createAuditLog(actor.companyId, {
          entityType: "ExtractedEntity",
          entityId: entity.id,
          action: "ENTITY_IMPORTED_TO_BOQ",
          actorName: actor.fullName,
          payload: { boqId: current.id, source: "AI_DRAFT" },
        }, tx);
      } else if (entity.status === "CONFIRMED" || entity.status === "CORRECTED") {
        const imported = await tx.extractedEntity.updateMany({
          where: {
            id: entity.id,
            companyId: actor.companyId,
            projectId: current.projectId,
            status: { in: ["CONFIRMED", "CORRECTED"] },
          },
          data: { status: "IMPORTED" },
        });

        if (imported.count !== 1) {
          throw new ConflictError(
            "AI_DRAFT_ENTITY_IMPORT_CONFLICT",
            "A reviewed extraction changed while AI Draft quantities were being confirmed. Reload and try again.",
          );
        }

        await createAuditLog(actor.companyId, {
          entityType: "ExtractedEntity",
          entityId: entity.id,
          action: "ENTITY_IMPORTED_TO_BOQ",
          actorName: actor.fullName,
          payload: { boqId: current.id, source: "AI_DRAFT" },
        }, tx);
      } else if (!REVIEWED_ENTITY_STATUSES.has(entity.status)) {
        skippedCount += 1;
        continue;
      }

      if (provenance.sourceType === QuantityProvenanceSource.LEGACY_UNVERIFIED) {
        const claimedProvenance = await tx.bOQItemQuantityProvenance.updateMany({
          where: {
            id: provenance.id,
            companyId: actor.companyId,
            boqItemId: item.id,
            sourceType: QuantityProvenanceSource.LEGACY_UNVERIFIED,
          },
          data: {
            sourceType: QuantityProvenanceSource.REVIEWED_EXTRACTION,
            quantitySnapshot: item.quantity,
            unitSnapshot: item.unit,
            confirmedByUserId: actor.userId,
            confirmedByName: actor.fullName,
            confirmedAt: now,
          },
        });

        if (claimedProvenance.count !== 1) {
          throw new ConflictError(
            "AI_DRAFT_CONFIRMATION_CONFLICT",
            "The AI Draft changed while quantities were being confirmed. Reload and try again.",
          );
        }
      }

      confirmedCount += 1;
    }

    await createAuditLog(actor.companyId, {
      entityType: "BOQ",
      entityId: current.id,
      action: "AI_DRAFT_QUANTITIES_CONFIRMED",
      actorName: actor.fullName,
      payload: {
        confirmedCount,
        skippedCount,
        remainingCount: linkedItems.length - confirmedCount,
      },
    }, tx);

    return {
      confirmedCount,
      skippedCount,
      remainingCount: linkedItems.length - confirmedCount,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
