import type { CurrentActor } from "@/lib/auth/current-actor";
import { getBOQ } from "@/lib/repositories/boq-repository";
import { listQuantityCalculationsForProject } from "@/lib/repositories/quantity-calculation-repository";
import { listExtractedEntities } from "@/lib/repositories/extracted-entity-repository";

/**
 * Guided BOQ measurement workflow (Release 1), spec section 12 — a
 * read-only PREVIEW of the same structural checks lockBOQ (boq-repository.ts)
 * already enforces at lock time, so the professional can see and act on
 * warnings before attempting to lock, instead of only discovering them from
 * a rejected lock request. This never blocks anything itself and never
 * duplicates lockBOQ's actual enforcement — lockBOQ remains the sole
 * authority at commit time; this is purely advisory.
 *
 * Per spec: a manual item with a professionally entered quantity and no
 * QuantityCalculation is fully legitimate and must never be flagged merely
 * for lacking a calculation link.
 */

export type ValidationWarning = {
  code: string;
  severity: "warning" | "info";
  message: string;
  itemId?: string;
};

export async function previewBoqValidation(actor: CurrentActor, boqId: string): Promise<ValidationWarning[]> {
  const boq = await getBOQ(actor.companyId, boqId);
  const warnings: ValidationWarning[] = [];

  for (const section of boq.sections) {
    for (const item of section.items) {
      if (!item.description || !item.description.trim()) {
        warnings.push({ code: "MISSING_DESCRIPTION", severity: "warning", message: `Item ${item.itemCode || item.itemNumber}: description is missing.`, itemId: item.id });
      }
      if (!item.unit || !item.unit.trim()) {
        warnings.push({ code: "MISSING_UNIT", severity: "warning", message: `Item ${item.itemCode || item.itemNumber}: unit is missing.`, itemId: item.id });
      }
      if (!(item.quantity > 0)) {
        warnings.push({ code: "INVALID_QUANTITY", severity: "warning", message: `Item ${item.itemCode || item.itemNumber}: quantity must be greater than zero.`, itemId: item.id });
      }
      if (item.unitCost < 0) {
        warnings.push({ code: "INVALID_RATE", severity: "warning", message: `Item ${item.itemCode || item.itemNumber}: unit cost cannot be negative.`, itemId: item.id });
      }
    }
  }

  const [calculations, entities] = await Promise.all([
    listQuantityCalculationsForProject(actor.companyId, boq.projectId),
    listExtractedEntities(actor.companyId, boq.projectId),
  ]);

  const unconfirmedCalculations = calculations.filter((c) => c.status !== "CONFIRMED" && c.status !== "REJECTED");
  if (unconfirmedCalculations.length > 0) {
    warnings.push({
      code: "CALCULATED_QUANTITY_NOT_REVIEWED",
      severity: "warning",
      message: `${unconfirmedCalculations.length} calculated quantity(ies) for this project have not been professionally reviewed yet.`,
    });
  }

  const unresolvedEntities = entities.filter((e) => e.status === "EXTRACTED" || e.status === "NEEDS_REVIEW");
  if (unresolvedEntities.length > 0) {
    warnings.push({
      code: "UNRESOLVED_EXTRACTION",
      severity: "warning",
      message: `${unresolvedEntities.length} extracted item(s) for this project still require human review.`,
    });
  }

  return warnings;
}
