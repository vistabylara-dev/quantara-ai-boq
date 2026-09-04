import {
  BOQItemStatus,
  BOQStatus,
  ExtractedEntityStatus,
  Prisma,
  QuantityProvenanceSource,
} from "@prisma/client";
import { calculateBOQItem } from "@/lib/calculations/boq-calculator";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { prisma } from "@/lib/db/prisma";
import { assertBOQEditable } from "@/lib/domain/boq-guards";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { getBOQ } from "@/lib/repositories/boq-repository";
import type { ParsedBOQSystemQuantityOverrideInput } from "@/lib/validation/boq-quantity-override-schema";

const SYSTEM_CALCULATION_PREFIX = "UNIVERSAL";
const SHA_256_HEX = /^[a-f0-9]{64}$/i;

/**
 * Accepts both versioned and unversioned universal identities. In either
 * form, the final two segments must bind the calculation to an immutable
 * operation hash and measurement fingerprint.
 */
export function isUniversalSystemCalculationIdentity(calculatedBy: string): boolean {
  const segments = calculatedBy.split(":");
  return segments[0] === SYSTEM_CALCULATION_PREFIX
    && segments.length >= 3
    && SHA_256_HEX.test(segments.at(-2) ?? "")
    && SHA_256_HEX.test(segments.at(-1) ?? "");
}

type ItemWithOverrideGraph = Prisma.BOQItemGetPayload<{
  include: {
    quantityProvenance: true;
    section: {
      include: {
        boq: {
          include: { project: true };
        };
      };
    };
  };
}>;

function assertExpectedState(
  item: ItemWithOverrideGraph,
  calculation: {
    resultValue: Prisma.Decimal;
  },
  input: ParsedBOQSystemQuantityOverrideInput,
) {
  const boq = item.section.boq;
  if (
    boq.id !== input.expected.boqId
    || boq.version !== input.expected.boqVersion
    || boq.revisionNumber !== input.expected.boqRevisionNumber
    || !item.quantity.equals(input.expected.itemQuantity)
    || item.unit !== input.expected.itemUnit
    || !calculation.resultValue.equals(input.expected.calculationResultValue)
  ) {
    throw new ConflictError(
      "QUANTITY_OVERRIDE_STALE",
      "The BOQ, item or system calculation changed after it was reviewed. Reload the current revision and try again.",
    );
  }
}

function assertSystemCalculationGraph(
  item: ItemWithOverrideGraph,
  calculation: {
    id: string;
    companyId: string;
    projectId: string;
    extractedEntityId: string | null;
    resultValue: Prisma.Decimal;
    resultUnit: string;
    status: ExtractedEntityStatus;
    manuallyOverridden: boolean;
    originalResultValue: Prisma.Decimal | null;
    calculatedBy: string;
    confirmedByUserId: string | null;
    confirmedAt: Date | null;
  },
  calculationId: string,
) {
  const boq = item.section.boq;
  const provenance = item.quantityProvenance;

  if (
    calculation.id !== calculationId
    || calculation.companyId !== item.companyId
    || calculation.projectId !== boq.projectId
  ) {
    throw new ConflictError(
      "QUANTITY_OVERRIDE_CALCULATION_MISMATCH",
      "The linked system calculation does not belong to this BOQ item.",
    );
  }
  if (
    calculation.status !== ExtractedEntityStatus.CONFIRMED
    || calculation.confirmedAt === null
    || calculation.confirmedByUserId !== null
    || !isUniversalSystemCalculationIdentity(calculation.calculatedBy)
  ) {
    throw new AppError(
      "QUANTITY_OVERRIDE_SYSTEM_CALCULATION_REQUIRED",
      "Only a confirmed Quantara system calculation can be deliberately overridden from this lane.",
      409,
    );
  }
  if (
    !provenance
    || provenance.companyId !== item.companyId
    || provenance.projectId !== boq.projectId
    || provenance.boqItemId !== item.id
    || provenance.sourceType !== QuantityProvenanceSource.CONFIRMED_CALCULATION
    || provenance.quantityCalculationId !== calculation.id
    || provenance.confirmedAt === null
    || provenance.confirmedByUserId !== null
  ) {
    throw new ConflictError(
      "QUANTITY_OVERRIDE_PROVENANCE_MISMATCH",
      "The BOQ item does not carry matching system-calculation provenance.",
    );
  }
  if (
    provenance.extractedEntityId !== null
    && calculation.extractedEntityId !== provenance.extractedEntityId
  ) {
    throw new ConflictError(
      "QUANTITY_OVERRIDE_PROVENANCE_MISMATCH",
      "The BOQ item provenance points to different measurement evidence.",
    );
  }
  if (
    !provenance.quantitySnapshot.equals(item.quantity)
    || provenance.unitSnapshot !== item.unit
    || !calculation.resultValue.equals(item.quantity)
    || calculation.resultUnit !== item.unit
  ) {
    throw new ConflictError(
      "QUANTITY_OVERRIDE_PROVENANCE_STALE",
      "The current BOQ quantity no longer matches its linked system calculation and provenance snapshot.",
    );
  }
  if (calculation.manuallyOverridden && calculation.originalResultValue === null) {
    throw new ConflictError(
      "QUANTITY_OVERRIDE_ORIGINAL_MISSING",
      "The original system-calculated quantity is unavailable, so another override cannot be recorded safely.",
    );
  }
}

export async function overrideSystemCalculatedBOQItemQuantityRecord(
  actor: CurrentActor,
  itemId: string,
  input: ParsedBOQSystemQuantityOverrideInput,
) {
  const overriddenAt = new Date();
  const transactionResult = await prisma.$transaction(async (tx) => {
    const item = await tx.bOQItem.findFirst({
      where: { id: itemId, companyId: actor.companyId },
      include: {
        quantityProvenance: true,
        section: {
          include: {
            boq: { include: { project: true } },
          },
        },
      },
    });
    if (!item) throw new NotFoundError("BOQ item not found.");

    const boq = item.section.boq;
    assertBOQEditable(boq, "edit");
    if (boq.project.currentRevisionNumber !== boq.revisionNumber) {
      throw new ConflictError(
        "BOQ_REVISION_HISTORICAL",
        "Quantities can only be overridden on the current editable BOQ revision.",
      );
    }

    const calculation = await tx.quantityCalculation.findFirst({
      where: {
        id: input.quantityCalculationId,
        companyId: actor.companyId,
      },
    });
    if (!calculation) throw new NotFoundError("Quantity calculation not found.");

    assertExpectedState(item, calculation, input);
    assertSystemCalculationGraph(item, calculation, input.quantityCalculationId);

    const liveLinks = await tx.bOQItemQuantityProvenance.findMany({
      where: {
        companyId: actor.companyId,
        quantityCalculationId: calculation.id,
        boqItem: { status: { not: BOQItemStatus.REJECTED } },
      },
      select: { boqItemId: true },
    });
    if (liveLinks.length !== 1 || liveLinks[0]?.boqItemId !== item.id) {
      throw new ConflictError(
        "QUANTITY_OVERRIDE_CALCULATION_NOT_EXCLUSIVE",
        "This system calculation is linked to multiple live BOQ items or to a different item and cannot be overridden safely.",
      );
    }

    const originalSystemQuantity = calculation.manuallyOverridden
      ? calculation.originalResultValue!
      : calculation.resultValue;
    const previousQuantity = item.quantity;
    const amounts = calculateBOQItem({
      quantity: input.quantity,
      unitCost: item.unitCost,
      freightCost: item.freightCost,
      installationCost: item.installationCost,
      additionalCost: item.additionalCost,
      marginMode: item.marginMode,
      marginPercentage: item.marginPercentage,
    });

    const claimedBoq = await tx.bOQ.updateMany({
      where: {
        id: boq.id,
        companyId: actor.companyId,
        projectId: boq.projectId,
        revisionNumber: input.expected.boqRevisionNumber,
        version: input.expected.boqVersion,
        isLocked: false,
        status: { notIn: [BOQStatus.LOCKED, BOQStatus.ISSUED, BOQStatus.APPROVED] },
        project: { currentRevisionNumber: input.expected.boqRevisionNumber },
      },
      data: {
        status: BOQStatus.NEEDS_VERIFICATION,
        version: { increment: 1 },
        verifiedVersion: null,
        verifiedAt: null,
      },
    });
    if (claimedBoq.count !== 1) {
      throw new ConflictError(
        "CONCURRENT_WRITE_CONFLICT",
        "The BOQ changed, was locked, or is no longer the current revision. Reload and retry.",
      );
    }

    const updatedCalculation = await tx.quantityCalculation.updateMany({
      where: {
        id: calculation.id,
        companyId: actor.companyId,
        projectId: boq.projectId,
        status: ExtractedEntityStatus.CONFIRMED,
        confirmedAt: calculation.confirmedAt,
        confirmedByUserId: null,
        calculatedBy: calculation.calculatedBy,
        resultValue: calculation.resultValue,
        resultUnit: calculation.resultUnit,
        manuallyOverridden: calculation.manuallyOverridden,
      },
      data: {
        resultValue: input.quantity,
        manuallyOverridden: true,
        originalResultValue: originalSystemQuantity,
        overrideReason: input.reason,
      },
    });
    if (updatedCalculation.count !== 1) {
      throw new ConflictError(
        "QUANTITY_OVERRIDE_CALCULATION_CONFLICT",
        "The system calculation changed while the override was being recorded. Reload and retry.",
      );
    }

    const updatedItem = await tx.bOQItem.updateMany({
      where: {
        id: item.id,
        companyId: actor.companyId,
        sectionId: item.sectionId,
        quantity: item.quantity,
        unit: item.unit,
        status: { not: BOQItemStatus.LOCKED },
      },
      data: {
        quantity: input.quantity,
        ...amounts,
      },
    });
    if (updatedItem.count !== 1) {
      throw new ConflictError(
        "QUANTITY_OVERRIDE_ITEM_CONFLICT",
        "The BOQ item changed while the override was being recorded. Reload and retry.",
      );
    }

    const provenance = item.quantityProvenance!;
    const updatedProvenance = await tx.bOQItemQuantityProvenance.updateMany({
      where: {
        id: provenance.id,
        companyId: actor.companyId,
        projectId: boq.projectId,
        boqItemId: item.id,
        sourceType: QuantityProvenanceSource.CONFIRMED_CALCULATION,
        quantityCalculationId: calculation.id,
        quantitySnapshot: provenance.quantitySnapshot,
        unitSnapshot: provenance.unitSnapshot,
        confirmedByUserId: null,
        confirmedAt: provenance.confirmedAt,
      },
      data: {
        quantitySnapshot: input.quantity,
      },
    });
    if (updatedProvenance.count !== 1) {
      throw new ConflictError(
        "QUANTITY_OVERRIDE_PROVENANCE_CONFLICT",
        "The quantity provenance changed while the override was being recorded. Reload and retry.",
      );
    }

    const auditPayload = {
      boqId: boq.id,
      boqRevisionNumber: boq.revisionNumber,
      boqVersionBefore: boq.version,
      boqVersionAfter: boq.version + 1,
      boqItemId: item.id,
      itemCode: item.itemCode,
      quantityCalculationId: calculation.id,
      calculationIdentity: calculation.calculatedBy,
      originalSystemQuantity: originalSystemQuantity.toString(),
      previousQuantity: previousQuantity.toString(),
      newQuantity: input.quantity.toString(),
      unit: item.unit,
      previousTotalAmount: item.totalAmount.toString(),
      newTotalAmount: amounts.totalAmount.toString(),
      reason: input.reason,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      overriddenAt: overriddenAt.toISOString(),
    } satisfies Prisma.InputJsonObject;

    await createAuditLog(actor.companyId, {
      entityType: "BOQItem",
      entityId: item.id,
      action: "ITEM_CHANGED",
      actorName: actor.fullName,
      payload: {
        boqId: boq.id,
        sectionId: item.sectionId,
        itemCode: item.itemCode,
      },
    }, tx);
    await createAuditLog(actor.companyId, {
      entityType: "BOQItem",
      entityId: item.id,
      action: "SYSTEM_QUANTITY_OVERRIDDEN",
      actorName: actor.fullName,
      payload: auditPayload,
    }, tx);
    await createAuditLog(actor.companyId, {
      entityType: "QuantityCalculation",
      entityId: calculation.id,
      action: "CALCULATION_OVERRIDDEN",
      actorName: actor.fullName,
      payload: auditPayload,
    }, tx);

    return {
      boqId: boq.id,
      calculationId: calculation.id,
      originalSystemQuantity: originalSystemQuantity.toString(),
      previousQuantity: previousQuantity.toString(),
      quantity: input.quantity.toString(),
      unit: item.unit,
      previousTotalAmount: item.totalAmount.toString(),
      totalAmount: amounts.totalAmount.toString(),
      reason: input.reason,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      overriddenAt: overriddenAt.toISOString(),
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });

  return {
    override: transactionResult,
    boq: await getBOQ(actor.companyId, transactionResult.boqId),
  };
}
