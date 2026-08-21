import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { createBOQSection } from "@/lib/repositories/boq-repository";
import {
  boqIdParamsSchema,
  sectionWriteRouteSchema,
} from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

async function POSTHandler(request: Request, context: { params: Promise<{ boqId: string }> }) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "boq:edit");
    const params = await context.params;
    const { boqId } = boqIdParamsSchema.parse(params);
    const input = await parseJsonBody(request, sectionWriteRouteSchema);
    const data = await createBOQSection(actor.companyId, boqId, input);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
