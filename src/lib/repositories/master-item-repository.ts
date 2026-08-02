import type { MasterItem, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";

export function toMasterItemDTO(row: MasterItem) {
  return {
    id: row.id,
    disciplineId: row.disciplineId,
    categoryId: row.categoryId,
    itemCode: row.itemCode,
    name: row.name,
    shortDescription: row.shortDescription,
    fullDescription: row.fullDescription,
    defaultUnit: row.defaultUnit,
    defaultSpecificationJson: row.defaultSpecificationJson,
    technicalFieldsJson: row.technicalFieldsJson,
    defaultTagsJson: row.defaultTagsJson,
    searchKeywordsJson: row.searchKeywordsJson,
    synonymsJson: row.synonymsJson,
    defaultManufacturerType: row.defaultManufacturerType,
    defaultInstallationMethod: row.defaultInstallationMethod,
    defaultTestingRequirement: row.defaultTestingRequirement,
    defaultWarrantyRequirement: row.defaultWarrantyRequirement,
    defaultDocumentLabelsJson: row.defaultDocumentLabelsJson,
    version: row.version,
    status: row.status,
    isPremium: row.isPremium,
  };
}

export type MasterItemDTO = ReturnType<typeof toMasterItemDTO>;

/** Minimal locked-preview shape — never includes full technical data, synonyms, or document labels (spec section 7). */
export function toMasterItemPreviewDTO(row: MasterItem, packageNames: string[]) {
  return {
    id: row.id,
    itemCode: row.itemCode,
    name: row.name,
    categoryId: row.categoryId,
    shortDescription: row.shortDescription,
    defaultUnit: row.defaultUnit,
    isPremium: true,
    locked: true as const,
    packageNames,
  };
}

export async function getMasterItemRecord(itemId: string): Promise<MasterItem> {
  const row = await prisma.masterItem.findUnique({ where: { id: itemId } });
  if (!row) throw new NotFoundError("Master item not found.");
  return row;
}

export type MasterItemListFilters = {
  disciplineId?: string;
  categoryId?: string;
  isPremium?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function listMasterItems(filters: MasterItemListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 20));

  const where: Prisma.MasterItemWhereInput = {
    status: "ACTIVE",
    ...(filters.disciplineId ? { disciplineId: filters.disciplineId } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.isPremium !== undefined ? { isPremium: filters.isPremium } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { itemCode: { contains: filters.search, mode: "insensitive" } },
            { shortDescription: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.masterItem.findMany({
      where,
      orderBy: [{ name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.masterItem.count({ where }),
  ]);

  return { items: rows.map(toMasterItemDTO), total, page, pageSize };
}

/** Seed-time only. Idempotent on (disciplineId, itemCode). */
export async function createMasterItem(input: {
  disciplineId: string;
  categoryId: string;
  itemCode: string;
  name: string;
  shortDescription?: string;
  fullDescription?: string;
  defaultUnit: string;
  defaultSpecificationJson?: unknown;
  technicalFieldsJson?: unknown;
  defaultTagsJson?: string[];
  searchKeywordsJson?: string[];
  synonymsJson?: string[];
  defaultManufacturerType?: string;
  defaultInstallationMethod?: string;
  defaultTestingRequirement?: string;
  defaultWarrantyRequirement?: string;
  isPremium?: boolean;
}) {
  const existing = await prisma.masterItem.findUnique({ where: { disciplineId_itemCode: { disciplineId: input.disciplineId, itemCode: input.itemCode } } });
  if (existing) return toMasterItemDTO(existing);

  const created = await prisma.masterItem.create({
    data: {
      disciplineId: input.disciplineId,
      categoryId: input.categoryId,
      itemCode: input.itemCode,
      name: input.name,
      shortDescription: input.shortDescription ?? "",
      fullDescription: input.fullDescription ?? "",
      defaultUnit: input.defaultUnit,
      defaultSpecificationJson: input.defaultSpecificationJson as never,
      technicalFieldsJson: input.technicalFieldsJson as never,
      defaultTagsJson: input.defaultTagsJson as never,
      searchKeywordsJson: input.searchKeywordsJson as never,
      synonymsJson: input.synonymsJson as never,
      defaultManufacturerType: input.defaultManufacturerType,
      defaultInstallationMethod: input.defaultInstallationMethod,
      defaultTestingRequirement: input.defaultTestingRequirement,
      defaultWarrantyRequirement: input.defaultWarrantyRequirement,
      isPremium: input.isPremium ?? true,
    },
  });
  return toMasterItemDTO(created);
}
