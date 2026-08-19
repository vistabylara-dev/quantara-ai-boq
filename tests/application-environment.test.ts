import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applicationEnvironment } from "../src/lib/runtime/application-environment";

describe("applicationEnvironment (moved from platform-admin-service.ts — VERCEL_ENV ?? NODE_ENV precedence)", () => {
  beforeEach(() => {
    // @types/node marks NODE_ENV readonly — vi.stubEnv is this repo's established way to
    // override it in tests (see tests/autodesk-integration.test.ts), and vi.stubEnv(name,
    // undefined) deletes the key rather than setting a literal "undefined" string.
    vi.stubEnv("VERCEL_ENV", undefined);
    vi.stubEnv("NODE_ENV", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers VERCEL_ENV over NODE_ENV when both are set", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NODE_ENV", "development");
    expect(applicationEnvironment()).toBe("production");
  });

  it("falls back to NODE_ENV when VERCEL_ENV is unset", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(applicationEnvironment()).toBe("test");
  });

  it("recognizes preview and development", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(applicationEnvironment()).toBe("preview");
    vi.stubEnv("VERCEL_ENV", "development");
    expect(applicationEnvironment()).toBe("development");
  });

  it("returns 'unknown' for an unrecognized or missing value", () => {
    expect(applicationEnvironment()).toBe("unknown");
    vi.stubEnv("VERCEL_ENV", "staging");
    expect(applicationEnvironment()).toBe("unknown");
  });
});
