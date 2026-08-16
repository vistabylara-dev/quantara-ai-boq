import { prisma } from "@/lib/db/prisma";

const SOURCE = "ADMIN_PRODUCT_MANAGER";

type ManagedMetadata = {
  source: typeof SOURCE;
  publicationState: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  marketplace: { enabled: boolean };
  category: string;
  slug: string;
  seo: { metaTitle: string; metaDescription: string };
  checkout?: {
    state: "DISABLED" | "SYNCING" | "READY" | "ERROR";
    lastErrorCode?: string | null;
    activatedAt?: string | null;
  };
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
};

function readMetadata(value: unknown): ManagedMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.source !== SOURCE) return null;
  return candidate as unknown as ManagedMetadata;
}

function toPublicDTO(row: {
  code: string;
  type: string;
  name: string;
  shortDescription: string;
  description: string;
  purchaseMode: string;
  metadataJson: unknown;
  updatedAt: Date;
  prices: Array<{
    code: string;
    amountMinor: number;
    currency: string;
    billingInterval: string;
    isFromPrice: boolean;
    isActive: boolean;
    reviewStatus: string;
  }>;
}) {
  const metadata = readMetadata(row.metadataJson);
  if (!metadata) return null;
  if (metadata.publicationState !== "PUBLISHED") return null;
  if (!metadata.marketplace.enabled) return null;

  return {
    code: row.code,
    type: row.type,
    name: row.name,
    shortDescription: row.shortDescription,
    description: row.description,
    purchaseMode: row.purchaseMode,
    category: metadata.category,
    slug: metadata.slug,
    seo: metadata.seo,
    merchant: metadata.merchant,
    checkoutState: metadata.checkout?.state ?? "DISABLED",
    prices: row.prices
      .filter((price) => price.isActive)
      .map((price) => ({
        code: price.code,
        amountMinor: price.amountMinor,
        currency: price.currency,
        billingInterval: price.billingInterval,
        isFromPrice: price.isFromPrice,
        reviewStatus: price.reviewStatus,
      })),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const publishedWhere = {
  // Dedicated Product Manager publication is metadata-gated. Commerce
  // isActive/isPublic remain false until checkout readiness is proven.
  metadataJson: {
    path: ["source"],
    equals: SOURCE,
  },
} as const;

const publicInclude = {
  prices: {
    orderBy: { createdAt: "asc" as const },
    select: {
      code: true,
      amountMinor: true,
      currency: true,
      billingInterval: true,
      isFromPrice: true,
      isActive: true,
      reviewStatus: true,
    },
  },
};

export async function listPublishedManagedProducts() {
  const rows = await prisma.commerceProduct.findMany({
    where: publishedWhere,
    include: publicInclude,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: 200,
  });

  return rows
    .map(toPublicDTO)
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

export async function getPublishedManagedProductBySlug(slug: string) {
  const rows = await prisma.commerceProduct.findMany({
    where: publishedWhere,
    include: publicInclude,
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });

  for (const row of rows) {
    const dto = toPublicDTO(row);
    if (dto?.slug === slug) return dto;
  }

  return null;
}
