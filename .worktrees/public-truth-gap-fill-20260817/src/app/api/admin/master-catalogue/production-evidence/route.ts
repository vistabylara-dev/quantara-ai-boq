import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getProductionCatalogueEvidence } from "@/lib/services/catalogue-production-evidence-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * CATALOGUE-100-VERIFY — one-call, read-only production evidence table:
 * every registered dataset's file manifest, latest job, real item/version
 * counts (scoped to that job's own batch), package state, and pipeline
 * stage. Open this URL directly (owner session required) to get the exact
 * numbers requested by the verification order instead of guessing.
 */
export async function GET() {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    return apiSuccess(await getProductionCatalogueEvidence(actor));
  } catch (error) {
    return handleApiError(error);
  }
}
