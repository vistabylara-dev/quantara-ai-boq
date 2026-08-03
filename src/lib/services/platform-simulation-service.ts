import type { SimulationMode } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { recordPlatformActionAudit } from "@/lib/repositories/platform-action-audit-repository";
import { getEffectiveEntitlements } from "@/lib/entitlements/effective-entitlement-service";

/**
 * ADMIN-CONTROL-1 section 3 — a platform owner's "customer simulation"
 * context. One row per user (upserted, never versioned). Starting, changing,
 * or exiting a simulation never touches CompanySoftwareSubscription or any
 * other real entitlement record — see effective-entitlement-service.ts for
 * where this actually changes owner-visible behavior.
 */

function toSimulationDTO(session: { mode: SimulationMode; targetBoqId: string | null; startedAt: Date } | null) {
  if (!session) return null;
  return { mode: session.mode, targetBoqId: session.targetBoqId, startedAt: session.startedAt.toISOString() };
}

export async function startOrChangeSimulation(owner: PlatformActor, mode: SimulationMode, targetBoqId?: string) {
  let resolvedTargetBoqId: string | null = null;
  if (mode === "SINGLE_BOQ_UNLOCKED") {
    if (!targetBoqId) {
      throw new AppError("BOQ_REQUIRED", "Select a BOQ to unlock for single-BOQ simulation.", 400);
    }
    const boq = await prisma.bOQ.findFirst({ where: { id: targetBoqId, companyId: owner.companyId } });
    if (!boq) throw new NotFoundError("BOQ not found in your company.");
    resolvedTargetBoqId = boq.id;
  }

  const existing = await prisma.platformSimulationSession.findUnique({ where: { userId: owner.userId } });
  const session = await prisma.platformSimulationSession.upsert({
    where: { userId: owner.userId },
    update: { mode, targetBoqId: resolvedTargetBoqId },
    create: { userId: owner.userId, mode, targetBoqId: resolvedTargetBoqId },
  });

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: existing ? "PLATFORM_SIMULATION_CHANGED" : "PLATFORM_SIMULATION_STARTED",
    targetType: "PlatformSimulationSession",
    targetId: session.id,
    metadata: { mode, targetBoqId: resolvedTargetBoqId, previousMode: existing?.mode ?? null },
  });

  return toSimulationDTO(session);
}

export async function exitSimulation(owner: PlatformActor) {
  const existing = await prisma.platformSimulationSession.findUnique({ where: { userId: owner.userId } });
  if (!existing) return null;

  await prisma.platformSimulationSession.delete({ where: { userId: owner.userId } });
  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "PLATFORM_SIMULATION_EXITED",
    targetType: "PlatformSimulationSession",
    targetId: existing.id,
    metadata: { previousMode: existing.mode },
  });
  return null;
}

export async function getSimulationStatus(owner: PlatformActor) {
  const [session, effective] = await Promise.all([
    prisma.platformSimulationSession.findUnique({ where: { userId: owner.userId } }),
    getEffectiveEntitlements({ userId: owner.userId, companyId: owner.companyId }),
  ]);

  const cleanExportSummary =
    effective.source === "owner-override"
      ? "Allowed (owner override)"
      : effective.simulationMode === "PRO"
        ? "Allowed (simulated Pro)"
        : effective.simulationMode === "SINGLE_BOQ_UNLOCKED"
          ? "Allowed only for the selected BOQ"
          : "Denied (simulated restricted mode)";

  return {
    realRole: owner.platformRole,
    companyId: owner.companyId,
    simulation: toSimulationDTO(session),
    effective: {
      source: effective.source,
      planName: effective.planName,
      status: effective.status,
      isTrial: effective.isTrial,
      isExpiredOrNone: effective.isExpiredOrNone,
      maxProjects: effective.maxProjects,
      trialStartedAt: effective.trialStartedAt,
      trialExpiresAt: effective.trialExpiresAt,
      simulationMode: effective.simulationMode,
      simulationTargetBoqId: effective.simulationTargetBoqId,
      watermarkExpected: effective.isTrial,
      cleanExportSummary,
    },
  };
}
