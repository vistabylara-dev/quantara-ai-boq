import { PlatformRole, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PlatformOwnerBootstrapError,
  bootstrapPlatformOwner,
  normalizePlatformOwnerEmail,
} from "../scripts/bootstrap-platform-owner";
import { prisma } from "../src/lib/db/prisma";

const RUN_ID = `${Date.now()}-${process.pid}`;
const COMPANY_EMAIL = `platform-bootstrap-company-${RUN_ID}@example.com`;
const PASSWORD_HASH = `platform-bootstrap-password-${RUN_ID}`;
const emails = {
  inactive: `platform-bootstrap-inactive-${RUN_ID}@example.com`,
  unverified: `platform-bootstrap-unverified-${RUN_ID}@example.com`,
  eligible: `platform-bootstrap-eligible-${RUN_ID}@example.com`,
  different: `platform-bootstrap-different-${RUN_ID}@example.com`,
  missing: `platform-bootstrap-missing-${RUN_ID}@example.com`,
};

let companyId = "";
const userIds: string[] = [];
let inactiveUserId = "";
let unverifiedUserId = "";
let eligibleUserId = "";
let differentUserId = "";
let sessionId = "";

describe("platform owner bootstrap (integration, real local PostgreSQL)", () => {
  beforeAll(async () => {
    const existingOwnerCount = await prisma.user.count({
      where: { platformRole: PlatformRole.PLATFORM_OWNER },
    });
    if (existingOwnerCount !== 0) {
      console.warn("platform-owner-bootstrap tests: Note: Other platform owners exist in the DB, ignoring.");
    }

    const company = await prisma.company.create({
      data: {
        legalName: `Platform Bootstrap Test ${RUN_ID}`,
        tradeName: `Platform Bootstrap ${RUN_ID}`,
        email: COMPANY_EMAIL,
      },
    });
    companyId = company.id;

    const [inactive, unverified, eligible, different] = await prisma.$transaction([
      prisma.user.create({
        data: {
          companyId,
          email: emails.inactive,
          passwordHash: PASSWORD_HASH,
          fullName: "Inactive bootstrap candidate",
          role: UserRole.COMPANY_OWNER,
          emailVerifiedAt: new Date(),
          isActive: false,
        },
      }),
      prisma.user.create({
        data: {
          companyId,
          email: emails.unverified,
          passwordHash: PASSWORD_HASH,
          fullName: "Unverified bootstrap candidate",
          role: UserRole.COMPANY_OWNER,
          emailVerifiedAt: null,
          isActive: true,
        },
      }),
      prisma.user.create({
        data: {
          companyId,
          email: emails.eligible,
          passwordHash: PASSWORD_HASH,
          fullName: "Eligible bootstrap candidate",
          role: UserRole.COMPANY_OWNER,
          emailVerifiedAt: new Date(),
          isActive: true,
        },
      }),
      prisma.user.create({
        data: {
          companyId,
          email: emails.different,
          passwordHash: PASSWORD_HASH,
          fullName: "Different bootstrap candidate",
          role: UserRole.COMPANY_OWNER,
          emailVerifiedAt: new Date(),
          isActive: true,
        },
      }),
    ]);

    inactiveUserId = inactive.id;
    unverifiedUserId = unverified.id;
    eligibleUserId = eligible.id;
    differentUserId = different.id;
    userIds.push(inactive.id, unverified.id, eligible.id, different.id);

    const session = await prisma.session.create({
      data: {
        userId: eligible.id,
        tokenHash: `platform-bootstrap-session-${RUN_ID}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    sessionId = session.id;
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

  it("requires a valid PLATFORM_OWNER_EMAIL", () => {
    expect(() => normalizePlatformOwnerEmail(undefined)).toThrow(PlatformOwnerBootstrapError);
    expect(() => normalizePlatformOwnerEmail("not-an-email")).toThrow(
      "PLATFORM_OWNER_EMAIL is not a valid email address.",
    );
    expect(normalizePlatformOwnerEmail(`  ${emails.eligible.toUpperCase()}  `)).toBe(
      emails.eligible,
    );
  });

  it("refuses a missing user without creating an account", async () => {
    const beforeCount = await prisma.user.count({ where: { email: emails.missing } });

    await expect(bootstrapPlatformOwner(prisma, emails.missing)).rejects.toThrow(
      "Register and verify the account first.",
    );

    expect(beforeCount).toBe(0);
    await expect(prisma.user.count({ where: { email: emails.missing } })).resolves.toBe(0);
  });

  it("refuses inactive and unverified existing users", async () => {
    await expect(bootstrapPlatformOwner(prisma, emails.inactive)).rejects.toThrow(
      "deactivated",
    );
    await expect(bootstrapPlatformOwner(prisma, emails.unverified)).rejects.toThrow(
      "verify their email",
    );

    const candidates = await prisma.user.findMany({
      where: { id: { in: [inactiveUserId, unverifiedUserId] } },
      select: { id: true, platformRole: true },
    });
    expect(candidates.every((candidate) => candidate.platformRole === null)).toBe(true);
  });

  it("promotes one existing eligible user atomically without changing credentials or sessions", async () => {
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: eligibleUserId },
      select: { passwordHash: true },
    });
    const sessionsBefore = await prisma.session.findMany({
      where: { userId: eligibleUserId },
      select: { id: true, tokenHash: true, expiresAt: true },
      orderBy: { id: "asc" },
    });

    await expect(bootstrapPlatformOwner(prisma, ` ${emails.eligible.toUpperCase()} `)).resolves.toEqual({
      userId: eligibleUserId,
      email: emails.eligible,
      changed: true,
    });

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: eligibleUserId },
      select: { passwordHash: true, platformRole: true },
    });
    const sessionsAfter = await prisma.session.findMany({
      where: { userId: eligibleUserId },
      select: { id: true, tokenHash: true, expiresAt: true },
      orderBy: { id: "asc" },
    });
    const audits = await prisma.platformAuditLog.findMany({
      where: {
        actorUserId: eligibleUserId,
        targetId: eligibleUserId,
        action: "PLATFORM_OWNER_BOOTSTRAPPED",
      },
    });

    expect(after).toMatchObject({
      passwordHash: before.passwordHash,
      platformRole: PlatformRole.PLATFORM_OWNER,
    });
    expect(sessionsAfter).toEqual(sessionsBefore);
    expect(sessionsAfter.map(({ id }) => id)).toContain(sessionId);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorPlatformRole: PlatformRole.PLATFORM_OWNER,
      targetType: "User",
      requestMetadataJson: { source: "local-cli-bootstrap" },
      beforeJson: { platformRole: null },
      afterJson: { platformRole: PlatformRole.PLATFORM_OWNER },
    });
  });

  it("is idempotent and does not create a second audit record", async () => {
    await expect(bootstrapPlatformOwner(prisma, emails.eligible)).resolves.toEqual({
      userId: eligibleUserId,
      email: emails.eligible,
      changed: false,
    });

    await expect(
      prisma.platformAuditLog.count({
        where: {
          actorUserId: eligibleUserId,
          targetId: eligibleUserId,
          action: "PLATFORM_OWNER_BOOTSTRAPPED",
        },
      }),
    ).resolves.toBe(1);
  });

  it("refuses a different candidate after the first owner exists", async () => {
    await expect(bootstrapPlatformOwner(prisma, emails.different)).rejects.toThrow(
      "A different platform owner already exists.",
    );

    await expect(
      prisma.user.findUnique({ where: { id: differentUserId }, select: { platformRole: true } }),
    ).resolves.toEqual({ platformRole: null });
    await expect(
      prisma.platformAuditLog.count({ where: { targetId: differentUserId } }),
    ).resolves.toBe(0);
  });
});
