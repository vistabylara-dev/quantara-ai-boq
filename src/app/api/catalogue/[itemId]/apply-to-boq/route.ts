import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { applyCatalogueRateToBOQItem } from "@/lib/services/apply-catalogue-rate-service";
import { applyCatalogueRateBodySchema } from "@/lib/validation/catalogue-schema";
import { catalogueItemIdParamsSchema } from "@/lib/validation/route-params";

type RouteContext = {
  params: { itemId: string };
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { itemId } = catalogueItemIdParamsSchema.parse(params);
    const body = await parseJsonBody(request, applyCatalogueRateBodySchema);
    const boq = await applyCatalogueRateToBOQItem(actor, { catalogueItemId: itemId, ...body });
    return apiSuccess(boq);
  } catch (error) {
    return handleApiError(error);
  }
}
