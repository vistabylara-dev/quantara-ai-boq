import type { ExternalConnection, ProjectIntegration } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";
import {
  encryptOAuthCredentials,
  decryptOAuthCredentials,
  type StoredOAuthCredentials,
} from "@/lib/integrations/credential-encryption";

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

/**
 * Creates a new CONNECTED ExternalConnection row, or re-activates/replaces an
 * existing one for the same (companyId, providerId) if the company already
 * had a prior (possibly disconnected/expired) connection to this provider —
 * one live connection per company per provider, matching how the marketplace
 * UI reads connection status (getConnectionForProvider already assumes this).
 * Credentials are encrypted before ever touching the database.
 */
export async function upsertConnectedExternalConnection(input: {
  companyId: string;
  connectedByUserId: string;
  providerId: string;
  credentials: StoredOAuthCredentials;
  providerAccountId: string | null;
  grantedScopesJson: unknown;
}): Promise<ReturnType<typeof toExternalConnectionDTO>> {
  const encryptedCredentialsRef = encryptOAuthCredentials(input.credentials);
  const existing = await prisma.externalConnection.findFirst({
    where: { companyId: input.companyId, providerId: input.providerId },
    orderBy: { connectedAt: "desc" },
  });

  const data = {
    encryptedCredentialsRef,
    providerAccountId: input.providerAccountId,
    grantedScopesJson: input.grantedScopesJson as never,
    status: "CONNECTED" as const,
    connectedAt: new Date(),
    tokenExpiresAt: input.credentials.expiresAt ? new Date(input.credentials.expiresAt) : null,
    disconnectedAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
  };

  const row = existing
    ? await prisma.externalConnection.update({ where: { id: existing.id }, data })
    : await prisma.externalConnection.create({
        data: {
          companyId: input.companyId,
          connectedByUserId: input.connectedByUserId,
          providerId: input.providerId,
          ...data,
        },
      });

  return toExternalConnectionDTO(row);
}

/** Internal use only (token refresh / calling the provider's API) — never expose this to a DTO or API response. */
export async function getDecryptedCredentialsForConnection(
  companyId: string,
  externalConnectionId: string,
): Promise<StoredOAuthCredentials> {
  const row = await prisma.externalConnection.findFirst({ where: { id: externalConnectionId, companyId } });
  if (!row || !row.encryptedCredentialsRef) throw new NotFoundError("Connection not found.");
  return decryptOAuthCredentials(row.encryptedCredentialsRef);
}

/** Refreshes stored credentials in place after a token refresh call — same encryption path as the initial connect. */
export async function updateStoredCredentials(
  companyId: string,
  externalConnectionId: string,
  credentials: StoredOAuthCredentials,
): Promise<void> {
  const row = await prisma.externalConnection.findFirst({ where: { id: externalConnectionId, companyId } });
  if (!row) throw new NotFoundError("Connection not found.");
  await prisma.externalConnection.update({
    where: { id: row.id },
    data: {
      encryptedCredentialsRef: encryptOAuthCredentials(credentials),
      tokenExpiresAt: credentials.expiresAt ? new Date(credentials.expiresAt) : null,
      status: "CONNECTED",
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });
}

export async function markConnectionDisconnected(companyId: string, externalConnectionId: string): Promise<void> {
  const row = await prisma.externalConnection.findFirst({ where: { id: externalConnectionId, companyId } });
  if (!row) throw new NotFoundError("Connection not found.");
  await prisma.externalConnection.update({
    where: { id: row.id },
    data: { status: "DISCONNECTED", disconnectedAt: new Date(), encryptedCredentialsRef: null },
  });
}

export async function recordConnectionError(externalConnectionId: string, code: string, message: string): Promise<void> {
  await prisma.externalConnection.update({
    where: { id: externalConnectionId },
    data: { status: "ERROR", lastErrorCode: code, lastErrorMessage: message },
  });
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
