import type { Manufacturer, ProductCertification, ProductModel, ProductSeries } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";

/**
 * MASTER-SCALE-1A — the manufacturer/brand/series/model tier, kept fully
 * separate from the generic master item/variant tier (see schema.prisma
 * doc comment on Manufacturer). Nothing here is a prerequisite for the
 * generic Master BOQ to function.
 */

export function toManufacturerDTO(row: Manufacturer) {
  return {
    id: row.id,
    legalName: row.legalName,
    brandNamesJson: row.brandNamesJson,
    country: row.country,
    website: row.website,
    status: row.status,
    isVerified: row.isVerified,
    regionsServedJson: row.regionsServedJson,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listManufacturers(filters: { search?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 20));
  const where = filters.search ? { legalName: { contains: filters.search, mode: "insensitive" as const } } : {};

  const [rows, total] = await Promise.all([
    prisma.manufacturer.findMany({ where, orderBy: { legalName: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.manufacturer.count({ where }),
  ]);
  return { items: rows.map(toManufacturerDTO), total, page, pageSize };
}

export async function getManufacturer(id: string): Promise<Manufacturer> {
  const row = await prisma.manufacturer.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Manufacturer not found.");
  return row;
}

export async function createManufacturer(input: {
  legalName: string;
  brandNames?: string[];
  country?: string;
  website?: string;
  regionsServed?: string[];
}) {
  const created = await prisma.manufacturer.create({
    data: {
      legalName: input.legalName,
      brandNamesJson: input.brandNames as never,
      country: input.country,
      website: input.website,
      regionsServedJson: input.regionsServed as never,
    },
  });
  return toManufacturerDTO(created);
}

function toProductSeriesDTO(row: ProductSeries) {
  return {
    id: row.id,
    manufacturerId: row.manufacturerId,
    seriesName: row.seriesName,
    hierarchyNodeId: row.hierarchyNodeId,
    effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listProductSeriesForManufacturer(manufacturerId: string) {
  const rows = await prisma.productSeries.findMany({ where: { manufacturerId }, orderBy: { seriesName: "asc" } });
  return rows.map(toProductSeriesDTO);
}

export async function createProductSeries(input: { manufacturerId: string; seriesName: string; hierarchyNodeId?: string }) {
  await getManufacturer(input.manufacturerId);
  const created = await prisma.productSeries.create({
    data: { manufacturerId: input.manufacturerId, seriesName: input.seriesName, hierarchyNodeId: input.hierarchyNodeId },
  });
  return toProductSeriesDTO(created);
}

function toProductModelDTO(row: ProductModel) {
  return {
    id: row.id,
    modelCode: row.modelCode,
    productSeriesId: row.productSeriesId,
    masterItemVersionId: row.masterItemVersionId,
    region: row.region,
    isActive: row.isActive,
    replacementProductModelId: row.replacementProductModelId,
    source: row.source,
    verificationState: row.verificationState,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listProductModelsForSeries(productSeriesId: string) {
  const rows = await prisma.productModel.findMany({ where: { productSeriesId }, orderBy: { modelCode: "asc" } });
  return rows.map(toProductModelDTO);
}

export async function createProductModel(input: {
  modelCode: string;
  productSeriesId: string;
  masterItemVersionId?: string;
  region?: "UAE" | "GCC" | "INTERNATIONAL" | "COUNTRY_SPECIFIC";
  source?: string;
}) {
  const series = await prisma.productSeries.findUnique({ where: { id: input.productSeriesId } });
  if (!series) throw new NotFoundError("Product series not found.");

  const created = await prisma.productModel.create({
    data: {
      modelCode: input.modelCode,
      productSeriesId: input.productSeriesId,
      masterItemVersionId: input.masterItemVersionId,
      region: input.region,
      source: input.source ?? "",
    },
  });
  return toProductModelDTO(created);
}

export async function setProductModelVerificationState(id: string, verificationState: "UNVERIFIED" | "VERIFIED" | "NEEDS_REVIEW") {
  const existing = await prisma.productModel.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Product model not found.");
  const updated = await prisma.productModel.update({ where: { id }, data: { verificationState } });
  return toProductModelDTO(updated);
}

function toCertificationDTO(row: ProductCertification) {
  return {
    id: row.id,
    productModelId: row.productModelId,
    masterItemId: row.masterItemId,
    certificationType: row.certificationType,
    authority: row.authority,
    certificateNumber: row.certificateNumber,
    region: row.region,
    issueDate: row.issueDate?.toISOString() ?? null,
    expiryDate: row.expiryDate?.toISOString() ?? null,
    verificationState: row.verificationState,
    sourceDocumentReference: row.sourceDocumentReference,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createCertification(input: {
  productModelId?: string;
  masterItemId?: string;
  certificationType: string;
  authority: string;
  certificateNumber?: string;
  region?: "UAE" | "GCC" | "INTERNATIONAL" | "COUNTRY_SPECIFIC";
  issueDate?: string;
  expiryDate?: string;
  sourceDocumentReference: string;
}) {
  const created = await prisma.productCertification.create({
    data: {
      productModelId: input.productModelId,
      masterItemId: input.masterItemId,
      certificationType: input.certificationType,
      authority: input.authority,
      certificateNumber: input.certificateNumber ?? "",
      region: input.region,
      issueDate: input.issueDate ? new Date(input.issueDate) : undefined,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
      sourceDocumentReference: input.sourceDocumentReference,
    },
  });
  return toCertificationDTO(created);
}
