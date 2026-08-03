import { PlatformRole, UserRole } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const requirePlatformActorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/platform-authorization", () => ({
  requirePlatformActor: requirePlatformActorMock,
}));

import { GET as overviewGET } from "../src/app/api/admin/overview/route";
import { GET as usersGET } from "../src/app/api/admin/users/route";
import { PATCH as statusPATCH } from "../src/app/api/admin/users/[userId]/status/route";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { prisma } from "../src/lib/db/prisma";
import { PermissionDeniedError, UnauthorizedError } from "../src/lib/errors/app-error";
import { getClient, listClients } from "../src/lib/repositories/client-repository";
import {
  buildPlatformRequestMetadata,
  getPlatformOverview,
  listPlatformAudit,
  listPlatformUsers,
  updatePlatformUserRole,
  updatePlatformUserStatus,
} from "../src/lib/services/platform-admin-service";
import { platformUserListQuerySchema } from "../src/lib/validation/platform-admin-schema";

const RUN_ID = `${Date.now()}-${process.pid}`;
const PASSWORD_HASH = `platform-admin-sensitive-password-hash-${RUN_ID}`;
const TEST_SEARCH = `platform-admin-${RUN_ID}`;
const requestMetadata = {
  method: "PATCH",
  path: "/api/admin/users/test",
  requestId: `test-${RUN_ID}`,
};

let companyAId = "";
let companyBId = "";
let clientAId = "";
let clientBId = "";
let sessionId = "";
const userIds: string[] = [];
const fixtures = {
  owner: { id: "", email: `${TEST_SEARCH}-owner@example.com` },
  admin: { id: "", email: `${TEST_SEARCH}-admin@example.com` },
  support: { id: "", email: `${TEST_SEARCH}-support@example.com` },
  normal: { id: "", email: `${TEST_SEARCH}-normal@example.com` },
  target: { id: "", email: `${TEST_SEARCH}-target@example.com` },
};

function actor(
  fixture: { id: string; email: string },
  platformRole: PlatformRole,
  companyId: string,
): PlatformActor {
  return {
    userId: fixture.id,
    companyId,
    platformRole,
    fullName: `${platformRole} fixture`,
    email: fixture.email,
  };
}

function ownerActor() {
  return actor(fixtures.owner, PlatformRole.PLATFORM_OWNER, companyAId);
}

function adminActor() {
  return actor(fixtures.admin, PlatformRole.PLATFORM_ADMIN, companyAId);
}

function supportActor() {
  return actor(fixtures.support, PlatformRole.PLATFORM_SUPPORT, companyBId);
}

describe("platform administration services and routes (integration)", () => {
  beforeAll(async () => {
    const existingOwnerCount = await prisma.user.count({
      where: { platformRole: PlatformRole.PLATFORM_OWNER },
    });
    if (existingOwnerCount !== 0) {
      throw new Error(
        "Platform administration tests require an isolated local test database with no existing platform owner.",
      );
    }

    const [companyA, companyB] = await prisma.$transaction([
      prisma.company.create({
        data: {
          legalName: `Platform Admin A ${RUN_ID}`,
          tradeName: `Platform Admin A ${RUN_ID}`,
          email: `${TEST_SEARCH}-company-a@example.com`,
        },
      }),
      prisma.company.create({
        data: {
          legalName: `Platform Admin B ${RUN_ID}`,
          tradeName: `Platform Admin B ${RUN_ID}`,
          email: `${TEST_SEARCH}-company-b@example.com`,
        },
      }),
    ]);
    companyAId = companyA.id;
    companyBId = companyB.id;

    const createdUsers = await prisma.$transaction([
      prisma.user.create({
        data: {
          companyId: companyAId,
          email: fixtures.owner.email,
          passwordHash: PASSWORD_HASH,
          fullName: "Platform owner fixture",
          role: UserRole.COMPANY_OWNER,
          platformRole: PlatformRole.PLATFORM_OWNER,
          emailVerifiedAt: new Date(),
          isActive: true,
        },
      }),
      prisma.user.create({
        data: {
          companyId: companyAId,
          email: fixtures.admin.email,
          passwordHash: PASSWORD_HASH,
          fullName: "Platform administrator fixture",
          role: UserRole.ADMINISTRATOR,
          platformRole: PlatformRole.PLATFORM_ADMIN,
          emailVerifiedAt: new Date(),
          isActive: true,
        },
      }),
      prisma.user.create({
        data: {
          companyId: companyBId,
          email: fixtures.support.email,
          passwordHash: PASSWORD_HASH,
          fullName: "Platform support fixture",
          role: UserRole.REVIEWER,
          platformRole: PlatformRole.PLATFORM_SUPPORT,
          emailVerifiedAt: new Date(),
          isActive: true,
        },
      }),
      prisma.user.create({
        data: {
          companyId: companyBId,
          email: fixtures.normal.email,
          passwordHash: PASSWORD_HASH,
          fullName: "Normal company user fixture",
          role: UserRole.COMPANY_OWNER,
          platformRole: null,
          emailVerifiedAt: new Date(),
          isActive: true,
        },
      }),
      prisma.user.create({
        data: {
          companyId: companyBId,
          email: fixtures.target.email,
          passwordHash: PASSWORD_HASH,
          fullName: "Platform mutation target fixture",
          role: UserRole.ESTIMATOR,
          platformRole: null,
          emailVerifiedAt: new Date(),
          isActive: true,
        },
      }),
    ]);

    createdUsers.forEach((created, index) => {
      const fixture = Object.values(fixtures)[index];
      fixture.id = created.id;
      userIds.push(created.id);
    });

    const [clientA, clientB, session] = await prisma.$transaction([
      prisma.client.create({
        data: { companyId: companyAId, name: `${TEST_SEARCH} client A` },
      }),
      prisma.client.create({
        data: { companyId: companyBId, name: `${TEST_SEARCH} client B` },
      }),
      prisma.session.create({
        data: {
          userId: fixtures.normal.id,
          tokenHash: `${TEST_SEARCH}-session-token-hash`,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      }),
    ]);
    clientAId = clientA.id;
    clientBId = clientB.id;
    sessionId = session.id;
  });

  beforeEach(() => {
    requirePlatformActorMock.mockReset();
  });

  afterAll(async () => {
    if (userIds.length > 0) {
      await prisma.platformAuditLog.deleteMany({
        where: {
          OR: [{ actorUserId: { in: userIds } }, { targetId: { in: userIds } }],
        },
      });
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (clientAId || clientBId) {
      await prisma.client.deleteMany({ where: { id: { in: [clientAId, clientBId].filter(Boolean) } } });
    }
    if (companyAId || companyBId) {
      await prisma.company.deleteMany({
        where: { id: { in: [companyAId, companyBId].filter(Boolean) } },
      });
    }
  });

  it("returns cross-company users only through the explicit platform path and omits secrets", async () => {
    const result = await listPlatformUsers(
      supportActor(),
      {
        search: TEST_SEARCH,
        page: 1,
        pageSize: 100,
      },
      { method: "GET", path: "/api/admin/users" },
    );

    expect(result.total).toBe(5);
    expect(new Set(result.items.map((item) => item.company.id))).toEqual(
      new Set([companyAId, companyBId]),
    );
    for (const item of result.items) {
      expect(item).not.toHaveProperty("passwordHash");
      expect(item).not.toHaveProperty("sessions");
      expect(item).not.toHaveProperty("tokenHash");
    }
    expect(JSON.stringify(result)).not.toContain(PASSWORD_HASH);
    expect(JSON.stringify(result)).not.toContain(`${TEST_SEARCH}-session-token-hash`);
    expect(sessionId).not.toBe("");

    const companyAClients = await listClients(companyAId, {
      search: TEST_SEARCH,
      includeArchived: true,
    });
    expect(companyAClients.items.map(({ id }) => id)).toEqual([clientAId]);
    await expect(getClient(companyAId, clientBId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("reports real PostgreSQL overview metrics and marks unavailable blocked-email data explicitly", async () => {
    const overview = await getPlatformOverview(supportActor(), {
      method: "GET",
      path: "/api/admin/overview",
      requestId: `overview-${RUN_ID}`,
    });

    expect(overview.metrics.totalCompanies).toBeGreaterThanOrEqual(2);
    expect(overview.metrics.activeUsers).toBeGreaterThanOrEqual(5);
    expect(overview.metrics.totalClients).toBeGreaterThanOrEqual(2);
    expect(overview.system.database).toBe("healthy");
    expect(overview.emailDelivery).toMatchObject({
      blockedCount: null,
      blockedStatusAvailable: false,
    });
    expect(overview.generatedAt).toEqual(expect.any(String));

    // Phase 1 — real dashboard metrics, not fixed to exact counts (other
    // tests' fixtures share this database), but must be real, well-typed
    // numbers consistent with each other.
    expect(overview.metrics.totalUsers).toBe(overview.metrics.activeUsers + overview.metrics.inactiveUsers);
    expect(overview.metrics.activeCompanies).toBeGreaterThanOrEqual(0);
    expect(overview.metrics.suspendedCompanies).toBeGreaterThanOrEqual(0);
    expect(overview.metrics.trialCompanies).toBeGreaterThanOrEqual(0);
    // Owner + admin + support fixtures in this file all carry a platform role.
    expect(overview.metrics.platformRoleHolders).toBeGreaterThanOrEqual(3);
    expect(overview.metrics.totalUploadedFiles).toBeGreaterThanOrEqual(0);
    expect(overview.metrics.totalGeneratedDocuments).toBeGreaterThanOrEqual(0);
    // Every fixture user/company in this suite was just created.
    expect(overview.metrics.recentRegistrations).toBeGreaterThanOrEqual(5);
    expect(overview.metrics.recentCompanies).toBeGreaterThanOrEqual(2);
    expect(["vercel-blob", "local", "unconfigured"]).toContain(overview.system.storageProvider);
    expect(overview.system.deployedVersion).toEqual(expect.any(String));
  });

  it("keeps pagination bounded and rejects unknown query fields", () => {
    expect(platformUserListQuerySchema.safeParse({ page: "1", pageSize: "100" }).success).toBe(
      true,
    );
    expect(platformUserListQuerySchema.safeParse({ page: "1", pageSize: "101" }).success).toBe(
      false,
    );
    expect(platformUserListQuerySchema.safeParse({ page: "1", passwordHash: "please" }).success).toBe(
      false,
    );
  });

  it("returns API 401 and 403 failures without executing protected work", async () => {
    requirePlatformActorMock.mockRejectedValueOnce(new UnauthorizedError());
    const unauthenticated = await overviewGET(
      new Request("http://localhost/api/admin/overview"),
    );
    expect(unauthenticated.status).toBe(401);
    await expect(unauthenticated.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });

    requirePlatformActorMock.mockRejectedValueOnce(new PermissionDeniedError());
    const forbidden = await statusPATCH(
      new Request(`http://localhost/api/admin/users/${fixtures.normal.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ userId: fixtures.normal.id }) },
    );
    expect(forbidden.status).toBe(403);
    await expect(forbidden.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "PERMISSION_DENIED" },
    });
    await expect(
      prisma.user.findUnique({ where: { id: fixtures.normal.id }, select: { isActive: true } }),
    ).resolves.toEqual({ isActive: true });
  });

  it("serves a paginated, secret-free users DTO through the protected API", async () => {
    requirePlatformActorMock.mockResolvedValueOnce(supportActor());
    const response = await usersGET(
      new Request(
        `http://localhost/api/admin/users?search=${encodeURIComponent(TEST_SEARCH)}&page=1&pageSize=100`,
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      data: { total: 5, page: 1, pageSize: 100 },
    });
    expect(JSON.stringify(body)).not.toContain(PASSWORD_HASH);
    expect(JSON.stringify(body)).not.toContain("tokenHash");
  });

  it("rejects unknown mutation fields before changing the user", async () => {
    requirePlatformActorMock.mockResolvedValueOnce(adminActor());
    const response = await statusPATCH(
      new Request(`http://localhost/api/admin/users/${fixtures.normal.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: false, password: "not-accepted" }),
      }),
      { params: Promise.resolve({ userId: fixtures.normal.id }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    await expect(
      prisma.user.findUnique({ where: { id: fixtures.normal.id }, select: { isActive: true } }),
    ).resolves.toEqual({ isActive: true });
  });

  it("enforces support, administrator, and owner service limitations", async () => {
    await expect(
      updatePlatformUserStatus(
        supportActor(),
        fixtures.normal.id,
        { isActive: false },
        requestMetadata,
      ),
    ).rejects.toMatchObject({ code: "PLATFORM_PERMISSION_DENIED", status: 403 });
    await expect(
      updatePlatformUserRole(
        adminActor(),
        fixtures.normal.id,
        { platformRole: PlatformRole.PLATFORM_SUPPORT },
        requestMetadata,
      ),
    ).rejects.toMatchObject({ code: "PLATFORM_PERMISSION_DENIED", status: 403 });
    await expect(
      listPlatformAudit(
        adminActor(),
        { page: 1, pageSize: 25 },
        { method: "GET", path: "/api/admin/audit" },
      ),
    ).rejects.toMatchObject({ code: "PLATFORM_PERMISSION_DENIED", status: 403 });

    await expect(
      prisma.user.findUnique({ where: { id: fixtures.normal.id }, select: { isActive: true, platformRole: true } }),
    ).resolves.toEqual({ isActive: true, platformRole: null });
  });

  it("rolls back a user update when its required audit insert fails", async () => {
    const auditCountBefore = await prisma.platformAuditLog.count({
      where: {
        targetId: fixtures.normal.id,
        action: "PLATFORM_USER_DEACTIVATED",
      },
    });

    await expect(
      updatePlatformUserStatus(
        ownerActor(),
        fixtures.normal.id,
        { isActive: false },
        {
          // A Symbol has no JSON representation and Prisma rejects it during
          // input validation (unlike BigInt, which Prisma's client silently
          // coerces inside Json fields). The repository updates the user
          // before inserting its audit row, so this exercises rollback of
          // the complete serializable transaction rather than a pre-check.
          method: Symbol("unserializable") as unknown as string,
          path: "/api/admin/users/test",
        },
      ),
    ).rejects.toBeDefined();

    await expect(
      prisma.user.findUnique({ where: { id: fixtures.normal.id }, select: { isActive: true } }),
    ).resolves.toEqual({ isActive: true });
    await expect(
      prisma.platformAuditLog.count({
        where: {
          targetId: fixtures.normal.id,
          action: "PLATFORM_USER_DEACTIVATED",
        },
      }),
    ).resolves.toBe(auditCountBefore);
  });

  it("writes one atomic audit entry for a role grant and a status mutation", async () => {
    const roleResult = await updatePlatformUserRole(
      ownerActor(),
      fixtures.target.id,
      { platformRole: PlatformRole.PLATFORM_SUPPORT },
      requestMetadata,
    );
    expect(roleResult).toMatchObject({
      changed: true,
      user: { id: fixtures.target.id, platformRole: PlatformRole.PLATFORM_SUPPORT },
    });

    const statusResult = await updatePlatformUserStatus(
      adminActor(),
      fixtures.target.id,
      { isActive: false },
      requestMetadata,
    );
    expect(statusResult).toMatchObject({
      changed: true,
      user: { id: fixtures.target.id, isActive: false },
    });

    const entries = await prisma.platformAuditLog.findMany({
      where: {
        targetId: fixtures.target.id,
        action: { in: ["PLATFORM_ROLE_GRANTED", "PLATFORM_USER_DEACTIVATED"] },
      },
      orderBy: { createdAt: "asc" },
    });
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      actorUserId: fixtures.owner.id,
      actorPlatformRole: PlatformRole.PLATFORM_OWNER,
      action: "PLATFORM_ROLE_GRANTED",
      beforeJson: { isActive: true, emailVerified: true, platformRole: "NONE" },
      afterJson: {
        isActive: true,
        emailVerified: true,
        platformRole: PlatformRole.PLATFORM_SUPPORT,
      },
    });
    expect(entries[1]).toMatchObject({
      actorUserId: fixtures.admin.id,
      actorPlatformRole: PlatformRole.PLATFORM_ADMIN,
      action: "PLATFORM_USER_DEACTIVATED",
    });

    const repeated = await updatePlatformUserStatus(
      adminActor(),
      fixtures.target.id,
      { isActive: false },
      requestMetadata,
    );
    expect(repeated.changed).toBe(false);
    await expect(
      prisma.platformAuditLog.count({
        where: { targetId: fixtures.target.id, action: "PLATFORM_USER_DEACTIVATED" },
      }),
    ).resolves.toBe(1);
  });

  it("revalidates the mutation actor and prevents administrators from changing peers or owners", async () => {
    await expect(
      updatePlatformUserStatus(
        adminActor(),
        fixtures.owner.id,
        { isActive: false },
        requestMetadata,
      ),
    ).rejects.toMatchObject({ code: "PLATFORM_PERMISSION_DENIED", status: 403 });
    await expect(
      updatePlatformUserStatus(
        adminActor(),
        fixtures.admin.id,
        { isActive: false },
        requestMetadata,
      ),
    ).rejects.toMatchObject({ code: "PLATFORM_PERMISSION_DENIED", status: 403 });

    await prisma.user.update({
      where: { id: fixtures.admin.id },
      data: { platformRole: PlatformRole.PLATFORM_SUPPORT },
    });
    await expect(
      updatePlatformUserStatus(
        adminActor(),
        fixtures.normal.id,
        { isActive: false },
        requestMetadata,
      ),
    ).rejects.toMatchObject({ code: "PLATFORM_PERMISSION_DENIED", status: 403 });
    await expect(
      prisma.user.findUnique({ where: { id: fixtures.normal.id }, select: { isActive: true } }),
    ).resolves.toEqual({ isActive: true });

    await prisma.user.update({
      where: { id: fixtures.admin.id },
      data: { platformRole: PlatformRole.PLATFORM_ADMIN },
    });
  });

  it("protects the final active verified owner with no partial mutation or audit", async () => {
    const auditCountBefore = await prisma.platformAuditLog.count({
      where: { actorUserId: fixtures.owner.id, targetId: fixtures.owner.id },
    });

    await expect(
      updatePlatformUserStatus(
        ownerActor(),
        fixtures.owner.id,
        { isActive: false },
        requestMetadata,
      ),
    ).rejects.toMatchObject({ code: "FINAL_PLATFORM_OWNER_PROTECTED", status: 409 });
    await expect(
      updatePlatformUserRole(
        ownerActor(),
        fixtures.owner.id,
        { platformRole: null },
        requestMetadata,
      ),
    ).rejects.toMatchObject({ code: "FINAL_PLATFORM_OWNER_PROTECTED", status: 409 });

    await expect(
      prisma.user.findUnique({
        where: { id: fixtures.owner.id },
        select: { isActive: true, platformRole: true },
      }),
    ).resolves.toEqual({ isActive: true, platformRole: PlatformRole.PLATFORM_OWNER });
    await expect(
      prisma.platformAuditLog.count({
        where: { actorUserId: fixtures.owner.id, targetId: fixtures.owner.id },
      }),
    ).resolves.toBe(auditCountBefore);
  });

  it("redacts sensitive audit JSON in the owner-only read DTO", async () => {
    await prisma.platformAuditLog.create({
      data: {
        actorUserId: fixtures.owner.id,
        actorPlatformRole: PlatformRole.PLATFORM_OWNER,
        action: `PLATFORM_TEST_REDACTION_${RUN_ID}`,
        targetType: "TestFixture",
        targetId: fixtures.normal.id,
        requestMetadataJson: { requestId: RUN_ID, authorization: "Bearer secret" },
        beforeJson: { password: "secret", harmless: "visible" },
        afterJson: { token: "secret", harmless: "still-visible" },
      },
    });

    const result = await listPlatformAudit(
      ownerActor(),
      {
        action: `PLATFORM_TEST_REDACTION_${RUN_ID}`,
        page: 1,
        pageSize: 25,
      },
      { method: "GET", path: "/api/admin/audit" },
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      requestMetadata: { requestId: RUN_ID, authorization: "[REDACTED]" },
      before: { password: "[REDACTED]", harmless: "visible" },
      after: { token: "[REDACTED]", harmless: "still-visible" },
    });
    expect(JSON.stringify(result)).not.toContain("Bearer secret");
  });

  it("keeps one owner when two owners concurrently attempt to revoke each other", async () => {
    await updatePlatformUserRole(
      ownerActor(),
      fixtures.support.id,
      { platformRole: PlatformRole.PLATFORM_OWNER },
      requestMetadata,
    );
    const secondOwnerActor = actor(
      fixtures.support,
      PlatformRole.PLATFORM_OWNER,
      companyBId,
    );

    const outcomes = await Promise.allSettled([
      updatePlatformUserRole(
        ownerActor(),
        fixtures.support.id,
        { platformRole: null },
        { ...requestMetadata, requestId: `${RUN_ID}-a` },
      ),
      updatePlatformUserRole(
        secondOwnerActor,
        fixtures.owner.id,
        { platformRole: null },
        { ...requestMetadata, requestId: `${RUN_ID}-b` },
      ),
    ]);

    expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(1);
    await expect(
      prisma.user.count({
        where: {
          platformRole: PlatformRole.PLATFORM_OWNER,
          isActive: true,
          emailVerifiedAt: { not: null },
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.platformAuditLog.count({
        where: {
          targetId: { in: [fixtures.owner.id, fixtures.support.id] },
          action: "PLATFORM_ROLE_REVOKED",
          requestMetadataJson: {
            path: ["requestId"],
            string_starts_with: RUN_ID,
          },
        },
      }),
    ).resolves.toBe(1);
  });

  it("records only a normalized path and safe request ID in request metadata", () => {
    const metadata = buildPlatformRequestMetadata(
      new Request("https://example.com/api/admin/users?password=secret", {
        method: "patch",
        headers: { "x-request-id": `safe-${RUN_ID}` },
      }),
    );
    expect(metadata).toEqual({
      method: "PATCH",
      path: "/api/admin/users",
      requestId: `safe-${RUN_ID}`,
    });
    expect(JSON.stringify(metadata)).not.toContain("password");
    expect(JSON.stringify(metadata)).not.toContain("secret");
  });
});
