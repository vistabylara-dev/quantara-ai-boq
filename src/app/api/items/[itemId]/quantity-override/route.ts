import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { overrideSystemCalculatedBOQItemQuantity } from "@/lib/services/boq-quantity-override-service";
import { itemIdParamsSchema } from "@/lib/validation/boq-route-schemas";
import { boqSystemQuantityOverrideInputSchema } from "@/lib/validation/boq-quantity-override-schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ itemId: string }> };

async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { itemId } = itemIdParamsSchema.parse(await context.params);
    const input = await parseJsonBody(request, boqSystemQuantityOverrideInputSchema);
    const data = await overrideSystemCalculatedBOQItemQuantity(actor, itemId, input);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
