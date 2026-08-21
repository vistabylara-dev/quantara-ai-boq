import type {
  CommerceProvider,
  CommerceProviderEnvironment,
  CommerceProviderMapping,
  CommerceProviderObjectType,
  CommerceProviderSyncStatus,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * STRIPE-1C — records which internal CommerceProduct/CommercePrice has been
 * synchronized to which provider object. True duplicate-prevention is
 * enforced by partial unique indexes at the database level (see the
 * migration) — this repository's find-then-create/update pattern is the
 * application-level mirror of that guarantee, not a substitute for it.
 */

export function toProviderMappingDTO(row: CommerceProviderMapping) {
  return {
    id: row.id,
    provider: row.provider,
    environment: row.environment,
    commerceProductId: row.commerceProductId,
    commercePriceId: row.commercePriceId,
    providerProductId: row.providerProductId,
    providerPriceId: row.providerPriceId,
    providerObjectType: row.providerObjectType,
    providerActive: row.providerActive,
    synchronizationStatus: row.synchronizationStatus,
    lastSynchronizedAt: row.lastSynchronizedAt?.toISOString() ?? null,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
    lastErrorCode: row.lastErrorCode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type CommerceProviderMappingDTO = ReturnType<typeof toProviderMappingDTO>;

type CommerceProviderMappingClient = { commerceProviderMapping: typeof prisma.commerceProviderMapping };

export async function findProductMapping(
  provider: CommerceProvider,
  environment: CommerceProviderEnvironment,
  commerceProductId: string,
  client: CommerceProviderMappingClient = prisma,
): Promise<CommerceProviderMapping | null> {
  return client.commerceProviderMapping.findFirst({
    where: { provider, environment, commerceProductId, providerObjectType: "PRODUCT" },
  });
}

export async function findPriceMapping(
  provider: CommerceProvider,
  environment: CommerceProviderEnvironment,
  commercePriceId: string,
  client: CommerceProviderMappingClient = prisma,
): Promise<CommerceProviderMapping | null> {
  return client.commerceProviderMapping.findFirst({
    where: { provider, environment, commercePriceId, providerObjectType: "PRICE" },
  });
}

/** Reverse lookup for webhook processing — resolves an inbound Stripe price ID back to the internal mapping (and via it, the CommercePrice/CommerceProduct). Accepts an optional transaction client so it can run inside the same transaction as the state mutation it feeds. */
export async function findMappingByProviderPriceId(
  provider: CommerceProvider,
  environment: CommerceProviderEnvironment,
  providerPriceId: string,
  client: { commerceProviderMapping: typeof prisma.commerceProviderMapping } = prisma,
): Promise<CommerceProviderMapping | null> {
  return client.commerceProviderMapping.findFirst({
    where: { provider, environment, providerPriceId, providerObjectType: "PRICE" },
  });
}

export async function listMappingsForEnvironment(
  provider: CommerceProvider,
  environment: CommerceProviderEnvironment,
  client: CommerceProviderMappingClient = prisma,
): Promise<CommerceProviderMapping[]> {
  return client.commerceProviderMapping.findMany({
    where: { provider, environment },
    orderBy: { createdAt: "asc" },
  });
}

export type CreateMappingInput = {
  provider: CommerceProvider;
  environment: CommerceProviderEnvironment;
  commerceProductId: string;
  commercePriceId?: string | null;
  providerProductId: string;
  providerPriceId?: string | null;
  providerObjectType: CommerceProviderObjectType;
  providerActive?: boolean;
};

export class CommerceProviderMappingConflictError extends Error {
  readonly code = "COMMERCE_PROVIDER_MAPPING_CONFLICT" as const;
  readonly provider: CommerceProvider;
  readonly environment: CommerceProviderEnvironment;
  readonly mappingType: CommerceProviderObjectType;
  readonly conflictingProviderObjectType: CommerceProviderObjectType;
  readonly safeConflictCode:
    | "PROVIDER_PRODUCT_ALREADY_MAPPED_TO_DIFFERENT_INTERNAL_PRODUCT"
    | "PROVIDER_PRICE_ALREADY_MAPPED_TO_DIFFERENT_INTERNAL_PRICE";

  constructor(input: {
    provider: CommerceProvider;
    environment: CommerceProviderEnvironment;
    mappingType: CommerceProviderObjectType;
    conflictingProviderObjectType: CommerceProviderObjectType;
    safeConflictCode:
      | "PROVIDER_PRODUCT_ALREADY_MAPPED_TO_DIFFERENT_INTERNAL_PRODUCT"
      | "PROVIDER_PRICE_ALREADY_MAPPED_TO_DIFFERENT_INTERNAL_PRICE";
  }) {
    super("Provider object is already mapped to a different internal record.");
    this.name = "CommerceProviderMappingConflictError";
    this.provider = input.provider;
    this.environment = input.environment;
    this.mappingType = input.mappingType;
    this.conflictingProviderObjectType = input.conflictingProviderObjectType;
    this.safeConflictCode = input.safeConflictCode;
  }
}

function isKnownUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isConsistentMapping(existing: CommerceProviderMapping, input: CreateMappingInput): boolean {
  if (existing.provider !== input.provider || existing.environment !== input.environment) return false;
  if (existing.providerObjectType !== input.providerObjectType) return false;

  if (input.providerObjectType === "PRODUCT") {
    return existing.commerceProductId === input.commerceProductId;
  }

  const expectedPriceId = input.commercePriceId ?? null;
  const existingPriceId = existing.commercePriceId ?? null;
  return existingPriceId === expectedPriceId;
}

function buildConflictForExisting(existing: CommerceProviderMapping, input: CreateMappingInput): CommerceProviderMappingConflictError {
  if (input.providerObjectType === "PRICE") {
    return new CommerceProviderMappingConflictError({
      provider: input.provider,
      environment: input.environment,
      mappingType: input.providerObjectType,
      conflictingProviderObjectType: existing.providerObjectType,
      safeConflictCode: "PROVIDER_PRICE_ALREADY_MAPPED_TO_DIFFERENT_INTERNAL_PRICE",
    });
  }

  return new CommerceProviderMappingConflictError({
    provider: input.provider,
    environment: input.environment,
    mappingType: input.providerObjectType,
    conflictingProviderObjectType: existing.providerObjectType,
    safeConflictCode: "PROVIDER_PRODUCT_ALREADY_MAPPED_TO_DIFFERENT_INTERNAL_PRODUCT",
  });
}

export async function createMapping(input: CreateMappingInput, client: CommerceProviderMappingClient = prisma): Promise<CommerceProviderMapping> {
  const data = {
    provider: input.provider,
    environment: input.environment,
    commerceProductId: input.commerceProductId,
    commercePriceId: input.commercePriceId ?? null,
    providerProductId: input.providerProductId,
    providerPriceId: input.providerPriceId ?? null,
    providerObjectType: input.providerObjectType,
    providerActive: input.providerActive ?? true,
    synchronizationStatus: "SYNCED" as const,
    lastSynchronizedAt: new Date(),
  };

  const existingByInternal =
    input.providerObjectType === "PRODUCT"
      ? await client.commerceProviderMapping.findFirst({
          where: {
            provider: input.provider,
            environment: input.environment,
            providerObjectType: "PRODUCT",
            commerceProductId: input.commerceProductId,
          },
        })
      : await client.commerceProviderMapping.findFirst({
          where: {
            provider: input.provider,
            environment: input.environment,
            providerObjectType: "PRICE",
            commercePriceId: input.commercePriceId ?? null,
          },
        });

  if (existingByInternal) {
    if (isConsistentMapping(existingByInternal, input)) return existingByInternal;
    throw buildConflictForExisting(existingByInternal, input);
  }

  try {
    return await client.commerceProviderMapping.create({ data });
  } catch (error) {
    if (!isKnownUniqueViolation(error)) throw error;

    const collisions: CommerceProviderMapping[] = [];
    const byProviderProductId = await client.commerceProviderMapping.findFirst({
      where: {
        provider: input.provider,
        environment: input.environment,
        providerProductId: input.providerProductId,
      },
    });
    if (byProviderProductId) collisions.push(byProviderProductId);

    if (input.providerObjectType === "PRICE" && input.providerPriceId) {
      const byProviderPriceId = await client.commerceProviderMapping.findFirst({
        where: {
          provider: input.provider,
          environment: input.environment,
          providerPriceId: input.providerPriceId,
        },
      });
      if (byProviderPriceId && !collisions.some((row) => row.id === byProviderPriceId.id)) {
        collisions.push(byProviderPriceId);
      }
    }

    const consistent = collisions.find((existing) => isConsistentMapping(existing, input));
    if (consistent) return consistent;

    if (collisions.length > 0) {
      throw buildConflictForExisting(collisions[0], input);
    }

    throw error;
  }
}

export type UpdateMappingStateInput = {
  providerActive?: boolean;
  synchronizationStatus?: CommerceProviderSyncStatus;
  lastSynchronizedAt?: Date;
  lastVerifiedAt?: Date;
  lastErrorCode?: string | null;
};

export async function updateMappingState(
  mappingId: string,
  input: UpdateMappingStateInput,
  client: CommerceProviderMappingClient = prisma,
): Promise<CommerceProviderMapping> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await client.commerceProviderMapping.update({
        where: { id: mappingId },
        data: input,
      });
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }

  throw new Error("UNREACHABLE_UPDATE_MAPPING_STATE_RETRY_EXHAUSTED");
}
