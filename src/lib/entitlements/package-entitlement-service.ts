import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError, PermissionDeniedError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import type { CurrentActor } from "@/lib/auth/current-actor";

/**
 * Industry-package-level entitlement (does this company have paid access to
 * package X, independent of the software-plan trial). Consulted by
 * entitlement-service.ts so a purchased package can bypass the trial's
 * five-item premium limit for items it actually covers — see
 * companyHasPackageAccessForItem, which entitlement-service imports.
 */

async function resolvePackage(packageKeyOrId: string) {
  return prisma.industryDataPackage.findFirst({ where: { OR: [{ id: packageKeyOrId }, { key: packageKeyOrId }] } });
}

/** Expires any package subscription whose expiresAt has passed. Existing copied items remain visible; only new copying is blocked (enforced by the callers of assertMasterItemAccess). */
async function syncCompanyPackageSubscriptions(companyId: string): Promise<void> {
  await prisma.companyPackageSubscription.updateMany({
    where: { companyId, status: SubscriptionStatus.ACTIVE, expiresAt: { not: null, lt: new Date() } },
    data: { status: SubscriptionStatus.EXPIRED },
  });
}

export async function companyHasPackageAccess(companyId: string, packageKeyOrId: string): Promise<boolean> {
  const pkg = await resolvePackage(packageKeyOrId);
  if (!pkg) return false;
  await syncCompanyPackageSubscriptions(companyId);
  const subscription = await prisma.companyPackageSubscription.findFirst({
    where: { companyId, packageId: pkg.id, status: SubscriptionStatus.ACTIVE },
  });
  return Boolean(subscription);
}

/** True only if the item belongs to at least one package AND the company holds an active subscription to one of those packages. */
export async function companyHasPackageAccessForItem(companyId: string, masterItemId: string): Promise<boolean> {
  const packageLinks = await prisma.industryDataPackageItem.findMany({ where: { masterItemId }, select: { packageId: true } });
  if (packageLinks.length === 0) return false;

  await syncCompanyPackageSubscriptions(companyId);
  const activeSubscription = await prisma.companyPackageSubscription.findFirst({
    where: { companyId, packageId: { in: packageLinks.map((link) => link.packageId) }, status: SubscriptionStatus.ACTIVE },
  });
  return Boolean(activeSubscription);
}

function toPackageDTO(pkg: {
  id: string; key: string; name: string; description: string; disciplineId: string; packageType: string;
  version: number; itemCount: number; monthlyPrice: unknown; annualPrice: unknown; currency: string; status: string; isFeatured: boolean;
}) {
  return {
    id: pkg.id,
    key: pkg.key,
    name: pkg.name,
    description: pkg.description,
    disciplineId: pkg.disciplineId,
    packageType: pkg.packageType,
    version: pkg.version,
    itemCount: pkg.itemCount,
    monthlyPrice: Number(pkg.monthlyPrice),
    annualPrice: Number(pkg.annualPrice),
    currency: pkg.currency,
    status: pkg.status,
    isFeatured: pkg.isFeatured,
  };
}

export async function listCompanyAccessiblePackages(companyId: string) {
  await syncCompanyPackageSubscriptions(companyId);
  const subscriptions = await prisma.companyPackageSubscription.findMany({
    where: { companyId },
    include: { package: true },
    orderBy: { createdAt: "desc" },
  });
  return subscriptions.map((sub) => ({
    subscriptionId: sub.id,
    status: sub.status,
    startsAt: sub.startsAt?.toISOString() ?? null,
    expiresAt: sub.expiresAt?.toISOString() ?? null,
    cancelledAt: sub.cancelledAt?.toISOString() ?? null,
    source: sub.source,
    package: toPackageDTO(sub.package),
  }));
}

export async function listAccessibleMasterItems(companyId: string, packageKeyOrId: string) {
  const pkg = await resolvePackage(packageKeyOrId);
  if (!pkg) throw new NotFoundError("Package not found.");
  const hasAccess = await companyHasPackageAccess(companyId, pkg.id);
  if (!hasAccess) throw new PermissionDeniedError("This package is not active for your company.");

  const items = await prisma.industryDataPackageItem.findMany({
    where: { packageId: pkg.id },
    include: { masterItem: true },
    orderBy: { sortOrder: "asc" },
  });
  return items.map((link) => link.masterItem);
}

/** Server-side gate for full technical detail / copying — never rely on the UI hiding a button. */
export async function assertMasterItemAccess(companyId: string, masterItemId: string): Promise<void> {
  const item = await prisma.masterItem.findUnique({ where: { id: masterItemId } });
  if (!item) throw new NotFoundError("Master item not found.");
  if (!item.isPremium) return;

  const hasPackage = await companyHasPackageAccessForItem(companyId, masterItemId);
  if (hasPackage) return;

  const { canUsePremiumItem } = await import("./entitlement-service");
  const check = await canUsePremiumItem(companyId, masterItemId);
  if (!check.allowed) {
    throw new AppError("PREMIUM_ITEM_ACCESS_DENIED", check.reason ?? "This premium item requires an active package or trial allowance.", 403);
  }
}

/** Development-only activation — never a real payment flow (spec sections 6/11/25). */
export async function activateDevelopmentPackage(actor: CurrentActor, packageKeyOrId: string): Promise<void> {
  const pkg = await resolvePackage(packageKeyOrId);
  if (!pkg) throw new NotFoundError("Package not found.");

  await prisma.$transaction(async (tx) => {
    const created = await tx.companyPackageSubscription.create({
      data: {
        companyId: actor.companyId,
        packageId: pkg.id,
        status: SubscriptionStatus.ACTIVE,
        startsAt: new Date(),
        expiresAt: null,
        source: "development",
      },
    });
    await createAuditLog(actor.companyId, { entityType: "CompanyPackageSubscription", entityId: created.id, action: "DEVELOPMENT_PACKAGE_ACTIVATED", payload: { packageKey: pkg.key } }, tx);
  });
}

export async function expireDevelopmentPackage(actor: CurrentActor, packageKeyOrId: string): Promise<void> {
  const pkg = await resolvePackage(packageKeyOrId);
  if (!pkg) throw new NotFoundError("Package not found.");

  const subscription = await prisma.companyPackageSubscription.findFirst({
    where: { companyId: actor.companyId, packageId: pkg.id, status: SubscriptionStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription) throw new NotFoundError("No active subscription to this package.");

  await prisma.$transaction(async (tx) => {
    await tx.companyPackageSubscription.update({ where: { id: subscription.id }, data: { status: SubscriptionStatus.EXPIRED } });
    await createAuditLog(actor.companyId, { entityType: "CompanyPackageSubscription", entityId: subscription.id, action: "DEVELOPMENT_PACKAGE_EXPIRED", payload: { packageKey: pkg.key } }, tx);
  });
}
