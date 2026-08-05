import type {
  CommerceProvider,
  CommerceProviderEnvironment,
  CommerceProviderMapping,
  CommerceProviderObjectType,
  CommerceProviderSyncStatus,
} from "@prisma/client";
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

export async function findProductMapping(
  provider: CommerceProvider,
  environment: CommerceProviderEnvironment,
  commerceProductId: string,
): Promise<CommerceProviderMapping | null> {
  return prisma.commerceProviderMapping.findFirst({
    where: { provider, environment, commerceProductId, providerObjectType: "PRODUCT" },
  });
}

export async function findPriceMapping(
  provider: CommerceProvider,
  environment: CommerceProviderEnvironment,
  commercePriceId: string,
): Promise<CommerceProviderMapping | null> {
  return prisma.commerceProviderMapping.findFirst({
    where: { provider, environment, commercePriceId, providerObjectType: "PRICE" },
  });
}

export async function listMappingsForEnvironment(
  provider: CommerceProvider,
  environment: CommerceProviderEnvironment,
): Promise<CommerceProviderMapping[]> {
  return prisma.commerceProviderMapping.findMany({
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

export async function createMapping(input: CreateMappingInput): Promise<CommerceProviderMapping> {
  return prisma.commerceProviderMapping.create({
    data: {
      provider: input.provider,
      environment: input.environment,
      commerceProductId: input.commerceProductId,
      commercePriceId: input.commercePriceId ?? null,
      providerProductId: input.providerProductId,
      providerPriceId: input.providerPriceId ?? null,
      providerObjectType: input.providerObjectType,
      providerActive: input.providerActive ?? true,
      synchronizationStatus: "SYNCED",
      lastSynchronizedAt: new Date(),
    },
  });
}

export type UpdateMappingStateInput = {
  providerActive?: boolean;
  synchronizationStatus?: CommerceProviderSyncStatus;
  lastSynchronizedAt?: Date;
  lastVerifiedAt?: Date;
  lastErrorCode?: string | null;
};

export async function updateMappingState(mappingId: string, input: UpdateMappingStateInput): Promise<CommerceProviderMapping> {
  return prisma.commerceProviderMapping.update({
    where: { id: mappingId },
    data: input,
  });
}
