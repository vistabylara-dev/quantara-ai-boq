import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { AppError, NotFoundError, PermissionDeniedError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/db/prisma";
import { getProviderById } from "@/lib/integrations/provider-registry";
import { toExternalConnectionDTO } from "@/lib/repositories/integration-repository";
import { recordIntegrationEvent, listEventsForConnection } from "./integration-event-service";

/**
 * INTEGRATIONS-1A completion pass — the real connection lifecycle. No live
 * OAuth exists yet (Autodesk and every other cloud provider is still
 * COMING_SOON — see provider-registry.ts), so the only way to create an
 * ExternalConnection in this phase is the platform owner's explicit test
 * tool below, which is clearly marked as a test fixture (grantedScopesJson:
 * {test:true}), never presented to a normal company user as a real
 * connection, and fully audited. Disconnect, listing, and detail are real,
 * generic actions that work identically for these test rows today and for
 * genuine OAuth connections in 1B+ — nothing here is provider-specific.
 */

function assertCompanyOwnsConnection(connection: { companyId: string } | null, companyId: string): asserts connection is NonNullable<typeof connection> {
  // 404, never 403 — cross-tenant IDs must not disclose that a connection exists for another company.
  if (!connection || connection.companyId !== companyId) throw new NotFoundError("Connection not found.");
}

export async function createTestConnection(owner: PlatformActor, input: { providerId: string; providerAccountId?: string }) {
  if (owner.platformRole !== "PLATFORM_OWNER") {
    throw new PermissionDeniedError("Creating a test connection is restricted to the platform owner.");
  }
  const provider = getProviderById(input.providerId);
  if (!provider) throw new NotFoundError("Integration provider not found.");

  const connection = await prisma.externalConnection.create({
    data: {
      companyId: owner.companyId,
      connectedByUserId: owner.userId,
      providerId: input.providerId,
      providerAccountId: input.providerAccountId ?? `test-account-${Date.now()}`,
      status: "CONNECTED",
      grantedScopesJson: { test: true, note: "Created by platform owner test tool — not a real provider grant." },
    },
  });

  await recordIntegrationEvent({
    companyId: owner.companyId,
    providerId: input.providerId,
    externalConnectionId: connection.id,
    eventType: "CONNECTION_CREATED",
    status: "success",
    summary: `Connected to ${provider.displayName} (test connection, created by platform owner)`,
    actorUserId: owner.userId,
  });

  return toExternalConnectionDTO(connection);
}

export async function listConnectionsForActor(actor: Pick<CurrentActor, "companyId">) {
  const rows = await prisma.externalConnection.findMany({
    where: { companyId: actor.companyId },
    orderBy: { connectedAt: "desc" },
  });
  return rows.map(toExternalConnectionDTO);
}

export async function getConnectionDetailForActor(actor: Pick<CurrentActor, "companyId">, connectionId: string) {
  const row = await prisma.externalConnection.findUnique({
    where: { id: connectionId },
    include: { projectIntegrations: { include: { project: { select: { id: true, name: true, reference: true } } } } },
  });
  assertCompanyOwnsConnection(row, actor.companyId);

  const provider = getProviderById(row.providerId);
  const events = await listEventsForConnection(actor.companyId, connectionId);

  return {
    ...toExternalConnectionDTO(row),
    provider: provider ? { id: provider.id, displayName: provider.displayName, familyDisplayName: provider.familyDisplayName, connectionType: provider.connectionType } : null,
    linkedProjects: row.projectIntegrations.map((pi) => ({
      projectIntegrationId: pi.id,
      projectId: pi.project.id,
      projectName: pi.project.name,
      projectReference: pi.project.reference,
      syncState: pi.syncState,
    })),
    isTestConnection: Boolean((row.grantedScopesJson as { test?: boolean } | null)?.test),
    recentEvents: events,
  };
}

export async function disconnectConnection(actor: CurrentActor, connectionId: string) {
  requireCapability(actor, "integrations:disconnect");

  const row = await prisma.externalConnection.findUnique({ where: { id: connectionId } });
  assertCompanyOwnsConnection(row, actor.companyId);
  if (row.status === "DISCONNECTED") {
    throw new AppError("ALREADY_DISCONNECTED", "This connection is already disconnected.", 409);
  }

  const updated = await prisma.externalConnection.update({
    where: { id: connectionId },
    data: { status: "DISCONNECTED", disconnectedAt: new Date() },
  });

  const provider = getProviderById(row.providerId);
  await recordIntegrationEvent({
    companyId: actor.companyId,
    providerId: row.providerId,
    externalConnectionId: connectionId,
    eventType: "CONNECTION_DISCONNECTED",
    status: "info",
    summary: `Disconnected from ${provider?.displayName ?? row.providerId}`,
    actorUserId: actor.userId,
  });

  return toExternalConnectionDTO(updated);
}
