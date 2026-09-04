import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import {
  rateOnlyUnitRateInputSchema,
  updateRateOnlyBOQItemUnitRate,
} from "@/lib/services/rate-only-boq-service";
import { itemIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ itemId: string }> };

async function PUTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { itemId } = itemIdParamsSchema.parse(await context.params);
    const input = await parseJsonBody(request, rateOnlyUnitRateInputSchema);
    const data = await updateRateOnlyBOQItemUnitRate(actor, itemId, input);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const PUT = withActorRequestContext(PUTHandler);
