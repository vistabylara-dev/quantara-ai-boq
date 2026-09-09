import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { reserveSalesAttempt } from "../src/lib/repositories/sales-agent-budget-repository";

// Run through the repository's isolated database test runner/CI only.
const isolated = Boolean(process.env.TEST_DATABASE_URL)
  && /(?:localhost|127\.0\.0\.1)/.test(process.env.DATABASE_URL ?? "");
const period = "2199-01";
const now = new Date("2199-01-15T10:00:00Z");
async function cleanup() {
  await prisma.$executeRaw`DELETE FROM "SalesAgentAttempt" WHERE "period" = ${period}`;
  await prisma.$executeRaw`DELETE FROM "SalesAgentBudget" WHERE "period" = ${period}`;
}

describe.skipIf(!isolated)("sales allowance across concurrent PostgreSQL transactions", () => {
  beforeEach(cleanup);
  afterAll(cleanup);
  it("permits only one call when concurrent requests compete for the last allowance", async () => {
    await prisma.$executeRaw`INSERT INTO "SalesAgentBudget" ("period", "reservedFils") VALUES (${period}, 4990)`;
    const decisions = await Promise.all(Array.from({ length: 12 }, (_, index) => reserveSalesAttempt(randomUUID(), `test-ip-${index}`, now)));
    expect(decisions.filter(Boolean)).toHaveLength(1);
    const [row] = await prisma.$queryRaw<Array<{ reservedFils: number }>>`SELECT "reservedFils" FROM "SalesAgentBudget" WHERE "period" = ${period}`;
    expect(row.reservedFils).toBe(5000);
  });
  it("charges a repeated request ID only once", async () => {
    const id = randomUUID();
    const decisions = await Promise.all(Array.from({ length: 8 }, () => reserveSalesAttempt(id, "test-ip", now)));
    expect(decisions.filter(Boolean)).toHaveLength(1);
    const [row] = await prisma.$queryRaw<Array<{ reservedFils: number }>>`SELECT "reservedFils" FROM "SalesAgentBudget" WHERE "period" = ${period}`;
    expect(row.reservedFils).toBe(10);
  });
  it("enforces the daily per-IP cap across parallel calls", async () => {
    const decisions = await Promise.all(Array.from({ length: 12 }, () => reserveSalesAttempt(randomUUID(), "test-ip", now)));
    expect(decisions.filter(Boolean)).toHaveLength(10);
  });
});
