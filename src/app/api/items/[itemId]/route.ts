import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
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

type RouteContext = { params: { itemId: string } };

export async function PUT(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    requireCapability(actor, "boq:edit");
    const { itemId } = itemIdParamsSchema.parse(context.params);
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
    requireCapability(actor, "boq:edit");
    const { itemId } = itemIdParamsSchema.parse(context.params);
    const data = await deleteBOQItem(actor.companyId, itemId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
