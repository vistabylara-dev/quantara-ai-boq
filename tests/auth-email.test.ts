import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const sendEmailMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email/get-email-provider", () => ({
  getEmailProvider: () => ({ providerName: "mock", sendEmail: sendEmailMock, validateConfiguration: () => ({ valid: true, errors: [] }) }),
}));

const { prisma } = await import("../src/lib/db/prisma");
const { appBaseUrl } = await import("../src/lib/auth/dev-mailer");
const { registerCompanyOwner, requestPasswordReset } = await import("../src/lib/services/auth-service");
const { buildVerificationEmail, buildPasswordResetEmail } = await import("../src/lib/email/auth-email-templates");
const { smtpEmailProvider } = await import("../src/lib/email/smtp-email-provider");
const { getEmailProvider: realGetEmailProvider } = await vi.importActual<
  typeof import("../src/lib/email/get-email-provider")
>("../src/lib/email/get-email-provider");

const RUN_ID = Date.now();
const REGISTER_EMAIL = `auth-email-register-${RUN_ID}@example.com`;
const RESET_EMAIL = `auth-email-reset-${RUN_ID}@example.com`;
const UNKNOWN_EMAIL = `auth-email-unknown-${RUN_ID}@example.com`;
let registeredCompanyId = "";

function resetSmtpEnv() {
  for (const key of [
    "EMAIL_PROVIDER",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM_EMAIL",
    "SMTP_FROM_NAME",
  ]) {
    delete process.env[key];
  }
}

describe("authentication emails (integration, real local Postgres)", () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue({ status: "DEVELOPMENT_CAPTURED", providerMessageId: "mock-id" });
    cookieStore.clear();
  });

  afterEach(() => {
    resetSmtpEnv();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [REGISTER_EMAIL, RESET_EMAIL] } } });
    await prisma.company.deleteMany({ where: { email: { in: [REGISTER_EMAIL, RESET_EMAIL] } } });
    await prisma.$disconnect();
  });

  describe("provider selection", () => {
    it("selects smtpEmailProvider only when EMAIL_PROVIDER=smtp, development otherwise", () => {
      resetSmtpEnv();
      expect(realGetEmailProvider().providerName).toBe("development");

      process.env.EMAIL_PROVIDER = "smtp";
      expect(realGetEmailProvider().providerName).toBe("smtp");

      process.env.EMAIL_PROVIDER = "something-else";
      expect(realGetEmailProvider().providerName).toBe("development");
    });

    it("accepts a full SpaceMail-shaped SMTP configuration as valid", () => {
      resetSmtpEnv();
      process.env.SMTP_HOST = "mail.spacemail.com";
      process.env.SMTP_PORT = "465";
      process.env.SMTP_SECURE = "true";
      process.env.SMTP_USER = "solution@vistabylara.com";
      process.env.SMTP_PASSWORD = "placeholder-not-a-real-password";
      process.env.SMTP_FROM_EMAIL = "solution@vistabylara.com";
      process.env.SMTP_FROM_NAME = "Quantara AI BOQ";

      expect(smtpEmailProvider.validateConfiguration()).toEqual({ valid: true, errors: [] });
    });

    it("fails safely (no network attempt, no leaked value) when SMTP_PASSWORD is missing", async () => {
      resetSmtpEnv();
      process.env.SMTP_HOST = "mail.spacemail.com";
      process.env.SMTP_PORT = "465";
      process.env.SMTP_USER = "solution@vistabylara.com";
      process.env.SMTP_FROM_EMAIL = "solution@vistabylara.com";
      // SMTP_PASSWORD intentionally left unset.

      const result = await smtpEmailProvider.sendEmail({
        to: "someone@example.com",
        subject: "Test",
        html: "<p>test</p>",
        text: "test",
      });

      expect(result.status).toBe("FAILED");
      expect(result.errorCode).toBe("SMTP_NOT_CONFIGURED");
      expect(result.errorMessage).toContain("SMTP_PASSWORD is not set");
      expect(result.errorMessage).not.toContain("placeholder");
    });
  });

  describe("templates", () => {
    it("builds a verification email with both HTML and plain-text bodies containing the link", () => {
      const url = `${appBaseUrl()}/verify-email?token=sample-token-value`;
      const email = buildVerificationEmail(url);

      expect(email.subject).toBe("Verify your Quantara account");
      expect(email.html).toContain(url);
      expect(email.html).toMatch(/<html/i);
      expect(email.text).toContain(url);
      expect(email.text).not.toMatch(/<[a-z]+>/i);
    });

    it("builds a password-reset email with both HTML and plain-text bodies containing the link", () => {
      const url = `${appBaseUrl()}/reset-password?token=sample-token-value`;
      const email = buildPasswordResetEmail(url);

      expect(email.subject).toBe("Reset your Quantara password");
      expect(email.html).toContain(url);
      expect(email.html).toMatch(/<html/i);
      expect(email.text).toContain(url);
      expect(email.text).not.toMatch(/<[a-z]+>/i);
    });
  });

  describe("auth flows send through getEmailProvider()", () => {
    it("sends a verification email whose link uses APP_BASE_URL when a company registers", async () => {
      const result = await registerCompanyOwner({
        companyName: "Auth Email Test Co",
        fullName: "Register Owner",
        email: REGISTER_EMAIL,
        password: "Password123",
      });
      registeredCompanyId = result.companyId;

      expect(sendEmailMock).toHaveBeenCalledTimes(2);
      const call = sendEmailMock.mock.calls.map(([email]) => email)
        .find((email) => email.subject === "Verify your Quantara account")!;
      expect(call.to).toBe(REGISTER_EMAIL.toLowerCase());
      expect(call.subject).toBe("Verify your Quantara account");
      expect(call.html).toContain(appBaseUrl());
      expect(call.text).toContain(appBaseUrl());
      expect(call.html).toContain("/verify-email?token=");

      const approvalCall = sendEmailMock.mock.calls.map(([email]) => email)
        .find((email) => email.subject === "New Early Access Request: Auth Email Test Co")!;
      expect(approvalCall.to).toBe(process.env.DEV_OWNER_EMAIL || "admin@quantara.ai");
      expect(approvalCall.html).toContain(`/admin/users/${result.userId}`);
    });

    it("sends a password-reset email for a known account, with a link using APP_BASE_URL", async () => {
      await prisma.user.create({
        data: {
          companyId: registeredCompanyId,
          email: RESET_EMAIL,
          passwordHash: "irrelevant-hash-for-this-test",
          fullName: "Reset Target",
          emailVerifiedAt: new Date(),
        },
      });

      await requestPasswordReset(RESET_EMAIL);

      expect(sendEmailMock).toHaveBeenCalledTimes(1);
      const call = sendEmailMock.mock.calls[0]![0];
      expect(call.to).toBe(RESET_EMAIL);
      expect(call.subject).toBe("Reset your Quantara password");
      expect(call.html).toContain(appBaseUrl());
      expect(call.html).toContain("/reset-password?token=");
    });

    it("stays completely generic for an unknown account (no email attempted, no error)", async () => {
      await expect(requestPasswordReset(UNKNOWN_EMAIL)).resolves.toBeUndefined();
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("never logs the raw token anywhere, even when delivery fails", async () => {
      sendEmailMock.mockResolvedValue({ status: "FAILED", errorCode: "SMTP_SEND_FAILED", errorMessage: "safe summary" });
      const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const logSpy2 = vi.spyOn(console, "log").mockImplementation(() => undefined);

      await requestPasswordReset(RESET_EMAIL);

      const allLoggedText = [...logSpy.mock.calls, ...logSpy2.mock.calls].flat().map((v) => JSON.stringify(v)).join("\n");
      const sentCall = sendEmailMock.mock.calls.at(-1)![0];
      const tokenFragment = sentCall.text.match(/token=([^\s"']+)/)?.[1];
      expect(tokenFragment).toBeTruthy();
      expect(allLoggedText).not.toContain(tokenFragment);

      logSpy.mockRestore();
      logSpy2.mockRestore();
    });
  });

  it("never interpolates the SMTP password into any error/log path in the provider source", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../src/lib/email/smtp-email-provider.ts"),
      "utf8",
    );
    // The password may only ever appear as the `pass` field of the transporter's
    // auth object — never inside a template literal that builds an error message
    // or a console call.
    const passwordUsages = [...source.matchAll(/config\.password/g)];
    expect(passwordUsages.length).toBeGreaterThan(0);
    expect(source).not.toMatch(/errorMessage.*config\.password/s);
    expect(source).not.toMatch(/console\.[a-z]+\([^)]*config\.password/s);
  });
});
