import {
  EmailDispatchStatus,
  PlatformRole,
  Prisma,
  SubscriptionStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import type {
  PlatformAuditListQuery,
  PlatformCompanyListQuery,
  PlatformDataPackageListQuery,
  PlatformSubscriptionListQuery,
  PlatformUserListQuery,
} from "@/lib/validation/platform-admin-schema";

export type PlatformRequestMetadata = {
  method: string;
  path: string;
  requestId?: string;
};

export type PlatformReadAuditAction =
  | "PLATFORM_OVERVIEW_VIEWED"
  | "PLATFORM_COMPANY_LIST_VIEWED"
  | "PLATFORM_USER_LIST_VIEWED"
  | "PLATFORM_SUBSCRIPTION_LIST_VIEWED"
  | "PLATFORM_DATA_PACKAGE_LIST_VIEWED"
  | "PLATFORM_AUDIT_LOG_VIEWED";

const companyListSelect = {
  id: true,
  legalName: true,
  tradeName: true,
  email: true,
  country: true,
  defaultCurrency: true,
  createdAt: true,
  updatedAt: true,
  softwareSubscriptions: {
    select: {
      id: true,
      status: true,
      trialExpiresAt: true,
      startsAt: true,
      expiresAt: true,
      source: true,
      updatedAt: true,
      softwarePlan: {
        select: {
          key: true,
          name: true,
          planType: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 1,
  },
} satisfies Prisma.CompanySelect;

const platformUserSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  platformRole: true,
  emailVerifiedAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  company: {
    select: {
      id: true,
      legalName: true,
      tradeName: true,
    },
  },
} satisfies Prisma.UserSelect;

const softwareSubscriptionSelect = {
  id: true,
  status: true,
  trialStartedAt: true,
  trialExpiresAt: true,
  startsAt: true,
  expiresAt: true,
  cancelledAt: true,
  source: true,
  createdAt: true,
  updatedAt: true,
  company: {
    select: {
      id: true,
      legalName: true,
      tradeName: true,
    },
  },
  softwarePlan: {
    select: {
      id: true,
      key: true,
      name: true,
      planType: true,
      currency: true,
    },
  },
} satisfies Prisma.CompanySoftwareSubscriptionSelect;

const dataPackageSelect = {
  id: true,
  key: true,
  name: true,
  description: true,
  packageType: true,
  version: true,
  itemCount: true,
  monthlyPrice: true,
  annualPrice: true,
  currency: true,
  status: true,
  isFeatured: true,
  createdAt: true,
  updatedAt: true,
  discipline: {
    select: {
      id: true,
      key: true,
      name: true,
    },
  },
  _count: {
    select: {
      items: true,
    },
  },
} satisfies Prisma.IndustryDataPackageSelect;

const auditListSelect = {
  id: true,
  actorUserId: true,
  actorPlatformRole: true,
  action: true,
  targetType: true,
  targetId: true,
  requestMetadataJson: true,
  beforeJson: true,
  afterJson: true,
  createdAt: true,
  actorUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
} satisfies Prisma.PlatformAuditLogSelect;

const mutationUserSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  platformRole: true,
  emailVerifiedAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  company: {
    select: {
      id: true,
      legalName: true,
      tradeName: true,
    },
  },
} satisfies Prisma.UserSelect;

type CompanyListRecord = Prisma.CompanyGetPayload<{ select: typeof companyListSelect }>;
type PlatformUserRecord = Prisma.UserGetPayload<{ select: typeof platformUserSelect }>;
type SoftwareSubscriptionRecord = Prisma.CompanySoftwareSubscriptionGetPayload<{
  select: typeof softwareSubscriptionSelect;
}>;
type DataPackageRecord = Prisma.IndustryDataPackageGetPayload<{ select: typeof dataPackageSelect }>;
type PlatformAuditRecord = Prisma.PlatformAuditLogGetPayload<{ select: typeof auditListSelect }>;
type MutationUserRecord = Prisma.UserGetPayload<{ select: typeof mutationUserSelect }>;

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function toPlatformUserDTO(user: PlatformUserRecord | MutationUserRecord) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    companyRole: user.role,
    platformRole: user.platformRole ?? "NONE",
    isActive: user.isActive,
    emailVerifiedAt: iso(user.emailVerifiedAt),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    company: {
      id: user.company.id,
      legalName: user.company.legalName,
      tradeName: user.company.tradeName,
    },
  };
}

function toSoftwareSubscriptionDTO(subscription: SoftwareSubscriptionRecord) {
  return {
    id: subscription.id,
    status: subscription.status,
    trialStartedAt: iso(subscription.trialStartedAt),
    trialExpiresAt: iso(subscription.trialExpiresAt),
    startsAt: iso(subscription.startsAt),
    expiresAt: iso(subscription.expiresAt),
    cancelledAt: iso(subscription.cancelledAt),
    source: subscription.source,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
    company: subscription.company,
    plan: subscription.softwarePlan,
  };
}

function countMap(rows: Array<{ companyId: string; _count: { _all: number } }>) {
  return new Map(rows.map((row) => [row.companyId, row._count._all]));
}

function sensitiveAuditKey(key: string): boolean {
  return /(password|passphrase|token|secret|cookie|authorization|credential|api[-_]?key|database[-_]?url|connection[-_]?string|hash)$/i.test(
    key,
  );
}

function sanitizeAuditJson(value: Prisma.JsonValue | null | undefined, depth = 0): unknown {
  if (value === undefined) return null;
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.length > 1_000 ? `${value.slice(0, 1_000)}...` : value;
  if (depth >= 6) return "[TRUNCATED]";
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((entry) => sanitizeAuditJson(entry, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 100)
      .map(([key, entry]) => [
        key,
        sensitiveAuditKey(key) ? "[REDACTED]" : sanitizeAuditJson(entry, depth + 1),
      ]),
  );
}

function toAuditDTO(entry: PlatformAuditRecord) {
  return {
    id: entry.id,
    actorUserId: entry.actorUserId,
    actorPlatformRole: entry.actorPlatformRole,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    requestMetadata: sanitizeAuditJson(entry.requestMetadataJson),
    before: sanitizeAuditJson(entry.beforeJson),
    after: sanitizeAuditJson(entry.afterJson),
    createdAt: entry.createdAt.toISOString(),
    actor: entry.actorUser,
  };
}

/**
 * Global platform metrics. This function is intentionally separate from all
 * tenant repositories; none of the ordinary company-scoped data paths call it.
 */
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function platformGetOverviewMetrics() {
  const recentSince = new Date(Date.now() - RECENT_WINDOW_MS);

  const [
    totalCompanies,
    activeUsers,
    inactiveUsers,
    totalProjects,
    totalBoqRevisionRecords,
    totalClients,
    activeSoftwareSubscriptionRecords,
    trialSoftwareSubscriptionRecords,
    suspendedSoftwareSubscriptionRecords,
    activeDataPackageEntitlementRecords,
    trialDataPackageEntitlementRecords,
    suspendedDataPackageEntitlementRecords,
    failedEmailDeliveries,
    platformRoleHolders,
    totalUploadedFiles,
    totalGeneratedDocuments,
    recentRegistrations,
    recentCompanies,
    companyStatusRows,
    databaseProbe,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: false } }),
    prisma.project.count(),
    prisma.bOQ.count(),
    prisma.client.count(),
    prisma.companySoftwareSubscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
    prisma.companySoftwareSubscription.count({ where: { status: SubscriptionStatus.TRIAL } }),
    prisma.companySoftwareSubscription.count({ where: { status: SubscriptionStatus.SUSPENDED } }),
    prisma.companyPackageSubscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
    prisma.companyPackageSubscription.count({ where: { status: SubscriptionStatus.TRIAL } }),
    prisma.companyPackageSubscription.count({ where: { status: SubscriptionStatus.SUSPENDED } }),
    prisma.emailDispatch.count({ where: { status: EmailDispatchStatus.FAILED } }),
    prisma.user.count({ where: { platformRole: { not: null } } }),
    prisma.projectFile.count(),
    prisma.generatedDocument.count(),
    prisma.user.count({ where: { createdAt: { gte: recentSince } } }),
    prisma.company.count({ where: { createdAt: { gte: recentSince } } }),
    // A company's status is defined by its most recent subscription record,
    // not by any field on Company itself — DISTINCT ON picks that one row
    // per company before grouping, so a company with several historical
    // subscription records is only ever counted once, under its latest status.
    prisma.$queryRaw<Array<{ status: SubscriptionStatus; count: number }>>(Prisma.sql`
      SELECT status, COUNT(*)::int AS count
      FROM (
        SELECT DISTINCT ON ("companyId") "companyId", status
        FROM "CompanySoftwareSubscription"
        ORDER BY "companyId", "createdAt" DESC
      ) latest
      GROUP BY status
    `),
    prisma.$queryRaw<Array<{ ok: number }>>(Prisma.sql`SELECT 1 AS ok`),
  ]);

  if (databaseProbe[0]?.ok !== 1) {
    throw new AppError("DATABASE_HEALTH_CHECK_FAILED", "The database health check failed.", 503);
  }

  const companyStatusCount = (status: SubscriptionStatus) =>
    companyStatusRows.find((row) => row.status === status)?.count ?? 0;

  return {
    metrics: {
      totalCompanies,
      activeCompanies: companyStatusCount(SubscriptionStatus.ACTIVE),
      suspendedCompanies: companyStatusCount(SubscriptionStatus.SUSPENDED),
      trialCompanies: companyStatusCount(SubscriptionStatus.TRIAL),
      totalUsers: activeUsers + inactiveUsers,
      activeUsers,
      inactiveUsers,
      platformRoleHolders,
      totalProjects,
      totalBoqRevisionRecords,
      totalClients,
      totalUploadedFiles,
      totalGeneratedDocuments,
      recentRegistrations,
      recentCompanies,
      activeSoftwareSubscriptionRecords,
      trialSoftwareSubscriptionRecords,
      suspendedSoftwareSubscriptionRecords,
      activeDataPackageEntitlementRecords,
      trialDataPackageEntitlementRecords,
      suspendedDataPackageEntitlementRecords,
    },
    emailDelivery: {
      failedCount: failedEmailDeliveries,
      blockedCount: null,
      blockedStatusAvailable: false,
    },
    database: "healthy" as const,
  };
}

/** Explicit cross-company company listing for authenticated platform actors. */
export async function platformListCompanies(filters: PlatformCompanyListQuery) {
  const where: Prisma.CompanyWhereInput = filters.search
    ? {
        OR: [
          { legalName: { contains: filters.search, mode: "insensitive" } },
          { tradeName: { contains: filters.search, mode: "insensitive" } },
          { email: { contains: filters.search, mode: "insensitive" } },
        ],
      }
    : {};

  const [companies, total] = await prisma.$transaction([
    prisma.company.findMany({
      where,
      select: companyListSelect,
      orderBy: [{ tradeName: "asc" }, { id: "asc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.company.count({ where }),
  ]);

  const companyIds = companies.map((company) => company.id);
  const [userRows, activeUserRows, projectRows, boqRows, clientRows, activePackageRows] =
    await Promise.all([
      prisma.user.groupBy({
        by: ["companyId"],
        where: { companyId: { in: companyIds } },
        _count: { _all: true },
      }),
      prisma.user.groupBy({
        by: ["companyId"],
        where: { companyId: { in: companyIds }, isActive: true },
        _count: { _all: true },
      }),
      prisma.project.groupBy({
        by: ["companyId"],
        where: { companyId: { in: companyIds } },
        _count: { _all: true },
      }),
      prisma.bOQ.groupBy({
        by: ["companyId"],
        where: { companyId: { in: companyIds } },
        _count: { _all: true },
      }),
      prisma.client.groupBy({
        by: ["companyId"],
        where: { companyId: { in: companyIds } },
        _count: { _all: true },
      }),
      prisma.companyPackageSubscription.groupBy({
        by: ["companyId"],
        where: { companyId: { in: companyIds }, status: SubscriptionStatus.ACTIVE },
        _count: { _all: true },
      }),
    ]);

  const userCounts = countMap(userRows);
  const activeUserCounts = countMap(activeUserRows);
  const projectCounts = countMap(projectRows);
  const boqCounts = countMap(boqRows);
  const clientCounts = countMap(clientRows);
  const activePackageCounts = countMap(activePackageRows);

  return {
    items: companies.map((company: CompanyListRecord) => {
      const subscription = company.softwareSubscriptions[0];
      return {
        id: company.id,
        legalName: company.legalName,
        tradeName: company.tradeName,
        email: company.email,
        country: company.country,
        defaultCurrency: company.defaultCurrency,
        createdAt: company.createdAt.toISOString(),
        updatedAt: company.updatedAt.toISOString(),
        userCount: userCounts.get(company.id) ?? 0,
        activeUserCount: activeUserCounts.get(company.id) ?? 0,
        projectCount: projectCounts.get(company.id) ?? 0,
        boqRevisionCount: boqCounts.get(company.id) ?? 0,
        clientCount: clientCounts.get(company.id) ?? 0,
        currentSoftwareSubscription: subscription
          ? {
              id: subscription.id,
              status: subscription.status,
              planKey: subscription.softwarePlan.key,
              planName: subscription.softwarePlan.name,
              planType: subscription.softwarePlan.planType,
              trialExpiresAt: iso(subscription.trialExpiresAt),
              startsAt: iso(subscription.startsAt),
              expiresAt: iso(subscription.expiresAt),
              source: subscription.source,
              updatedAt: subscription.updatedAt.toISOString(),
            }
          : null,
        activeDataPackageEntitlementCount: activePackageCounts.get(company.id) ?? 0,
      };
    }),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

/** Explicit cross-company user listing with a field allow-list. */
export async function platformListUsers(filters: PlatformUserListQuery) {
  const where: Prisma.UserWhereInput = {
    ...(filters.companyId ? { companyId: filters.companyId } : {}),
    ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    ...(filters.platformRole ? { platformRole: filters.platformRole } : {}),
    ...(filters.search
      ? {
          OR: [
            { email: { contains: filters.search, mode: "insensitive" } },
            { fullName: { contains: filters.search, mode: "insensitive" } },
            { company: { legalName: { contains: filters.search, mode: "insensitive" } } },
            { company: { tradeName: { contains: filters.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: platformUserSelect,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: users.map(toPlatformUserDTO),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

/** Explicit cross-company software-subscription record listing. */
export async function platformListSoftwareSubscriptions(filters: PlatformSubscriptionListQuery) {
  const where: Prisma.CompanySoftwareSubscriptionWhereInput = {
    ...(filters.companyId ? { companyId: filters.companyId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            { company: { legalName: { contains: filters.search, mode: "insensitive" } } },
            { company: { tradeName: { contains: filters.search, mode: "insensitive" } } },
            { softwarePlan: { name: { contains: filters.search, mode: "insensitive" } } },
            { softwarePlan: { key: { contains: filters.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [subscriptions, total] = await prisma.$transaction([
    prisma.companySoftwareSubscription.findMany({
      where,
      select: softwareSubscriptionSelect,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.companySoftwareSubscription.count({ where }),
  ]);

  return {
    items: subscriptions.map(toSoftwareSubscriptionDTO),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

/** Explicit global package catalogue listing with entitlement-record counts. */
export async function platformListDataPackages(filters: PlatformDataPackageListQuery) {
  const where: Prisma.IndustryDataPackageWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            { key: { contains: filters.search, mode: "insensitive" } },
            { name: { contains: filters.search, mode: "insensitive" } },
            { discipline: { name: { contains: filters.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [packages, total] = await prisma.$transaction([
    prisma.industryDataPackage.findMany({
      where,
      select: dataPackageSelect,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.industryDataPackage.count({ where }),
  ]);

  const packageIds = packages.map((dataPackage) => dataPackage.id);
  const entitlementCounts = await prisma.companyPackageSubscription.groupBy({
    by: ["packageId", "status"],
    where: { packageId: { in: packageIds } },
    _count: { _all: true },
  });
  const countsByPackage = new Map<
    string,
    { total: number; active: number; trial: number; pastDue: number; cancelled: number; expired: number; suspended: number }
  >();

  for (const row of entitlementCounts) {
    const counts = countsByPackage.get(row.packageId) ?? {
      total: 0,
      active: 0,
      trial: 0,
      pastDue: 0,
      cancelled: 0,
      expired: 0,
      suspended: 0,
    };
    const count = row._count._all;
    counts.total += count;
    if (row.status === SubscriptionStatus.ACTIVE) counts.active += count;
    if (row.status === SubscriptionStatus.TRIAL) counts.trial += count;
    if (row.status === SubscriptionStatus.PAST_DUE) counts.pastDue += count;
    if (row.status === SubscriptionStatus.CANCELLED) counts.cancelled += count;
    if (row.status === SubscriptionStatus.EXPIRED) counts.expired += count;
    if (row.status === SubscriptionStatus.SUSPENDED) counts.suspended += count;
    countsByPackage.set(row.packageId, counts);
  }

  return {
    items: packages.map((dataPackage: DataPackageRecord) => ({
      id: dataPackage.id,
      key: dataPackage.key,
      name: dataPackage.name,
      description: dataPackage.description,
      packageType: dataPackage.packageType,
      version: dataPackage.version,
      configuredItemCount: dataPackage.itemCount,
      linkedItemCount: dataPackage._count.items,
      monthlyPrice: dataPackage.monthlyPrice.toNumber(),
      annualPrice: dataPackage.annualPrice.toNumber(),
      currency: dataPackage.currency,
      status: dataPackage.status,
      isFeatured: dataPackage.isFeatured,
      discipline: dataPackage.discipline,
      entitlementRecords: countsByPackage.get(dataPackage.id) ?? {
        total: 0,
        active: 0,
        trial: 0,
        pastDue: 0,
        cancelled: 0,
        expired: 0,
        suspended: 0,
      },
      createdAt: dataPackage.createdAt.toISOString(),
      updatedAt: dataPackage.updatedAt.toISOString(),
    })),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

/** Owner-only global audit listing. Authorization is enforced by the service and route. */
export async function platformListAuditLogs(filters: PlatformAuditListQuery) {
  const where: Prisma.PlatformAuditLogWhereInput = {
    ...(filters.action
      ? { action: { contains: filters.action, mode: "insensitive" } }
      : {}),
    ...(filters.targetType
      ? { targetType: { contains: filters.targetType, mode: "insensitive" } }
      : {}),
    ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
  };

  const [entries, total] = await prisma.$transaction([
    prisma.platformAuditLog.findMany({
      where,
      select: auditListSelect,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.platformAuditLog.count({ where }),
  ]);

  return {
    items: entries.map(toAuditDTO),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

function safeMutationSnapshot(user: MutationUserRecord): Prisma.InputJsonObject {
  return {
    isActive: user.isActive,
    emailVerified: user.emailVerifiedAt !== null,
    platformRole: user.platformRole ?? "NONE",
  };
}

async function requireFreshMutationActor(
  tx: Prisma.TransactionClient,
  actorUserId: string,
  allowedRoles: readonly PlatformRole[],
) {
  const actor = await tx.user.findUnique({
    where: { id: actorUserId },
    select: {
      id: true,
      isActive: true,
      emailVerifiedAt: true,
      platformRole: true,
    },
  });

  if (
    !actor ||
    !actor.isActive ||
    !actor.emailVerifiedAt ||
    !actor.platformRole ||
    !allowedRoles.includes(actor.platformRole)
  ) {
    throw new AppError(
      "PLATFORM_PERMISSION_DENIED",
      "Your platform role does not permit this action.",
      403,
    );
  }
  return actor;
}

async function assertNotFinalActiveOwner(
  tx: Prisma.TransactionClient,
  target: MutationUserRecord,
) {
  if (
    target.platformRole !== PlatformRole.PLATFORM_OWNER ||
    !target.isActive ||
    !target.emailVerifiedAt
  ) {
    return;
  }

  const activeVerifiedOwnerCount = await tx.user.count({
    where: {
      platformRole: PlatformRole.PLATFORM_OWNER,
      isActive: true,
      emailVerifiedAt: { not: null },
    },
  });
  if (activeVerifiedOwnerCount <= 1) {
    throw new AppError(
      "FINAL_PLATFORM_OWNER_PROTECTED",
      "The final active verified platform owner cannot be removed or deactivated.",
      409,
    );
  }
}

function requestMetadataJson(metadata: PlatformRequestMetadata): Prisma.InputJsonObject {
  return {
    method: metadata.method,
    path: metadata.path,
    ...(metadata.requestId ? { requestId: metadata.requestId } : {}),
  };
}

/**
 * Records one event for a successful global read. Callers supply only filter
 * names and pagination metadata, never raw search strings or customer values.
 */
export async function platformRecordReadAudit(input: {
  actorUserId: string;
  action: PlatformReadAuditAction;
  targetType: string;
  requestMetadata: PlatformRequestMetadata;
  viewMetadata?: Prisma.InputJsonObject;
}) {
  return prisma.$transaction(async (tx) => {
    const actor = await requireFreshMutationActor(tx, input.actorUserId, [
      PlatformRole.PLATFORM_OWNER,
      PlatformRole.PLATFORM_ADMIN,
      PlatformRole.PLATFORM_SUPPORT,
    ]);
    await tx.platformAuditLog.create({
      data: {
        actorUserId: actor.id,
        actorPlatformRole: actor.platformRole,
        action: input.action,
        targetType: input.targetType,
        requestMetadataJson: {
          ...requestMetadataJson(input.requestMetadata),
          ...(input.viewMetadata ?? {}),
        },
      },
    });
  });
}

export async function platformSetUserActiveStatus(input: {
  actorUserId: string;
  targetUserId: string;
  isActive: boolean;
  requestMetadata: PlatformRequestMetadata;
}) {
  return prisma.$transaction(
    async (tx) => {
      const actor = await requireFreshMutationActor(tx, input.actorUserId, [
        PlatformRole.PLATFORM_OWNER,
        PlatformRole.PLATFORM_ADMIN,
      ]);
      const target = await tx.user.findUnique({
        where: { id: input.targetUserId },
        select: mutationUserSelect,
      });
      if (!target) throw new NotFoundError("The requested user was not found.");

      if (
        actor.platformRole === PlatformRole.PLATFORM_ADMIN &&
        (target.platformRole === PlatformRole.PLATFORM_OWNER ||
          target.platformRole === PlatformRole.PLATFORM_ADMIN)
      ) {
        throw new AppError(
          "PLATFORM_PERMISSION_DENIED",
          "Platform administrators cannot activate or deactivate platform owners or administrators.",
          403,
        );
      }

      if (!input.isActive) await assertNotFinalActiveOwner(tx, target);
      if (target.isActive === input.isActive) {
        return { user: toPlatformUserDTO(target), changed: false };
      }

      const before = safeMutationSnapshot(target);
      const updated = await tx.user.update({
        where: { id: target.id },
        data: { isActive: input.isActive },
        select: mutationUserSelect,
      });
      await tx.platformAuditLog.create({
        data: {
          actorUserId: actor.id,
          actorPlatformRole: actor.platformRole,
          action: input.isActive ? "PLATFORM_USER_ACTIVATED" : "PLATFORM_USER_DEACTIVATED",
          targetType: "User",
          targetId: target.id,
          requestMetadataJson: requestMetadataJson(input.requestMetadata),
          beforeJson: before,
          afterJson: safeMutationSnapshot(updated),
        },
      });

      return { user: toPlatformUserDTO(updated), changed: true };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function platformSetUserPlatformRole(input: {
  actorUserId: string;
  targetUserId: string;
  platformRole: PlatformRole | null;
  requestMetadata: PlatformRequestMetadata;
}) {
  return prisma.$transaction(
    async (tx) => {
      const actor = await requireFreshMutationActor(tx, input.actorUserId, [
        PlatformRole.PLATFORM_OWNER,
      ]);
      const target = await tx.user.findUnique({
        where: { id: input.targetUserId },
        select: mutationUserSelect,
      });
      if (!target) throw new NotFoundError("The requested user was not found.");

      if (input.platformRole && (!target.isActive || !target.emailVerifiedAt)) {
        throw new AppError(
          "PLATFORM_USER_NOT_ELIGIBLE",
          "Platform roles can be granted only to active users with verified email addresses.",
          409,
        );
      }
      if (target.platformRole === PlatformRole.PLATFORM_OWNER && input.platformRole !== PlatformRole.PLATFORM_OWNER) {
        await assertNotFinalActiveOwner(tx, target);
      }
      if (target.platformRole === input.platformRole) {
        return { user: toPlatformUserDTO(target), changed: false };
      }

      const before = safeMutationSnapshot(target);
      const updated = await tx.user.update({
        where: { id: target.id },
        data: { platformRole: input.platformRole },
        select: mutationUserSelect,
      });
      const action =
        target.platformRole === null
          ? "PLATFORM_ROLE_GRANTED"
          : input.platformRole === null
            ? "PLATFORM_ROLE_REVOKED"
            : "PLATFORM_ROLE_CHANGED";
      await tx.platformAuditLog.create({
        data: {
          actorUserId: actor.id,
          actorPlatformRole: actor.platformRole,
          action,
          targetType: "User",
          targetId: target.id,
          requestMetadataJson: requestMetadataJson(input.requestMetadata),
          beforeJson: before,
          afterJson: safeMutationSnapshot(updated),
        },
      });

      return { user: toPlatformUserDTO(updated), changed: true };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
