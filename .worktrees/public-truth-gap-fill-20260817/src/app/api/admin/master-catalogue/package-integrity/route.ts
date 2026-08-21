import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { computeAllPackageIntegrity, computeCrossPackageOverlap } from "@/lib/services/catalogue-package-integrity-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * CATALOGUE-PHASE7-STRICT-CLOSEOUT — owner-only, strictly read-only. Exact
 * per-package membership integrity for all 15 governed packages, plus real
 * cross-package overlap. This is the evidence used before any repair — the
 * reconcile route requires the exact integrityFingerprint this returns.
 */
export async function GET() {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const [packages, crossPackageOverlaps] = await Promise.all([
      computeAllPackageIntegrity(actor),
      computeCrossPackageOverlap(actor),
    ]);
    return apiSuccess({ generatedAt: new Date().toISOString(), packages, crossPackageOverlaps });
  } catch (error) {
    return handleApiError(error);
  }
}
