import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { prisma } from "@/lib/db/prisma";
import { seedCommerceProducts } from "../../../../../../prisma/seed-data/commerce-products";

export const dynamic = "force-dynamic";

/**
 * STRIPE-1B — owner-only, idempotent trigger for the commerce catalogue
 * seed. Runs inside this deployment using its real runtime DATABASE_URL,
 * the same break-glass pattern established by
 * /api/admin/system-health/apply-pending-migrations in PRODUCTION-RECOVERY-1
 * — this is how the catalogue gets seeded in production, since the raw
 * DATABASE_URL is never available to any external process. GET (not POST)
 * so it is reachable by pasting the URL directly; safe to call repeatedly,
 * every write is an upsert keyed on a stable code.
 */
export async function GET() {
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const report = await seedCommerceProducts(prisma);
    return apiSuccess(report);
  } catch (error) {
    return handleApiError(error);
  }
}
