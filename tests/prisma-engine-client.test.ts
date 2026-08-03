import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

/**
 * Locks in a behavior discovered empirically while migrating off the
 * native Rust query engine (which cannot load inside the Cloudflare
 * Workers V8 isolate): with `engineType = "client"` in schema.prisma, the
 * generated client uses Prisma's WASM query compiler and refuses to
 * construct at all without a driver adapter. This is the invariant that
 * makes `src/lib/db/prisma.ts` mandatory-adapter on *every* path (Node
 * direct and Cloudflare Hyperdrive alike) — if this test ever starts
 * failing, either `engineType` reverted to the default `"library"` engine
 * (reintroducing the native-binary dependency) or the generated client's
 * adapter requirement changed.
 */
describe("generated Prisma client (engineType client)", () => {
  it("throws immediately when constructed without a driver adapter", () => {
    expect(() => new PrismaClient()).toThrow(/driver adapter/i);
  });
});
