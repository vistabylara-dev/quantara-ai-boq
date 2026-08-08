import { z } from "zod";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { confirmCalculatedQuantityForItem } from "@/lib/services/boq-quantity-update-service";
import { itemIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ itemId: string }> };

const bodySchema = z.object({ calculationId: z.string().uuid() }).strict();

/** The only route that actually mutates the BOQ item — only reachable after the user explicitly confirmed the proposal (spec section 7). */
export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { itemId } = itemIdParamsSchema.parse(await context.params);
    const body = await parseJsonBody(request, bodySchema);
    const data = await confirmCalculatedQuantityForItem(actor, itemId, body.calculationId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
