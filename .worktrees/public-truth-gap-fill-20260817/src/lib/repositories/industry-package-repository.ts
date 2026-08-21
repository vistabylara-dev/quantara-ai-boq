import type { IndustryDataPackage } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toPackageDTO(row: IndustryDataPackage) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    disciplineId: row.disciplineId,
    packageType: row.packageType,
    version: row.version,
    itemCount: row.itemCount,
    monthlyPrice: row.monthlyPrice.toNumber(),
    annualPrice: row.annualPrice.toNumber(),
    currency: row.currency,
    status: row.status,
    isFeatured: row.isFeatured,
  };
}

export async function listPackages(includeInactive = false) {
  const rows = await prisma.industryDataPackage.findMany({
    where: includeInactive ? {} : { status: "ACTIVE" },
    orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
  });
  return rows.map(toPackageDTO);
}

export async function getPackage(packageIdOrKey: string) {
  const row = await prisma.industryDataPackage.findFirst({
    where: isUuid(packageIdOrKey) ? { OR: [{ id: packageIdOrKey }, { key: packageIdOrKey }] } : { key: packageIdOrKey },
  });
  if (!row) throw new NotFoundError("Package not found.");
  return toPackageDTO(row);
}

export async function listPackageItems(packageId: string) {
  const links = await prisma.industryDataPackageItem.findMany({
    where: { packageId },
    include: { masterItem: true },
    orderBy: { sortOrder: "asc" },
  });
  return links.map((link) => link.masterItem);
}

export async function searchPackageItems(
  packageId: string,
  options: { page: number; pageSize: number; search?: string }
) {
  const { page, pageSize, search } = options;
  const skip = (page - 1) * pageSize;

  const where = {
    packageId,
    ...(search ? {
      masterItem: {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { itemCode: { contains: search, mode: "insensitive" as const } },
        ]
      }
    } : {})
  };

  const [total, links] = await Promise.all([
    prisma.industryDataPackageItem.count({ where }),
    prisma.industryDataPackageItem.findMany({
      where,
      include: { masterItem: true },
      orderBy: { sortOrder: "asc" },
      skip,
      take: pageSize,
    })
  ]);

  return { total, items: links.map(link => link.masterItem) };
}

/** Seed-time only. Idempotent on key. */
export async function createPackage(input: {
  key: string;
  name: string;
  description?: string;
  disciplineId: string;
  packageType: IndustryDataPackage["packageType"];
  monthlyPrice?: number;
  annualPrice?: number;
  currency?: string;
  isFeatured?: boolean;
}) {
  const existing = await prisma.industryDataPackage.findUnique({ where: { key: input.key } });
  if (existing) return toPackageDTO(existing);

  const created = await prisma.industryDataPackage.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description ?? "",
      disciplineId: input.disciplineId,
      packageType: input.packageType,
      monthlyPrice: input.monthlyPrice ?? 0,
      annualPrice: input.annualPrice ?? 0,
      currency: input.currency ?? "USD",
      isFeatured: input.isFeatured ?? false,
    },
  });
  return toPackageDTO(created);
}

/**
 * Seed-time only. Idempotent on (packageId, masterItemId); refreshes the package's itemCount.
 *
 * Uses a single batched createMany (skipDuplicates) instead of N sequential upserts inside an
 * interactive transaction — the latter hit Prisma's default 5s interactive-transaction timeout
 * once masterItemIds got past a few dozen entries on a WAN connection (each upsert is its own
 * round trip). createMany does it in one round trip and needs no transaction wrapper; a rerun
 * after a partial failure is still safe since createMany skips existing rows and the count/update
 * below always reflects whatever is actually in the table.
 */
export async function addItemsToPackage(packageId: string, masterItemIds: string[]) {
  // sortOrder has no unique constraint, but package readers order by it —
  // always assigning 0..n-1 would tie with any existing rows' sortOrder on
  // a package that already has members (e.g. a re-publish or a membership
  // repair), leaving their relative order unspecified. Allocate after the
  // current maximum instead.
  const maxSortOrder = await prisma.industryDataPackageItem.aggregate({ where: { packageId }, _max: { sortOrder: true } });
  const startOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;
  await prisma.industryDataPackageItem.createMany({
    data: masterItemIds.map((masterItemId, index) => ({ packageId, masterItemId, sortOrder: startOrder + index })),
    skipDuplicates: true,
  });
  const count = await prisma.industryDataPackageItem.count({ where: { packageId } });
  await prisma.industryDataPackage.update({ where: { id: packageId }, data: { itemCount: count } });
}
