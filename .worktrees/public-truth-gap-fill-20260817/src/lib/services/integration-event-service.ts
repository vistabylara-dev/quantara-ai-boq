import type { IntegrationEventType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * INTEGRATIONS-1A completion pass — the single write site for
 * IntegrationEvent, so "never a token/secret in history" is enforced in one
 * place rather than trusted at every call site. `summary` must always be a
 * short, safe, human-readable sentence (e.g. "Connected to Test Provider",
 * "Reason: Authorization expired — Action: Reconnect account") — callers
 * never pass raw provider payloads, tokens, or headers here.
 */

export type RecordIntegrationEventInput = {
  companyId: string;
  providerId: string;
  externalConnectionId?: string | null;
  projectIntegrationId?: string | null;
  eventType: IntegrationEventType;
  status: "success" | "failed" | "info";
  summary: string;
  metadata?: Record<string, string | number | boolean | null>;
  actorUserId?: string | null;
};

export async function recordIntegrationEvent(input: RecordIntegrationEventInput) {
  return prisma.integrationEvent.create({
    data: {
      companyId: input.companyId,
      providerId: input.providerId,
      externalConnectionId: input.externalConnectionId ?? null,
      projectIntegrationId: input.projectIntegrationId ?? null,
      eventType: input.eventType,
      status: input.status,
      summary: input.summary,
      metadataJson: input.metadata ?? undefined,
      actorUserId: input.actorUserId ?? null,
    },
  });
}

function toEventDTO(row: {
  id: string; providerId: string; externalConnectionId: string | null; projectIntegrationId: string | null;
  eventType: IntegrationEventType; status: string; summary: string; metadataJson: unknown; createdAt: Date;
  actorUser: { id: string; fullName: string } | null;
}) {
  return {
    id: row.id,
    providerId: row.providerId,
    externalConnectionId: row.externalConnectionId,
    projectIntegrationId: row.projectIntegrationId,
    eventType: row.eventType,
    status: row.status,
    summary: row.summary,
    metadata: row.metadataJson,
    createdAt: row.createdAt.toISOString(),
    actor: row.actorUser ? { id: row.actorUser.id, fullName: row.actorUser.fullName } : null,
  };
}

export type ListEventsFilters = {
  providerId?: string;
  eventType?: IntegrationEventType;
  status?: string;
  externalConnectionId?: string;
  projectId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

/** Bounded (default 20, max 50) and always company-scoped — never loads a company's full history into the browser in one call. */
export async function listEventsForCompany(companyId: string, filters: ListEventsFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 20));

  const where = {
    companyId,
    ...(filters.providerId ? { providerId: filters.providerId } : {}),
    ...(filters.eventType ? { eventType: filters.eventType } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.externalConnectionId ? { externalConnectionId: filters.externalConnectionId } : {}),
    ...(filters.projectId ? { projectIntegration: { projectId: filters.projectId } } : {}),
    ...(filters.from || filters.to
      ? { createdAt: { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lte: new Date(filters.to) } : {}) } }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.integrationEvent.findMany({
      where,
      include: { actorUser: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.integrationEvent.count({ where }),
  ]);

  return { items: rows.map(toEventDTO), total, page, pageSize };
}

export async function listEventsForConnection(companyId: string, externalConnectionId: string, limit = 20) {
  const rows = await prisma.integrationEvent.findMany({
    where: { companyId, externalConnectionId },
    include: { actorUser: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(50, limit),
  });
  return rows.map(toEventDTO);
}
