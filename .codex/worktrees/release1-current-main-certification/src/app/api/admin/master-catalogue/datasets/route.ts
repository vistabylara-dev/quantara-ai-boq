import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { listRegisteredDatasetsSummary } from "@/lib/services/master-catalogue-import-job-service";

export const dynamic = "force-dynamic";

/** CATALOGUE-PROD-ACTIVATE — lists the code-registered approved datasets (never arbitrary user-supplied ones) with their current production state. */
export async function GET() {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    return apiSuccess(await listRegisteredDatasetsSummary(actor));
  } catch (error) {
    return handleApiError(error);
  }
}
