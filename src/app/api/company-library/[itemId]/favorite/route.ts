import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { setLibraryItemFavoriteForCompany } from "@/lib/services/company-library-service";
import { companyLibraryFavoriteSchema } from "@/lib/validation/phase7-schema";
import { libraryItemIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ itemId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { itemId } = libraryItemIdParamsSchema.parse(params);
    const { isFavorite } = await parseJsonBody(request, companyLibraryFavoriteSchema);
    const data = await setLibraryItemFavoriteForCompany(actor, itemId, isFavorite);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
