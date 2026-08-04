import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/db/prisma";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { getProviderById } from "@/lib/integrations/provider-registry";
import { recordIntegrationEvent } from "./integration-event-service";

/**
 * INTEGRATIONS-1A completion pass — real link/unlink actions for a
 * project. No provider browse API exists yet (that needs a live connector,
 * 1B+), so the external ids are entered directly rather than picked from a
 * folder browser; the resulting ProjectIntegration row and audit trail are
 * genuine, not placeholders.
 */

export type LinkProjectSourceInput = {
  externalConnectionId: string;
  externalAccountId?: string;
  externalProjectId?: string;
  externalFolderId?: string;
  externalFileId?: string;
  externalModelId?: string;
  externalVersionId?: string;
};

export async function linkProjectSource(actor: CurrentActor, projectId: string, input: LinkProjectSourceInput) {
  requireCapability(actor, "integrations:connect");
  const project = await getProjectRecord(actor.companyId, projectId);

  const connection = await prisma.externalConnection.findUnique({ where: { id: input.externalConnectionId } });
  if (!connection || connection.companyId !== actor.companyId) throw new NotFoundError("Connection not found.");
  if (connection.status === "DISCONNECTED") {
    throw new AppError("CONNECTION_DISCONNECTED", "This connection is disconnected — reconnect before linking a project source.", 409);
  }

  const link = await prisma.projectIntegration.create({
    data: {
      projectId: project.id,
      externalConnectionId: connection.id,
      externalAccountId: input.externalAccountId,
      externalProjectId: input.externalProjectId,
      externalFolderId: input.externalFolderId,
      externalFileId: input.externalFileId,
      externalModelId: input.externalModelId,
      externalVersionId: input.externalVersionId,
    },
  });

  const provider = getProviderById(connection.providerId);
  await recordIntegrationEvent({
    companyId: actor.companyId,
    providerId: connection.providerId,
    externalConnectionId: connection.id,
    projectIntegrationId: link.id,
    eventType: "PROJECT_LINKED",
    status: "success",
    summary: `Linked ${provider?.displayName ?? connection.providerId} source to project ${project.reference}`,
    actorUserId: actor.userId,
  });

  return link;
}

export async function unlinkProjectSource(actor: CurrentActor, projectIdentifier: string, projectIntegrationId: string) {
  requireCapability(actor, "integrations:disconnect");
  const project = await getProjectRecord(actor.companyId, projectIdentifier);

  const link = await prisma.projectIntegration.findUnique({
    where: { id: projectIntegrationId },
    include: { externalConnection: true },
  });
  if (!link || link.projectId !== project.id || link.externalConnection.companyId !== actor.companyId) {
    throw new NotFoundError("Linked source not found.");
  }

  await prisma.projectIntegration.delete({ where: { id: projectIntegrationId } });

  const provider = getProviderById(link.externalConnection.providerId);
  await recordIntegrationEvent({
    companyId: actor.companyId,
    providerId: link.externalConnection.providerId,
    externalConnectionId: link.externalConnectionId,
    eventType: "PROJECT_UNLINKED",
    status: "info",
    summary: `Unlinked ${provider?.displayName ?? link.externalConnection.providerId} source from this project`,
    actorUserId: actor.userId,
  });

  return { unlinked: true };
}
