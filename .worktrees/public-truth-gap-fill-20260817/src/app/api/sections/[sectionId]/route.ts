import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import {
  deleteBOQSection,
  updateBOQSection,
} from "@/lib/repositories/boq-repository";
import {
  sectionIdParamsSchema,
  sectionWriteRouteSchema,
} from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ sectionId: string }> };

async function PUTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "boq:edit");
    const params = await context.params;
    const { sectionId } = sectionIdParamsSchema.parse(params);
    const input = await parseJsonBody(request, sectionWriteRouteSchema);
    const data = await updateBOQSection(actor.companyId, sectionId, input);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

async function DELETEHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "boq:edit");
    const params = await context.params;
    const { sectionId } = sectionIdParamsSchema.parse(params);
    const data = await deleteBOQSection(actor.companyId, sectionId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const PUT = withActorRequestContext(PUTHandler);
export const DELETE = withActorRequestContext(DELETEHandler);
