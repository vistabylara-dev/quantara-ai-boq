import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import {
  deleteBOQItem,
  updateBOQItem,
} from "@/lib/repositories/boq-repository";
import {
  itemIdParamsSchema,
  itemUpdateRouteSchema,
} from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ itemId: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "boq:edit");
    const params = await context.params;
    const { itemId } = itemIdParamsSchema.parse(params);
    const input = await parseJsonBody(request, itemUpdateRouteSchema);
    const data = await updateBOQItem(actor.companyId, itemId, input);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "boq:edit");
    const params = await context.params;
    const { itemId } = itemIdParamsSchema.parse(params);
    const data = await deleteBOQItem(actor.companyId, itemId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
