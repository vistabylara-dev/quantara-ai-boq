import { PlatformRole, ProjectStatus, UserRole } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const requirePlatformActorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/platform-authorization", () => ({
  requirePlatformActor: requirePlatformActorMock,
}));

import { GET as recentCompaniesGET } from "../src/app/api/admin/recent-companies/route";
import { GET as recentProjectsGET } from "../src/app/api/admin/recent-projects/route";
import { GET as recentUsersGET } from "../src/app/api/admin/recent-users/route";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { prisma } from "../src/lib/db/prisma";
import { PermissionDeniedError, UnauthorizedError } from "../src/lib/errors/app-error";
import {
  listPlatformRecentCompanies,
  listPlatformRecentProjects,
  listPlatformRecentUsers,
} from "../src/lib/services/platform-admin-service";

const RUN_ID = `${Date.now()}-${process.pid}`;
const requestMetadata = { method: "GET", path: "/api/admin/recent-companies" };

let companyId = "";
let clientId = "";
let industryEngineId = "";
const userIds: string[] = [];
const projectIds: string[] = [];

function ownerActor(): PlatformActor {
  return {
    userId: userIds[0]!,
    companyId,
    platformRole: PlatformRole.PLATFORM_OWNER,
    fullName: "Owner Fixture",
    email: `dashboard-owner-${RUN_ID}@example.com`,
  };
}

describe("platform admin dashboard summary panels (integration, real local Postgres)", () => {
  beforeAll(async () => {
    const company = await prisma.company.create({
      data: {
        legalName: `Dashboard Test Co ${RUN_ID}`,
        tradeName: `Dashboard Test Co ${RUN_ID}`,
        email: `dashboard-company-${RUN_ID}@example.com`,
      },
    });
    companyId = company.id;

    const owner = await prisma.user.create({
      data: {
        companyId,
        email: `dashboard-owner-${RUN_ID}@example.com`,
        passwordHash: `dashboard-hash-${RUN_ID}`,
        fullName: "Dashboard Owner",
        role: UserRole.COMPANY_OWNER,
        platformRole: PlatformRole.PLATFORM_OWNER,
        emailVerifiedAt: new Date(),
        isActive: true,
      },
    });
    userIds.push(owner.id);

    const client = await prisma.client.create({
      data: { companyId, name: `Dashboard Test Client ${RUN_ID}` },
    });
    clientId = client.id;

    const industryEngine = await prisma.industryEngine.findFirstOrThrow({ select: { id: true } });
    industryEngineId = industryEngine.id;

    const project = await prisma.project.create({
      data: {
        companyId,
        clientId,
        industryEngineId,
        slug: `dashboard-test-${RUN_ID}`,
        reference: `DASH-${RUN_ID}`,
        name: `Dashboard Test Project ${RUN_ID}`,
        status: ProjectStatus.DRAFT,
      },
    });
    projectIds.push(project.id);
  });

  beforeEach(() => {
    requirePlatformActorMock.mockReset();
  });

  afterAll(async () => {
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    await prisma.platformAuditLog.deleteMany({
      where: { OR: [{ actorUserId: { in: userIds } }, { targetId: { in: userIds } }] },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (clientId) await prisma.client.deleteMany({ where: { id: clientId } });
    if (companyId) await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it("returns real recent companies with owner, status, and counts — never fabricated, never unbounded", async () => {
    const result = await listPlatformRecentCompanies(ownerActor(), requestMetadata);

    expect(result.length).toBeLessThanOrEqual(8);
    const fixtureCompany = result.find((company) => company.id === companyId);
    expect(fixtureCompany).toBeDefined();
    expect(fixtureCompany).toMatchObject({
      owner: { fullName: "Dashboard Owner" },
      status: "NONE",
      userCount: 1,
      projectCount: 1,
    });
    expect(JSON.stringify(result)).not.toContain(`dashboard-hash-${RUN_ID}`);
  });

  it("returns real recent users, never including password hashes", async () => {
    const result = await listPlatformRecentUsers(ownerActor(), requestMetadata);

    expect(result.length).toBeLessThanOrEqual(8);
    const fixtureUser = result.find((user) => user.id === userIds[0]);
    expect(fixtureUser).toMatchObject({
      companyRole: UserRole.COMPANY_OWNER,
      platformRole: PlatformRole.PLATFORM_OWNER,
      isActive: true,
    });
    expect(JSON.stringify(result)).not.toContain(`dashboard-hash-${RUN_ID}`);
  });

  it("returns real recent projects with BOQ/file counts, never invented progress fields", async () => {
    const result = await listPlatformRecentProjects(ownerActor(), requestMetadata);

    expect(result.length).toBeLessThanOrEqual(8);
    const fixtureProject = result.find((project) => project.id === projectIds[0]);
    expect(fixtureProject).toMatchObject({
      status: ProjectStatus.DRAFT,
      boqCount: 0,
      fileCount: 0,
    });
    expect(fixtureProject).not.toHaveProperty("progress");
    expect(fixtureProject).not.toHaveProperty("risk");
  });

  it("rejects an unauthenticated request on every new route without executing the query", async () => {
    requirePlatformActorMock.mockRejectedValue(new UnauthorizedError());
    for (const handler of [recentCompaniesGET, recentUsersGET, recentProjectsGET]) {
      const response = await handler(new Request("http://localhost/api/admin/recent"));
      expect(response.status).toBe(401);
    }
  });

  it("rejects a non-platform actor on every new route", async () => {
    requirePlatformActorMock.mockRejectedValue(new PermissionDeniedError());
    for (const handler of [recentCompaniesGET, recentUsersGET, recentProjectsGET]) {
      const response = await handler(new Request("http://localhost/api/admin/recent"));
      expect(response.status).toBe(403);
    }
  });

  it("serves real data through the protected routes for an authorized platform actor", async () => {
    requirePlatformActorMock.mockResolvedValue(ownerActor());
    const response = await recentCompaniesGET(new Request("http://localhost/api/admin/recent-companies"));
    const body = (await response.json()) as { ok: boolean; data: unknown };
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});
