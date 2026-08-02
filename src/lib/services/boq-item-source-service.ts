import { BoqItemSourceType, MarginMode } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireCapability } from "@/lib/auth/rbac";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import { createBOQItem, getBOQ } from "@/lib/repositories/boq-repository";
import { getMasterItemRecord } from "@/lib/repositories/master-item-repository";
import { getLibraryItemRecord, recordItemUsage } from "@/lib/repositories/company-library-repository";
import { assertMasterItemAccess, companyHasPackageAccessForItem } from "@/lib/entitlements/package-entitlement-service";
import { recordPremiumItemUnlock } from "@/lib/entitlements/entitlement-service";

type ResolvedDefaults = {
  itemCode: string;
  category: string;
  description: string;
  specification: string;
  unit: string;
  unitCost: number;
  marginMode: MarginMode;
  marginPercentage: number;
};

const EMPTY_DEFAULTS: ResolvedDefaults = {
  itemCode: "",
  category: "Uncategorized",
  description: "",
  specification: "",
  unit: "",
  unitCost: 0,
  marginMode: MarginMode.MARKUP,
  marginPercentage: 0,
};

export type AddBoqItemFromSourceInput = {
  sourceType: BoqItemSourceType;
  sourceId?: string;
  sectionId?: string;
  itemNumber: number;
  quantity: string;
  sortOrder?: number;
  drawingReference?: string;
  roomOrZone?: string;
  overrides?: Partial<Pick<ResolvedDefaults, "itemCode" | "category" | "description" | "specification" | "unit" | "unitCost" | "marginMode" | "marginPercentage">>;
};

async function resolveMasterItemDefaults(companyId: string, masterItemId: string): Promise<ResolvedDefaults> {
  await assertMasterItemAccess(companyId, masterItemId);
  const master = await getMasterItemRecord(masterItemId);
  const discipline = await prisma.masterDiscipline.findUnique({ where: { id: master.disciplineId } });

  if (master.isPremium) {
    const hasPackage = await companyHasPackageAccessForItem(companyId, masterItemId);
    if (!hasPackage) await recordPremiumItemUnlock(companyId, masterItemId);
  }

  return {
    itemCode: master.itemCode,
    category: discipline?.name ?? "Uncategorized",
    description: master.name,
    specification: master.shortDescription,
    unit: master.defaultUnit,
    unitCost: 0,
    marginMode: MarginMode.MARKUP,
    marginPercentage: 0,
  };
}

async function resolveLibraryItemDefaults(companyId: string, libraryItemId: string): Promise<ResolvedDefaults> {
  const item = await getLibraryItemRecord(companyId, libraryItemId);
  const discipline = item.disciplineId ? await prisma.masterDiscipline.findUnique({ where: { id: item.disciplineId } }) : null;
  return {
    itemCode: item.companyItemCode,
    category: discipline?.name ?? "Uncategorized",
    description: item.name,
    specification: item.description,
    unit: item.unit,
    unitCost: item.defaultCost.toNumber(),
    marginMode: item.defaultMarginMode,
    marginPercentage: item.defaultMargin.toNumber(),
  };
}

async function resolveCatalogueItemDefaults(companyId: string, rateCatalogueItemId: string): Promise<ResolvedDefaults> {
  const item = await prisma.rateCatalogueItem.findFirst({ where: { id: rateCatalogueItemId, companyId } });
  if (!item) throw new NotFoundError("Rate catalogue item not found.");
  return {
    itemCode: item.itemCode,
    category: item.category,
    description: item.description,
    specification: item.specification ?? "",
    unit: item.unit,
    unitCost: item.landedCost.toNumber(),
    marginMode: item.marginMode,
    marginPercentage: item.defaultMargin.toNumber(),
  };
}

async function resolvePreviousBoqItemDefaults(companyId: string, boqItemId: string): Promise<ResolvedDefaults> {
  const item = await prisma.bOQItem.findFirst({ where: { id: boqItemId, companyId } });
  if (!item) throw new NotFoundError("Source BOQ item not found.");
  return {
    itemCode: item.itemCode,
    category: item.category,
    description: item.description,
    specification: item.specification,
    unit: item.unit,
    unitCost: item.unitCost.toNumber(),
    marginMode: item.marginMode,
    marginPercentage: item.marginPercentage.toNumber(),
  };
}

/**
 * Copies an item from any source into a new, independent BOQItem, recording
 * provenance (sourceType + the relevant source id) without ever mutating the
 * source itself — the master item, company library item, catalogue rate,
 * and previous BOQ item are all left untouched (spec section 1/16/17).
 */
export async function addBoqItemFromSource(actor: CurrentActor, boqId: string, input: AddBoqItemFromSourceInput) {
  requireCapability(actor, "boq:edit");
  const boq = await getBOQ(actor.companyId, boqId);
  const section = (input.sectionId ? boq.sections.find((s) => s.id === input.sectionId) : undefined) ?? boq.sections[0];
  if (!section) throw new AppError("NO_SECTIONS", "This BOQ has no sections to add an item to.", 409);

  let defaults: ResolvedDefaults = EMPTY_DEFAULTS;
  switch (input.sourceType) {
    case BoqItemSourceType.MASTER_ITEM:
      if (!input.sourceId) throw new AppError("SOURCE_ID_REQUIRED", "sourceId is required for this source type.", 400);
      defaults = await resolveMasterItemDefaults(actor.companyId, input.sourceId);
      break;
    case BoqItemSourceType.COMPANY_LIBRARY:
      if (!input.sourceId) throw new AppError("SOURCE_ID_REQUIRED", "sourceId is required for this source type.", 400);
      defaults = await resolveLibraryItemDefaults(actor.companyId, input.sourceId);
      break;
    case BoqItemSourceType.RATE_CATALOGUE:
      if (!input.sourceId) throw new AppError("SOURCE_ID_REQUIRED", "sourceId is required for this source type.", 400);
      defaults = await resolveCatalogueItemDefaults(actor.companyId, input.sourceId);
      break;
    case BoqItemSourceType.PREVIOUS_BOQ:
      if (!input.sourceId) throw new AppError("SOURCE_ID_REQUIRED", "sourceId is required for this source type.", 400);
      defaults = await resolvePreviousBoqItemDefaults(actor.companyId, input.sourceId);
      break;
    case BoqItemSourceType.MANUAL:
    case BoqItemSourceType.IMPORT:
    default:
      defaults = EMPTY_DEFAULTS;
      break;
  }

  const merged = { ...defaults, ...input.overrides };
  const result = await createBOQItem(actor.companyId, section.id, {
    itemNumber: input.itemNumber,
    itemCode: merged.itemCode,
    category: merged.category,
    description: merged.description,
    specification: merged.specification,
    quantity: input.quantity,
    unit: merged.unit,
    unitCost: merged.unitCost,
    marginMode: merged.marginMode,
    marginPercentage: merged.marginPercentage,
    drawingReference: input.drawingReference,
    roomOrZone: input.roomOrZone,
    sortOrder: input.sortOrder,
  });

  const updated = await prisma.bOQItem.update({
    where: { id: result.item.id, companyId: actor.companyId },
    data: {
      sourceType: input.sourceType,
      sourceMasterItemId: input.sourceType === BoqItemSourceType.MASTER_ITEM ? input.sourceId : null,
      sourceCompanyLibraryItemId: input.sourceType === BoqItemSourceType.COMPANY_LIBRARY ? input.sourceId : null,
      sourceCatalogueItemId: input.sourceType === BoqItemSourceType.RATE_CATALOGUE ? input.sourceId : null,
      sourcePreviousBoqItemId: input.sourceType === BoqItemSourceType.PREVIOUS_BOQ ? input.sourceId : null,
      copiedAt: new Date(),
      copiedByUserId: actor.userId,
    },
  });

  if (input.sourceType === BoqItemSourceType.COMPANY_LIBRARY && input.sourceId) {
    await recordItemUsage(actor.companyId, input.sourceId, {
      projectId: boq.projectId,
      boqId,
      boqItemId: updated.id,
      usedByUserId: actor.userId,
    });
  }

  return { item: updated, boq: await getBOQ(actor.companyId, boqId) };
}
