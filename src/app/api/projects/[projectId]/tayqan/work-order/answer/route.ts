import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { answerTayqanWorkOrderBlocker } from "@/lib/services/tayqan-work-order-service";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";
import { tayqanWorkOrderAnswerSchema } from "@/lib/validation/tayqan-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ projectId: string }> };

async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "verification:manage");
    const { projectId } = projectIdParamsSchema.parse(await context.params);
    const input = await parseJsonBody(request, tayqanWorkOrderAnswerSchema);
    return apiSuccess(await answerTayqanWorkOrderBlocker(actor, projectId, input));
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
