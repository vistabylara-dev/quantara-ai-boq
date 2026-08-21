import { PlatformRole, UserRole } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { safeAdminNext } from "../src/app/admin/login/safe-next";

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

const isPlatformActorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/platform-authorization", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/platform-authorization")>();
  return { ...actual, isPlatformActor: isPlatformActorMock };
});

const redirectMock = vi.hoisted(() =>
  vi.fn((destination: string): never => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
);
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return { ...actual, redirect: redirectMock };
});

const { prisma } = await import("../src/lib/db/prisma");
const { loginPlatformActor, loginWithPassword } = await import("../src/lib/services/auth-service");
const { POST: adminLoginPOST } = await import("../src/app/api/auth/admin-login/route");
const AdminLoginPage = (await import("../src/app/admin/login/page")).default;

const RUN_ID = Date.now();
const PASSWORD = "Password123";
let companyId = "";
const emails = {
  owner: `admin-login-owner-${RUN_ID}@example.com`,
  support: `admin-login-support-${RUN_ID}@example.com`,
  unverified: `admin-login-unverified-${RUN_ID}@example.com`,
  inactive: `admin-login-inactive-${RUN_ID}@example.com`,
  normal: `admin-login-normal-${RUN_ID}@example.com`,
};
const userIds: string[] = [];

describe("platform-admin login (integration, real local Postgres)", () => {
  beforeEach(() => {
    cookieStore.clear();
    isPlatformActorMock.mockReset();
    redirectMock.mockClear();
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.platformAuditLog.deleteMany({ where: { targetId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (companyId) await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it("sets up shared fixtures", async () => {
    const company = await prisma.company.create({
      data: {
        legalName: `Admin Login Test Co ${RUN_ID}`,
        tradeName: `Admin Login Test Co ${RUN_ID}`,
        email: `admin-login-company-${RUN_ID}@example.com`,
      },
    });
    companyId = company.id;

    const { hashPassword } = await import("../src/lib/auth/password");
    const passwordHash = await hashPassword(PASSWORD);

    const created = await prisma.$transaction([
      prisma.user.create({
        data: {
          companyId,
          email: emails.owner,
          passwordHash,
          fullName: "Owner Fixture",
          role: UserRole.COMPANY_OWNER,
          platformRole: PlatformRole.PLATFORM_OWNER,
          emailVerifiedAt: new Date(),
          isActive: true,
        },
      }),
      prisma.user.create({
        data: {
          companyId,
          email: emails.support,
          passwordHash,
          fullName: "Support Fixture",
          role: UserRole.REVIEWER,
          platformRole: PlatformRole.PLATFORM_SUPPORT,
          emailVerifiedAt: new Date(),
          isActive: true,
        },
      }),
      prisma.user.create({
        data: {
          companyId,
          email: emails.unverified,
          passwordHash,
          fullName: "Unverified Platform Fixture",
          role: UserRole.ESTIMATOR,
          platformRole: PlatformRole.PLATFORM_SUPPORT,
          emailVerifiedAt: null,
          isActive: true,
        },
      }),
      prisma.user.create({
        data: {
          companyId,
          email: emails.inactive,
          passwordHash,
          fullName: "Inactive Platform Fixture",
          role: UserRole.ESTIMATOR,
          platformRole: PlatformRole.PLATFORM_SUPPORT,
          emailVerifiedAt: new Date(),
          isActive: false,
        },
      }),
      prisma.user.create({
        data: {
          companyId,
          email: emails.normal,
          passwordHash,
          fullName: "Normal Company Fixture",
          role: UserRole.COMPANY_OWNER,
          emailVerifiedAt: new Date(),
          isActive: true,
        },
      }),
    ]);
    created.forEach((u) => userIds.push(u.id));
  });

  it("blocks an open redirect and only ever targets /admin", () => {
    expect(safeAdminNext("/admin/settings")).toBe("/admin/settings");
    expect(safeAdminNext("/admin")).toBe("/admin");
    expect(safeAdminNext(null)).toBe("/admin");
    expect(safeAdminNext(undefined)).toBe("/admin");
    expect(safeAdminNext("/dashboard")).toBe("/admin");
    expect(safeAdminNext("https://evil.example.com")).toBe("/admin");
    expect(safeAdminNext("//evil.example.com")).toBe("/admin");
  });

  it("signs in a valid platform owner and creates a session", async () => {
    await loginPlatformActor({ email: emails.owner, password: PASSWORD });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: emails.owner } });
    const sessions = await prisma.session.findMany({ where: { userId: user.id } });
    expect(sessions).toHaveLength(1);
    expect(cookieStore.has("quantara_session")).toBe(true);
  });

  it("rejects a valid ordinary company user generically and leaves no session", async () => {
    cookieStore.clear();
    await expect(
      loginPlatformActor({ email: emails.normal, password: PASSWORD }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS", status: 401 });

    const user = await prisma.user.findUniqueOrThrow({ where: { email: emails.normal } });
    const sessions = await prisma.session.findMany({ where: { userId: user.id } });
    expect(sessions).toHaveLength(0);
    expect(cookieStore.has("quantara_session")).toBe(false);

    // Ordinary login through the normal service is completely unaffected.
    await loginWithPassword({ email: emails.normal, password: PASSWORD });
    const sessionsAfterNormalLogin = await prisma.session.findMany({ where: { userId: user.id } });
    expect(sessionsAfterNormalLogin).toHaveLength(1);
  });

  it("fails generically on the wrong password", async () => {
    cookieStore.clear();
    await expect(
      loginPlatformActor({ email: emails.owner, password: "WrongPassword1" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS", status: 401 });
  });

  it("denies an unverified platform-role account", async () => {
    cookieStore.clear();
    await expect(
      loginPlatformActor({ email: emails.unverified, password: PASSWORD }),
    ).rejects.toMatchObject({ code: "EMAIL_NOT_VERIFIED", status: 403 });
  });

  it("denies an inactive platform-role account", async () => {
    cookieStore.clear();
    await expect(
      loginPlatformActor({ email: emails.inactive, password: PASSWORD }),
    ).rejects.toMatchObject({ code: "ACCOUNT_PENDING_APPROVAL", status: 403 });
  });

  it("POST /api/auth/admin-login succeeds for a platform owner and fails generically otherwise", async () => {
    cookieStore.clear();
    const ok = await adminLoginPOST(
      new Request("http://localhost/api/auth/admin-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: emails.owner, password: PASSWORD }),
      }),
    );
    expect(ok.status).toBe(200);
    await expect(ok.json()).resolves.toMatchObject({ ok: true, data: { signedIn: true } });

    cookieStore.clear();
    const rejected = await adminLoginPOST(
      new Request("http://localhost/api/auth/admin-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: emails.normal, password: PASSWORD }),
      }),
    );
    expect(rejected.status).toBe(401);
    await expect(rejected.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_CREDENTIALS" },
    });
  });

  it("/admin/login redirects an already-authenticated platform actor to a safe destination", async () => {
    isPlatformActorMock.mockResolvedValue(true);
    await expect(
      AdminLoginPage({ searchParams: Promise.resolve({ next: "/admin/settings" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/admin/settings");
    expect(redirectMock).toHaveBeenCalledWith("/admin/settings");
  });

  it("/admin/login renders the form for anyone without platform access", async () => {
    isPlatformActorMock.mockResolvedValue(false);
    const result = await AdminLoginPage({ searchParams: Promise.resolve({}) });
    expect(result).toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
