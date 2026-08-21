import { MarginMode, Prisma, RateStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";
import { getEnabledIndustry } from "@/lib/repositories/industry-repository";
import { getSupplier } from "@/lib/repositories/supplier-repository";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { calculateLandedCost, calculateSellingRate } from "@/lib/calculations/boq-calculator";

export type CatalogueItemWriteInput = {
  industryEngineId: string;
  supplierId?: string | null;
  itemCode: string;
  category: string;
  subcategory?: string | null;
  description: string;
  specification?: string | null;
  unit: string;
  manufacturer?: string | null;
  brand?: string | null;
  model?: string | null;
  countryOfOrigin?: string | null;
  baseCost: Prisma.Decimal.Value;
  freightCost?: Prisma.Decimal.Value;
  installationCost?: Prisma.Decimal.Value;
  additionalCost?: Prisma.Decimal.Value;
  marginMode?: MarginMode;
  defaultMargin?: Prisma.Decimal.Value;
  minimumSellingRate?: Prisma.Decimal.Value | null;
  currency?: string;
  effectiveDate: Date;
  expiryDate?: Date | null;
  sourceReference?: string | null;
  supplierQuotationReference?: string | null;
  metadataJson?: Prisma.InputJsonValue | null;
  changeReason?: string | null;
};

export type CatalogueListFilters = {
  search?: string;
  industryEngineId?: string;
  category?: string;
  supplierId?: string;
  status?: RateStatus;
  expired?: boolean;
  page?: number;
  pageSize?: number;
};

const catalogueInclude = {
  industryEngine: true,
  supplier: true,
} satisfies Prisma.RateCatalogueItemInclude;

type CatalogueRecord = Prisma.RateCatalogueItemGetPayload<{ include: typeof catalogueInclude }>;

function computeStatus(effectiveDate: Date, expiryDate: Date | null | undefined, isDeactivated: boolean): RateStatus {
  if (isDeactivated) return RateStatus.INACTIVE;
  const now = Date.now();
  if (effectiveDate.getTime() > now) return RateStatus.PENDING;
  if (expiryDate && expiryDate.getTime() < now) return RateStatus.EXPIRED;
  return RateStatus.ACTIVE;
}

export function toCatalogueDTO(item: CatalogueRecord) {
  return {
    id: item.id,
    itemCode: item.itemCode,
    industryId: item.industryEngine.key,
    industryEngineId: item.industryEngineId,
    category: item.category,
    subcategory: item.subcategory,
    description: item.description,
    specification: item.specification,
    unit: item.unit,
    supplierId: item.supplierId,
    supplierName: item.supplier?.name ?? null,
    manufacturer: item.manufacturer,
    brand: item.brand,
    model: item.model,
    countryOfOrigin: item.countryOfOrigin,
    baseCost: item.baseCost.toNumber(),
    freightCost: item.freightCost.toNumber(),
    installationCost: item.installationCost.toNumber(),
    additionalCost: item.additionalCost.toNumber(),
    landedCost: item.landedCost.toNumber(),
    marginMode: item.marginMode,
    defaultMargin: item.defaultMargin.toNumber(),
    sellingRate: item.sellingRate.toNumber(),
    minimumSellingRate: item.minimumSellingRate?.toNumber() ?? null,
    belowMinimum: item.minimumSellingRate ? item.sellingRate.lessThan(item.minimumSellingRate) : false,
    currency: item.currency,
    effectiveDate: item.effectiveDate.toISOString(),
    expiryDate: item.expiryDate?.toISOString() ?? null,
    status: item.status,
    sourceReference: item.sourceReference,
    supplierQuotationReference: item.supplierQuotationReference,
    metadataJson: item.metadataJson,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

async function getCatalogueRecord(companyId: string, itemId: string): Promise<CatalogueRecord> {
  const item = await prisma.rateCatalogueItem.findFirst({
    where: { id: itemId, companyId },
    include: catalogueInclude,
  });
  if (!item) throw new NotFoundError("Rate catalogue item not found.");
  return item;
}

export async function getCatalogueItemById(companyId: string, itemId: string) {
  await refreshCatalogueStatuses(companyId);
  return toCatalogueDTO(await getCatalogueRecord(companyId, itemId));
}

export async function getCatalogueItemByCode(companyId: string, itemCode: string) {
  const item = await prisma.rateCatalogueItem.findFirst({
    where: { companyId, itemCode },
    include: catalogueInclude,
  });
  return item ? toCatalogueDTO(item) : null;
}

export async function listCatalogueItems(companyId: string, filters: CatalogueListFilters = {}) {
  await refreshCatalogueStatuses(companyId);
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const industry = filters.industryEngineId
    ? await getEnabledIndustry(companyId, filters.industryEngineId).catch(() => null)
    : undefined;

  const where: Prisma.RateCatalogueItemWhereInput = {
    companyId,
    ...(industry ? { industryEngineId: industry.id } : {}),
    ...(filters.category ? { category: { equals: filters.category, mode: "insensitive" } } : {}),
    ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.expired ? { status: RateStatus.EXPIRED } : {}),
    ...(filters.search
      ? {
          OR: [
            { itemCode: { contains: filters.search, mode: "insensitive" } },
            { description: { contains: filters.search, mode: "insensitive" } },
            { category: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.rateCatalogueItem.findMany({
      where,
      include: catalogueInclude,
      orderBy: [{ itemCode: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.rateCatalogueItem.count({ where }),
  ]);

  return { items: items.map(toCatalogueDTO), total, page, pageSize };
}

export async function listExpiredItems(companyId: string) {
  await refreshCatalogueStatuses(companyId);
  const items = await prisma.rateCatalogueItem.findMany({
    where: { companyId, status: RateStatus.EXPIRED },
    include: catalogueInclude,
    orderBy: { expiryDate: "desc" },
  });
  return items.map(toCatalogueDTO);
}

export async function listItemsBySupplier(companyId: string, supplierId: string) {
  const items = await prisma.rateCatalogueItem.findMany({
    where: { companyId, supplierId },
    include: catalogueInclude,
    orderBy: { itemCode: "asc" },
  });
  return items.map(toCatalogueDTO);
}

export async function getPriceHistory(companyId: string, itemId: string) {
  await getCatalogueRecord(companyId, itemId);
  const history = await prisma.rateCataloguePriceHistory.findMany({
    where: { companyId, rateCatalogueItemId: itemId },
    include: { changedByUser: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return history.map((entry) => ({
    id: entry.id,
    previousBaseCost: entry.previousBaseCost.toNumber(),
    newBaseCost: entry.newBaseCost.toNumber(),
    previousFreightCost: entry.previousFreightCost.toNumber(),
    newFreightCost: entry.newFreightCost.toNumber(),
    previousInstallationCost: entry.previousInstallationCost.toNumber(),
    newInstallationCost: entry.newInstallationCost.toNumber(),
    previousAdditionalCost: entry.previousAdditionalCost.toNumber(),
    newAdditionalCost: entry.newAdditionalCost.toNumber(),
    previousLandedCost: entry.previousLandedCost.toNumber(),
    newLandedCost: entry.newLandedCost.toNumber(),
    previousMargin: entry.previousMargin.toNumber(),
    newMargin: entry.newMargin.toNumber(),
    previousSellingRate: entry.previousSellingRate.toNumber(),
    newSellingRate: entry.newSellingRate.toNumber(),
    currency: entry.currency,
    effectiveDate: entry.effectiveDate.toISOString(),
    expiryDate: entry.expiryDate?.toISOString() ?? null,
    changedByName: entry.changedByUser?.fullName ?? null,
    changeReason: entry.changeReason,
    createdAt: entry.createdAt.toISOString(),
  }));
}

async function resolveSupplierId(companyId: string, supplierId?: string | null): Promise<string | null> {
  if (!supplierId) return null;
  const supplier = await getSupplier(companyId, supplierId);
  return supplier.id;
}

export async function createCatalogueItem(companyId: string, input: CatalogueItemWriteInput) {
  const industry = await getEnabledIndustry(companyId, input.industryEngineId);
  const resolvedSupplierId = await resolveSupplierId(companyId, input.supplierId);

  const landedCost = calculateLandedCost({
    unitCost: input.baseCost,
    freightCost: input.freightCost,
    installationCost: input.installationCost,
    additionalCost: input.additionalCost,
  });
  const marginMode = input.marginMode ?? MarginMode.MARKUP;
  const sellingRate = calculateSellingRate(landedCost, marginMode, input.defaultMargin ?? 0);
  const status = computeStatus(input.effectiveDate, input.expiryDate, false);

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.rateCatalogueItem.create({
      data: {
        companyId,
        industryEngineId: industry.id,
        supplierId: resolvedSupplierId,
        itemCode: input.itemCode,
        category: input.category,
        subcategory: input.subcategory,
        description: input.description,
        specification: input.specification,
        unit: input.unit,
        manufacturer: input.manufacturer,
        brand: input.brand,
        model: input.model,
        countryOfOrigin: input.countryOfOrigin,
        baseCost: new Prisma.Decimal(input.baseCost),
        freightCost: new Prisma.Decimal(input.freightCost ?? 0),
        installationCost: new Prisma.Decimal(input.installationCost ?? 0),
        additionalCost: new Prisma.Decimal(input.additionalCost ?? 0),
        landedCost,
        marginMode,
        defaultMargin: new Prisma.Decimal(input.defaultMargin ?? 0),
        sellingRate,
        minimumSellingRate:
          input.minimumSellingRate !== undefined && input.minimumSellingRate !== null
            ? new Prisma.Decimal(input.minimumSellingRate)
            : null,
        currency: input.currency ?? "AED",
        effectiveDate: input.effectiveDate,
        expiryDate: input.expiryDate,
        status,
        sourceReference: input.sourceReference,
        supplierQuotationReference: input.supplierQuotationReference,
        metadataJson: input.metadataJson ?? undefined,
      },
      include: catalogueInclude,
    });
    await createAuditLog(companyId, {
      entityType: "RateCatalogueItem",
      entityId: created.id,
      action: "CATALOGUE_ITEM_CREATED",
      payload: { itemCode: created.itemCode, sellingRate: sellingRate.toNumber() },
    }, tx);
    return created;
  });

  return toCatalogueDTO(item);
}

function pricingFieldsChanged(current: CatalogueRecord, next: {
  baseCost: Prisma.Decimal;
  freightCost: Prisma.Decimal;
  installationCost: Prisma.Decimal;
  additionalCost: Prisma.Decimal;
  landedCost: Prisma.Decimal;
  defaultMargin: Prisma.Decimal;
  sellingRate: Prisma.Decimal;
  currency: string;
  effectiveDate: Date;
  expiryDate: Date | null;
}): boolean {
  return (
    !current.baseCost.equals(next.baseCost) ||
    !current.freightCost.equals(next.freightCost) ||
    !current.installationCost.equals(next.installationCost) ||
    !current.additionalCost.equals(next.additionalCost) ||
    !current.landedCost.equals(next.landedCost) ||
    !current.defaultMargin.equals(next.defaultMargin) ||
    !current.sellingRate.equals(next.sellingRate) ||
    current.currency !== next.currency ||
    current.effectiveDate.getTime() !== next.effectiveDate.getTime() ||
    (current.expiryDate?.getTime() ?? null) !== (next.expiryDate?.getTime() ?? null)
  );
}

export async function updateCatalogueItem(
  companyId: string,
  itemId: string,
  input: Partial<CatalogueItemWriteInput>,
  changedByUserId?: string | null,
) {
  const current = await getCatalogueRecord(companyId, itemId);

  const industry = input.industryEngineId
    ? await getEnabledIndustry(companyId, input.industryEngineId)
    : undefined;
  const resolvedSupplierId =
    input.supplierId !== undefined ? await resolveSupplierId(companyId, input.supplierId) : undefined;

  const baseCost = input.baseCost !== undefined ? new Prisma.Decimal(input.baseCost) : current.baseCost;
  const freightCost = input.freightCost !== undefined ? new Prisma.Decimal(input.freightCost) : current.freightCost;
  const installationCost =
    input.installationCost !== undefined ? new Prisma.Decimal(input.installationCost) : current.installationCost;
  const additionalCost =
    input.additionalCost !== undefined ? new Prisma.Decimal(input.additionalCost) : current.additionalCost;
  const marginMode = input.marginMode ?? current.marginMode;
  const defaultMargin =
    input.defaultMargin !== undefined ? new Prisma.Decimal(input.defaultMargin) : current.defaultMargin;
  const effectiveDate = input.effectiveDate ?? current.effectiveDate;
  const expiryDate = input.expiryDate !== undefined ? input.expiryDate : current.expiryDate;
  const currency = input.currency ?? current.currency;

  const landedCost = calculateLandedCost({ unitCost: baseCost, freightCost, installationCost, additionalCost });
  const sellingRate = calculateSellingRate(landedCost, marginMode, defaultMargin);
  const isDeactivated = current.status === RateStatus.INACTIVE;
  const status = computeStatus(effectiveDate, expiryDate, isDeactivated);

  const shouldRecordHistory = pricingFieldsChanged(current, {
    baseCost,
    freightCost,
    installationCost,
    additionalCost,
    landedCost,
    defaultMargin,
    sellingRate,
    currency,
    effectiveDate,
    expiryDate: expiryDate ?? null,
  });

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.rateCatalogueItem.update({
      where: { id: current.id, companyId },
      data: {
        ...(industry ? { industryEngineId: industry.id } : {}),
        ...(resolvedSupplierId !== undefined ? { supplierId: resolvedSupplierId } : {}),
        ...(input.itemCode !== undefined ? { itemCode: input.itemCode } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.subcategory !== undefined ? { subcategory: input.subcategory } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.specification !== undefined ? { specification: input.specification } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.manufacturer !== undefined ? { manufacturer: input.manufacturer } : {}),
        ...(input.brand !== undefined ? { brand: input.brand } : {}),
        ...(input.model !== undefined ? { model: input.model } : {}),
        ...(input.countryOfOrigin !== undefined ? { countryOfOrigin: input.countryOfOrigin } : {}),
        baseCost,
        freightCost,
        installationCost,
        additionalCost,
        landedCost,
        marginMode,
        defaultMargin,
        sellingRate,
        ...(input.minimumSellingRate !== undefined
          ? { minimumSellingRate: input.minimumSellingRate !== null ? new Prisma.Decimal(input.minimumSellingRate) : null }
          : {}),
        currency,
        effectiveDate,
        expiryDate,
        status,
        ...(input.sourceReference !== undefined ? { sourceReference: input.sourceReference } : {}),
        ...(input.supplierQuotationReference !== undefined
          ? { supplierQuotationReference: input.supplierQuotationReference }
          : {}),
        ...(input.metadataJson !== undefined ? { metadataJson: input.metadataJson ?? Prisma.JsonNull } : {}),
      },
      include: catalogueInclude,
    });

    if (shouldRecordHistory) {
      await tx.rateCataloguePriceHistory.create({
        data: {
          companyId,
          rateCatalogueItemId: current.id,
          previousBaseCost: current.baseCost,
          newBaseCost: baseCost,
          previousFreightCost: current.freightCost,
          newFreightCost: freightCost,
          previousInstallationCost: current.installationCost,
          newInstallationCost: installationCost,
          previousAdditionalCost: current.additionalCost,
          newAdditionalCost: additionalCost,
          previousLandedCost: current.landedCost,
          newLandedCost: landedCost,
          previousMargin: current.defaultMargin,
          newMargin: defaultMargin,
          previousSellingRate: current.sellingRate,
          newSellingRate: sellingRate,
          currency,
          effectiveDate,
          expiryDate,
          changedByUserId: changedByUserId ?? null,
          changeReason: input.changeReason ?? null,
        },
      });
    }

    await createAuditLog(companyId, {
      entityType: "RateCatalogueItem",
      entityId: updated.id,
      action: "CATALOGUE_ITEM_UPDATED",
      payload: { itemCode: updated.itemCode, priceChanged: shouldRecordHistory },
    }, tx);

    return updated;
  });

  return toCatalogueDTO(item);
}

export async function deactivateCatalogueItem(companyId: string, itemId: string) {
  const current = await getCatalogueRecord(companyId, itemId);
  const item = await prisma.rateCatalogueItem.update({
    where: { id: current.id, companyId },
    data: { status: RateStatus.INACTIVE },
    include: catalogueInclude,
  });
  await createAuditLog(companyId, {
    entityType: "RateCatalogueItem",
    entityId: item.id,
    action: "CATALOGUE_ITEM_DEACTIVATED",
    payload: { itemCode: item.itemCode },
  });
  return toCatalogueDTO(item);
}

/**
 * Recomputes and persists the derived `status` (ACTIVE/PENDING/EXPIRED) for
 * every non-manually-deactivated catalogue item whose date-derived status no
 * longer matches today's date. Intended to run before status-sensitive reads
 * (dashboard aggregates, expiry verification) so stored status never drifts
 * from actual dates without requiring a background job in this phase.
 */
export async function refreshCatalogueStatuses(companyId: string): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.rateCatalogueItem.updateMany({
      where: { companyId, status: { in: [RateStatus.ACTIVE, RateStatus.PENDING] }, effectiveDate: { gt: now } },
      data: { status: RateStatus.PENDING },
    }),
    prisma.rateCatalogueItem.updateMany({
      where: {
        companyId,
        status: { in: [RateStatus.ACTIVE, RateStatus.PENDING] },
        effectiveDate: { lte: now },
        expiryDate: { lt: now },
      },
      data: { status: RateStatus.EXPIRED },
    }),
    prisma.rateCatalogueItem.updateMany({
      where: {
        companyId,
        status: { in: [RateStatus.PENDING, RateStatus.EXPIRED] },
        effectiveDate: { lte: now },
        OR: [{ expiryDate: null }, { expiryDate: { gte: now } }],
      },
      data: { status: RateStatus.ACTIVE },
    }),
  ]);
}
