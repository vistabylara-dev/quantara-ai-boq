import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * EMAIL-SAFETY-GUARD — the module-level "already logged" flag lives inside
 * get-email-provider.ts itself, so each test re-imports it fresh via
 * vi.resetModules()/dynamic import to get an unset flag, rather than relying
 * on test execution order within this file. NODE_ENV is readonly per
 * @types/node, so env overrides use vi.stubEnv/vi.unstubAllEnvs (see
 * tests/autodesk-integration.test.ts for the same pattern).
 */
describe("get-email-provider.ts: EMAIL-SAFETY-GUARD one-time production log", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VERCEL_ENV", undefined);
    vi.stubEnv("NODE_ENV", undefined);
    vi.stubEnv("EMAIL_PROVIDER", undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("logs exactly once across multiple calls when production + no SMTP, and never changes the returned provider", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { getEmailProvider } = await import("../src/lib/email/get-email-provider");
    const { developmentEmailProvider } = await import("../src/lib/email/development-email-provider");

    const first = getEmailProvider();
    const second = getEmailProvider();
    const third = getEmailProvider();

    expect(first).toBe(developmentEmailProvider);
    expect(second).toBe(developmentEmailProvider);
    expect(third).toBe(developmentEmailProvider);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [message] = errorSpy.mock.calls[0] as [string];
    expect(message).toContain("[EMAIL-SAFETY]");
    expect(message).toContain("PRODUCTION");
    expect(message).toContain("EMAIL_PROVIDER=smtp");
  });

  it("logs nothing when the environment is not production (development)", async () => {
    vi.stubEnv("VERCEL_ENV", "development");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { getEmailProvider } = await import("../src/lib/email/get-email-provider");

    getEmailProvider();
    getEmailProvider();

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("logs nothing when the environment resolves to 'unknown' (never assumes production)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { getEmailProvider } = await import("../src/lib/email/get-email-provider");

    getEmailProvider();

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("logs nothing when SMTP is configured, even in production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("EMAIL_PROVIDER", "smtp");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { getEmailProvider } = await import("../src/lib/email/get-email-provider");
    const { smtpEmailProvider } = await import("../src/lib/email/smtp-email-provider");

    const result = getEmailProvider();

    expect(result).toBe(smtpEmailProvider);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
