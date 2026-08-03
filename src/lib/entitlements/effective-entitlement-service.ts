import { PlanType, SubscriptionStatus, type SimulationMode } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { CurrentActor } from "@/lib/auth/current-actor";

type EntitlementActor = Pick<CurrentActor, "userId" | "companyId">;
import {
  getCompanyEntitlements,
  canCreateProject as canCreateProjectReal,
  canCreateBoq as canCreateBoqReal,
  canGenerateDocument as canGenerateDocumentReal,
  canUsePremiumItem as canUsePremiumItemReal,
  canCreateProposal as canCreateProposalReal,
  type CompanyEntitlements,
  type CheckResult,
} from "./entitlement-service";
import { assertMasterItemAccess } from "./package-entitlement-service";
import { AppError, NotFoundError } from "@/lib/errors/app-error";

/**
 * ADMIN-CONTROL-1 — the single, centralized place every entitlement-gated
 * call site in the app should go through, instead of calling
 * entitlement-service.ts's companyId-based functions directly. This is
 * deliberately the *only* place platformRole or a simulation session ever
 * changes product behavior — no other file should branch on platformRole or
 * a hardcoded email/plan string (spec section 14).
 *
 * For a normal company user (source: "real") this resolves to byte-identical
 * behavior to calling entitlement-service.ts directly — real customer
 * enforcement is never weakened, never bypassed, never touched by this file.
 */

function allow(): CheckResult {
  return { allowed: true, reason: null };
}
function deny(reason: string): CheckResult {
  return { allowed: false, reason };
}

export type EffectiveSource = "real" | "owner-override" | "simulation";

export type EffectiveEntitlements = CompanyEntitlements & {
  source: EffectiveSource;
  simulationMode: SimulationMode | null;
  simulationTargetBoqId: string | null;
};

const UNRESTRICTED_BASE = {
  isTrial: false,
  isExpiredOrNone: false,
  trialStartedAt: null as string | null,
  trialExpiresAt: null as string | null,
  trialDaysRemaining: null as number | null,
  subscriptionId: null as string | null,
  maxProjects: null as number | null,
};

function ownerOverrideEntitlements(): EffectiveEntitlements {
  return {
    ...UNRESTRICTED_BASE,
    planType: PlanType.ENTERPRISE,
    planName: "Platform Owner (unrestricted)",
    status: SubscriptionStatus.ACTIVE,
    source: "owner-override",
    simulationMode: null,
    simulationTargetBoqId: null,
  };
}

function simulatedEntitlements(mode: SimulationMode, targetBoqId: string | null): EffectiveEntitlements {
  const base = { ...UNRESTRICTED_BASE, source: "simulation" as const, simulationMode: mode, simulationTargetBoqId: targetBoqId };
  switch (mode) {
    case "TRIAL_ACTIVE":
      return { ...base, planType: PlanType.TRIAL, planName: "Simulated Trial (active)", status: SubscriptionStatus.TRIAL, isTrial: true, isExpiredOrNone: false, maxProjects: 1, trialDaysRemaining: 3 };
    case "TRIAL_EXPIRED":
      return { ...base, planType: PlanType.TRIAL, planName: "Simulated Trial (expired)", status: SubscriptionStatus.EXPIRED, isTrial: true, isExpiredOrNone: true, maxProjects: 1, trialDaysRemaining: 0 };
    case "FREE":
      return { ...base, planType: PlanType.FREE, planName: "Simulated Free", status: "NONE", isTrial: false, isExpiredOrNone: true, maxProjects: 1 };
    case "PRO":
      return { ...base, planType: PlanType.PRO, planName: "Simulated Pro", status: SubscriptionStatus.ACTIVE, isTrial: false, isExpiredOrNone: false, maxProjects: null };
    case "SINGLE_BOQ_UNLOCKED":
      return { ...base, planType: PlanType.FREE, planName: "Simulated Single-BOQ Unlock", status: SubscriptionStatus.ACTIVE, isTrial: false, isExpiredOrNone: false, maxProjects: null };
  }
}

/**
 * Re-reads the platform role fresh from the database on every call, same
 * rigor as requirePlatformActor — never trusted from a cached actor, cookie,
 * or request body. Returns false for anyone who isn't an active,
 * email-verified PLATFORM_OWNER (PLATFORM_ADMIN/PLATFORM_SUPPORT get no
 * entitlement override here — "restricted subset per existing policy").
 * A non-UUID-shaped id (never possible for a real authenticated session,
 * but used by some fixture-style tests that never touch the platform-role
 * system) short-circuits to false instead of a raw Postgres type error.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function isOwnerActor(userId: string): Promise<boolean> {
  if (!UUID_PATTERN.test(userId)) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { platformRole: true, isActive: true, emailVerifiedAt: true },
  });
  return Boolean(user?.isActive && user.emailVerifiedAt && user.platformRole === "PLATFORM_OWNER");
}

export async function getActiveSimulation(userId: string) {
  return prisma.platformSimulationSession.findUnique({ where: { userId } });
}

export async function getEffectiveEntitlements(actor: EntitlementActor): Promise<EffectiveEntitlements> {
  if (!(await isOwnerActor(actor.userId))) {
    const real = await getCompanyEntitlements(actor.companyId);
    return { ...real, source: "real", simulationMode: null, simulationTargetBoqId: null };
  }

  const simulation = await getActiveSimulation(actor.userId);
  if (!simulation) return ownerOverrideEntitlements();
  return simulatedEntitlements(simulation.mode, simulation.targetBoqId);
}

export async function canCreateProjectEffective(actor: EntitlementActor): Promise<CheckResult> {
  const effective = await getEffectiveEntitlements(actor);
  if (effective.source === "real") return canCreateProjectReal(actor.companyId);
  if (effective.maxProjects === null) return allow();
  const activeProjectCount = await prisma.project.count({ where: { companyId: actor.companyId } });
  return activeProjectCount >= effective.maxProjects
    ? deny(`${effective.planName} allows ${effective.maxProjects} project(s).`)
    : allow();
}

export async function canCreateBoqEffective(actor: EntitlementActor): Promise<CheckResult> {
  const effective = await getEffectiveEntitlements(actor);
  if (effective.source === "real") return canCreateBoqReal(actor.companyId);
  return allow();
}

export async function canCreateProposalEffective(actor: EntitlementActor): Promise<CheckResult> {
  const effective = await getEffectiveEntitlements(actor);
  if (effective.source === "real") return canCreateProposalReal(actor.companyId);
  return allow();
}

export async function canUsePremiumItemEffective(actor: EntitlementActor, masterItemId: string): Promise<CheckResult> {
  const effective = await getEffectiveEntitlements(actor);
  if (effective.source === "real") return canUsePremiumItemReal(actor.companyId, masterItemId);
  if (effective.source === "owner-override") return allow();
  // Simulation: PRO allows premium items; every restricted mode (trial/expired/free/single-boq) denies —
  // "master catalogue remains non-downloadable" applies to every non-Pro simulated mode.
  return effective.simulationMode === "PRO"
    ? allow()
    : deny(`${effective.planName} does not permit premium master-catalogue items.`);
}

/**
 * Hard gate (throws) for full technical detail / copying a master item —
 * owner-override and PRO simulation bypass the underlying real check
 * entirely; every other simulation mode enforces it exactly like a real
 * restricted company (never silently more permissive than intended).
 */
export async function assertMasterItemAccessEffective(actor: EntitlementActor, masterItemId: string): Promise<void> {
  const effective = await getEffectiveEntitlements(actor);
  if (effective.source === "real") return assertMasterItemAccess(actor.companyId, masterItemId);
  if (effective.source === "owner-override" || effective.simulationMode === "PRO") return;

  const item = await prisma.masterItem.findUnique({ where: { id: masterItemId } });
  if (!item) throw new NotFoundError("Master item not found.");
  if (!item.isPremium) return;
  throw new AppError("PREMIUM_ITEM_ACCESS_DENIED", `${effective.planName} does not permit this premium item.`, 403);
}

export type DocumentExportCheck = CheckResult & { applyTrialWatermark: boolean };

/**
 * The single place "clean vs watermarked export" is decided (spec section 4
 * simulation behavior table + section 7 admin export rights). boqId is only
 * consulted for the SINGLE_BOQ_UNLOCKED simulation mode.
 */
export async function canGenerateDocumentEffective(actor: EntitlementActor, isDraft: boolean, boqId: string): Promise<DocumentExportCheck> {
  const effective = await getEffectiveEntitlements(actor);

  if (effective.source === "real") {
    const real = await canGenerateDocumentReal(actor.companyId, isDraft);
    return { ...real, applyTrialWatermark: effective.isTrial && !isDraft };
  }

  if (isDraft) return { ...allow(), applyTrialWatermark: effective.isTrial };

  if (effective.source === "owner-override") return { ...allow(), applyTrialWatermark: false };

  if (effective.simulationMode === "SINGLE_BOQ_UNLOCKED") {
    if (boqId === effective.simulationTargetBoqId) return { ...allow(), applyTrialWatermark: false };
    return { ...deny("Simulated single-BOQ unlock only permits a clean export for the selected BOQ."), applyTrialWatermark: true };
  }

  if (effective.simulationMode === "PRO") return { ...allow(), applyTrialWatermark: false };

  // TRIAL_ACTIVE, TRIAL_EXPIRED, FREE — every one of these denies a clean export in simulation.
  return {
    ...deny(`${effective.planName} does not permit a clean export.`),
    applyTrialWatermark: effective.isTrial,
  };
}
