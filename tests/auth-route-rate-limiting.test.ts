import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mocks auth-service.ts (protected, not touched) so these tests exercise
 * only the rate-limiting layer added to each route — auth correctness
 * itself is already covered by tests/auth-service.test.ts. Every mocked
 * function resolves successfully; a request that gets past the rate
 * limiter always reaches (and succeeds through) the mocked auth call, so a
 * non-2xx response below can only be the rate limiter tripping.
 */
const {
  loginWithPassword,
  registerCompanyOwner,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  loginPlatformActor,
} = vi.hoisted(() => ({
  loginWithPassword: vi.fn().mockResolvedValue(undefined),
  registerCompanyOwner: vi.fn().mockResolvedValue({ userId: "u1", companyId: "c1" }),
  requestPasswordReset: vi.fn().mockResolvedValue(undefined),
  resetPassword: vi.fn().mockResolvedValue(undefined),
  verifyEmail: vi.fn().mockResolvedValue(undefined),
  loginPlatformActor: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/services/auth-service", () => ({
  loginWithPassword,
  registerCompanyOwner,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  loginPlatformActor,
}));

import { POST as loginPOST } from "@/app/api/auth/login/route";
import { POST as adminLoginPOST } from "@/app/api/auth/admin-login/route";
import { POST as registerPOST } from "@/app/api/auth/register/route";
import { POST as forgotPasswordPOST } from "@/app/api/auth/forgot-password/route";
import { POST as resetPasswordPOST } from "@/app/api/auth/reset-password/route";
import { POST as verifyEmailPOST } from "@/app/api/auth/verify-email/route";

function jsonRequest(url: string, payload: unknown, ip: string) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(payload),
  });
}

async function status(response: Response): Promise<number> {
  return response.status;
}

describe("auth route rate limiting", () => {
  beforeEach(() => {
    loginWithPassword.mockClear();
    registerCompanyOwner.mockClear();
    requestPasswordReset.mockClear();
    resetPassword.mockClear();
    verifyEmail.mockClear();
    loginPlatformActor.mockClear();
  });

  describe("POST /api/auth/login (IP: 10/5min, email: 5/15min — the tighter email limit trips first for a fixed email+IP pair)", () => {
    it("allows requests under the email limit, blocks the 6th with 429, and never blocks a different email from the same IP", async () => {
      const ip = "10.0.0.1";
      const email = `login-a-${Date.now()}@example.com`;

      for (let i = 0; i < 5; i += 1) {
        const res = await loginPOST(jsonRequest("http://localhost/api/auth/login", { email, password: "x" }, ip));
        expect(await status(res)).toBe(200);
      }

      const sixth = await loginPOST(jsonRequest("http://localhost/api/auth/login", { email, password: "x" }, ip));
      expect(await status(sixth)).toBe(429);
      const sixthBody = (await sixth.json()) as { error: { code: string } };
      expect(sixthBody.error.code).toBe("RATE_LIMITED");

      // A different email from the SAME IP must not be blocked by the
      // exhausted email's limit — proves the two limiter instances/keys
      // are genuinely independent, not a shared budget.
      const otherEmail = `login-b-${Date.now()}@example.com`;
      const different = await loginPOST(jsonRequest("http://localhost/api/auth/login", { email: otherEmail, password: "x" }, ip));
      expect(await status(different)).toBe(200);

      expect(loginWithPassword).toHaveBeenCalledTimes(6);
    });

    it("the IP dimension alone can also trip the limit, independent of email", async () => {
      const ip = "10.0.0.2";
      // 10 distinct emails from the same IP stay under the per-email limit
      // (5) each, but accumulate against the shared per-IP limit (10).
      for (let i = 0; i < 10; i += 1) {
        const res = await loginPOST(
          jsonRequest("http://localhost/api/auth/login", { email: `login-ip-${i}-${Date.now()}@example.com`, password: "x" }, ip),
        );
        expect(await status(res)).toBe(200);
      }
      const eleventh = await loginPOST(
        jsonRequest("http://localhost/api/auth/login", { email: `login-ip-11-${Date.now()}@example.com`, password: "x" }, ip),
      );
      expect(await status(eleventh)).toBe(429);
    });
  });

  describe("POST /api/auth/admin-login (same combined-key shape as login, separate limiter instance)", () => {
    it("allows requests under the email limit and blocks the 6th with 429", async () => {
      const ip = "10.0.1.1";
      const email = `admin-login-${Date.now()}@example.com`;

      for (let i = 0; i < 5; i += 1) {
        const res = await adminLoginPOST(jsonRequest("http://localhost/api/auth/admin-login", { email, password: "x" }, ip));
        expect(await status(res)).toBe(200);
      }
      const sixth = await adminLoginPOST(jsonRequest("http://localhost/api/auth/admin-login", { email, password: "x" }, ip));
      expect(await status(sixth)).toBe(429);

      const otherEmail = `admin-login-b-${Date.now()}@example.com`;
      const different = await adminLoginPOST(jsonRequest("http://localhost/api/auth/admin-login", { email: otherEmail, password: "x" }, ip));
      expect(await status(different)).toBe(200);
    });

    it("does not share a limiter instance with /api/auth/login — exhausting login's limit for an email never blocks the same email on admin-login", async () => {
      const ip = "10.0.1.2";
      const sharedEmail = `cross-route-${Date.now()}@example.com`;

      for (let i = 0; i < 6; i += 1) {
        await loginPOST(jsonRequest("http://localhost/api/auth/login", { email: sharedEmail, password: "x" }, ip));
      }
      // login is now exhausted for sharedEmail — admin-login must be unaffected.
      const res = await adminLoginPOST(jsonRequest("http://localhost/api/auth/admin-login", { email: sharedEmail, password: "x" }, ip));
      expect(await status(res)).toBe(200);
    });
  });

  describe("POST /api/auth/register (IP-only: 5/10min)", () => {
    it("allows requests under the limit, blocks the 6th with 429, and a different IP is unaffected", async () => {
      const ip = "10.0.2.1";
      const payload = { companyName: "Test Co", fullName: "Test User", email: "unused@example.com", password: "Password123" };

      for (let i = 0; i < 5; i += 1) {
        const res = await registerPOST(jsonRequest("http://localhost/api/auth/register", { ...payload, email: `reg-${i}-${Date.now()}@example.com` }, ip));
        expect(await status(res)).toBe(201);
      }
      const sixth = await registerPOST(jsonRequest("http://localhost/api/auth/register", { ...payload, email: `reg-6-${Date.now()}@example.com` }, ip));
      expect(await status(sixth)).toBe(429);

      const otherIp = "10.0.2.2";
      const different = await registerPOST(jsonRequest("http://localhost/api/auth/register", { ...payload, email: `reg-other-${Date.now()}@example.com` }, otherIp));
      expect(await status(different)).toBe(201);
    });
  });

  describe("POST /api/auth/forgot-password (IP: 5/10min, email: 5/10min)", () => {
    it("allows requests under the limit, blocks the 6th with 429, and a different email from the same IP is unaffected", async () => {
      const ip = "10.0.3.1";
      const email = `forgot-${Date.now()}@example.com`;

      for (let i = 0; i < 5; i += 1) {
        const res = await forgotPasswordPOST(jsonRequest("http://localhost/api/auth/forgot-password", { email }, ip));
        expect(await status(res)).toBe(200);
      }
      const sixth = await forgotPasswordPOST(jsonRequest("http://localhost/api/auth/forgot-password", { email }, ip));
      expect(await status(sixth)).toBe(429);

      // A different IP too — forgot-password's IP limit (5) is as tight as
      // its email limit, so reusing `ip` here would hit that instead and
      // prove nothing about the email dimension specifically.
      const otherEmail = `forgot-b-${Date.now()}@example.com`;
      const different = await forgotPasswordPOST(jsonRequest("http://localhost/api/auth/forgot-password", { email: otherEmail }, "10.0.3.9"));
      expect(await status(different)).toBe(200);
    });
  });

  describe("POST /api/auth/reset-password (IP-only: 10/10min)", () => {
    it("allows requests under the limit, blocks the 11th with 429, and a different IP is unaffected", async () => {
      const ip = "10.0.4.1";
      for (let i = 0; i < 10; i += 1) {
        const res = await resetPasswordPOST(jsonRequest("http://localhost/api/auth/reset-password", { token: `tok-${i}`, password: "Password123" }, ip));
        expect(await status(res)).toBe(200);
      }
      const eleventh = await resetPasswordPOST(jsonRequest("http://localhost/api/auth/reset-password", { token: "tok-11", password: "Password123" }, ip));
      expect(await status(eleventh)).toBe(429);

      const otherIp = "10.0.4.2";
      const different = await resetPasswordPOST(jsonRequest("http://localhost/api/auth/reset-password", { token: "tok-other", password: "Password123" }, otherIp));
      expect(await status(different)).toBe(200);
    });
  });

  describe("POST /api/auth/verify-email (IP-only: 10/10min)", () => {
    it("allows requests under the limit, blocks the 11th with 429, and a different IP is unaffected", async () => {
      const ip = "10.0.5.1";
      for (let i = 0; i < 10; i += 1) {
        const res = await verifyEmailPOST(jsonRequest("http://localhost/api/auth/verify-email", { token: `tok-${i}` }, ip));
        expect(await status(res)).toBe(200);
      }
      const eleventh = await verifyEmailPOST(jsonRequest("http://localhost/api/auth/verify-email", { token: "tok-11" }, ip));
      expect(await status(eleventh)).toBe(429);

      const otherIp = "10.0.5.2";
      const different = await verifyEmailPOST(jsonRequest("http://localhost/api/auth/verify-email", { token: "tok-other" }, otherIp));
      expect(await status(different)).toBe(200);
    });
  });
});
