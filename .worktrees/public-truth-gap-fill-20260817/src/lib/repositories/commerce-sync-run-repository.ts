import type {
  CommerceProvider,
  CommerceProviderEnvironment,
  CommerceSyncOperation,
  CommerceSyncRun,
  CommerceSyncRunStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export function toSyncRunDTO(row: CommerceSyncRun) {
  return {
    id: row.id,
    provider: row.provider,
    environment: row.environment,
    operation: row.operation,
    status: row.status,
    initiatedByUserId: row.initiatedByUserId,
    dryRun: row.dryRun,
    catalogueFingerprint: row.catalogueFingerprint,
    productsCreated: row.productsCreated,
    productsUpdated: row.productsUpdated,
    productsUnchanged: row.productsUnchanged,
    productsArchived: row.productsArchived,
    pricesCreated: row.pricesCreated,
    pricesUnchanged: row.pricesUnchanged,
    pricesArchived: row.pricesArchived,
    blockedCount: row.blockedCount,
    warningCount: row.warningCount,
    safeErrorCode: row.safeErrorCode,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export type CommerceSyncRunDTO = ReturnType<typeof toSyncRunDTO>;

export type CreateSyncRunInput = {
  provider: CommerceProvider;
  environment: CommerceProviderEnvironment;
  operation: CommerceSyncOperation;
  initiatedByUserId: string;
  dryRun: boolean;
  catalogueFingerprint: string;
};

export async function createSyncRun(
  input: CreateSyncRunInput,
  client: { commerceSyncRun: typeof prisma.commerceSyncRun } = prisma,
): Promise<CommerceSyncRun> {
  return client.commerceSyncRun.create({
    data: {
      provider: input.provider,
      environment: input.environment,
      operation: input.operation,
      status: "RUNNING",
      initiatedByUserId: input.initiatedByUserId,
      dryRun: input.dryRun,
      catalogueFingerprint: input.catalogueFingerprint,
    },
  });
}

export type CompleteSyncRunInput = {
  status: CommerceSyncRunStatus;
  productsCreated: number;
  productsUpdated: number;
  productsUnchanged: number;
  productsArchived: number;
  pricesCreated: number;
  pricesUnchanged: number;
  pricesArchived: number;
  blockedCount: number;
  warningCount: number;
  safeErrorCode?: string | null;
};

export async function completeSyncRun(
  syncRunId: string,
  input: CompleteSyncRunInput,
  client: { commerceSyncRun: typeof prisma.commerceSyncRun } = prisma,
): Promise<CommerceSyncRun> {
  return client.commerceSyncRun.update({
    where: { id: syncRunId },
    data: { ...input, completedAt: new Date() },
  });
}

export async function listSyncRuns(
  provider: CommerceProvider,
  environment: CommerceProviderEnvironment,
  limit = 50,
): Promise<CommerceSyncRun[]> {
  return prisma.commerceSyncRun.findMany({
    where: { provider, environment },
    orderBy: { startedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
  });
}

export async function getMostRecentCompletedRun(
  provider: CommerceProvider,
  environment: CommerceProviderEnvironment,
  status: CommerceSyncRunStatus,
): Promise<CommerceSyncRun | null> {
  return prisma.commerceSyncRun.findFirst({
    where: { provider, environment, status },
    orderBy: { startedAt: "desc" },
  });
}
