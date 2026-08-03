import type { Prisma, PlatformRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Lean, reusable audit writer for ADMIN-CONTROL-1 actions (simulation
 * lifecycle, catalogue admin, admin exports, test-company lifecycle).
 * Deliberately separate from platform-admin-repository.ts's heavier
 * requireFreshMutationActor-wrapped mutation audits — the actor here is
 * already re-verified by the caller (requirePlatformRole) immediately
 * before this is called. Never pass tokens, secrets, or full private URLs
 * in metadata; only safe, structural values.
 */
export async function recordPlatformActionAudit(input: {
  actorUserId: string;
  actorPlatformRole: PlatformRole;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Prisma.InputJsonObject;
}) {
  return prisma.platformAuditLog.create({
    data: {
      actorUserId: input.actorUserId,
      actorPlatformRole: input.actorPlatformRole,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      requestMetadataJson: input.metadata ?? {},
    },
  });
}
