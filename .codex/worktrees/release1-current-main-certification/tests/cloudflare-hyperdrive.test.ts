import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * These tests cover the Cloudflare Hyperdrive / driver-adapter runtime
 * selection layer in isolation, using a mocked `@opennextjs/cloudflare`
 * context — no real Cloudflare credentials or Worker runtime are required.
 * The "direct" (no Hyperdrive) path is also exercised implicitly by every
 * other integration test in this suite: they all import the real,
 * unmocked `prisma` singleton and successfully hit local Postgres, which
 * only works if `getHyperdriveBinding()` correctly resolves to `undefined`
 * outside a Cloudflare context.
 */

const getCloudflareContextMock = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => getCloudflareContextMock(...args),
}));

const { getHyperdriveBinding, isCloudflareRuntime } = await import("../src/lib/cloudflare/env");

describe("Cloudflare env accessor (mocked context)", () => {
  afterEach(() => {
    getCloudflareContextMock.mockReset();
  });

  it("returns undefined and reports non-Cloudflare when no context is available", () => {
    getCloudflareContextMock.mockImplementation(() => {
      throw new Error("no cloudflare context available");
    });

    expect(getHyperdriveBinding()).toBeUndefined();
    expect(isCloudflareRuntime()).toBe(false);
  });

  it("returns undefined when a Cloudflare context exists but has no Hyperdrive binding configured", () => {
    getCloudflareContextMock.mockReturnValue({ env: {}, cf: undefined, ctx: {} });

    expect(getHyperdriveBinding()).toBeUndefined();
    expect(isCloudflareRuntime()).toBe(true);
  });

  it("returns the Hyperdrive binding when a Cloudflare context provides one", () => {
    const hyperdrive = { connectionString: "postgresql://fake-hyperdrive-host/db" };
    getCloudflareContextMock.mockReturnValue({ env: { HYPERDRIVE: hyperdrive }, cf: undefined, ctx: {} });

    expect(getHyperdriveBinding()).toBe(hyperdrive);
    expect(isCloudflareRuntime()).toBe(true);
  });

  it("treats a malformed/invalid binding object the same as a missing one (no throw)", () => {
    // e.g. a binding key present but not actually a Hyperdrive resource
    getCloudflareContextMock.mockReturnValue({ env: { HYPERDRIVE: undefined }, cf: undefined, ctx: {} });

    expect(() => getHyperdriveBinding()).not.toThrow();
    expect(getHyperdriveBinding()).toBeUndefined();
  });
});
