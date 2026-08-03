import { prisma } from "@/lib/db/prisma";
import { MarginMode } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError } from "@/lib/errors/app-error";
import { createBOQItem, getBOQ } from "@/lib/repositories/boq-repository";
import { getExtractedEntityRecord } from "@/lib/repositories/extracted-entity-repository";

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

  const result = await createBOQItem(actor.companyId, input.sectionId, {
    itemNumber: input.itemNumber,
    itemCode: input.itemCode,
    category: input.category,
    description: input.description,
    specification: entity.sourceText ?? "",
    quantity: String(input.quantity),
    unit: input.unit,
    unitCost: input.unitCost,
    marginMode: MarginMode.MARKUP,
    marginPercentage: input.marginPercentage,
  });

  await prisma.extractedEntity.update({ where: { id: entityId }, data: { status: "IMPORTED" } });

  return { item: result.item, boq: await getBOQ(actor.companyId, boqId) };
}
