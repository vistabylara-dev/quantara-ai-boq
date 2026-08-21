import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { searchMasterCatalogueAdmin } from "@/lib/services/master-catalogue-admin-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const url = new URL(request.url);
    const result = await searchMasterCatalogueAdmin(actor, {
      disciplineId: url.searchParams.get("disciplineId") ?? undefined,
      categoryId: url.searchParams.get("categoryId") ?? undefined,
      hierarchyNodeId: url.searchParams.get("hierarchyNodeId") ?? undefined,
      manufacturerId: url.searchParams.get("manufacturerId") ?? undefined,
      regionScope: (url.searchParams.get("regionScope") as never) ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      page: url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined,
      pageSize: url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined,
    });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
