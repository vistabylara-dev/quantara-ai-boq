import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getCatalogueItemHistoryForCompany } from "@/lib/services/catalogue-service";
import { catalogueItemIdParamsSchema } from "@/lib/validation/route-params";

type RouteContext = {
  params: { itemId: string };
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { itemId } = catalogueItemIdParamsSchema.parse(params);
    return apiSuccess(await getCatalogueItemHistoryForCompany(actor, itemId));
  } catch (error) {
    return handleApiError(error);
  }
}
