import { prisma } from "@/lib/db/prisma";
import { MarginMode } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError } from "@/lib/errors/app-error";
import { createBOQItem, getBOQ } from "@/lib/repositories/boq-repository";
import { getExtractedEntityRecord } from "@/lib/repositories/extracted-entity-repository";
import { getQuantityCalculationRecord } from "@/lib/repositories/quantity-calculation-repository";
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

/**
 * Imports a confirmed (or corrected) extracted entity into a BOQ as a new
 * item. Only confirmed entities may be imported (spec section 28); the
 * entity is marked IMPORTED afterward so it cannot be silently
 * re-imported, but the BOQItem itself is fully independent once created.
 */
export async function importExtractedEntityToBoq(actor: CurrentActor, boqId: string, entityId: string, input: ImportEntityToBoqInput) {
  requireCapability(actor, "boq:edit");
  const entity = await getExtractedEntityRecord(actor.companyId, entityId);

  if (entity.status !== "CONFIRMED" && entity.status !== "CORRECTED") {
    throw new AppError("ENTITY_NOT_CONFIRMED", "Only confirmed or corrected entities may be imported to a BOQ.", 409);
  }

  let quantity = input.quantity;
  let unit = input.unit;
  if (input.quantityCalculationId) {
    const calculation = await getQuantityCalculationRecord(actor.companyId, input.quantityCalculationId);
    if (calculation.extractedEntityId !== entityId) {
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

  const result = await createBOQItem(actor.companyId, input.sectionId, {
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
  });

  await prisma.extractedEntity.update({ where: { id: entityId }, data: { status: "IMPORTED" } });

  await createAuditLog(actor.companyId, {
    entityType: "BOQItem",
    entityId: result.item.id,
    action: "ENTITY_IMPORTED_TO_BOQ",
    payload: {
      extractedEntityId: entityId,
      quantityCalculationId: input.quantityCalculationId ?? null,
      quantity,
      unit,
    },
  });

  return { item: result.item, boq: await getBOQ(actor.companyId, boqId) };
}
