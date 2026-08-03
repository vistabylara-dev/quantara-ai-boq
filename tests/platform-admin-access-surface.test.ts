import { readFileSync } from "node:fs";
import path from "node:path";
import { PlatformRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePlatformActorMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((destination: string): never => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
);

vi.mock("@/lib/auth/platform-authorization", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../src/lib/auth/platform-authorization")
  >();
  return {
    ...actual,
    requirePlatformActor: requirePlatformActorMock,
  };
});

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return { ...actual, redirect: redirectMock };
});

import AdminLayout from "../src/app/admin/(protected)/layout";
import {
  PlatformAuthorizationError,
  type PlatformActor,
} from "../src/lib/auth/platform-authorization";
import { UnauthorizedError } from "../src/lib/errors/app-error";

const userMenuPath = path.resolve(__dirname, "../src/components/layout/user-menu.tsx");
const sessionRoutePath = path.resolve(__dirname, "../src/app/api/auth/session/route.ts");

describe("platform administration access surface", () => {
  beforeEach(() => {
    requirePlatformActorMock.mockReset();
    redirectMock.mockClear();
  });

  it("redirects an unauthenticated /admin request to login on the server", async () => {
    requirePlatformActorMock.mockRejectedValue(new UnauthorizedError());

    await expect(AdminLayout({ children: "protected admin content" })).rejects.toThrow(
      "NEXT_REDIRECT:/admin/login?next=/admin",
    );
    expect(requirePlatformActorMock).toHaveBeenCalledOnce();
    expect(redirectMock).toHaveBeenCalledWith("/admin/login?next=/admin");
  });

  it("redirects a normal company-role user safely away from /admin", async () => {
    requirePlatformActorMock.mockRejectedValue(
      new PlatformAuthorizationError(
        "This account does not have platform access.",
        "PLATFORM_ROLE_REQUIRED",
      ),
    );

    await expect(AdminLayout({ children: "protected admin content" })).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
    expect(requirePlatformActorMock).toHaveBeenCalledOnce();
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("renders children only after the server helper authorizes a platform actor", async () => {
    const platformActor: PlatformActor = {
      userId: "00000000-0000-4000-8000-000000000001",
      companyId: "00000000-0000-4000-8000-000000000002",
      platformRole: PlatformRole.PLATFORM_SUPPORT,
      fullName: "Authorized support user",
      email: "authorized-support@example.com",
    };
    requirePlatformActorMock.mockResolvedValue(platformActor);

    await expect(AdminLayout({ children: "protected admin content" })).resolves.toBe(
      "protected admin content",
    );
    expect(requirePlatformActorMock).toHaveBeenCalledOnce();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("shows the single Platform Admin link only inside the non-null platform-role condition", () => {
    const source = readFileSync(userMenuPath, "utf8");
    const conditionalAdminLink =
      /\{user\.platformRole\s*&&\s*\([\s\S]*?href="\/admin"[\s\S]*?Platform Admin[\s\S]*?<\/Link>[\s\S]*?\)\}/;

    expect(source).toMatch(conditionalAdminLink);
    expect(source.match(/href="\/admin"/g)).toHaveLength(1);
    expect(source).toMatch(/platformRole:\s*"PLATFORM_OWNER"\s*\|\s*"PLATFORM_ADMIN"\s*\|\s*"PLATFORM_SUPPORT"\s*\|\s*null/);
  });

  it("derives navigation visibility from a fresh, allow-listed session field without secrets", () => {
    const source = readFileSync(sessionRoutePath, "utf8");

    expect(source).toContain("platformIdentity?.isActive && platformIdentity.emailVerifiedAt");
    expect(source).toContain("? platformIdentity.platformRole");
    expect(source).toContain(": null");
    expect(source).not.toMatch(/select:\s*\{[\s\S]*?passwordHash:\s*true/);
    expect(source).not.toMatch(/select:\s*\{[\s\S]*?tokenHash:\s*true/);
  });
});
