import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError } from "@/lib/errors/app-error";
import { getBOQItemRecord, updateBOQItem } from "@/lib/repositories/boq-repository";
import { getQuantityCalculationRecord } from "@/lib/repositories/quantity-calculation-repository";
import { createAuditLog } from "@/lib/repositories/audit-repository";

/**
 * Guided BOQ measurement workflow (Release 1), spec section 7 — a calculated
 * quantity must NEVER silently overwrite a BOQ quantity. This is a two-step
 * propose/confirm flow: proposeCalculatedQuantityForItem is read-only (no
 * mutation at all, safe to call just to render the confirm dialog);
 * confirmCalculatedQuantityForItem is the only function that actually
 * writes, and only after the caller has explicitly confirmed. Reuses the
 * existing updateBOQItem (which already enforces BOQ-editable/lock checks
 * and its own generic ITEM_CHANGED audit) — this only adds a second,
 * calculation-traceable audit entry on top, it never reimplements the
 * commercial recalculation or lock guard.
 */

export type QuantityUpdateProposal = {
  itemId: string;
  itemCode: string;
  description: string;
  currentQuantity: number;
  currentUnit: string;
  proposedQuantity: number;
  proposedUnit: string;
  calculationId: string;
  calculationFormula: string;
  calculationConfirmed: boolean;
};

export async function proposeCalculatedQuantityForItem(actor: CurrentActor, itemId: string, calculationId: string): Promise<QuantityUpdateProposal> {
  const item = await getBOQItemRecord(actor.companyId, itemId);
  const calculation = await getQuantityCalculationRecord(actor.companyId, calculationId);
  return {
    itemId: item.id,
    itemCode: item.itemCode,
    description: item.description,
    currentQuantity: item.quantity.toNumber(),
    currentUnit: item.unit,
    proposedQuantity: calculation.resultValue.toNumber(),
    proposedUnit: calculation.resultUnit,
    calculationId: calculation.id,
    calculationFormula: calculation.formula,
    calculationConfirmed: calculation.status === "CONFIRMED",
  };
}

/**
 * The only function in this file that writes. Requires the calculation to
 * already be human-confirmed (spec section 6) — a calculated quantity that
 * hasn't been professionally reviewed can never reach a BOQ item, even
 * through this "confirm" step, which confirms the *quantity update*, not
 * the calculation itself.
 */
export async function confirmCalculatedQuantityForItem(actor: CurrentActor, itemId: string, calculationId: string) {
  requireCapability(actor, "boq:edit");
  const item = await getBOQItemRecord(actor.companyId, itemId);
  const calculation = await getQuantityCalculationRecord(actor.companyId, calculationId);
  if (calculation.status !== "CONFIRMED") {
    throw new AppError("CALCULATION_NOT_CONFIRMED", "This calculation must be professionally confirmed before its quantity can be applied to a BOQ item.", 409);
  }

  const previousQuantity = item.quantity.toNumber();
  const proposedQuantity = calculation.resultValue.toNumber();

  const result = await updateBOQItem(actor.companyId, itemId, {
    quantity: proposedQuantity,
    unit: calculation.resultUnit,
  });

  await createAuditLog(actor.companyId, {
    entityType: "BOQItem",
    entityId: itemId,
    action: "BOQ_QUANTITY_UPDATED_FROM_CALCULATION",
    payload: {
      calculationId,
      calculationType: calculation.calculationType,
      formula: calculation.formula,
      previousQuantity,
      newQuantity: proposedQuantity,
      unit: calculation.resultUnit,
    },
  });

  return result;
}
