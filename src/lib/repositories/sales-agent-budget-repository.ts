import { prisma } from "@/lib/db/prisma";
import { REQUEST_RESERVE_FILS, salesPeriod, withinSalesLimits } from "@/lib/sales-agent/policy";

/** Global owner-funded budget, deliberately not charged to customer tenants.
 * One row lock serialises all replicas. Reservation commits BEFORE the API call.
 * Idempotency IDs are global; retries never issue another paid request.
 */
export async function reserveSalesAttempt(id: string, ipHash: string, now = new Date()) {
  const { month, day } = salesPeriod(now);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO "SalesAgentBudget" ("period") VALUES (${month}) ON CONFLICT DO NOTHING`;
    const rows = await tx.$queryRaw<Array<{ reservedFils: number }>>`
      SELECT "reservedFils" FROM "SalesAgentBudget" WHERE "period" = ${month} FOR UPDATE`;
    const duplicate = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "SalesAgentAttempt" WHERE "id" = ${id}`;
    if (duplicate.length) return false;
    const [counts] = await tx.$queryRaw<Array<{ total: number; perIp: number }>>`
      SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE "ipHash" = ${ipHash})::int AS "perIp"
      FROM "SalesAgentAttempt" WHERE "day" = ${day}`;
    if (!rows[0] || !withinSalesLimits(rows[0].reservedFils, counts.total, counts.perIp)) return false;
    await tx.$executeRaw`INSERT INTO "SalesAgentAttempt" ("id", "period", "day", "ipHash", "reservedFils")
      VALUES (${id}, ${month}, ${day}, ${ipHash}, ${REQUEST_RESERVE_FILS})`;
    await tx.$executeRaw`UPDATE "SalesAgentBudget" SET "reservedFils" = "reservedFils" + ${REQUEST_RESERVE_FILS} WHERE "period" = ${month}`;
    return true;
  });
}

export async function finishSalesAttempt(id: string, status: "COMPLETED" | "FAILED") {
  await prisma.$executeRaw`UPDATE "SalesAgentAttempt" SET "status" = ${status} WHERE "id" = ${id}`;
}

export async function readSalesBudget() {
  const { month } = salesPeriod();
  const rows = await prisma.$queryRaw<Array<{ reservedFils: number }>>`
    SELECT "reservedFils" FROM "SalesAgentBudget" WHERE "period" = ${month}`;
  return { period: month, reservedFils: rows[0]?.reservedFils ?? 0, maximumFils: 5000 };
}
