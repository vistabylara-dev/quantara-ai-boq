import { apiSuccess, apiFailure } from "@/lib/http/api-response";
import { prisma, getPrismaConnectionMethod } from "@/lib/db/prisma";
import { isCloudflareRuntime } from "@/lib/cloudflare/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const runtime = isCloudflareRuntime() ? "cloudflare-worker" : "node";

  try {
    await prisma.$queryRaw`SELECT 1`;
    return apiSuccess({
      status: "ok",
      database: "connected",
      runtime,
      connectionMethod: getPrismaConnectionMethod(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Any failure of a plain `SELECT 1` unambiguously means the database is
    // unreachable — report that directly rather than through the generic
    // business-error mapper, so health checks never depend on which Prisma
    // error subclass happened to be thrown. Never include the connection
    // string, host, or Hyperdrive binding details in the response.
    console.error("[health] database check failed:", error instanceof Error ? error.message : error);
    return apiFailure("DATABASE_UNAVAILABLE", "The database is currently unavailable.", 503);
  }
}
