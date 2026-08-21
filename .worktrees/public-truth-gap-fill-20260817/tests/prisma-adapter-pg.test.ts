import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@prisma/client";
// Imported for its side effect only: it pulls in `@prisma/client`, which
// loads `DATABASE_URL` from `.env` the same way every other integration
// test in this suite already relies on.
import "../src/lib/db/prisma";

/**
 * Verifies the `@prisma/adapter-pg` driver-adapter path independently of
 * Cloudflare/Hyperdrive: a plain `pg.Pool` against the same local Postgres
 * every other test uses, wrapped in `PrismaPg`, wired into a *separate*
 * `PrismaClient` instance (not the app's canonical singleton). This proves
 * the adapter mechanism itself works — the Hyperdrive-specific wiring
 * around it (env.HYPERDRIVE.connectionString) is covered by
 * tests/cloudflare-hyperdrive.test.ts and tests/health-ready-routes.test.ts
 * using a mocked binding, since no real Hyperdrive resource exists yet.
 */
describe("Prisma driver adapter (@prisma/adapter-pg) against real local Postgres", () => {
  let pool: Pool;
  let adapterClient: PrismaClient;

  beforeAll(() => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL must be set for the adapter-pg integration test");
    }
    pool = new Pool({ connectionString, max: 5 });
    const adapter = new PrismaPg(pool);
    adapterClient = new PrismaClient({ adapter });
  });

  afterAll(async () => {
    await adapterClient.$disconnect();
    await pool.end();
  });

  it("executes a simple query through the adapter", async () => {
    const result = await adapterClient.$queryRaw<Array<{ value: number }>>`SELECT 1 as value`;
    expect(result).toEqual([{ value: 1 }]);
  });

  it("executes a transaction through the adapter", async () => {
    const [a, b] = await adapterClient.$transaction([
      adapterClient.$queryRaw<Array<{ value: number }>>`SELECT 1 as value`,
      adapterClient.$queryRaw<Array<{ value: number }>>`SELECT 2 as value`,
    ]);
    expect(a).toEqual([{ value: 1 }]);
    expect(b).toEqual([{ value: 2 }]);
  });

  it("can read real application data through the adapter (e.g. software plans, seeded/created by other tests)", async () => {
    const count = await adapterClient.softwarePlan.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
