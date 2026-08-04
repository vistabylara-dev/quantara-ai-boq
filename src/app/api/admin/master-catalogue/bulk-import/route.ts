import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { listCatalogueDatasets } from "@/lib/services/catalogue-dataset-registry";

export const dynamic = "force-dynamic";

/** CATALOGUE-CLOSE — lists the owner-triggerable catalogue datasets available to import (never the data itself). */
export async function GET() {
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    return apiSuccess(listCatalogueDatasets());
  } catch (error) {
    return handleApiError(error);
  }
}
