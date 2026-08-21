import { prisma } from "@/lib/db/prisma";
import { MarginMode } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import { createBOQItem } from "@/lib/repositories/boq-repository";
import { createAuditLog } from "@/lib/repositories/audit-repository";

export type CreateBoqItemFromFindingInput = {
  correctiveActionId?: string;
  sectionId: string;
  itemNumber: number;
  itemCode: string;
  category: string;
  description: string;
  unit: string;
  quantity: number;
  /** Never derived from the finding itself — spec section 39: pricing must come from catalogue or manual confirmed input. */
  unitCost: number;
  marginPercentage: number;
};

/** Finding must be confirmed; if a corrective action is linked, it must be confirmed too. Both gates are spec-mandated (section 39). */
export async function createBoqItemsFromFinding(actor: CurrentActor, boqId: string, findingId: string, input: CreateBoqItemFromFindingInput) {
  requireCapability(actor, "boq:edit");

  const finding = await prisma.inspectionFinding.findFirst({ where: { id: findingId, companyId: actor.companyId } });
  if (!finding) throw new NotFoundError("Finding not found.");
  if (finding.status !== "CONFIRMED" && finding.status !== "CLOSED") {
    throw new AppError("FINDING_NOT_CONFIRMED", "The finding must be confirmed before a BOQ item can be created from it.", 409);
  }

  if (input.correctiveActionId) {
    const action = await prisma.correctiveAction.findFirst({ where: { id: input.correctiveActionId, companyId: actor.companyId } });
    if (!action) throw new NotFoundError("Corrective action not found.");
    if (action.status !== "CONFIRMED") {
      throw new AppError("ACTION_NOT_CONFIRMED", "The corrective action must be confirmed before a BOQ item can be created from it.", 409);
    }
  }

  const result = await createBOQItem(actor.companyId, input.sectionId, {
    itemNumber: input.itemNumber,
    itemCode: input.itemCode,
    category: input.category,
    description: input.description,
    specification: finding.description,
    quantity: String(input.quantity),
    unit: input.unit,
    unitCost: input.unitCost,
    marginMode: MarginMode.MARKUP,
    marginPercentage: input.marginPercentage,
  });

  const link = await prisma.findingBoqLink.create({
    data: {
      companyId: actor.companyId,
      inspectionFindingId: findingId,
      correctiveActionId: input.correctiveActionId,
      boqId,
      boqItemId: result.item.id,
      quantitySource: "manual-confirmed-input",
      createdByUserId: actor.userId,
    },
  });

  await createAuditLog(actor.companyId, { entityType: "FindingBoqLink", entityId: link.id, action: "FINDING_BOQ_ITEM_CREATED", payload: { findingId, boqItemId: result.item.id } });
  return { item: result.item, link };
}

export async function unlinkFinding(actor: CurrentActor, linkId: string) {
  requireCapability(actor, "boq:edit");
  const link = await prisma.findingBoqLink.findFirst({ where: { id: linkId, companyId: actor.companyId } });
  if (!link) throw new NotFoundError("Finding-BOQ link not found.");
  await prisma.findingBoqLink.delete({ where: { id: linkId } });
  await createAuditLog(actor.companyId, { entityType: "FindingBoqLink", entityId: linkId, action: "FINDING_BOQ_LINK_REMOVED", payload: { findingId: link.inspectionFindingId, boqItemId: link.boqItemId } });
}

export async function listLinksForFinding(actor: CurrentActor, findingId: string) {
  return prisma.findingBoqLink.findMany({ where: { companyId: actor.companyId, inspectionFindingId: findingId } });
}
