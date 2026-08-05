import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { bootstrapIndustryEngines } from "@/lib/services/industry-bootstrap-service";

export const dynamic = "force-dynamic";

/**
 * P0-REAL-PRODUCT Checkpoint 1 — owner-only, idempotent. Production's IndustryEngine
 * reference table was never seeded, leaving every company's Industry selector empty and
 * blocking project creation entirely. See industry-bootstrap-service.ts for the full
 * root-cause explanation. Safe to trigger more than once.
 */
export async function GET() {
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const result = await bootstrapIndustryEngines();
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
