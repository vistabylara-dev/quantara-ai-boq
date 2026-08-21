import type { CompanyLibraryItem, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";

export function toLibraryItemDTO(row: CompanyLibraryItem) {
  return {
    id: row.id,
    companyId: row.companyId,
    sourceMasterItemId: row.sourceMasterItemId,
    sourcePackageId: row.sourcePackageId,
    disciplineId: row.disciplineId,
    categoryId: row.categoryId,
    companyItemCode: row.companyItemCode,
    name: row.name,
    description: row.description,
    specificationJson: row.specificationJson,
    technicalDataJson: row.technicalDataJson,
    unit: row.unit,
    defaultSupplierId: row.defaultSupplierId,
    defaultRateCatalogueItemId: row.defaultRateCatalogueItemId,
    defaultCost: row.defaultCost.toNumber(),
    defaultMarginMode: row.defaultMarginMode,
    defaultMargin: row.defaultMargin.toNumber(),
    defaultSellingRate: row.defaultSellingRate.toNumber(),
    tagsJson: row.tagsJson,
    searchKeywordsJson: row.searchKeywordsJson,
    sourceType: row.sourceType,
    usageCount: row.usageCount,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    isFavorite: row.isFavorite,
    isActive: row.isActive,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type LibraryItemDTO = ReturnType<typeof toLibraryItemDTO>;

export async function getLibraryItemRecord(companyId: string, itemId: string): Promise<CompanyLibraryItem> {
  const row = await prisma.companyLibraryItem.findFirst({ where: { id: itemId, companyId } });
  if (!row) throw new NotFoundError("Company library item not found.");
  return row;
}

export async function getLibraryItem(companyId: string, itemId: string) {
  return toLibraryItemDTO(await getLibraryItemRecord(companyId, itemId));
}

export type LibraryItemListFilters = {
  disciplineId?: string;
  categoryId?: string;
  search?: string;
  favoritesOnly?: boolean;
  activeOnly?: boolean;
  sourceType?: CompanyLibraryItem["sourceType"];
  page?: number;
  pageSize?: number;
};

export async function listLibraryItems(companyId: string, filters: LibraryItemListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 20));

  const where: Prisma.CompanyLibraryItemWhereInput = {
    companyId,
    ...(filters.disciplineId ? { disciplineId: filters.disciplineId } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.favoritesOnly ? { isFavorite: true } : {}),
    ...(filters.activeOnly !== false ? { isActive: true } : {}),
    ...(filters.sourceType ? { sourceType: filters.sourceType } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { companyItemCode: { contains: filters.search, mode: "insensitive" } },
            { description: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.companyLibraryItem.findMany({
      where,
      orderBy: [{ isFavorite: "desc" }, { usageCount: "desc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.companyLibraryItem.count({ where }),
  ]);

  return { items: rows.map(toLibraryItemDTO), total, page, pageSize };
}

export type CreateLibraryItemInput = {
  sourceMasterItemId?: string | null;
  sourcePackageId?: string | null;
  disciplineId?: string | null;
  categoryId?: string | null;
  companyItemCode: string;
  name: string;
  description?: string;
  specificationJson?: unknown;
  technicalDataJson?: unknown;
  unit: string;
  defaultSupplierId?: string | null;
  defaultRateCatalogueItemId?: string | null;
  defaultCost?: number;
  defaultMarginMode?: CompanyLibraryItem["defaultMarginMode"];
  defaultMargin?: number;
  defaultSellingRate?: number;
  tagsJson?: string[];
  searchKeywordsJson?: string[];
  sourceType: CompanyLibraryItem["sourceType"];
};

export async function createLibraryItem(companyId: string, input: CreateLibraryItemInput, createdByUserId: string | null) {
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.companyLibraryItem.create({
      data: {
        companyId,
        sourceMasterItemId: input.sourceMasterItemId ?? null,
        sourcePackageId: input.sourcePackageId ?? null,
        disciplineId: input.disciplineId ?? null,
        categoryId: input.categoryId ?? null,
        companyItemCode: input.companyItemCode,
        name: input.name,
        description: input.description ?? "",
        specificationJson: input.specificationJson as never,
        technicalDataJson: input.technicalDataJson as never,
        unit: input.unit,
        defaultSupplierId: input.defaultSupplierId ?? null,
        defaultRateCatalogueItemId: input.defaultRateCatalogueItemId ?? null,
        defaultCost: input.defaultCost ?? 0,
        defaultMarginMode: input.defaultMarginMode ?? "MARKUP",
        defaultMargin: input.defaultMargin ?? 0,
        defaultSellingRate: input.defaultSellingRate ?? 0,
        tagsJson: input.tagsJson as never,
        searchKeywordsJson: input.searchKeywordsJson as never,
        sourceType: input.sourceType,
        createdByUserId,
      },
    });
    await createAuditLog(companyId, { entityType: "CompanyLibraryItem", entityId: row.id, action: "LIBRARY_ITEM_CREATED", payload: { sourceType: row.sourceType, name: row.name } }, tx);
    return row;
  });
  return toLibraryItemDTO(created);
}

const VERSION_TRIGGER_FIELDS = ["description", "technicalDataJson", "unit", "defaultCost", "defaultMargin", "defaultSellingRate", "categoryId", "defaultSupplierId"] as const;

export type UpdateLibraryItemInput = Partial<{
  name: string;
  description: string;
  specificationJson: unknown;
  technicalDataJson: unknown;
  unit: string;
  categoryId: string | null;
  defaultSupplierId: string | null;
  defaultRateCatalogueItemId: string | null;
  defaultCost: number;
  defaultMarginMode: CompanyLibraryItem["defaultMarginMode"];
  defaultMargin: number;
  defaultSellingRate: number;
  tagsJson: string[];
  searchKeywordsJson: string[];
  isActive: boolean;
}>;

function fieldChanged(current: CompanyLibraryItem, key: (typeof VERSION_TRIGGER_FIELDS)[number], nextValue: unknown): boolean {
  if (nextValue === undefined) return false;
  if (key === "technicalDataJson") return JSON.stringify(current.technicalDataJson) !== JSON.stringify(nextValue);
  if (key === "defaultCost" || key === "defaultMargin" || key === "defaultSellingRate") {
    return !current[key].equals(nextValue as number);
  }
  return current[key] !== nextValue;
}

export async function updateLibraryItem(
  companyId: string,
  itemId: string,
  input: UpdateLibraryItemInput,
  updatedByUserId: string | null,
  changeReason?: string,
) {
  const current = await getLibraryItemRecord(companyId, itemId);

  const triggersVersion = VERSION_TRIGGER_FIELDS.some((key) => fieldChanged(current, key, (input as Record<string, unknown>)[key]));

  const updated = await prisma.$transaction(async (tx) => {
    if (triggersVersion) {
      const lastVersion = await tx.companyLibraryItemVersion.findFirst({
        where: { companyLibraryItemId: itemId },
        orderBy: { version: "desc" },
      });
      await tx.companyLibraryItemVersion.create({
        data: {
          companyId,
          companyLibraryItemId: itemId,
          version: (lastVersion?.version ?? 0) + 1,
          snapshotJson: toLibraryItemDTO(current) as unknown as Prisma.InputJsonValue,
          changeReason: changeReason ?? "",
          createdByUserId: updatedByUserId,
        },
      });
    }

    const row = await tx.companyLibraryItem.update({
      where: { id: itemId, companyId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.specificationJson !== undefined ? { specificationJson: input.specificationJson as never } : {}),
        ...(input.technicalDataJson !== undefined ? { technicalDataJson: input.technicalDataJson as never } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.defaultSupplierId !== undefined ? { defaultSupplierId: input.defaultSupplierId } : {}),
        ...(input.defaultRateCatalogueItemId !== undefined ? { defaultRateCatalogueItemId: input.defaultRateCatalogueItemId } : {}),
        ...(input.defaultCost !== undefined ? { defaultCost: input.defaultCost } : {}),
        ...(input.defaultMarginMode !== undefined ? { defaultMarginMode: input.defaultMarginMode } : {}),
        ...(input.defaultMargin !== undefined ? { defaultMargin: input.defaultMargin } : {}),
        ...(input.defaultSellingRate !== undefined ? { defaultSellingRate: input.defaultSellingRate } : {}),
        ...(input.tagsJson !== undefined ? { tagsJson: input.tagsJson as never } : {}),
        ...(input.searchKeywordsJson !== undefined ? { searchKeywordsJson: input.searchKeywordsJson as never } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    await createAuditLog(companyId, { entityType: "CompanyLibraryItem", entityId: row.id, action: "LIBRARY_ITEM_UPDATED", payload: { versioned: triggersVersion } }, tx);
    return row;
  });
  return toLibraryItemDTO(updated);
}

export async function setLibraryItemFavorite(companyId: string, itemId: string, isFavorite: boolean) {
  await getLibraryItemRecord(companyId, itemId);
  const row = await prisma.companyLibraryItem.update({ where: { id: itemId, companyId }, data: { isFavorite } });
  await createAuditLog(companyId, { entityType: "CompanyLibraryItem", entityId: row.id, action: isFavorite ? "LIBRARY_ITEM_FAVORITED" : "LIBRARY_ITEM_UNFAVORITED" });
  return toLibraryItemDTO(row);
}

export async function setLibraryItemActive(companyId: string, itemId: string, isActive: boolean) {
  await getLibraryItemRecord(companyId, itemId);
  const row = await prisma.companyLibraryItem.update({ where: { id: itemId, companyId }, data: { isActive } });
  await createAuditLog(companyId, { entityType: "CompanyLibraryItem", entityId: row.id, action: isActive ? "LIBRARY_ITEM_ACTIVATED" : "LIBRARY_ITEM_ARCHIVED" });
  return toLibraryItemDTO(row);
}

export async function listLibraryItemVersions(companyId: string, itemId: string) {
  await getLibraryItemRecord(companyId, itemId);
  const rows = await prisma.companyLibraryItemVersion.findMany({
    where: { companyId, companyLibraryItemId: itemId },
    orderBy: { version: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    version: row.version,
    snapshotJson: row.snapshotJson,
    changeReason: row.changeReason,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Accepts an optional externally-managed transaction so callers can persist usage tracking atomically alongside other writes (see createBOQItem's externalTx doc comment for the same pattern). */
export async function recordItemUsage(
  companyId: string,
  itemId: string,
  usage: { projectId?: string | null; boqId?: string | null; boqItemId?: string | null; usedByUserId?: string | null },
  externalTx?: Prisma.TransactionClient,
) {
  const run = async (tx: Prisma.TransactionClient) => {
    await tx.companyItemUsage.create({
      data: {
        companyId,
        companyLibraryItemId: itemId,
        projectId: usage.projectId ?? null,
        boqId: usage.boqId ?? null,
        boqItemId: usage.boqItemId ?? null,
        usedByUserId: usage.usedByUserId ?? null,
      },
    });
    await tx.companyLibraryItem.update({
      where: { id: itemId, companyId },
      data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
    });
  };
  if (externalTx) {
    await run(externalTx);
  } else {
    await prisma.$transaction(run);
  }
}

export async function listItemUsageHistory(companyId: string, itemId: string, limit = 20) {
  await getLibraryItemRecord(companyId, itemId);
  const rows = await prisma.companyItemUsage.findMany({
    where: { companyId, companyLibraryItemId: itemId },
    orderBy: { usedAt: "desc" },
    take: Math.min(100, Math.max(1, limit)),
    include: { project: { select: { name: true, reference: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    projectName: row.project?.name ?? null,
    projectReference: row.project?.reference ?? null,
    boqId: row.boqId,
    boqItemId: row.boqItemId,
    usedByUserId: row.usedByUserId,
    usedAt: row.usedAt.toISOString(),
  }));
}

export async function listRecentlyUsedItems(companyId: string, limit = 10) {
  const rows = await prisma.companyLibraryItem.findMany({
    where: { companyId, isActive: true, lastUsedAt: { not: null } },
    orderBy: { lastUsedAt: "desc" },
    take: Math.min(50, Math.max(1, limit)),
  });
  return rows.map(toLibraryItemDTO);
}

export async function listFavoriteItems(companyId: string, limit = 50) {
  const rows = await prisma.companyLibraryItem.findMany({
    where: { companyId, isActive: true, isFavorite: true },
    orderBy: { name: "asc" },
    take: Math.min(200, Math.max(1, limit)),
  });
  return rows.map(toLibraryItemDTO);
}

function toVariantDTO(row: {
  id: string; companyLibraryItemId: string; name: string; variantCode: string;
  specificationOverridesJson: unknown; technicalOverridesJson: unknown; unit: string | null;
  defaultSupplierId: string | null; defaultCost: Prisma.Decimal; defaultSellingRate: Prisma.Decimal; isActive: boolean;
}) {
  return {
    id: row.id,
    companyLibraryItemId: row.companyLibraryItemId,
    name: row.name,
    variantCode: row.variantCode,
    specificationOverridesJson: row.specificationOverridesJson,
    technicalOverridesJson: row.technicalOverridesJson,
    unit: row.unit,
    defaultSupplierId: row.defaultSupplierId,
    defaultCost: row.defaultCost.toNumber(),
    defaultSellingRate: row.defaultSellingRate.toNumber(),
    isActive: row.isActive,
  };
}

export async function createVariant(
  companyId: string,
  itemId: string,
  input: {
    name: string;
    variantCode: string;
    specificationOverridesJson?: unknown;
    technicalOverridesJson?: unknown;
    unit?: string;
    defaultSupplierId?: string | null;
    defaultCost?: number;
    defaultSellingRate?: number;
  },
) {
  await getLibraryItemRecord(companyId, itemId);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.companyLibraryItemVariant.create({
      data: {
        companyId,
        companyLibraryItemId: itemId,
        name: input.name,
        variantCode: input.variantCode,
        specificationOverridesJson: input.specificationOverridesJson as never,
        technicalOverridesJson: input.technicalOverridesJson as never,
        unit: input.unit,
        defaultSupplierId: input.defaultSupplierId ?? null,
        defaultCost: input.defaultCost ?? 0,
        defaultSellingRate: input.defaultSellingRate ?? 0,
      },
    });
    await createAuditLog(companyId, { entityType: "CompanyLibraryItemVariant", entityId: row.id, action: "LIBRARY_ITEM_VARIANT_CREATED", payload: { name: row.name } }, tx);
    return row;
  });
  return toVariantDTO(created);
}

export async function listVariants(companyId: string, itemId: string) {
  await getLibraryItemRecord(companyId, itemId);
  const rows = await prisma.companyLibraryItemVariant.findMany({ where: { companyId, companyLibraryItemId: itemId }, orderBy: { name: "asc" } });
  return rows.map(toVariantDTO);
}
