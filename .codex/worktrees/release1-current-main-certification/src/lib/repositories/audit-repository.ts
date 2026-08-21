import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getActorFromContext } from "@/lib/auth/request-context";

type AuditDatabase = typeof prisma | Prisma.TransactionClient;

export type AuditEvent = {
  entityType: string;
  entityId: string;
  action: string;
  payload?: Prisma.InputJsonValue;
  actorName?: string;
};

export async function createAuditLog(
  companyId: string,
  event: AuditEvent,
  database: AuditDatabase = prisma,
) {
  const contextActor = getActorFromContext();
  return database.auditLog.create({
    data: {
      companyId,
      userId: contextActor?.userId ?? null,
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      payloadJson: event.payload ?? {},
      actorName: event.actorName ?? contextActor?.fullName ?? "System",
    },
  });
}

export async function listAuditLogs(companyId: string, limit = 50) {
  return prisma.auditLog.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
  });
}
