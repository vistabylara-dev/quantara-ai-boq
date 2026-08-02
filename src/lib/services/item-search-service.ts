import { prisma } from "@/lib/db/prisma";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { companyHasPackageAccessForItem } from "@/lib/entitlements/package-entitlement-service";
import { canUsePremiumItem } from "@/lib/entitlements/entitlement-service";
import { toLibraryItemDTO } from "@/lib/repositories/company-library-repository";
import { toMasterItemDTO, toMasterItemPreviewDTO } from "@/lib/repositories/master-item-repository";

/**
 * Unified search across every item source, ranked per spec section 11:
 * exact company code > exact name > recent usage > favorite > company
 * library > purchased package > previous project > supplier catalogue >
 * locked preview. Each source is queried separately with its own indexed
 * lookup rather than one unstructured LIKE across a merged table.
 */

export type SearchSource = "COMPANY_LIBRARY" | "RECENT" | "FAVORITE" | "MASTER_PACKAGE" | "PREVIOUS_PROJECT" | "SUPPLIER_CATALOGUE" | "LOCKED_PREVIEW";

export type SearchResultItem = {
  source: SearchSource;
  rankTier: number;
  id: string;
  itemCode: string;
  name: string;
  description: string;
  unit: string;
  isPremium: boolean;
  locked: boolean;
  packageNames: string[];
};

const RESULT_LIMIT_PER_SOURCE = 15;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export async function searchItems(
  actor: CurrentActor,
  query: string,
  filters: { disciplineId?: string; categoryId?: string } = {},
): Promise<{ items: SearchResultItem[]; total: number }> {
  const q = query.trim();
  const normalizedQuery = normalize(q);
  const results: SearchResultItem[] = [];

  // 1-2, 4-5: company library (exact code/name gets a higher tier below; the rest is company-library-match tier).
  const libraryRows = await prisma.companyLibraryItem.findMany({
    where: {
      companyId: actor.companyId,
      isActive: true,
      ...(filters.disciplineId ? { disciplineId: filters.disciplineId } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(q
        ? {
            OR: [
              { companyItemCode: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ isFavorite: "desc" }, { usageCount: "desc" }],
    take: RESULT_LIMIT_PER_SOURCE,
  });
  for (const row of libraryRows) {
    const dto = toLibraryItemDTO(row);
    const exactCode = normalize(dto.companyItemCode) === normalizedQuery;
    const exactName = normalize(dto.name) === normalizedQuery;
    const tier = exactCode ? 1 : exactName ? 2 : dto.lastUsedAt ? 3 : dto.isFavorite ? 4 : 5;
    results.push({
      source: dto.lastUsedAt ? "RECENT" : dto.isFavorite ? "FAVORITE" : "COMPANY_LIBRARY",
      rankTier: tier,
      id: dto.id,
      itemCode: dto.companyItemCode,
      name: dto.name,
      description: dto.description,
      unit: dto.unit,
      isPremium: false,
      locked: false,
      packageNames: [],
    });
  }

  // 6, 9: master/package items — accessible ones rank as "purchased package match", inaccessible premium ones become a locked preview.
  if (q || filters.disciplineId || filters.categoryId) {
    const masterRows = await prisma.masterItem.findMany({
      where: {
        status: "ACTIVE",
        ...(filters.disciplineId ? { disciplineId: filters.disciplineId } : {}),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(q
          ? { OR: [{ itemCode: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { shortDescription: { contains: q, mode: "insensitive" } }] }
          : {}),
      },
      take: RESULT_LIMIT_PER_SOURCE,
    });
    for (const row of masterRows) {
      if (!row.isPremium) {
        const dto = toMasterItemDTO(row);
        results.push({
          source: "MASTER_PACKAGE",
          rankTier: 6,
          id: dto.id,
          itemCode: dto.itemCode,
          name: dto.name,
          description: dto.shortDescription,
          unit: dto.defaultUnit,
          isPremium: false,
          locked: false,
          packageNames: [],
        });
        continue;
      }

      const check = await canUsePremiumItem(actor.companyId, row.id);
      if (check.allowed) {
        const dto = toMasterItemDTO(row);
        results.push({
          source: "MASTER_PACKAGE",
          rankTier: 6,
          id: dto.id,
          itemCode: dto.itemCode,
          name: dto.name,
          description: dto.shortDescription,
          unit: dto.defaultUnit,
          isPremium: true,
          locked: false,
          packageNames: [],
        });
      } else {
        const packageLinks = await prisma.industryDataPackageItem.findMany({ where: { masterItemId: row.id }, include: { package: { select: { name: true } } } });
        const preview = toMasterItemPreviewDTO(row, packageLinks.map((link) => link.package.name));
        results.push({
          source: "LOCKED_PREVIEW",
          rankTier: 9,
          id: preview.id,
          itemCode: preview.itemCode,
          name: preview.name,
          description: preview.shortDescription,
          unit: preview.defaultUnit,
          isPremium: true,
          locked: true,
          packageNames: preview.packageNames,
        });
      }
    }
  }

  // 7: previous-project items — this company's own historical BOQ items.
  if (q) {
    const boqItemRows = await prisma.bOQItem.findMany({
      where: {
        companyId: actor.companyId,
        OR: [{ itemCode: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }],
      },
      orderBy: { createdAt: "desc" },
      take: RESULT_LIMIT_PER_SOURCE,
    });
    for (const row of boqItemRows) {
      results.push({
        source: "PREVIOUS_PROJECT",
        rankTier: 7,
        id: row.id,
        itemCode: row.itemCode,
        name: row.description,
        description: row.specification,
        unit: row.unit,
        isPremium: false,
        locked: false,
        packageNames: [],
      });
    }
  }

  // 8: supplier catalogue.
  if (q) {
    const catalogueRows = await prisma.rateCatalogueItem.findMany({
      where: {
        companyId: actor.companyId,
        status: "ACTIVE",
        OR: [{ itemCode: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }],
      },
      take: RESULT_LIMIT_PER_SOURCE,
    });
    for (const row of catalogueRows) {
      results.push({
        source: "SUPPLIER_CATALOGUE",
        rankTier: 8,
        id: row.id,
        itemCode: row.itemCode,
        name: row.description,
        description: row.specification ?? "",
        unit: row.unit,
        isPremium: false,
        locked: false,
        packageNames: [],
      });
    }
  }

  results.sort((a, b) => a.rankTier - b.rankTier);
  return { items: results, total: results.length };
}

export async function listRecentlyUsed(actor: CurrentActor, limit = 10) {
  const { listRecentlyUsedItems } = await import("@/lib/repositories/company-library-repository");
  return listRecentlyUsedItems(actor.companyId, limit);
}

export async function listFavorites(actor: CurrentActor, limit = 50) {
  const { listFavoriteItems } = await import("@/lib/repositories/company-library-repository");
  return listFavoriteItems(actor.companyId, limit);
}

export async function listPreviousProjectItems(actor: CurrentActor, query: string, limit = 20) {
  const rows = await prisma.bOQItem.findMany({
    where: {
      companyId: actor.companyId,
      ...(query ? { OR: [{ itemCode: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(50, Math.max(1, limit)),
  });
  return rows;
}
