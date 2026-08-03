import { CompanyLibrarySourceType } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";
import { companyHasPackageAccessForItem } from "@/lib/entitlements/package-entitlement-service";
import { recordPremiumItemUnlock } from "@/lib/entitlements/entitlement-service";
import { assertMasterItemAccessEffective } from "@/lib/entitlements/effective-entitlement-service";
import { getMasterItemRecord } from "@/lib/repositories/master-item-repository";
import {
  createLibraryItem,
  createVariant,
  getLibraryItem,
  listItemUsageHistory,
  listLibraryItemVersions,
  listLibraryItems,
  listVariants,
  recordItemUsage,
  setLibraryItemActive,
  setLibraryItemFavorite,
  updateLibraryItem,
  type CreateLibraryItemInput,
  type LibraryItemListFilters,
  type UpdateLibraryItemInput,
} from "@/lib/repositories/company-library-repository";

export async function listLibraryItemsForCompany(actor: CurrentActor, filters: LibraryItemListFilters) {
  return listLibraryItems(actor.companyId, filters);
}

export async function getLibraryItemForCompany(actor: CurrentActor, itemId: string) {
  return getLibraryItem(actor.companyId, itemId);
}

export async function createManualLibraryItem(actor: CurrentActor, input: Omit<CreateLibraryItemInput, "sourceType" | "sourceMasterItemId" | "sourcePackageId">) {
  requireCapability(actor, "library:manage");
  return createLibraryItem(actor.companyId, { ...input, sourceType: CompanyLibrarySourceType.MANUAL }, actor.userId);
}

export async function updateLibraryItemForCompany(actor: CurrentActor, itemId: string, input: UpdateLibraryItemInput, changeReason?: string) {
  requireCapability(actor, "library:manage");
  return updateLibraryItem(actor.companyId, itemId, input, actor.userId, changeReason);
}

export async function setLibraryItemFavoriteForCompany(actor: CurrentActor, itemId: string, isFavorite: boolean) {
  return setLibraryItemFavorite(actor.companyId, itemId, isFavorite);
}

export async function archiveLibraryItemForCompany(actor: CurrentActor, itemId: string, isActive: boolean) {
  requireCapability(actor, "library:manage");
  return setLibraryItemActive(actor.companyId, itemId, isActive);
}

export async function listLibraryItemVersionsForCompany(actor: CurrentActor, itemId: string) {
  return listLibraryItemVersions(actor.companyId, itemId);
}

export async function listLibraryItemUsageForCompany(actor: CurrentActor, itemId: string) {
  return listItemUsageHistory(actor.companyId, itemId);
}

export async function createVariantForCompany(actor: CurrentActor, itemId: string, input: Parameters<typeof createVariant>[2]) {
  requireCapability(actor, "library:manage");
  return createVariant(actor.companyId, itemId, input);
}

export async function listVariantsForCompany(actor: CurrentActor, itemId: string) {
  return listVariants(actor.companyId, itemId);
}

export async function recordLibraryItemUsageForCompany(
  actor: CurrentActor,
  itemId: string,
  usage: { projectId?: string | null; boqId?: string | null; boqItemId?: string | null },
) {
  return recordItemUsage(actor.companyId, itemId, { ...usage, usedByUserId: actor.userId });
}

/**
 * Copies a Quantara master item into the company's private library. Server-
 * side entitlement is checked before any technical data is copied — a
 * locked/inaccessible master item can never reach this far, regardless of
 * what the UI shows. If access came from the trial allowance (not a
 * purchased package), this consumes one of the five unique-item slots.
 */
export async function createFromMaster(actor: CurrentActor, masterItemId: string, overrides?: { companyItemCode?: string; name?: string }) {
  requireCapability(actor, "library:manage");
  await assertMasterItemAccessEffective(actor, masterItemId);
  const master = await getMasterItemRecord(masterItemId);

  const created = await createLibraryItem(
    actor.companyId,
    {
      sourceMasterItemId: master.id,
      disciplineId: master.disciplineId,
      categoryId: master.categoryId,
      companyItemCode: overrides?.companyItemCode ?? master.itemCode,
      name: overrides?.name ?? master.name,
      description: master.fullDescription || master.shortDescription,
      specificationJson: master.defaultSpecificationJson,
      technicalDataJson: master.technicalFieldsJson,
      unit: master.defaultUnit,
      tagsJson: (master.defaultTagsJson as string[] | null) ?? undefined,
      searchKeywordsJson: (master.searchKeywordsJson as string[] | null) ?? undefined,
      sourceType: CompanyLibrarySourceType.MASTER_PACKAGE,
    },
    actor.userId,
  );

  if (master.isPremium) {
    const hasPackage = await companyHasPackageAccessForItem(actor.companyId, masterItemId);
    if (!hasPackage) await recordPremiumItemUnlock(actor.companyId, masterItemId);
  }

  return created;
}

export async function createFromCatalogue(actor: CurrentActor, rateCatalogueItemId: string, overrides?: { companyItemCode?: string; name?: string }) {
  requireCapability(actor, "library:manage");
  const catalogueItem = await prisma.rateCatalogueItem.findFirst({ where: { id: rateCatalogueItemId, companyId: actor.companyId } });
  if (!catalogueItem) throw new NotFoundError("Rate catalogue item not found.");

  return createLibraryItem(
    actor.companyId,
    {
      companyItemCode: overrides?.companyItemCode ?? catalogueItem.itemCode,
      name: overrides?.name ?? catalogueItem.description,
      description: catalogueItem.specification ?? "",
      unit: catalogueItem.unit,
      defaultSupplierId: catalogueItem.supplierId,
      defaultRateCatalogueItemId: catalogueItem.id,
      defaultCost: catalogueItem.landedCost.toNumber(),
      defaultMarginMode: catalogueItem.marginMode,
      defaultMargin: catalogueItem.defaultMargin.toNumber(),
      defaultSellingRate: catalogueItem.sellingRate.toNumber(),
      sourceType: CompanyLibrarySourceType.SUPPLIER_CATALOGUE,
    },
    actor.userId,
  );
}

export async function createFromBoqItem(actor: CurrentActor, boqItemId: string, overrides?: { companyItemCode?: string; name?: string }) {
  requireCapability(actor, "library:manage");
  const boqItem = await prisma.bOQItem.findFirst({ where: { id: boqItemId, companyId: actor.companyId } });
  if (!boqItem) throw new NotFoundError("BOQ item not found.");

  return createLibraryItem(
    actor.companyId,
    {
      companyItemCode: overrides?.companyItemCode ?? boqItem.itemCode,
      name: overrides?.name ?? boqItem.description,
      description: boqItem.specification,
      unit: boqItem.unit,
      defaultCost: boqItem.unitCost.toNumber(),
      defaultMarginMode: boqItem.marginMode,
      defaultMargin: boqItem.marginPercentage.toNumber(),
      defaultSellingRate: boqItem.sellingRate.toNumber(),
      sourceType: CompanyLibrarySourceType.PREVIOUS_PROJECT,
    },
    actor.userId,
  );
}
