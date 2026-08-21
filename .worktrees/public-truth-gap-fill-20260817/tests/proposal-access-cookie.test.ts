import { afterEach, describe, expect, it, vi } from "vitest";
import { createAccessGrant, verifyAccessGrant } from "@/lib/proposals/access-cookie";

describe("proposal access grants", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed when the production secret is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PROPOSAL_ACCESS_SECRET", "");

    expect(() => createAccessGrant("proposal-1")).toThrow(/must be configured/i);
  });

  it("rejects the public development fallback in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PROPOSAL_ACCESS_SECRET", "dev-only-proposal-access-secret-not-for-production");

    expect(() => createAccessGrant("proposal-1")).toThrow(/must be configured/i);
  });

  it("rejects a short production secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PROPOSAL_ACCESS_SECRET", "too-short");

    expect(() => createAccessGrant("proposal-1")).toThrow(/at least 32 bytes/i);
  });

  it("round-trips a grant with a configured production secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PROPOSAL_ACCESS_SECRET", "a-production-secret-with-at-least-thirty-two-bytes");

    const grant = createAccessGrant("proposal-1");
    expect(verifyAccessGrant(grant, "proposal-1")).toBe(true);
    expect(verifyAccessGrant(grant, "proposal-2")).toBe(false);
  });

  it("keeps the fallback limited to non-production use", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PROPOSAL_ACCESS_SECRET", "");

    const grant = createAccessGrant("proposal-1");
    expect(verifyAccessGrant(grant, "proposal-1")).toBe(true);
  });
});