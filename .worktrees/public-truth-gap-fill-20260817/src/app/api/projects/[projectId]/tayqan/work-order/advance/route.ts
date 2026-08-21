import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { advanceTayqanWorkOrder } from "@/lib/services/tayqan-work-order-service";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";
import { tayqanWorkOrderAdvanceSchema } from "@/lib/validation/tayqan-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ projectId: string }> };

async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "verification:manage");
    const { projectId } = projectIdParamsSchema.parse(await context.params);
    const input = await parseJsonBody(request, tayqanWorkOrderAdvanceSchema);
    return apiSuccess(await advanceTayqanWorkOrder(actor, projectId, input.workOrderId));
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
