import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPlatformEnvironmentBanner } from "../src/lib/services/platform-admin-service";
import { EnvironmentSafetyBanner } from "../src/components/admin/environment-safety-banner";

describe("getPlatformEnvironmentBanner (platform-admin-service.ts)", () => {
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalEmailProvider = process.env.EMAIL_PROVIDER;

  afterEach(() => {
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
    if (originalEmailProvider === undefined) delete process.env.EMAIL_PROVIDER;
    else process.env.EMAIL_PROVIDER = originalEmailProvider;
  });

  it("returns the current applicationEnvironment and emailProvider as a plain object", () => {
    process.env.VERCEL_ENV = "production";
    delete process.env.EMAIL_PROVIDER;
    expect(getPlatformEnvironmentBanner()).toEqual({
      applicationEnvironment: "production",
      emailProvider: "development",
    });

    process.env.EMAIL_PROVIDER = "smtp";
    expect(getPlatformEnvironmentBanner()).toEqual({
      applicationEnvironment: "production",
      emailProvider: "smtp",
    });
  });
});

describe("EnvironmentSafetyBanner: renders in exactly one of the four meaningful combinations", () => {
  beforeEach(() => {
    delete process.env.VERCEL_ENV;
    delete process.env.EMAIL_PROVIDER;
  });

  it("renders the warning banner for production + development (the dangerous combination)", () => {
    const result = EnvironmentSafetyBanner({ applicationEnvironment: "production", emailProvider: "development" });
    expect(result).not.toBeNull();
  });

  it("renders nothing (null, not a hidden element) for production + smtp", () => {
    const result = EnvironmentSafetyBanner({ applicationEnvironment: "production", emailProvider: "smtp" });
    expect(result).toBeNull();
  });

  it("renders nothing for development + development", () => {
    const result = EnvironmentSafetyBanner({ applicationEnvironment: "development", emailProvider: "development" });
    expect(result).toBeNull();
  });

  it("renders nothing for preview + development", () => {
    const result = EnvironmentSafetyBanner({ applicationEnvironment: "preview", emailProvider: "development" });
    expect(result).toBeNull();
  });

  it("renders nothing for test + development and unknown + development (every other environment value)", () => {
    expect(EnvironmentSafetyBanner({ applicationEnvironment: "test", emailProvider: "development" })).toBeNull();
    expect(EnvironmentSafetyBanner({ applicationEnvironment: "unknown", emailProvider: "development" })).toBeNull();
  });

  it("renders nothing for development/preview/test/unknown + smtp (the other four combinations)", () => {
    expect(EnvironmentSafetyBanner({ applicationEnvironment: "development", emailProvider: "smtp" })).toBeNull();
    expect(EnvironmentSafetyBanner({ applicationEnvironment: "preview", emailProvider: "smtp" })).toBeNull();
    expect(EnvironmentSafetyBanner({ applicationEnvironment: "test", emailProvider: "smtp" })).toBeNull();
    expect(EnvironmentSafetyBanner({ applicationEnvironment: "unknown", emailProvider: "smtp" })).toBeNull();
  });
});
