import { PlatformRole, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ProvisionPlatformOwnerError,
  provisionPlatformOwner,
} from "../scripts/provision-platform-owner";
import { prisma } from "../src/lib/db/prisma";

const RUN_ID = `${Date.now()}-${process.pid}`;
const PASSWORD_HASH = `provision-owner-sensitive-hash-${RUN_ID}`;
const PLATFORM_COMPANY_EMAIL = "platform@quantara.internal";

const emails = {
  newOwner: `provision-owner-new-${RUN_ID}@example.com`,
  differentOwner: `provision-owner-different-${RUN_ID}@example.com`,
  existingInactive: `provision-owner-existing-inactive-${RUN_ID}@example.com`,
};

let unrelatedCompanyId = "";
const userIds: string[] = [];

describe("provision-platform-owner (integration, real local PostgreSQL)", () => {
  beforeAll(async () => {
    const existingOwnerCount = await prisma.user.count({
      where: { platformRole: PlatformRole.PLATFORM_OWNER },
    });
    if (existingOwnerCount !== 0) {
      throw new Error(
        "Provision-owner tests require an isolated local test database with no existing platform owner.",
      );
    }

    const company = await prisma.company.create({
      data: {
        legalName: `Provision Owner Unrelated Co ${RUN_ID}`,
        tradeName: `Provision Owner Unrelated Co ${RUN_ID}`,
        email: `provision-owner-unrelated-${RUN_ID}@example.com`,
      },
    });
    unrelatedCompanyId = company.id;

    const existingInactive = await prisma.user.create({
      data: {
        companyId: unrelatedCompanyId,
        email: emails.existingInactive,
        passwordHash: PASSWORD_HASH,
        fullName: "Existing Inactive Candidate",
        role: UserRole.COMPANY_OWNER,
        emailVerifiedAt: null,
        isActive: false,
      },
    });
    userIds.push(existingInactive.id);
  });

  afterAll(async () => {
    const platformCompany = await prisma.company.findFirst({
      where: { email: PLATFORM_COMPANY_EMAIL },
    });
    await prisma.platformAuditLog.deleteMany({
      where: { OR: [{ actorUserId: { in: userIds } }, { targetId: { in: userIds } }] },
    });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (unrelatedCompanyId) {
      await prisma.company.deleteMany({ where: { id: unrelatedCompanyId } });
    }
    if (platformCompany) {
      await prisma.company.deleteMany({ where: { id: platformCompany.id } });
    }
    await prisma.$disconnect();
  });

  it("creates the platform owner using one dedicated, non-customer company (never a fake customer company)", async () => {
    const result = await provisionPlatformOwner(prisma, emails.newOwner, {
      providePassword: async () => "StrongPass1",
    });
    userIds.push(result.userId);

    expect(result).toMatchObject({ email: emails.newOwner, created: true, roleChanged: true });
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("password");

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: result.userId },
      include: { company: true },
    });
    expect(user.platformRole).toBe(PlatformRole.PLATFORM_OWNER);
    expect(user.isActive).toBe(true);
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.company.email).toBe(PLATFORM_COMPANY_EMAIL);
    expect(user.companyId).not.toBe(unrelatedCompanyId);

    const auditEntries = await prisma.platformAuditLog.findMany({
      where: { targetId: result.userId, action: "PLATFORM_OWNER_PROVISIONED" },
    });
    expect(auditEntries).toHaveLength(1);
    expect(JSON.stringify(auditEntries)).not.toContain("StrongPass1");
  });

  it("is idempotent: re-running for the same email reuses the account and the same platform company", async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { email: emails.newOwner } });

    const result = await provisionPlatformOwner(prisma, emails.newOwner, {
      providePassword: async () => {
        throw new Error("Password should never be requested for an existing account.");
      },
    });

    expect(result).toMatchObject({ userId: before.id, created: false, roleChanged: false });

    const companies = await prisma.company.findMany({ where: { email: PLATFORM_COMPANY_EMAIL } });
    expect(companies).toHaveLength(1);
  });

  it("refuses to create a second owner while one already exists", async () => {
    await expect(
      provisionPlatformOwner(prisma, emails.differentOwner, {
        providePassword: async () => "AnotherPass1",
      }),
    ).rejects.toThrow(ProvisionPlatformOwnerError);

    await expect(prisma.user.findUnique({ where: { email: emails.differentOwner } })).resolves.toBeNull();
  });

  it("refuses to activate an existing inactive/unverified account without the explicit option", async () => {
    await expect(
      provisionPlatformOwner(prisma, emails.existingInactive, {
        providePassword: async () => {
          throw new Error("Password should never be requested for an existing account.");
        },
      }),
    ).rejects.toThrow(ProvisionPlatformOwnerError);

    const unchanged = await prisma.user.findUniqueOrThrow({ where: { email: emails.existingInactive } });
    expect(unchanged.isActive).toBe(false);
    expect(unchanged.platformRole).toBeNull();
  });
});
