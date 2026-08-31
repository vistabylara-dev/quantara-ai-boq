import { Prisma } from "@prisma/client";
import { apiSuccess, apiFailure } from "@/lib/http/api-response";
import { prisma } from "@/lib/db/prisma";
import { validateProductionSecuritySecrets } from "@/lib/config/security-secrets";

export const dynamic = "force-dynamic";

/**
 * Readiness probe: a lighter-weight sibling of `/api/health` intended for
 * load balancer / orchestrator polling. Issues one minimal query against the
 * canonical Prisma client (Hyperdrive or direct, whichever resolved) and
 * reports pass/fail without leaking connection details. Unlike `/api/health`,
 * this probe also exercises the core Session model so a reachable database
 * with an incompatible application schema cannot be reported as ready.
 */
export async function GET() {
  try {
    validateProductionSecuritySecrets();
  } catch (error) {
    console.error("[ready] production security configuration check failed:", error instanceof Error ? error.message : error);
    return apiFailure(
      "SECURITY_CONFIGURATION_UNAVAILABLE",
      "Required production security configuration is unavailable.",
      503,
    );
  }

  try {
    await prisma.session.findUnique({
      where: { tokenHash: "quantara-readiness-schema-canary" },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
      },
    });
    return apiSuccess({ status: "ready" });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    ) {
      console.error(`[ready] core schema compatibility check failed (${error.code})`);
      return apiFailure(
        "DATABASE_SCHEMA_INCOMPATIBLE",
        "The database schema is incompatible with this application release.",
        503,
      );
    }

    console.error("[ready] readiness check failed:", error instanceof Error ? error.message : error);
    return apiFailure("DATABASE_UNAVAILABLE", "The database is currently unavailable.", 503);
  }
}
