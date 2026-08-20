import type { CommerceBillingInterval, CommerceProduct, CommercePrice, CommerceProductType, EntitlementTemplate, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";

/**
 * STRIPE-1B — read/write access to the internal commerce catalogue
 * (CommerceProduct/CommercePrice/EntitlementTemplate). Deliberately global
 * (not company-scoped) — this is a platform-wide product catalogue, not
 * tenant data, the same way SoftwarePlan/IndustryDataPackage already are.
 */

const productInclude = {
  prices: { orderBy: { createdAt: "asc" as const } },
  entitlementTemplate: true,
  industryPackage: { select: { id: true, key: true, name: true, status: true } },
} satisfies Prisma.CommerceProductInclude;

export type CommerceProductRecord = Prisma.CommerceProductGetPayload<{ include: typeof productInclude }>;

export function toCommercePriceDTO(row: CommercePrice) {
  return {
    id: row.id,
    productId: row.productId,
    code: row.code,
    amountMinor: row.amountMinor,
    currency: row.currency,
    billingInterval: row.billingInterval,
    isFromPrice: row.isFromPrice,
    isActive: row.isActive,
    validFrom: row.validFrom.toISOString(),
    validUntil: row.validUntil?.toISOString() ?? null,
    reviewStatus: row.reviewStatus,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type CommercePriceDTO = ReturnType<typeof toCommercePriceDTO>;

function toEntitlementTemplateDTO(row: EntitlementTemplate) {
  return {
    id: row.id,
    productId: row.productId,
    maxUsers: row.maxUsers,
    maxWorkspaces: row.maxWorkspaces,
    maxActiveProjects: row.maxActiveProjects,
    maxBoqGenerationsPerMonth: row.maxBoqGenerationsPerMonth,
    maxTechnicalReportsPerMonth: row.maxTechnicalReportsPerMonth,
    maxWatermarkFreeExportsPerMonth: row.maxWatermarkFreeExportsPerMonth,
    permittedExportFormats: (row.permittedExportFormatsJson as string[] | null) ?? [],
    removesWatermark: row.removesWatermark,
    allowsCompanyBranding: row.allowsCompanyBranding,
    allowsApiAccess: row.allowsApiAccess,
    allowsWhiteLabel: row.allowsWhiteLabel,
    industryPackageKeys: (row.industryPackageKeysJson as string[] | null) ?? [],
    aiCreditsGranted: row.aiCreditsGranted,
    downloadLimit: row.downloadLimit,
    entitlementDurationDays: row.entitlementDurationDays,
  };
}

export type EntitlementTemplateDTO = ReturnType<typeof toEntitlementTemplateDTO>;

export function toCommerceProductDTO(row: CommerceProductRecord) {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    name: row.name,
    shortDescription: row.shortDescription,
    description: row.description,
    purchaseMode: row.purchaseMode,
    isActive: row.isActive,
    isPublic: row.isPublic,
    sortOrder: row.sortOrder,
    industryPackage: row.industryPackage,
    prices: row.prices.map(toCommercePriceDTO),
    entitlementTemplate: row.entitlementTemplate ? toEntitlementTemplateDTO(row.entitlementTemplate) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type CommerceProductDTO = ReturnType<typeof toCommerceProductDTO>;

/**
 * Public projection — never database IDs beyond the product's own, never
 * metadataJson, never inactive/private products, never unpublished prices.
 *
 * item-D (Round 3 correction) — "never unpublished prices" was previously
 * NOT enforced here: only `isActive` was checked, so a price still awaiting
 * governed owner/admin approval (`reviewStatus: "REQUIRES_REVIEW"`, or even
 * "DRAFT"/"RETIRED") was exposed by the public, unauthenticated
 * /api/commerce/products endpoint the moment its product/price rows were
 * active — before any approval. Only `reviewStatus === "APPROVED"` is a
 * published price; every other status is filtered out here exactly as the
 * governed approval flow (commerce-price-approval-service.ts) intends.
 */
export function toPublicCommerceProductDTO(row: CommerceProductRecord) {
  return {
    code: row.code,
    type: row.type,
    name: row.name,
    shortDescription: row.shortDescription,
    description: row.description,
    purchaseMode: row.purchaseMode,
    prices: row.prices
      .filter((p) => p.isActive && p.reviewStatus === "APPROVED")
      .map((p) => ({
        code: p.code,
        amountMinor: p.amountMinor,
        currency: p.currency,
        billingInterval: p.billingInterval,
        isFromPrice: p.isFromPrice,
      })),
    entitlementSummary: row.entitlementTemplate
      ? {
          maxUsers: row.entitlementTemplate.maxUsers,
          maxActiveProjects: row.entitlementTemplate.maxActiveProjects,
          maxBoqGenerationsPerMonth: row.entitlementTemplate.maxBoqGenerationsPerMonth,
          removesWatermark: row.entitlementTemplate.removesWatermark,
          allowsCompanyBranding: row.entitlementTemplate.allowsCompanyBranding,
        }
      : null,
    catalogueAvailability: row.industryPackage ? { available: row.industryPackage.status === "ACTIVE" } : null,
  };
}

export type PublicCommerceProductDTO = ReturnType<typeof toPublicCommerceProductDTO>;

export type CommerceProductListFilters = {
  type?: CommerceProductType;
  billingInterval?: CommerceBillingInterval;
  activeOnly?: boolean;
  publicOnly?: boolean;
};

export async function listCommerceProducts(filters: CommerceProductListFilters = {}) {
  const rows = await prisma.commerceProduct.findMany({
    where: {
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.activeOnly ? { isActive: true } : {}),
      ...(filters.publicOnly ? { isPublic: true } : {}),
      ...(filters.billingInterval ? { prices: { some: { billingInterval: filters.billingInterval, isActive: true } } } : {}),
    },
    include: productInclude,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: 200,
  });
  return rows;
}

async function getProductRecord(productId: string): Promise<CommerceProductRecord> {
  const row = await prisma.commerceProduct.findUnique({ where: { id: productId }, include: productInclude });
  if (!row) throw new NotFoundError("Commerce product not found.");
  return row;
}

export async function getCommerceProduct(productId: string) {
  return getProductRecord(productId);
}

export async function getCommerceProductByCode(code: string) {
  const row = await prisma.commerceProduct.findUnique({ where: { code }, include: productInclude });
  if (!row) throw new NotFoundError("Commerce product not found.");
  return row;
}

export type SetProductStateInput = {
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
};

/** Minimal, safe mutation surface — activate/deactivate, public/private, reorder.
 *  Never edits code/type/prices here (prices are append-only, see commerce-product-service.ts). */
export async function updateCommerceProductState(productId: string, input: SetProductStateInput) {
  await getProductRecord(productId);
  const updated = await prisma.commerceProduct.update({
    where: { id: productId },
    data: {
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
    include: productInclude,
  });
  return updated;
}

export type UpsertProductInput = {
  code: string;
  type: CommerceProductType;
  name: string;
  shortDescription?: string;
  description?: string;
  purchaseMode?: "DIRECT" | "QUOTATION_REQUIRED" | "CONTACT_SALES";
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
  industryPackageId?: string | null;
};

/** Idempotent upsert keyed on `code` — the seed script's only write path for products. */
export async function upsertCommerceProduct(input: UpsertProductInput): Promise<{ product: CommerceProduct; wasCreated: boolean }> {
  const existing = await prisma.commerceProduct.findUnique({ where: { code: input.code } });
  const data = {
    type: input.type,
    name: input.name,
    shortDescription: input.shortDescription ?? "",
    description: input.description ?? "",
    purchaseMode: input.purchaseMode ?? "DIRECT",
    isActive: input.isActive ?? true,
    isPublic: input.isPublic ?? true,
    sortOrder: input.sortOrder ?? 0,
    industryPackageId: input.industryPackageId ?? null,
  };
  if (existing) {
    const product = await prisma.commerceProduct.update({ where: { id: existing.id }, data });
    return { product, wasCreated: false };
  }
  const product = await prisma.commerceProduct.create({ data: { code: input.code, ...data } });
  return { product, wasCreated: true };
}

export type UpsertPriceInput = {
  productId: string;
  code: string;
  amountMinor: number;
  currency?: "AED";
  billingInterval: "ONE_TIME" | "MONTH" | "YEAR";
  isFromPrice?: boolean;
  isActive?: boolean;
};

/**
 * Idempotent upsert keyed on `code` — but if a price with this exact code
 * already exists with a DIFFERENT amountMinor, this creates a NEW price row
 * (append-only identity) instead of mutating the old one, per the
 * commercial requirement that a used price is never silently changed.
 * Re-running the seed with unchanged amounts is a true no-op.
 */
export async function upsertCommercePrice(input: UpsertPriceInput): Promise<{ price: CommercePrice; wasCreated: boolean; wasUnchanged: boolean }> {
  const existing = await prisma.commercePrice.findUnique({ where: { code: input.code } });
  if (existing) {
    if (existing.amountMinor === input.amountMinor && existing.billingInterval === input.billingInterval && existing.isFromPrice === (input.isFromPrice ?? false)) {
      return { price: existing, wasCreated: false, wasUnchanged: true };
    }
    // Amount/shape changed under the same code — archive the old identity rather than mutate it.
    await prisma.commercePrice.update({ where: { id: existing.id }, data: { isActive: false, validUntil: new Date() } });
  }
  const price = await prisma.commercePrice.create({
    data: {
      productId: input.productId,
      code: existing ? `${input.code}_v${Date.now()}` : input.code,
      amountMinor: input.amountMinor,
      currency: input.currency ?? "AED",
      billingInterval: input.billingInterval,
      isFromPrice: input.isFromPrice ?? false,
      isActive: input.isActive ?? true,
    },
  });
  return { price, wasCreated: true, wasUnchanged: false };
}

export type UpsertEntitlementTemplateInput = {
  productId: string;
  maxUsers?: number | null;
  maxWorkspaces?: number | null;
  maxActiveProjects?: number | null;
  maxBoqGenerationsPerMonth?: number | null;
  maxTechnicalReportsPerMonth?: number | null;
  maxWatermarkFreeExportsPerMonth?: number | null;
  permittedExportFormats?: string[];
  removesWatermark?: boolean;
  allowsCompanyBranding?: boolean;
  allowsApiAccess?: boolean;
  allowsWhiteLabel?: boolean;
  industryPackageKeys?: string[];
  aiCreditsGranted?: number | null;
  downloadLimit?: number | null;
  entitlementDurationDays?: number | null;
};

/** Idempotent upsert keyed on the 1:1 productId relation. */
export async function upsertEntitlementTemplate(input: UpsertEntitlementTemplateInput): Promise<{ template: EntitlementTemplate; wasCreated: boolean }> {
  const existing = await prisma.entitlementTemplate.findUnique({ where: { productId: input.productId } });
  const data = {
    maxUsers: input.maxUsers ?? null,
    maxWorkspaces: input.maxWorkspaces ?? null,
    maxActiveProjects: input.maxActiveProjects ?? null,
    maxBoqGenerationsPerMonth: input.maxBoqGenerationsPerMonth ?? null,
    maxTechnicalReportsPerMonth: input.maxTechnicalReportsPerMonth ?? null,
    maxWatermarkFreeExportsPerMonth: input.maxWatermarkFreeExportsPerMonth ?? null,
    permittedExportFormatsJson: (input.permittedExportFormats ?? []) as unknown as Prisma.InputJsonValue,
    removesWatermark: input.removesWatermark ?? false,
    allowsCompanyBranding: input.allowsCompanyBranding ?? false,
    allowsApiAccess: input.allowsApiAccess ?? false,
    allowsWhiteLabel: input.allowsWhiteLabel ?? false,
    industryPackageKeysJson: (input.industryPackageKeys ?? []) as unknown as Prisma.InputJsonValue,
    aiCreditsGranted: input.aiCreditsGranted ?? null,
    downloadLimit: input.downloadLimit ?? null,
    entitlementDurationDays: input.entitlementDurationDays ?? null,
  };
  if (existing) {
    const template = await prisma.entitlementTemplate.update({ where: { id: existing.id }, data });
    return { template, wasCreated: false };
  }
  const template = await prisma.entitlementTemplate.create({ data: { productId: input.productId, ...data } });
  return { template, wasCreated: true };
}

export async function getCommercePriceById(priceId: string): Promise<CommercePrice> {
  const row = await prisma.commercePrice.findUnique({ where: { id: priceId } });
  if (!row) throw new NotFoundError("Commerce price not found.");
  return row;
}

export type SetPriceReviewStatusInput = {
  reviewStatus: "DRAFT" | "REQUIRES_REVIEW" | "APPROVED" | "RETIRED";
  reviewedByUserId: string;
  reviewNote?: string | null;
};

/** The only mutation surface for a price's commercial review state — never touches amount/currency/interval. */
export async function setCommercePriceReviewStatus(priceId: string, input: SetPriceReviewStatusInput): Promise<CommercePrice> {
  await getCommercePriceById(priceId);
  return prisma.commercePrice.update({
    where: { id: priceId },
    data: {
      reviewStatus: input.reviewStatus,
      reviewedByUserId: input.reviewedByUserId,
      reviewedAt: new Date(),
      reviewNote: input.reviewNote ?? null,
    },
  });
}

/** Every product with its prices — the full catalogue slice the Stripe sync service reasons over. Accepts an optional transaction client so a caller holding a lock (e.g. live sync's STRIPE:LIVE serialization) reads through the same transaction. */
export async function listAllCommerceProductsWithPrices(
  client: { commerceProduct: typeof prisma.commerceProduct } = prisma,
): Promise<CommerceProductRecord[]> {
  return client.commerceProduct.findMany({
    include: productInclude,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}
