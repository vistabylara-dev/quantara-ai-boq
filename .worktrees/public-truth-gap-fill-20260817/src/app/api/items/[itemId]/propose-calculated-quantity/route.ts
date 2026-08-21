import { z } from "zod";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { proposeCalculatedQuantityForItem } from "@/lib/services/boq-quantity-update-service";
import { itemIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ itemId: string }> };

const bodySchema = z.object({ calculationId: z.string().uuid() }).strict();

/** Read-only — never mutates the BOQ item. Renders the "current vs proposed quantity" confirm dialog (spec section 7). */
async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { itemId } = itemIdParamsSchema.parse(await context.params);
    const body = await parseJsonBody(request, bodySchema);
    const data = await proposeCalculatedQuantityForItem(actor, itemId, body.calculationId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
