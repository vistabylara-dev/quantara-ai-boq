import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name)! } : undefined),
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  }),
}));

const { prisma } = await import("../src/lib/db/prisma");
const { getCurrentActor } = await import("../src/lib/auth/current-actor");
const {
  loginWithPassword,
  registerCompanyOwner,
  resetPassword,
} = await import("../src/lib/services/auth-service");
const { generateRawToken, hashToken } = await import("../src/lib/auth/tokens");
const { UnauthorizedError } = await import("../src/lib/errors/app-error");

const RUN_ID = Date.now();
const primaryEmail = `auth-test-primary-${RUN_ID}@example.com`;
const secondaryEmail = `auth-test-secondary-${RUN_ID}@example.com`;
const PASSWORD = "Password123";

describe("auth service (integration, real local Postgres)", () => {
  beforeEach(() => {
    cookieStore.clear();
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: [primaryEmail, secondaryEmail] } },
    });
    await prisma.session.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.passwordResetToken.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { email: { in: [primaryEmail, secondaryEmail] } } });
    await prisma.company.deleteMany({ where: { email: { in: [primaryEmail, secondaryEmail] } } });
    await prisma.$disconnect();
  });

  it("registers a company owner and rejects a duplicate email", async () => {
    const result = await registerCompanyOwner({
      companyName: "Auth Test Co",
      fullName: "Primary Owner",
      email: primaryEmail,
      password: PASSWORD,
    });
    expect(result.email).toBe(primaryEmail.toLowerCase());

    await expect(
      registerCompanyOwner({
        companyName: "Duplicate Co",
        fullName: "Someone Else",
        email: primaryEmail,
        password: PASSWORD,
      }),
    ).rejects.toMatchObject({ code: "EMAIL_ALREADY_REGISTERED" });
  });

  it("blocks login before verification, then allows it after", async () => {
    await expect(loginWithPassword({ email: primaryEmail, password: PASSWORD })).rejects.toMatchObject({
      code: "EMAIL_NOT_VERIFIED",
    });

    await prisma.user.update({
      where: { email: primaryEmail },
      data: { emailVerifiedAt: new Date() },
    });

    await expect(
      loginWithPassword({ email: primaryEmail, password: "WrongPassword1" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });

    await loginWithPassword({ email: primaryEmail, password: PASSWORD });

    const user = await prisma.user.findUniqueOrThrow({ where: { email: primaryEmail } });
    const sessions = await prisma.session.findMany({ where: { userId: user.id } });
    expect(sessions).toHaveLength(1);
    expect(cookieStore.has("quantara_session")).toBe(true);
  });

  it("resolves the authenticated actor from a valid session cookie and rejects an expired one", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: primaryEmail } });
    await loginWithPassword({ email: primaryEmail, password: PASSWORD });

    const actor = await getCurrentActor();
    expect(actor.userId).toBe(user.id);
    expect(actor.companyId).toBe(user.companyId);

    // Expire every session for this user directly in the database.
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(getCurrentActor()).rejects.toThrow(UnauthorizedError);
  });

  it("resets a password with a valid token, rejects reuse, and invalidates existing sessions", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: primaryEmail } });
    const rawToken = generateRawToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await resetPassword(rawToken, "NewPassword456");

    await expect(resetPassword(rawToken, "AnotherPassword789")).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED_TOKEN",
    });

    const remainingSessions = await prisma.session.findMany({ where: { userId: user.id } });
    expect(remainingSessions).toHaveLength(0);

    cookieStore.clear();
    await loginWithPassword({ email: primaryEmail, password: "NewPassword456" });
  });

  it("isolates two companies from each other after independent registration", async () => {
    await registerCompanyOwner({
      companyName: "Auth Test Secondary Co",
      fullName: "Secondary Owner",
      email: secondaryEmail,
      password: PASSWORD,
    });

    const primaryUser = await prisma.user.findUniqueOrThrow({ where: { email: primaryEmail } });
    const secondaryUser = await prisma.user.findUniqueOrThrow({ where: { email: secondaryEmail } });

    expect(primaryUser.companyId).not.toBe(secondaryUser.companyId);

    cookieStore.clear();
    await prisma.user.update({ where: { email: secondaryEmail }, data: { emailVerifiedAt: new Date() } });
    await loginWithPassword({ email: secondaryEmail, password: PASSWORD });
    const secondaryActor = await getCurrentActor();
    expect(secondaryActor.companyId).toBe(secondaryUser.companyId);
    expect(secondaryActor.companyId).not.toBe(primaryUser.companyId);
  });
});
