import type { MasterItem, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";
import { getDescendantNodeIds } from "@/lib/repositories/master-hierarchy-repository";

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
  /** MASTER-BOQ-1A — filters by any node in the new deep hierarchy (industry/discipline/system/category/subcategory/item family). */
  hierarchyNodeId?: string;
  /** MASTER-SCALE-1A — items with at least one verified manufacturer product model. */
  manufacturerId?: string;
  /** MASTER-SCALE-1A — items with a regional applicability row for this scope. */
  regionScope?: "UAE" | "GCC" | "INTERNATIONAL" | "COUNTRY_SPECIFIC";
  isPremium?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function listMasterItems(filters: MasterItemListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 20));

  // A hierarchy filter matches the node itself *and* every descendant, so
  // filtering by a SYSTEM node (e.g. "HVAC") also returns items linked at a
  // deeper CATEGORY/SUBCATEGORY/ITEM_FAMILY node underneath it.
  const hierarchyNodeIds = filters.hierarchyNodeId ? await getDescendantNodeIds(filters.hierarchyNodeId) : null;

  const where: Prisma.MasterItemWhereInput = {
    status: "ACTIVE",
    ...(filters.disciplineId ? { disciplineId: filters.disciplineId } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(hierarchyNodeIds ? { hierarchyNodeId: { in: hierarchyNodeIds } } : {}),
    ...(filters.manufacturerId
      ? { versions: { some: { productModels: { some: { productSeries: { manufacturerId: filters.manufacturerId } } } } } }
      : {}),
    ...(filters.regionScope ? { regionalApplicability: { some: { scope: filters.regionScope } } } : {}),
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

/**
 * MASTER-BOQ-1A customer-facing detail: hierarchy breadcrumb, classification
 * summary, region summary, and the current PUBLISHED version's specification
 * templates — never draft/unpublished versions, never source batch/import
 * metadata, never internal-only notes.
 */
export async function getMasterItemCustomerDetail(itemId: string) {
  const row = await getMasterItemRecord(itemId);

  try {
    const [classifications, regionalApplicability, publishedVersion, hierarchyNode] = await Promise.all([
      prisma.masterItemClassification.findMany({
        where: { masterItemId: itemId },
        select: { system: true, code: true, label: true, isPrimary: true },
      }),
      prisma.masterItemRegionalApplicability.findMany({
        where: { masterItemId: itemId },
        select: { scope: true, countryCode: true },
      }),
      prisma.masterItemVersion.findFirst({
        where: { masterItemId: itemId, status: "PUBLISHED" },
        select: { versionNumber: true, specificationTemplate: true, inclusionTemplate: true, exclusionTemplate: true, effectiveDate: true },
      }),
      row.hierarchyNodeId
        ? prisma.masterHierarchyNode.findUnique({ where: { id: row.hierarchyNodeId }, select: { id: true, code: true, name: true, nodeType: true } })
        : Promise.resolve(null),
    ]);

    return { ...toMasterItemDTO(row), hierarchyNode, classifications, regionalApplicability, publishedVersion };
  } catch {
    // MASTER-BOQ-1A tables ship in a code deploy that lands before the
    // corresponding `prisma migrate deploy` is run against production
    // (Vercel's build never runs migrations automatically) — until that
    // migration runs, degrade to the pre-existing base fields rather than
    // 500ing a previously-working item detail view.
    return {
      ...toMasterItemDTO(row),
      hierarchyNode: null as { id: string; code: string; name: string; nodeType: string } | null,
      classifications: [] as { system: string; code: string; label: string; isPrimary: boolean }[],
      regionalApplicability: [] as { scope: string; countryCode: string }[],
      publishedVersion: null as { versionNumber: number; specificationTemplate: string; inclusionTemplate: string; exclusionTemplate: string; effectiveDate: Date | null } | null,
    };
  }
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
