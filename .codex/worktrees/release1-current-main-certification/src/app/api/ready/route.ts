import { apiSuccess, apiFailure } from "@/lib/http/api-response";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * Readiness probe: a lighter-weight sibling of `/api/health` intended for
 * load balancer / orchestrator polling. Issues one minimal query against the
 * canonical Prisma client (Hyperdrive or direct, whichever resolved) and
 * reports pass/fail without leaking connection details.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return apiSuccess({ status: "ready" });
  } catch (error) {
    console.error("[ready] readiness check failed:", error instanceof Error ? error.message : error);
    return apiFailure("DATABASE_UNAVAILABLE", "The database is currently unavailable.", 503);
  }
}
