import { PlatformRole } from "@prisma/client";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { AppError } from "@/lib/errors/app-error";
import {
  platformGetOverviewMetrics,
  platformListAuditLogs,
  platformListCompanies,
  platformListDataPackages,
  platformListSoftwareSubscriptions,
  platformListUsers,
  platformRecordReadAudit,
  platformSetUserActiveStatus,
  platformSetUserPlatformRole,
  type PlatformRequestMetadata,
} from "@/lib/repositories/platform-admin-repository";
import type {
  PlatformAuditListQuery,
  PlatformCompanyListQuery,
  PlatformDataPackageListQuery,
  PlatformSubscriptionListQuery,
  PlatformUserListQuery,
  PlatformUserRoleUpdateInput,
  PlatformUserStatusUpdateInput,
} from "@/lib/validation/platform-admin-schema";

const PLATFORM_ROLES = new Set<PlatformRole>([
  PlatformRole.PLATFORM_OWNER,
  PlatformRole.PLATFORM_ADMIN,
  PlatformRole.PLATFORM_SUPPORT,
]);

function assertPlatformActor(actor: PlatformActor): void {
  if (!PLATFORM_ROLES.has(actor.platformRole)) {
    throw new AppError("PLATFORM_PERMISSION_DENIED", "Platform access is required.", 403);
  }
}

function assertPlatformMutationActor(actor: PlatformActor): void {
  if (
    actor.platformRole !== PlatformRole.PLATFORM_OWNER &&
    actor.platformRole !== PlatformRole.PLATFORM_ADMIN
  ) {
    throw new AppError(
      "PLATFORM_PERMISSION_DENIED",
      "Platform support access is read-only.",
      403,
    );
  }
}

function assertPlatformOwner(actor: PlatformActor): void {
  if (actor.platformRole !== PlatformRole.PLATFORM_OWNER) {
    throw new AppError(
      "PLATFORM_PERMISSION_DENIED",
      "Only a platform owner may perform this action.",
      403,
    );
  }
}

function applicationEnvironment(): "production" | "preview" | "development" | "test" | "unknown" {
  const candidate = process.env.VERCEL_ENV ?? process.env.NODE_ENV;
  if (
    candidate === "production" ||
    candidate === "preview" ||
    candidate === "development" ||
    candidate === "test"
  ) {
    return candidate;
  }
  return "unknown";
}

/**
 * Reports only whether STORAGE_PROVIDER is configured, never a live
 * connectivity check — an actual Blob call from a dashboard page load would
 * be a functional test, not a status read, and does not belong here.
 */
function storageConfigurationStatus(): "vercel-blob" | "local" | "unconfigured" {
  const provider = process.env.STORAGE_PROVIDER;
  if (provider === "vercel-blob" || provider === "local") return provider;
  return "unconfigured";
}

function deployedVersion(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return sha ? sha.slice(0, 7) : "unknown";
}

export function buildPlatformRequestMetadata(request: Request): PlatformRequestMetadata {
  const url = new URL(request.url);
  const requestIdHeader = request.headers.get("x-vercel-id") ?? request.headers.get("x-request-id");
  const requestId =
    requestIdHeader && /^[A-Za-z0-9:._/-]{1,128}$/.test(requestIdHeader)
      ? requestIdHeader
      : undefined;

  return {
    method: request.method.toUpperCase().slice(0, 12),
    path: url.pathname.slice(0, 500),
    ...(requestId ? { requestId } : {}),
  };
}

export async function getPlatformOverview(
  actor: PlatformActor,
  requestMetadata: PlatformRequestMetadata,
) {
  assertPlatformActor(actor);
  const overview = await platformGetOverviewMetrics();
  await platformRecordReadAudit({
    actorUserId: actor.userId,
    action: "PLATFORM_OVERVIEW_VIEWED",
    targetType: "PlatformOverview",
    requestMetadata,
  });
  return {
    generatedAt: new Date().toISOString(),
    metrics: overview.metrics,
    emailDelivery: overview.emailDelivery,
    system: {
      database: overview.database,
      applicationEnvironment: applicationEnvironment(),
      storageProvider: storageConfigurationStatus(),
      deployedVersion: deployedVersion(),
    },
  };
}

export async function listPlatformCompanies(
  actor: PlatformActor,
  filters: PlatformCompanyListQuery,
  requestMetadata: PlatformRequestMetadata,
) {
  assertPlatformActor(actor);
  const result = await platformListCompanies(filters);
  await platformRecordReadAudit({
    actorUserId: actor.userId,
    action: "PLATFORM_COMPANY_LIST_VIEWED",
    targetType: "CompanyList",
    requestMetadata,
    viewMetadata: {
      page: filters.page,
      pageSize: filters.pageSize,
      appliedFilters: filters.search ? ["search"] : [],
    },
  });
  return result;
}

export async function listPlatformUsers(
  actor: PlatformActor,
  filters: PlatformUserListQuery,
  requestMetadata: PlatformRequestMetadata,
) {
  assertPlatformActor(actor);
  const result = await platformListUsers(filters);
  await platformRecordReadAudit({
    actorUserId: actor.userId,
    action: "PLATFORM_USER_LIST_VIEWED",
    targetType: "UserList",
    requestMetadata,
    viewMetadata: {
      page: filters.page,
      pageSize: filters.pageSize,
      appliedFilters: [
        ...(filters.search ? ["search"] : []),
        ...(filters.companyId ? ["companyId"] : []),
        ...(filters.isActive !== undefined ? ["isActive"] : []),
        ...(filters.platformRole ? ["platformRole"] : []),
      ],
    },
  });
  return result;
}

export async function listPlatformSoftwareSubscriptions(
  actor: PlatformActor,
  filters: PlatformSubscriptionListQuery,
  requestMetadata: PlatformRequestMetadata,
) {
  assertPlatformActor(actor);
  const result = await platformListSoftwareSubscriptions(filters);
  await platformRecordReadAudit({
    actorUserId: actor.userId,
    action: "PLATFORM_SUBSCRIPTION_LIST_VIEWED",
    targetType: "SoftwareSubscriptionList",
    requestMetadata,
    viewMetadata: {
      page: filters.page,
      pageSize: filters.pageSize,
      appliedFilters: [
        ...(filters.search ? ["search"] : []),
        ...(filters.companyId ? ["companyId"] : []),
        ...(filters.status ? ["status"] : []),
      ],
    },
  });
  return result;
}

export async function listPlatformDataPackages(
  actor: PlatformActor,
  filters: PlatformDataPackageListQuery,
  requestMetadata: PlatformRequestMetadata,
) {
  assertPlatformActor(actor);
  const result = await platformListDataPackages(filters);
  await platformRecordReadAudit({
    actorUserId: actor.userId,
    action: "PLATFORM_DATA_PACKAGE_LIST_VIEWED",
    targetType: "IndustryDataPackageList",
    requestMetadata,
    viewMetadata: {
      page: filters.page,
      pageSize: filters.pageSize,
      appliedFilters: [
        ...(filters.search ? ["search"] : []),
        ...(filters.status ? ["status"] : []),
      ],
    },
  });
  return result;
}

export async function listPlatformAudit(
  actor: PlatformActor,
  filters: PlatformAuditListQuery,
  requestMetadata: PlatformRequestMetadata,
) {
  assertPlatformOwner(actor);
  const result = await platformListAuditLogs(filters);
  await platformRecordReadAudit({
    actorUserId: actor.userId,
    action: "PLATFORM_AUDIT_LOG_VIEWED",
    targetType: "PlatformAuditLogList",
    requestMetadata,
    viewMetadata: {
      page: filters.page,
      pageSize: filters.pageSize,
      appliedFilters: [
        ...(filters.action ? ["action"] : []),
        ...(filters.targetType ? ["targetType"] : []),
        ...(filters.actorUserId ? ["actorUserId"] : []),
      ],
    },
  });
  return result;
}

export async function updatePlatformUserStatus(
  actor: PlatformActor,
  targetUserId: string,
  input: PlatformUserStatusUpdateInput,
  requestMetadata: PlatformRequestMetadata,
) {
  assertPlatformMutationActor(actor);
  return platformSetUserActiveStatus({
    actorUserId: actor.userId,
    targetUserId,
    isActive: input.isActive,
    requestMetadata,
  });
}

export async function updatePlatformUserRole(
  actor: PlatformActor,
  targetUserId: string,
  input: PlatformUserRoleUpdateInput,
  requestMetadata: PlatformRequestMetadata,
) {
  assertPlatformOwner(actor);
  return platformSetUserPlatformRole({
    actorUserId: actor.userId,
    targetUserId,
    platformRole: input.platformRole,
    requestMetadata,
  });
}
