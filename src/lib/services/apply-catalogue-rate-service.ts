import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { getCatalogueItemById } from "@/lib/repositories/rate-catalogue-repository";
import { updateBOQItem, type BOQItemWriteInput } from "@/lib/repositories/boq-repository";
import type { BOQItemPricingMetadata } from "@/types/boq";

export type ApplyMode = "REPLACE_COMMERCIAL_FIELDS" | "APPLY_COST_ONLY" | "APPLY_SELLING_RATE_ONLY";

export type ApplyCatalogueRateInput = {
  catalogueItemId: string;
  boqItemId: string;
  applyMode: ApplyMode;
  confirmReplaceOverrides: boolean;
};

/**
 * Copies commercial fields from a catalogue rate onto a BOQ item. The
 * selling rate itself is never copied as a raw number — it is always
 * re-derived server-side from cost + margin (calculateBOQItem, inside
 * updateBOQItem), consistent with "never trust client-provided calculated
 * totals". APPLY_SELLING_RATE_ONLY therefore means "apply the catalogue's
 * margin so the item's selling rate is recalculated from it", not "force
 * this exact number".
 */
export async function applyCatalogueRateToBOQItem(actor: CurrentActor, input: ApplyCatalogueRateInput) {
  requireCapability(actor, "boq:edit");

  const catalogueItem = await getCatalogueItemById(actor.companyId, input.catalogueItemId);

  const boqItem = await prisma.bOQItem.findFirst({
    where: { id: input.boqItemId, companyId: actor.companyId },
  });
  if (!boqItem) {
    throw new NotFoundError("BOQ item not found.");
  }

  const existingMeta = boqItem.pricingMetadataJson as unknown as BOQItemPricingMetadata | null;
  const overriddenFields = existingMeta?.manuallyOverriddenFields ?? [];
  if (overriddenFields.length > 0 && !input.confirmReplaceOverrides) {
    throw new AppError(
      "MANUAL_OVERRIDE_CONFIRMATION_REQUIRED",
      "This item has manually overridden commercial fields. Confirm to replace them with the catalogue rate.",
      409,
      { manuallyOverriddenFields: overriddenFields },
    );
  }

  const patch: Partial<BOQItemWriteInput> = {};

  if (input.applyMode === "REPLACE_COMMERCIAL_FIELDS" || input.applyMode === "APPLY_COST_ONLY") {
    patch.unitCost = catalogueItem.baseCost;
    patch.freightCost = catalogueItem.freightCost;
    patch.installationCost = catalogueItem.installationCost;
    patch.additionalCost = catalogueItem.additionalCost;
  }
  if (input.applyMode === "REPLACE_COMMERCIAL_FIELDS" || input.applyMode === "APPLY_SELLING_RATE_ONLY") {
    patch.marginMode = catalogueItem.marginMode;
    patch.marginPercentage = catalogueItem.defaultMargin;
  }
  if (input.applyMode === "REPLACE_COMMERCIAL_FIELDS") {
    patch.unit = catalogueItem.unit;
    patch.category = catalogueItem.category;
    if (!boqItem.itemCode.trim() || input.confirmReplaceOverrides) {
      patch.itemCode = catalogueItem.itemCode;
    }
    if (!boqItem.description.trim() || input.confirmReplaceOverrides) {
      patch.description = catalogueItem.description;
    }
    if (catalogueItem.specification) {
      patch.specification = catalogueItem.specification;
    }
    if (catalogueItem.sourceReference) {
      patch.sourceReference = catalogueItem.sourceReference;
    }
  }

  const pricingMetadata: BOQItemPricingMetadata = {
    catalogueItemId: catalogueItem.id,
    catalogueItemCode: catalogueItem.itemCode,
    commercialSource: "catalogue",
    rateAppliedAt: new Date().toISOString(),
    rateAppliedByUserId: actor.userId,
    rateAppliedByName: actor.fullName,
    supplierNameSnapshot: catalogueItem.supplierName,
    supplierQuotationReference: catalogueItem.supplierQuotationReference,
    sourceExpiryDate: catalogueItem.expiryDate,
    manuallyOverriddenFields: [],
  };
  patch.pricingMetadataJson = pricingMetadata as unknown as Prisma.InputJsonValue;

  const boq = await updateBOQItem(actor.companyId, input.boqItemId, patch);

  await createAuditLog(actor.companyId, {
    entityType: "BOQItem",
    entityId: input.boqItemId,
    action: "CATALOGUE_RATE_APPLIED",
    payload: {
      catalogueItemId: catalogueItem.id,
      itemCode: catalogueItem.itemCode,
      applyMode: input.applyMode,
      catalogueStatus: catalogueItem.status,
    },
  });

  return boq;
}
