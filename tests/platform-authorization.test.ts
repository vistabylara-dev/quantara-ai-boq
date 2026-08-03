import { PlatformRole, UserRole } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const currentActorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActor: currentActorMock,
}));

import {
  PlatformAuthorizationError,
  hasPlatformCapability,
  requirePlatformActor,
  requirePlatformCapability,
} from "../src/lib/auth/platform-authorization";
import { prisma } from "../src/lib/db/prisma";
import { UnauthorizedError } from "../src/lib/errors/app-error";

const RUN_ID = `${Date.now()}-${process.pid}`;
const COMPANY_EMAIL = `platform-auth-company-${RUN_ID}@example.com`;
const PASSWORD_HASH = "platform-auth-test-hash";

let companyId = "";
const userIds: string[] = [];
const users = {
  companyOwner: { id: "", email: `platform-auth-normal-${RUN_ID}@example.com` },
  mutable: { id: "", email: `platform-auth-mutable-${RUN_ID}@example.com` },
  inactive: { id: "", email: `platform-auth-inactive-${RUN_ID}@example.com` },
  unverified: { id: "", email: `platform-auth-unverified-${RUN_ID}@example.com` },
};

function mockSessionActor(user: { id: string; email: string }) {
  currentActorMock.mockResolvedValue({
    userId: user.id,
    companyId,
    role: UserRole.COMPANY_OWNER,
    fullName: "Platform authorization fixture",
    email: user.email,
  });
}

describe("platform authorization (fresh database identity)", () => {
  beforeAll(async () => {
    const company = await prisma.company.create({
      data: {
        legalName: `Platform Authorization Test ${RUN_ID}`,
        tradeName: `Platform Auth ${RUN_ID}`,
        email: COMPANY_EMAIL,
      },
    });
    companyId = company.id;

    const created = await prisma.$transaction(
      Object.values(users).map((fixture, index) =>
        prisma.user.create({
          data: {
            companyId,
            email: fixture.email,
            passwordHash: PASSWORD_HASH,
            fullName: `Platform authorization user ${index + 1}`,
            role: UserRole.COMPANY_OWNER,
            platformRole:
              fixture === users.mutable || fixture === users.inactive || fixture === users.unverified
                ? PlatformRole.PLATFORM_SUPPORT
                : null,
            emailVerifiedAt: fixture === users.unverified ? null : new Date(),
            isActive: fixture !== users.inactive,
          },
        }),
      ),
    );

    created.forEach((user, index) => {
      const fixture = Object.values(users)[index];
      fixture.id = user.id;
      userIds.push(user.id);
    });
  });

  beforeEach(() => {
    currentActorMock.mockReset();
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
    if (companyId) {
      await prisma.company.deleteMany({ where: { id: companyId } });
    }
  });

  it("preserves an unauthenticated session failure as a 401", async () => {
    currentActorMock.mockRejectedValue(new UnauthorizedError());

    await expect(requirePlatformActor()).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
    });
  });

  it("denies a normal company owner without treating the company role as platform access", async () => {
    mockSessionActor(users.companyOwner);

    await expect(requirePlatformActor()).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
      status: 403,
      reason: "PLATFORM_ROLE_REQUIRED",
    });
  });

  it("reloads the platform role from the database for every authorization check", async () => {
    mockSessionActor(users.mutable);

    await expect(requirePlatformActor()).resolves.toMatchObject({
      userId: users.mutable.id,
      companyId,
      platformRole: PlatformRole.PLATFORM_SUPPORT,
    });

    await prisma.user.update({
      where: { id: users.mutable.id },
      data: { platformRole: PlatformRole.PLATFORM_ADMIN },
    });

    await expect(requirePlatformActor()).resolves.toMatchObject({
      userId: users.mutable.id,
      platformRole: PlatformRole.PLATFORM_ADMIN,
    });
    await expect(requirePlatformActor([PlatformRole.PLATFORM_OWNER])).rejects.toBeInstanceOf(
      PlatformAuthorizationError,
    );
  });

  it("rejects inactive and unverified platform-role holders", async () => {
    mockSessionActor(users.inactive);
    await expect(requirePlatformActor()).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
    });

    mockSessionActor(users.unverified);
    await expect(requirePlatformActor()).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
      status: 403,
      reason: "EMAIL_NOT_VERIFIED",
    });
  });

  it("enforces the support, administrator, and owner capability hierarchy", () => {
    expect(hasPlatformCapability(PlatformRole.PLATFORM_SUPPORT, "platform:read")).toBe(true);
    expect(hasPlatformCapability(PlatformRole.PLATFORM_SUPPORT, "platform:operate")).toBe(false);
    expect(hasPlatformCapability(PlatformRole.PLATFORM_ADMIN, "platform:operate")).toBe(true);
    expect(hasPlatformCapability(PlatformRole.PLATFORM_ADMIN, "platform:manage-roles")).toBe(false);
    expect(hasPlatformCapability(PlatformRole.PLATFORM_OWNER, "platform:manage-roles")).toBe(true);
    expect(hasPlatformCapability(PlatformRole.PLATFORM_OWNER, "platform:audit:read")).toBe(true);

    expect(() =>
      requirePlatformCapability(
        {
          userId: users.mutable.id,
          companyId,
          platformRole: PlatformRole.PLATFORM_SUPPORT,
          fullName: "Support user",
          email: users.mutable.email,
        },
        "platform:operate",
      ),
    ).toThrow(PlatformAuthorizationError);
  });
});
