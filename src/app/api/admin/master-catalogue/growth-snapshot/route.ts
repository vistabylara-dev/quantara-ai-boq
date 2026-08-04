import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCatalogueGrowthSnapshot } from "@/lib/services/master-item-quality-service";

export const dynamic = "force-dynamic";

/** Truthful catalogue-growth counts for the MASTER-SCALE milestone tracker — never inflated. */
export async function GET() {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    return apiSuccess(await getCatalogueGrowthSnapshot(actor));
  } catch (error) {
    return handleApiError(error);
  }
}
