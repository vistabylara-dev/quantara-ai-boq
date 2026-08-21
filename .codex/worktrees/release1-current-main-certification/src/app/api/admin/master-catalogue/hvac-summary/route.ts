import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getHvacMasterDataSummary } from "@/lib/services/master-item-quality-service";

export const dynamic = "force-dynamic";

/** MASTER-SCALE-1B admin review dashboard — real HVAC import/catalogue counts, never inflated. */
export async function GET() {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    return apiSuccess(await getHvacMasterDataSummary(actor));
  } catch (error) {
    return handleApiError(error);
  }
}
