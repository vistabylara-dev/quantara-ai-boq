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

/** Seed-time only. Idempotent on (packageId, masterItemId); refreshes the package's itemCount. */
export async function addItemsToPackage(packageId: string, masterItemIds: string[]) {
  await prisma.$transaction(async (tx) => {
    for (const [index, masterItemId] of masterItemIds.entries()) {
      await tx.industryDataPackageItem.upsert({
        where: { packageId_masterItemId: { packageId, masterItemId } },
        update: {},
        create: { packageId, masterItemId, sortOrder: index },
      });
    }
    const count = await tx.industryDataPackageItem.count({ where: { packageId } });
    await tx.industryDataPackage.update({ where: { id: packageId }, data: { itemCount: count } });
  });
}
