import { Prisma, RateStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import { getEnabledIndustry } from "@/lib/repositories/industry-repository";

export type RateCatalogueWriteInput = {
  industryEngineId: string;
  itemCode: string;
  category: string;
  description: string;
  unit: string;
  supplier: string;
  cost: Prisma.Decimal.Value;
  defaultMargin: Prisma.Decimal.Value;
  sellingRate: Prisma.Decimal.Value;
  currency: string;
  effectiveDate: Date;
  expiryDate?: Date | null;
  status?: RateStatus;
};

const catalogueStatusDTO = {
  [RateStatus.ACTIVE]: "active",
  [RateStatus.EXPIRED]: "expired",
  [RateStatus.INACTIVE]: "inactive",
} as const satisfies Record<RateStatus, "active" | "expired" | "inactive">;

function assertCatalogueDateRange(effectiveDate: Date, expiryDate?: Date | null) {
  if (expiryDate && expiryDate.getTime() < effectiveDate.getTime()) {
    throw new AppError(
      "VALIDATION_ERROR",
      "The request contains invalid fields.",
      400,
      { expiryDate: ["Expiry date cannot be before the effective date."] },
    );
  }
}

function toCatalogueDTO(item: Awaited<ReturnType<typeof getRateCatalogueRecord>>) {
  return {
    id: item.id,
    itemCode: item.itemCode,
    industryId: item.industryEngine.key,
    category: item.category,
    description: item.description,
    unit: item.unit,
    supplier: item.supplier,
    cost: item.cost.toNumber(),
    defaultMargin: item.defaultMargin.toNumber(),
    sellingRate: item.sellingRate.toNumber(),
    effectiveDate: item.effectiveDate.toISOString(),
    expiryDate: item.expiryDate?.toISOString(),
    currency: item.currency,
    status: catalogueStatusDTO[item.status],
  };
}

async function getRateCatalogueRecord(companyId: string, itemId: string) {
  const item = await prisma.rateCatalogueItem.findFirst({
    where: { id: itemId, companyId },
    include: { industryEngine: true },
  });
  if (!item) throw new NotFoundError("Rate catalogue item not found.");
  return item;
}

export async function listRateCatalogueItems(
  companyId: string,
  filters?: { industryEngineId?: string; status?: RateStatus },
) {
  const industry = filters?.industryEngineId
    ? await getEnabledIndustry(companyId, filters.industryEngineId)
    : undefined;
  const items = await prisma.rateCatalogueItem.findMany({
    where: {
      companyId,
      ...(industry ? { industryEngineId: industry.id } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
    },
    include: { industryEngine: true },
    orderBy: [{ itemCode: "asc" }, { effectiveDate: "desc" }],
  });
  return items.map(toCatalogueDTO);
}

export async function createRateCatalogueItem(companyId: string, input: RateCatalogueWriteInput) {
  const industry = await getEnabledIndustry(companyId, input.industryEngineId);
  const item = await prisma.rateCatalogueItem.create({
    data: {
      companyId,
      industryEngineId: industry.id,
      itemCode: input.itemCode,
      category: input.category,
      description: input.description,
      unit: input.unit,
      supplier: input.supplier,
      cost: new Prisma.Decimal(input.cost),
      defaultMargin: new Prisma.Decimal(input.defaultMargin),
      sellingRate: new Prisma.Decimal(input.sellingRate),
      currency: input.currency,
      effectiveDate: input.effectiveDate,
      expiryDate: input.expiryDate,
      status: input.status ?? RateStatus.ACTIVE,
    },
    include: { industryEngine: true },
  });
  return toCatalogueDTO(item);
}

export async function updateRateCatalogueItem(
  companyId: string,
  itemId: string,
  input: Partial<RateCatalogueWriteInput>,
) {
  const current = await getRateCatalogueRecord(companyId, itemId);
  const effectiveDate = input.effectiveDate ?? current.effectiveDate;
  const expiryDate = input.expiryDate !== undefined ? input.expiryDate : current.expiryDate;
  assertCatalogueDateRange(effectiveDate, expiryDate);
  const industry = input.industryEngineId
    ? await getEnabledIndustry(companyId, input.industryEngineId)
    : undefined;
  const item = await prisma.rateCatalogueItem.update({
    where: { id: current.id, companyId },
    data: {
      ...(industry ? { industryEngineId: industry.id } : {}),
      ...(input.itemCode !== undefined ? { itemCode: input.itemCode } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.supplier !== undefined ? { supplier: input.supplier } : {}),
      ...(input.cost !== undefined ? { cost: new Prisma.Decimal(input.cost) } : {}),
      ...(input.defaultMargin !== undefined ? { defaultMargin: new Prisma.Decimal(input.defaultMargin) } : {}),
      ...(input.sellingRate !== undefined ? { sellingRate: new Prisma.Decimal(input.sellingRate) } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.effectiveDate !== undefined ? { effectiveDate: input.effectiveDate } : {}),
      ...(input.expiryDate !== undefined ? { expiryDate: input.expiryDate } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    include: { industryEngine: true },
  });
  return toCatalogueDTO(item);
}

export async function deleteRateCatalogueItem(companyId: string, itemId: string) {
  const current = await getRateCatalogueRecord(companyId, itemId);
  await prisma.rateCatalogueItem.delete({ where: { id: current.id, companyId } });
  return { id: current.id, deleted: true };
}
