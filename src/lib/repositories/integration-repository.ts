import type { ExternalConnection, ProjectIntegration } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * INTEGRATIONS-1A — thin repository over the four new tables. Every read
 * used by the marketplace/API layer is wrapped defensively by the caller
 * (integration-service.ts) since these tables are brand new and the
 * production migration may not have run yet when this code deploys.
 */

export function toExternalConnectionDTO(row: ExternalConnection) {
  return {
    id: row.id,
    companyId: row.companyId,
    connectedByUserId: row.connectedByUserId,
    providerId: row.providerId,
    providerAccountId: row.providerAccountId,
    status: row.status,
    connectedAt: row.connectedAt.toISOString(),
    tokenExpiresAt: row.tokenExpiresAt?.toISOString() ?? null,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    disconnectedAt: row.disconnectedAt?.toISOString() ?? null,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    grantedScopesJson: row.grantedScopesJson,
  };
}

export async function listConnectionsForCompany(companyId: string) {
  const rows = await prisma.externalConnection.findMany({
    where: { companyId },
    orderBy: { connectedAt: "desc" },
  });
  return rows.map(toExternalConnectionDTO);
}

export async function getConnectionForProvider(companyId: string, providerId: string) {
  const row = await prisma.externalConnection.findFirst({
    where: { companyId, providerId, status: { not: "DISCONNECTED" } },
    orderBy: { connectedAt: "desc" },
  });
  return row ? toExternalConnectionDTO(row) : null;
}

function toProjectIntegrationDTO(row: ProjectIntegration) {
  return {
    id: row.id,
    projectId: row.projectId,
    externalConnectionId: row.externalConnectionId,
    externalAccountId: row.externalAccountId,
    externalProjectId: row.externalProjectId,
    externalFolderId: row.externalFolderId,
    externalFileId: row.externalFileId,
    externalModelId: row.externalModelId,
    externalVersionId: row.externalVersionId,
    syncState: row.syncState,
    lastSyncedVersionId: row.lastSyncedVersionId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listProjectIntegrations(companyId: string, projectId: string) {
  const rows = await prisma.projectIntegration.findMany({
    where: { projectId, externalConnection: { companyId } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toProjectIntegrationDTO);
}

/** Idempotent on id — seeds/refreshes the IntegrationProvider table from the code-side registry. */
export async function upsertIntegrationProvider(input: {
  id: string;
  providerFamily: string;
  displayName: string;
  category: string;
  connectionType: "OAUTH_CLOUD" | "PLUGIN_DESKTOP" | "API_KEY" | "SERVICE_ACCOUNT" | "FILE_IMPORT" | "WEBHOOK" | "COMING_SOON";
  status: "AVAILABLE" | "BETA" | "REQUIRES_PLUGIN" | "FILE_IMPORT_ONLY" | "COMING_SOON";
  sortOrder?: number;
}) {
  return prisma.integrationProvider.upsert({
    where: { id: input.id },
    update: {
      providerFamily: input.providerFamily,
      displayName: input.displayName,
      category: input.category,
      connectionType: input.connectionType,
      status: input.status,
      sortOrder: input.sortOrder ?? 0,
    },
    create: {
      id: input.id,
      providerFamily: input.providerFamily,
      displayName: input.displayName,
      category: input.category,
      connectionType: input.connectionType,
      status: input.status,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}
