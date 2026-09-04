import { PlanType, PlatformRole, ProjectStatus, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError, PermissionDeniedError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { companyHasPackageAccess, companyHasPackageAccessForItem } from "./package-entitlement-service";

/**
 * Canonical, single source of truth for software-plan/trial entitlement
 * rules (spec: "Do not duplicate entitlement rules across route handlers").
 * Industry-package-level entitlement lives in package-entitlement-service.ts
 * and is consulted here so a purchased package can bypass the trial's
 * five-item premium limit for items it actually covers.
 */

export const TRIAL_LIMITS = {
  durationDays: 3,
  maxProjects: 3,
  maxCompletedBoqs: 1,
  maxUniquePremiumItems: 5,
  maxFinalExports: 1,
  maxProposals: 1,
};

const FREE_LIMITS = {
  maxProjects: 1,
};

export type CheckResult = { allowed: boolean; reason: string | null };

function allow(): CheckResult {
  return { allowed: true, reason: null };
}
function deny(reason: string): CheckResult {
  return { allowed: false, reason };
}

async function getLatestSubscription(companyId: string) {
  return prisma.companySoftwareSubscription.findFirst({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    include: { softwarePlan: true },
  });
}

/** Transitions an expired TRIAL/ACTIVE subscription to EXPIRED. Read-only otherwise — never called implicitly on every read without need. */
async function syncSubscriptionStatus(subscriptionId: string): Promise<void> {
  const sub = await prisma.companySoftwareSubscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) return;
  const now = Date.now();
  const expiryDate = sub.status === SubscriptionStatus.TRIAL ? sub.trialExpiresAt : sub.expiresAt;
  if (!expiryDate || expiryDate.getTime() > now) return;
  if (sub.status !== SubscriptionStatus.TRIAL && sub.status !== SubscriptionStatus.ACTIVE) return;

  await prisma.companySoftwareSubscription.updateMany({
    where: { id: subscriptionId, status: sub.status },
    data: { status: SubscriptionStatus.EXPIRED },
  });
}

export type CompanyEntitlements = {
  planType: PlanType;
  planName: string;
  status: SubscriptionStatus | "NONE";
  isTrial: boolean;
  isExpiredOrNone: boolean;
  trialStartedAt: string | null;
  trialExpiresAt: string | null;
  trialDaysRemaining: number | null;
  subscriptionId: string | null;
  maxProjects: number | null;
};

export async function getCompanyEntitlements(companyId: string): Promise<CompanyEntitlements> {
  const subscription = await getLatestSubscription(companyId);
  if (!subscription) {
    return {
      planType: PlanType.FREE,
      planName: "Free",
      status: "NONE",
      isTrial: false,
      isExpiredOrNone: true,
      trialStartedAt: null,
      trialExpiresAt: null,
      trialDaysRemaining: null,
      subscriptionId: null,
      maxProjects: FREE_LIMITS.maxProjects,
    };
  }

  await syncSubscriptionStatus(subscription.id);
  const fresh = await prisma.companySoftwareSubscription.findUniqueOrThrow({
    where: { id: subscription.id },
    include: { softwarePlan: true },
  });

  // Some legacy/self-service subscriptions were persisted as ACTIVE while
  // still pointing at the canonical TRIAL plan. Plan type is authoritative
  // for commercial limits; otherwise those accounts fall back to the stale
  // SoftwarePlan.maxProjects value instead of TRIAL_LIMITS.
  const isTrial = fresh.status === SubscriptionStatus.TRIAL
    || fresh.softwarePlan.planType === PlanType.TRIAL;
  const isActive = fresh.status === SubscriptionStatus.ACTIVE || isTrial;
  const trialDaysRemaining = isTrial && fresh.trialExpiresAt
    ? Math.max(0, Math.ceil((fresh.trialExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  return {
    planType: fresh.softwarePlan.planType,
    planName: fresh.softwarePlan.name,
    status: fresh.status,
    isTrial,
    isExpiredOrNone: !isActive,
    trialStartedAt: fresh.trialStartedAt?.toISOString() ?? null,
    trialExpiresAt: fresh.trialExpiresAt?.toISOString() ?? null,
    trialDaysRemaining,
    subscriptionId: fresh.id,
    maxProjects: isTrial ? TRIAL_LIMITS.maxProjects : fresh.softwarePlan.maxProjects,
  };
}

async function getOrCreateTrialUsage(companyId: string, subscriptionId: string) {
  return prisma.companyTrialUsage.upsert({
    where: { companyId_subscriptionId: { companyId, subscriptionId } },
    update: {},
    create: { companyId, subscriptionId },
  });
}

export type TrialUsageSummary = {
  isTrial: boolean;
  trialDaysRemaining: number | null;
  projectsCreated: number;
  maxProjects: number;
  boqsCompleted: number;
  maxCompletedBoqs: number;
  documentsGenerated: number;
  maxFinalExports: number;
  proposalsCreated: number;
  maxProposals: number;
  uniquePremiumItemsUnlocked: number;
  maxUniquePremiumItems: number;
  unlockedItems: { masterItemId: string; name: string; usageCount: number }[];
};

export async function getTrialUsageSummary(companyId: string): Promise<TrialUsageSummary | null> {
  const entitlements = await getCompanyEntitlements(companyId);
  if (!entitlements.isTrial || !entitlements.subscriptionId) return null;

  const usage = await getOrCreateTrialUsage(companyId, entitlements.subscriptionId);
  const unlocks = await prisma.trialPremiumItemUnlock.findMany({
    where: { companyId, subscriptionId: entitlements.subscriptionId },
    include: { masterItem: { select: { name: true } } },
    orderBy: { firstUnlockedAt: "asc" },
  });

  return {
    isTrial: true,
    trialDaysRemaining: entitlements.trialDaysRemaining,
    projectsCreated: usage.projectsCreated,
    maxProjects: TRIAL_LIMITS.maxProjects,
    boqsCompleted: usage.boqsCompleted,
    maxCompletedBoqs: TRIAL_LIMITS.maxCompletedBoqs,
    documentsGenerated: usage.documentsGenerated,
    maxFinalExports: TRIAL_LIMITS.maxFinalExports,
    proposalsCreated: usage.proposalsCreated,
    maxProposals: TRIAL_LIMITS.maxProposals,
    uniquePremiumItemsUnlocked: usage.uniquePremiumItemsUnlocked,
    maxUniquePremiumItems: TRIAL_LIMITS.maxUniquePremiumItems,
    unlockedItems: unlocks.map((u) => ({ masterItemId: u.masterItemId, name: u.masterItem.name, usageCount: u.usageCount })),
  };
}

export async function canCreateProject(companyId: string): Promise<CheckResult> {
  const entitlements = await getCompanyEntitlements(companyId);
  if (entitlements.maxProjects === null) return allow();

  const activeProjectCount = await prisma.project.count({
    where: { companyId, status: { not: ProjectStatus.ARCHIVED } },
  });
  if (activeProjectCount >= entitlements.maxProjects) {
    if (entitlements.isTrial) {
      return deny(`The 3-day Pro trial allows ${TRIAL_LIMITS.maxProjects} projects. Upgrade to create additional projects.`);
    }
    if (entitlements.status === "NONE") {
      return deny("The free plan allows one draft project. Upgrade to create additional projects.");
    }
    // A genuine paid, limited plan (e.g. Starter/Professional) — the message
    // must name the actual plan and its actual limit, not the free-plan
    // wording every non-trial limited plan previously got regardless of
    // what the customer is paying for.
    return deny(`${entitlements.planName} allows ${entitlements.maxProjects} project${entitlements.maxProjects === 1 ? "" : "s"}. Upgrade to create additional projects.`);
  }
  return allow();
}

/** Gates BOQ *completion* (locking) — the trial's "one complete BOQ" limit. Revisions require locking first, so this also naturally blocks a second revision. */
export async function canCreateBoq(companyId: string): Promise<CheckResult> {
  const entitlements = await getCompanyEntitlements(companyId);
  if (!entitlements.isTrial || !entitlements.subscriptionId) return allow();

  const usage = await getOrCreateTrialUsage(companyId, entitlements.subscriptionId);
  if (usage.boqsCompleted >= TRIAL_LIMITS.maxCompletedBoqs) {
    return deny("The 3-day Pro trial allows one completed BOQ. Upgrade to lock additional revisions.");
  }
  return allow();
}

export async function recordBoqCompleted(companyId: string): Promise<void> {
  const entitlements = await getCompanyEntitlements(companyId);
  if (!entitlements.isTrial || !entitlements.subscriptionId) return;
  const usage = await getOrCreateTrialUsage(companyId, entitlements.subscriptionId);
  await prisma.companyTrialUsage.update({
    where: { id: usage.id },
    data: { boqsCompleted: { increment: 1 }, lastUsedAt: new Date(), firstUsedAt: usage.firstUsedAt ?? new Date() },
  });
}

export async function canUsePremiumItem(companyId: string, masterItemId: string): Promise<CheckResult> {
  const hasPackage = await companyHasPackageAccessForItem(companyId, masterItemId);
  if (hasPackage) return allow();

  const entitlements = await getCompanyEntitlements(companyId);
  if (!entitlements.isTrial || !entitlements.subscriptionId) {
    return deny("This is a premium item. Purchase the industry package or start a Pro trial to use it.");
  }

  const existingUnlock = await prisma.trialPremiumItemUnlock.findUnique({
    where: { companyId_subscriptionId_masterItemId: { companyId, subscriptionId: entitlements.subscriptionId, masterItemId } },
  });
  if (existingUnlock) return allow();

  const usage = await getOrCreateTrialUsage(companyId, entitlements.subscriptionId);
  if (usage.uniquePremiumItemsUnlocked >= TRIAL_LIMITS.maxUniquePremiumItems) {
    return deny(`The trial allows ${TRIAL_LIMITS.maxUniquePremiumItems} unique premium items. Upgrade to unlock more.`);
  }
  return allow();
}

/**
 * Records a trial premium-item unlock. Re-checks the limit inside the same
 * transaction as the write, so two concurrent requests for two different
 * new items can never both slip past the five-item cap (the unique index
 * on companyId+subscriptionId+masterItemId also protects against a
 * duplicate insert for the same item racing itself).
 */
export async function recordPremiumItemUnlock(companyId: string, masterItemId: string): Promise<void> {
  const entitlements = await getCompanyEntitlements(companyId);
  if (!entitlements.isTrial || !entitlements.subscriptionId) return;
  const subscriptionId = entitlements.subscriptionId;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.trialPremiumItemUnlock.findUnique({
      where: { companyId_subscriptionId_masterItemId: { companyId, subscriptionId, masterItemId } },
    });
    if (existing) {
      await tx.trialPremiumItemUnlock.update({
        where: { id: existing.id },
        data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
      });
      return;
    }

    const usage = await tx.companyTrialUsage.upsert({
      where: { companyId_subscriptionId: { companyId, subscriptionId } },
      update: {},
      create: { companyId, subscriptionId },
    });
    if (usage.uniquePremiumItemsUnlocked >= TRIAL_LIMITS.maxUniquePremiumItems) {
      throw new AppError("PREMIUM_ITEM_LIMIT_REACHED", `The trial allows ${TRIAL_LIMITS.maxUniquePremiumItems} unique premium items.`, 403);
    }

    await tx.trialPremiumItemUnlock.create({ data: { companyId, subscriptionId, masterItemId } });
    await tx.companyTrialUsage.update({
      where: { id: usage.id },
      data: { uniquePremiumItemsUnlocked: { increment: 1 }, lastUsedAt: new Date(), firstUsedAt: usage.firstUsedAt ?? new Date() },
    });
    await createAuditLog(companyId, { entityType: "TrialPremiumItemUnlock", entityId: masterItemId, action: "TRIAL_PREMIUM_ITEM_UNLOCKED", payload: { masterItemId } }, tx);
  });
}

/** Gates *final* (non-draft) document generation — trial allows one watermarked export. Draft/working exports are not counted. */
export async function canGenerateDocument(companyId: string, isDraft: boolean): Promise<CheckResult> {
  if (isDraft) return allow();
  const entitlements = await getCompanyEntitlements(companyId);

  if (entitlements.planType === PlanType.FREE || entitlements.status === "NONE") {
    return deny("Free accounts do not include clean final exports. Upgrade to continue.");
  }

  if (!entitlements.isTrial || !entitlements.subscriptionId) return allow();

  const usage = await getOrCreateTrialUsage(companyId, entitlements.subscriptionId);
  if (usage.documentsGenerated >= TRIAL_LIMITS.maxFinalExports) {
    return deny("The 3-day Pro trial allows one final export. Upgrade to generate additional documents.");
  }
  return allow();
}

export async function recordDocumentGenerated(companyId: string, isDraft: boolean): Promise<void> {
  if (isDraft) return;
  const entitlements = await getCompanyEntitlements(companyId);
  if (!entitlements.isTrial || !entitlements.subscriptionId) return;
  const usage = await getOrCreateTrialUsage(companyId, entitlements.subscriptionId);
  await prisma.companyTrialUsage.update({
    where: { id: usage.id },
    data: { documentsGenerated: { increment: 1 }, lastUsedAt: new Date(), firstUsedAt: usage.firstUsedAt ?? new Date() },
  });
}

export async function canCreateProposal(companyId: string): Promise<CheckResult> {
  const entitlements = await getCompanyEntitlements(companyId);
  if (!entitlements.isTrial || !entitlements.subscriptionId) return allow();

  const usage = await getOrCreateTrialUsage(companyId, entitlements.subscriptionId);
  if (usage.proposalsCreated >= TRIAL_LIMITS.maxProposals) {
    return deny("The 3-day Pro trial allows one client proposal. Upgrade to create additional proposals.");
  }
  return allow();
}

export async function recordProposalCreated(companyId: string): Promise<void> {
  const entitlements = await getCompanyEntitlements(companyId);
  if (!entitlements.isTrial || !entitlements.subscriptionId) return;
  const usage = await getOrCreateTrialUsage(companyId, entitlements.subscriptionId);
  await prisma.companyTrialUsage.update({
    where: { id: usage.id },
    data: { proposalsCreated: { increment: 1 }, lastUsedAt: new Date(), firstUsedAt: usage.firstUsedAt ?? new Date() },
  });
}

export async function recordProjectCreated(companyId: string): Promise<void> {
  const entitlements = await getCompanyEntitlements(companyId);
  if (!entitlements.isTrial || !entitlements.subscriptionId) return;
  const usage = await getOrCreateTrialUsage(companyId, entitlements.subscriptionId);
  await prisma.companyTrialUsage.update({
    where: { id: usage.id },
    data: { projectsCreated: { increment: 1 }, lastUsedAt: new Date(), firstUsedAt: usage.firstUsedAt ?? new Date() },
  });
}

export type RestrictedFeature = "bulk-export" | "api-access" | "master-data-download" | "package-copying-bulk";

const FEATURE_MESSAGES: Record<RestrictedFeature, string> = {
  "bulk-export": "Bulk export is not available on a trial or free plan.",
  "api-access": "API access requires an active Business or Enterprise plan.",
  "master-data-download": "Master data cannot be downloaded or exported in bulk.",
  "package-copying-bulk": "Bulk package copying is not available on a trial or free plan.",
};

/** Hard gate for features that must never be reachable on trial/free — throws rather than returning a boolean, since these must never be silently skipped by a caller that forgets to check a return value. */
export async function assertFeatureAccess(companyId: string, feature: RestrictedFeature): Promise<void> {
  const entitlements = await getCompanyEntitlements(companyId);
  const paidActive = !entitlements.isTrial && entitlements.status === "ACTIVE";
  if (!paidActive) {
    throw new AppError("FEATURE_NOT_AVAILABLE", FEATURE_MESSAGES[feature], 403);
  }
}

export async function hasIndustryPackage(companyId: string, packageKeyOrId: string): Promise<boolean> {
  return companyHasPackageAccess(companyId, packageKeyOrId);
}

function isCompanyProfileComplete(company: { legalName: string; email: string }): boolean {
  return Boolean(company.legalName.trim() && company.email.trim());
}

export async function acceptTrialTerms(actor: CurrentActor): Promise<void> {
  await prisma.company.update({ where: { id: actor.companyId }, data: { trialTermsAcceptedAt: new Date() } });
  await createAuditLog(actor.companyId, { entityType: "Company", entityId: actor.companyId, action: "TRIAL_TERMS_ACCEPTED" });
}

export type StartTrialResult = { subscriptionId: string; trialExpiresAt: string };

async function ensureTrialSoftwarePlan() {
  return prisma.softwarePlan.upsert({
    where: { key: "trial-pro" },
    update: {
      name: "Pro Trial",
      description: "3-day Pro trial: one project, one completed BOQ, five premium items, one export.",
      planType: PlanType.TRIAL,
      monthlyPrice: 0,
      annualPrice: 0,
      maxUsers: 3,
      maxProjects: 1,
      maxActiveBoqs: 1,
      maxDocumentsPerMonth: 1,
      featuresJson: { bulkExport: false, apiAccess: false, premiumMasterData: "trial-allowance" },
      isActive: true,
    },
    create: {
      key: "trial-pro",
      name: "Pro Trial",
      description: "3-day Pro trial: one project, one completed BOQ, five premium items, one export.",
      planType: PlanType.TRIAL,
      monthlyPrice: 0,
      annualPrice: 0,
      maxUsers: 3,
      maxProjects: 1,
      maxActiveBoqs: 1,
      maxDocumentsPerMonth: 1,
      featuresJson: { bulkExport: false, apiAccess: false, premiumMasterData: "trial-allowance" },
      isActive: true,
    },
  });
}

/**
 * Trial starts only after verified email, a completed company profile, and
 * accepted trial terms (spec section 2). Mobile verification is not yet
 * implemented — email verification is used as the current requirement, and
 * this is the one place that decision is recorded (see the doc comment on
 * emailVerifiedAt below).
 */
export async function startTrial(actor: CurrentActor): Promise<StartTrialResult> {
  const [user, company, existingSubscription] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: actor.userId } }),
    prisma.company.findUniqueOrThrow({ where: { id: actor.companyId } }),
    prisma.companySoftwareSubscription.findFirst({ where: { companyId: actor.companyId } }),
  ]);

  // Mobile verification is a future requirement; email verification is the current gate.
  if (!user.emailVerifiedAt) {
    throw new AppError("EMAIL_NOT_VERIFIED", "Verify your email before starting the Pro trial.", 403);
  }
  if (!isCompanyProfileComplete(company)) {
    throw new AppError("COMPANY_PROFILE_INCOMPLETE", "Add your company legal name and email before starting the Pro trial.", 403);
  }
  if (!company.trialTermsAcceptedAt) {
    throw new AppError("TRIAL_TERMS_NOT_ACCEPTED", "Accept the trial terms before starting the Pro trial.", 403);
  }
  if (existingSubscription) {
    throw new AppError("TRIAL_ALREADY_USED", "This company has already used its Pro trial.", 409);
  }

  const trialPlan = await ensureTrialSoftwarePlan();

  const now = new Date();
  const trialExpiresAt = new Date(now.getTime() + TRIAL_LIMITS.durationDays * 24 * 60 * 60 * 1000);

  const subscription = await prisma.$transaction(async (tx) => {
    const created = await tx.companySoftwareSubscription.create({
      data: {
        companyId: actor.companyId,
        softwarePlanId: trialPlan.id,
        status: SubscriptionStatus.TRIAL,
        trialStartedAt: now,
        trialExpiresAt,
        source: "self-service",
      },
    });
    await tx.companyTrialUsage.create({ data: { companyId: actor.companyId, subscriptionId: created.id } });
    await createAuditLog(actor.companyId, { entityType: "CompanySoftwareSubscription", entityId: created.id, action: "TRIAL_STARTED", payload: { trialExpiresAt: trialExpiresAt.toISOString() } }, tx);
    return created;
  });

  return { subscriptionId: subscription.id, trialExpiresAt: trialExpiresAt.toISOString() };
}

/**
 * Development activation/expiry is a manual test control, never a real
 * payment path, and must never function as a free bypass of Stripe checkout
 * for a real paying customer. Restricted to a platform-owner acting on a
 * sandbox/demo company (Company.isTestCompany) — both facts are re-read
 * fresh from the database here, never trusted from the session-cached
 * actor, mirroring requirePlatformActor's own re-read discipline. This is
 * the actual security boundary; hiding the controls in the UI (settings/
 * subscription/page.tsx) is a UX convenience on top of this, not a
 * substitute for it.
 */
async function assertDevelopmentControlsAllowed(actor: CurrentActor): Promise<void> {
  const [company, user] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: actor.companyId }, select: { isTestCompany: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { companyId: true, platformRole: true, isActive: true, emailVerifiedAt: true } }),
  ]);

  if (!company.isTestCompany) {
    throw new AppError(
      "DEVELOPMENT_CONTROLS_NOT_AVAILABLE",
      "Development plan activation is not available for this company. Use checkout to purchase a real subscription.",
      403,
    );
  }
  if (user.companyId !== actor.companyId || !user.isActive || !user.emailVerifiedAt || user.platformRole !== PlatformRole.PLATFORM_OWNER) {
    throw new PermissionDeniedError("Development plan activation requires platform owner access.");
  }
}

/** Development-only activation, clearly not a real payment flow (spec section 11/25). Test-company + platform-owner only — see assertDevelopmentControlsAllowed. */
export async function activateDevelopmentSoftwarePlan(actor: CurrentActor, planKey: string): Promise<void> {
  await assertDevelopmentControlsAllowed(actor);

  const plan = await prisma.softwarePlan.findUnique({ where: { key: planKey } });
  if (!plan) throw new NotFoundError("Software plan not found.");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const created = await tx.companySoftwareSubscription.create({
      data: {
        companyId: actor.companyId,
        softwarePlanId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        startsAt: now,
        expiresAt: null,
        source: "development",
      },
    });
    await createAuditLog(actor.companyId, { entityType: "CompanySoftwareSubscription", entityId: created.id, action: "DEVELOPMENT_PLAN_ACTIVATED", payload: { planKey } }, tx);
  });
}

/** Test-company + platform-owner only — see assertDevelopmentControlsAllowed. Never matches a Stripe-sourced subscription (source: "stripe" is explicitly excluded below), so a real paid subscription can never be expired through this development-only path. */
export async function expireDevelopmentSoftwarePlan(actor: CurrentActor): Promise<void> {
  await assertDevelopmentControlsAllowed(actor);

  const subscription = await prisma.companySoftwareSubscription.findFirst({
    where: {
      companyId: actor.companyId,
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
      source: { not: "stripe" },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription) throw new NotFoundError("No active development subscription to expire.");

  await prisma.$transaction(async (tx) => {
    await tx.companySoftwareSubscription.update({ where: { id: subscription.id }, data: { status: SubscriptionStatus.EXPIRED } });
    await createAuditLog(actor.companyId, { entityType: "CompanySoftwareSubscription", entityId: subscription.id, action: "DEVELOPMENT_PLAN_EXPIRED" }, tx);
  });
}
