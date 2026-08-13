import { CompanyLibrarySourceType, type CompanyLibraryItem } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { requireCapability } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError, PermissionDeniedError } from "@/lib/errors/app-error";
import { companyHasPackageAccessForItem } from "@/lib/entitlements/package-entitlement-service";
import { recordPremiumItemUnlock } from "@/lib/entitlements/entitlement-service";
import { assertMasterItemAccessEffective } from "@/lib/entitlements/effective-entitlement-service";
import { getMasterItemRecord } from "@/lib/repositories/master-item-repository";
import { recordPlatformActionAudit } from "@/lib/repositories/platform-action-audit-repository";
import {
  createLibraryItem,
  createVariant,
  findLibraryItemByCode,
  generateDistinctItemCode,
  getLibraryItem,
  listItemUsageHistory,
  listLibraryItemVersions,
  listLibraryItems,
  listVariants,
  recordItemUsage,
  setLibraryItemActive,
  setLibraryItemFavorite,
  toLibraryItemDTO,
  updateLibraryItem,
  type CreateLibraryItemInput,
  type LibraryItemDTO,
  type LibraryItemListFilters,
  type UpdateLibraryItemInput,
} from "@/lib/repositories/company-library-repository";

export async function listLibraryItemsForCompany(actor: CurrentActor, filters: LibraryItemListFilters) {
  return listLibraryItems(actor.companyId, filters);
}

export async function getLibraryItemForCompany(actor: CurrentActor, itemId: string) {
  return getLibraryItem(actor.companyId, itemId);
}

/**
 * ADMIN-DATA-ACCESS-1 — cross-tenant, owner-only operational inspection of a
 * company's library item, for support/QA/import-validation. Deliberately not
 * cross-tenant for anyone else: a normal company user must keep using
 * getLibraryItemForCompany above, which stays hard-scoped to actor.companyId.
 * Returns a safe company name, never the full Company record.
 */
export async function getLibraryItemForOwner(owner: PlatformActor, itemId: string) {
  if (owner.platformRole !== "PLATFORM_OWNER") {
    throw new PermissionDeniedError("Cross-tenant library item inspection is restricted to the platform owner.");
  }
  const row = await prisma.companyLibraryItem.findUnique({ where: { id: itemId } });
  if (!row) throw new NotFoundError("Company library item not found.");
  const company = await prisma.company.findUnique({ where: { id: row.companyId }, select: { id: true, tradeName: true, legalName: true } });

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "ADMIN_ITEM_VIEWED",
    targetType: "CompanyLibraryItem",
    targetId: itemId,
    metadata: { owningCompanyId: row.companyId },
  });

  return {
    ...toLibraryItemDTO(row),
    owningCompany: company ? { id: company.id, name: company.tradeName || company.legalName } : null,
  };
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

export type SaveBoqItemForFutureProjectsResult = LibraryItemDTO & {
  /** True when an existing, content-identical item was returned instead of inserting a new row — protects against accidental double-submit of the same save action. */
  reused: boolean;
  /** Set only when the requested code already existed with different details: the item was still saved, under this generated code, so an engineer's intentional variant is never blocked or silently overwritten. */
  renamedFrom?: string;
};

/**
 * "Save for future projects" (engineer reusable-item workflow) — copies an
 * editable BOQ item into the company library as a new, independent row.
 * Never mutates the source BOQItem, never touches Master Catalogue data,
 * and grants no entitlements (PREVIOUS_PROJECT source type is always free).
 *
 * Duplicate-safety: (companyId, companyItemCode) is unique at the DB level.
 * Rather than surfacing that as a raw 409 to the user, this pre-checks the
 * intended code and picks one of three outcomes:
 *   - no existing item with that code -> create normally;
 *   - an existing item with the same code AND equivalent content -> reuse it
 *     (idempotent; covers accidental double-click resubmission);
 *   - an existing item with the same code but different content -> the
 *     engineer is intentionally keeping a variant, so save under a new,
 *     automatically distinct code instead of blocking or overwriting.
 */
export async function createFromBoqItem(
  actor: CurrentActor,
  boqItemId: string,
  overrides?: { companyItemCode?: string; name?: string },
): Promise<SaveBoqItemForFutureProjectsResult> {
  requireCapability(actor, "library:manage");
  const boqItem = await prisma.bOQItem.findFirst({ where: { id: boqItemId, companyId: actor.companyId } });
  if (!boqItem) throw new NotFoundError("BOQ item not found.");

  const requestedCode = overrides?.companyItemCode ?? boqItem.itemCode;
  const input: CreateLibraryItemInput = {
    companyItemCode: requestedCode,
    name: overrides?.name ?? boqItem.description,
    description: boqItem.specification,
    unit: boqItem.unit,
    defaultCost: boqItem.unitCost.toNumber(),
    defaultMarginMode: boqItem.marginMode,
    defaultMargin: boqItem.marginPercentage.toNumber(),
    defaultSellingRate: boqItem.sellingRate.toNumber(),
    sourceType: CompanyLibrarySourceType.PREVIOUS_PROJECT,
  };

  const existing = await findLibraryItemByCode(actor.companyId, requestedCode);
  if (!existing) {
    const created = await createLibraryItem(actor.companyId, input, actor.userId);
    return { ...created, reused: false };
  }

  if (isEquivalentSavedContent(existing, input)) {
    return { ...toLibraryItemDTO(existing), reused: true };
  }

  const distinctCode = await generateDistinctItemCode(actor.companyId, requestedCode);
  const created = await createLibraryItem(actor.companyId, { ...input, companyItemCode: distinctCode }, actor.userId);
  return { ...created, reused: false, renamedFrom: requestedCode };
}

function isEquivalentSavedContent(
  existing: CompanyLibraryItem,
  input: Pick<CreateLibraryItemInput, "name" | "description" | "unit" | "defaultCost" | "defaultSellingRate">,
): boolean {
  return (
    existing.name === input.name
    && existing.description === (input.description ?? "")
    && existing.unit === input.unit
    && existing.defaultCost.equals(input.defaultCost ?? 0)
    && existing.defaultSellingRate.equals(input.defaultSellingRate ?? 0)
  );
}
