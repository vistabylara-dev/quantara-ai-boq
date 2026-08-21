import { describe, expect, it, vi } from "vitest";

/**
 * Verified empirically against the real OpenNext build via `wrangler dev`:
 * inside an actual Cloudflare Worker, the standard Prisma Client's binary
 * query engine cannot load at all ("could not locate the Query Engine for
 * runtime debian-openssl-1.1.x"). So unlike Node.js — where no Hyperdrive
 * binding just means "use DATABASE_URL directly" — a Worker with no
 * Hyperdrive binding must fail fast with an explicit, actionable error
 * instead of silently attempting (and cryptically failing) that fallback.
 */
vi.mock("../src/lib/cloudflare/env", () => ({
  getHyperdriveBinding: () => undefined,
  isCloudflareRuntime: () => true,
}));

describe("Prisma factory: Cloudflare runtime without a Hyperdrive binding", () => {
  it("throws HyperdriveNotConfiguredError instead of attempting the Node.js binary-engine fallback", async () => {
    const { prisma, HyperdriveNotConfiguredError } = await import("../src/lib/db/prisma");
    expect(() => prisma.$queryRaw).toThrow(HyperdriveNotConfiguredError);
    expect(() => prisma.$queryRaw).toThrow(/HYPERDRIVE binding is configured/);
  });
});
