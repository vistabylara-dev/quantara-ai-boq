import { prisma } from "@/lib/db/prisma";
import { MarginMode } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { assertValidCalculatedResult } from "@/lib/calculations/quantity-domain-validator";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors/app-error";
import {
  createPreparedBOQItem,
  getBOQ,
  getBOQRecord,
  prepareBOQItemCreation,
} from "@/lib/repositories/boq-repository";
import { createAuditLog } from "@/lib/repositories/audit-repository";

export type ImportEntityToBoqInput = {
  sectionId: string;
  itemNumber: number;
  itemCode: string;
  category: string;
  description: string;
  unit: string;
  quantity: number;
  /** Spec section 28: never import a selling price from the drawing — commercial values always come from catalogue/supplier-rate/library-default/manual-confirmed-input, supplied explicitly here by the user. */
  unitCost: number;
  marginPercentage: number;
  /**
   * Guided BOQ measurement workflow (Release 1), spec section 9 — when a
   * physical measurement calculation was applicable, the caller passes the
   * ID of the CONFIRMED QuantityCalculation the professional reviewed
   * instead of trusting `quantity`/`unit` directly. When omitted, behavior
   * is byte-identical to before this change: `quantity`/`unit` are used
   * as-is (the simple count/schedule case, which never required a
   * dimensional calculation and must not be forced through one).
   */
  quantityCalculationId?: string;
};

export type CanonicalProjectIdentity = { id: string };

/**
 * Imports a confirmed (or corrected) extracted entity into a BOQ as a new
 * item. Only confirmed entities may be imported (spec section 28); the
 * entity is marked IMPORTED afterward so it cannot be silently
 * re-imported, but the BOQItem itself is fully independent once created.
 */
export async function importExtractedEntityToBoq(
  actor: CurrentActor,
  boqId: string,
  entityId: string,
  input: ImportEntityToBoqInput,
  canonicalProject?: CanonicalProjectIdentity,
) {
  requireCapability(actor, "boq:edit");
  const result = await prisma.$transaction(async (tx) => {
    const entity = await tx.extractedEntity.findFirst({
      where: { id: entityId, companyId: actor.companyId },
    });
    if (!entity) throw new NotFoundError("Extracted entity not found.");

    // Existing direct service callers have no route identifier and remain
    // safely anchored to the entity project. HTTP callers always pass the
    // canonically resolved route project.
    const canonicalProjectId = canonicalProject?.id ?? entity.projectId;
    if (entity.projectId !== canonicalProjectId) {
      throw new AppError(
        "ENTITY_PROJECT_MISMATCH",
        "The extracted entity does not belong to the route project.",
        400,
      );
    }

    if (entity.status !== "CONFIRMED" && entity.status !== "CORRECTED") {
      throw new AppError("ENTITY_NOT_CONFIRMED", "Only confirmed or corrected entities may be imported to a BOQ.", 409);
    }

    const boq = await getBOQRecord(actor.companyId, boqId, tx);
    if (boq.projectId !== canonicalProjectId) {
      throw new AppError(
        "BOQ_PROJECT_MISMATCH",
        "The target BOQ does not belong to the route project.",
        400,
      );
    }

    let quantity = input.quantity;
    let unit = input.unit;
    if (input.quantityCalculationId) {
      const calculation = await tx.quantityCalculation.findFirst({
        where: { id: input.quantityCalculationId, companyId: actor.companyId },
      });
      if (!calculation) throw new NotFoundError("Quantity calculation not found.");
      if (calculation.projectId !== canonicalProjectId) {
        throw new AppError(
          "CALCULATION_PROJECT_MISMATCH",
          "This calculation does not belong to the route project.",
          400,
        );
      }
      if (calculation.extractedEntityId !== entity.id) {
        throw new AppError("CALCULATION_ENTITY_MISMATCH", "This calculation does not belong to the extracted entity being imported.", 400);
      }
      if (calculation.status !== "CONFIRMED") {
        throw new AppError("CALCULATION_NOT_CONFIRMED", "This calculation must be professionally confirmed before it can be imported to a BOQ.", 409);
      }
      // The confirmed calculation's result is authoritative once a calculation is supplied —
      // never a caller-supplied quantity that bypassed the review the professional just did.
      quantity = calculation.resultValue.toNumber();
      unit = calculation.resultUnit;
    }

    assertValidCalculatedResult(quantity);

    // This final read-only preparation proves section -> BOQ ownership,
    // editability and pricing inputs before the conditional entity claim.
    const preparedItem = await prepareBOQItemCreation(actor.companyId, input.sectionId, {
      itemNumber: input.itemNumber,
      itemCode: input.itemCode,
      category: input.category,
      description: input.description,
      specification: entity.sourceText ?? "",
      quantity: String(quantity),
      unit,
      unitCost: input.unitCost,
      marginMode: MarginMode.MARKUP,
      marginPercentage: input.marginPercentage,
      // Evidence visibility (spec section 10) — these were previously never populated on
      // import, silently discarding the entity's own provenance and confidence.
      sourceReference: entity.sourceReference ?? "",
      confidenceScore: entity.confidence.toNumber(),
    }, tx, boq.id);

    const claimed = await tx.extractedEntity.updateMany({
      where: {
        id: entity.id,
        companyId: actor.companyId,
        projectId: canonicalProjectId,
        status: { in: ["CONFIRMED", "CORRECTED"] },
      },
      data: { status: "IMPORTED" },
    });
    if (claimed.count !== 1) {
      throw new ConflictError(
        "ENTITY_IMPORT_CONFLICT",
        "The extracted entity was already imported or changed by another request.",
      );
    }

    const item = await createPreparedBOQItem(actor.companyId, preparedItem, tx);
    await createAuditLog(actor.companyId, {
      entityType: "BOQItem",
      entityId: item.id,
      action: "ENTITY_IMPORTED_TO_BOQ",
      payload: {
        extractedEntityId: entity.id,
        quantityCalculationId: input.quantityCalculationId ?? null,
        quantity,
        unit,
      },
    }, tx);

    return { item, boq: await getBOQ(actor.companyId, boq.id, tx) };
  });

  return result;
}
