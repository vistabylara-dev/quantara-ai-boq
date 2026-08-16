import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { requirePlatformCapability } from "@/lib/auth/platform-authorization";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import type { PlatformRequestMetadata } from "@/lib/repositories/platform-admin-repository";
import type { AdminProductManagerCreateInput } from "@/lib/validation/admin-product-manager-schema";

const SOURCE = "ADMIN_PRODUCT_MANAGER";

type ManagedMetadata = {
  source: typeof SOURCE;
  version: number;
  publicationState: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  marketplace: { enabled: boolean };
  category: string;
  slug: string;
  seo: { metaTitle: string; metaDescription: string };
  merchant: {
    enabled: boolean;
    title: string;
    description: string;
    googleProductCategory: string;
    productType: string;
    brand: string;
    mpn: string;
    gtin: string;
    imageUrl: string;
    availability: "in_stock" | "out_of_stock" | "preorder";
    condition: "new" | "refurbished" | "used";
  };
  fulfillment:
    | { adapter: "NONE" }
    | {
        adapter: "SOFTWARE_PLAN";
        softwarePlanKey: string;
        planType: "PRO" | "BUSINESS" | "ENTERPRISE";
        maxUsers: number | null;
        maxProjects: number | null;
        maxActiveBoqs: number | null;
        maxDocumentsPerMonth: number | null;
      };
  checkout?: {
    state: "DISABLED" | "SYNCING" | "READY" | "ERROR";
    lastErrorCode?: string | null;
    activatedAt?: string | null;
  };
};

function requestMetadataJson(metadata: PlatformRequestMetadata) {
  return {
    method: metadata.method,
    path: metadata.path,
    ...(metadata.requestId ? { requestId: metadata.requestId } : {}),
  };
}

function readMetadata(value: unknown): ManagedMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.source !== SOURCE) return null;
  return candidate as unknown as ManagedMetadata;
}

function toDTO(row: {
  id: string;
  code: string;
  type: string;
  name: string;
  shortDescription: string;
  description: string;
  purchaseMode: string;
  isActive: boolean;
  isPublic: boolean;
  metadataJson: unknown;
  createdAt: Date;
  updatedAt: Date;
  prices: Array<{
    id: string;
    code: string;
    amountMinor: number;
    currency: string;
    billingInterval: string;
    isActive: boolean;
    reviewStatus: string;
  }>;
}) {
  const metadata = readMetadata(row.metadataJson);

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
    publicationState: metadata?.publicationState ?? "DRAFT",
    marketplaceEnabled: metadata?.marketplace.enabled ?? false,
    category: metadata?.category ?? "",
    slug: metadata?.slug ?? "",
    seo: metadata?.seo ?? { metaTitle: "", metaDescription: "" },
    merchant: metadata?.merchant ?? {
      enabled: false,
      title: "",
      description: "",
      googleProductCategory: "",
      productType: "",
      brand: "",
      mpn: "",
      gtin: "",
      imageUrl: "",
      availability: "in_stock",
      condition: "new",
    },
    fulfillment: metadata?.fulfillment ?? { adapter: "NONE" },
    fulfillmentAdapter: metadata?.fulfillment.adapter ?? "NONE",
    checkoutState: metadata?.checkout?.state ?? "DISABLED",
    prices: row.prices,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAdminProductManagerProducts(actor: PlatformActor) {
  requirePlatformCapability(actor, "platform:read");

  const rows = await prisma.commerceProduct.findMany({
    where: {
      metadataJson: { path: ["source"], equals: SOURCE },
    },
    include: {
      prices: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          code: true,
          amountMinor: true,
          currency: true,
          billingInterval: true,
          isActive: true,
          reviewStatus: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });

  return rows.map(toDTO);
}

export async function createAdminProductManagerDraft(
  actor: PlatformActor,
  input: AdminProductManagerCreateInput,
  requestMetadata: PlatformRequestMetadata,
) {
  requirePlatformCapability(actor, "platform:operate");

  const amountMinor = Math.round(input.priceAed * 100);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new ConflictError(
      "INVALID_PRODUCT_PRICE",
      "The product price could not be represented safely.",
    );
  }

  const duplicateCode = await prisma.commerceProduct.findUnique({
    where: { code: input.code },
    select: { id: true },
  });

  if (duplicateCode) {
    throw new ConflictError(
      "COMMERCE_PRODUCT_CODE_EXISTS",
      "A product with this code already exists. Product Manager never overwrites existing products.",
    );
  }

  const managedRows = await prisma.commerceProduct.findMany({
    where: {
      metadataJson: { path: ["source"], equals: SOURCE },
    },
    select: { metadataJson: true },
    take: 500,
  });

  if (managedRows.some((row) => readMetadata(row.metadataJson)?.slug === input.slug)) {
    throw new ConflictError(
      "COMMERCE_PRODUCT_SLUG_EXISTS",
      "A Product Manager product with this URL slug already exists.",
    );
  }

  const metadata: ManagedMetadata = {
    source: SOURCE,
    version: 1,
    publicationState: "DRAFT",
    marketplace: { enabled: input.marketplaceEnabled },
    category: input.category,
    slug: input.slug,
    seo: {
      metaTitle: input.metaTitle,
      metaDescription: input.metaDescription,
    },
    merchant: {
      enabled: input.merchantEnabled,
      title: input.merchantTitle,
      description: input.merchantDescription,
      googleProductCategory: input.googleProductCategory,
      productType: input.googleProductType,
      brand: input.brand,
      mpn: input.mpn,
      gtin: input.gtin,
      imageUrl: input.imageUrl,
      availability: input.availability,
      condition: input.condition,
    },
    fulfillment:
      input.fulfillmentMode === "SOFTWARE_SUBSCRIPTION"
        ? {
            adapter: "SOFTWARE_PLAN",
            softwarePlanKey: `commerce_pm_${input.code}`,
            planType: input.softwarePlanType,
            maxUsers: input.maxUsers,
            maxProjects: input.maxProjects,
            maxActiveBoqs: input.maxActiveBoqs,
            maxDocumentsPerMonth: input.maxDocumentsPerMonth,
          }
        : { adapter: "NONE" },
    checkout: {
      state: "DISABLED",
      lastErrorCode: null,
      activatedAt: null,
    },
  };

  const productId = await prisma.$transaction(async (tx) => {
    const product = await tx.commerceProduct.create({
      data: {
        code: input.code,
        type: input.billingInterval === "ONE_TIME" ? "ONE_TIME" : "SUBSCRIPTION",
        name: input.name,
        shortDescription: input.shortDescription,
        description: input.description,
        purchaseMode: input.purchaseMode,

        // Fail closed. Drafts cannot be picked up by public catalogue or Stripe sync.
        isActive: false,
        isPublic: false,
        sortOrder: 0,
        metadataJson: metadata as unknown as Prisma.InputJsonValue,
      },
    });

    const price = await tx.commercePrice.create({
      data: {
        productId: product.id,
        code: `${input.code}_${input.billingInterval.toLowerCase()}`,
        amountMinor,
        currency: "AED",
        billingInterval: input.billingInterval,
        isFromPrice: false,
        isActive: true,
        // Existing DB default remains REQUIRES_REVIEW.
      },
    });

    await tx.platformAuditLog.create({
      data: {
        actorUserId: actor.userId,
        actorPlatformRole: actor.platformRole,
        action: "commerce_product_manager.create_draft",
        targetType: "CommerceProduct",
        targetId: product.id,
        requestMetadataJson: requestMetadataJson(requestMetadata),
        afterJson: {
          code: product.code,
          name: product.name,
          priceCode: price.code,
          amountMinor: price.amountMinor,
          billingInterval: price.billingInterval,
          publicationState: "DRAFT",
          isActive: false,
          isPublic: false,
          source: SOURCE,
        },
      },
    });

    return product.id;
  });

  const row = await prisma.commerceProduct.findUnique({
    where: { id: productId },
    include: {
      prices: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          code: true,
          amountMinor: true,
          currency: true,
          billingInterval: true,
          isActive: true,
          reviewStatus: true,
        },
      },
    },
  });

  if (!row) throw new NotFoundError("Product Manager product could not be reloaded.");

  return toDTO(row);
}

async function getManagedProductOrThrow(productId: string) {
  const row = await prisma.commerceProduct.findUnique({
    where: { id: productId },
    include: {
      prices: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          code: true,
          amountMinor: true,
          currency: true,
          billingInterval: true,
          isActive: true,
          reviewStatus: true,
        },
      },
    },
  });

  if (!row) throw new NotFoundError("Product Manager product not found.");

  const metadata = readMetadata(row.metadataJson);
  if (!metadata) {
    throw new ConflictError(
      "PRODUCT_MANAGER_OWNERSHIP_REQUIRED",
      "This product is not managed by Product Manager and cannot be changed here.",
    );
  }

  return { row, metadata };
}

export async function publishAdminProductManagerProduct(
  actor: PlatformActor,
  productId: string,
  requestMetadata: PlatformRequestMetadata,
) {
  requirePlatformCapability(actor, "platform:operate");

  const { row, metadata } = await getManagedProductOrThrow(productId);

  if (!metadata.marketplace.enabled) {
    throw new ConflictError(
      "MARKETPLACE_CHANNEL_DISABLED",
      "Enable the Marketplace sales channel before publishing this product.",
    );
  }

  if (metadata.publicationState === "PUBLISHED") {
    return toDTO(row);
  }

  const nextMetadata: ManagedMetadata = {
    ...metadata,
    publicationState: "PUBLISHED",
    checkout: {
      state: "DISABLED",
      lastErrorCode: null,
      activatedAt: null,
    },
  };

  await prisma.$transaction(async (tx) => {
    await tx.commerceProduct.update({
      where: { id: row.id },
      data: {
        // Marketplace publication is deliberately NOT Stripe readiness.
        // Existing public-commerce and live-sync flows remain unable to
        // pick this product up until a later guarded checkout phase.
        isActive: false,
        isPublic: false,
        metadataJson: nextMetadata as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.platformAuditLog.create({
      data: {
        actorUserId: actor.userId,
        actorPlatformRole: actor.platformRole,
        action: "commerce_product_manager.publish_marketplace",
        targetType: "CommerceProduct",
        targetId: row.id,
        requestMetadataJson: requestMetadataJson(requestMetadata),
        beforeJson: {
          publicationState: metadata.publicationState,
          isActive: row.isActive,
          isPublic: row.isPublic,
        },
        afterJson: {
          publicationState: "PUBLISHED",
          isActive: false,
          isPublic: false,
          stripeChanged: false,
        },
      },
    });
  });

  const updated = await getManagedProductOrThrow(productId);
  return toDTO(updated.row);
}

export async function unpublishAdminProductManagerProduct(
  actor: PlatformActor,
  productId: string,
  requestMetadata: PlatformRequestMetadata,
) {
  requirePlatformCapability(actor, "platform:operate");

  const { row, metadata } = await getManagedProductOrThrow(productId);

  const nextMetadata: ManagedMetadata = {
    ...metadata,
    publicationState: "DRAFT",
    checkout: {
      state: "DISABLED",
      lastErrorCode: null,
      activatedAt: null,
    },
  };

  await prisma.$transaction(async (tx) => {
    await tx.commerceProduct.update({
      where: { id: row.id },
      data: {
        isActive: false,
        isPublic: false,
        metadataJson: nextMetadata as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.platformAuditLog.create({
      data: {
        actorUserId: actor.userId,
        actorPlatformRole: actor.platformRole,
        action: "commerce_product_manager.unpublish_marketplace",
        targetType: "CommerceProduct",
        targetId: row.id,
        requestMetadataJson: requestMetadataJson(requestMetadata),
        beforeJson: {
          publicationState: metadata.publicationState,
          isActive: row.isActive,
          isPublic: row.isPublic,
        },
        afterJson: {
          publicationState: "DRAFT",
          isActive: false,
          isPublic: false,
          stripeChanged: false,
        },
      },
    });
  });

  return toDTO((await getManagedProductOrThrow(productId)).row);
}
