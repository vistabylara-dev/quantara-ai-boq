import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { answerTayqanIntakeQuestion } from "@/lib/services/tayqan-hire-service";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";
import { tayqanIntakeAnswerSchema } from "@/lib/validation/tayqan-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ projectId: string }> };

async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "verification:manage");
    const { projectId } = projectIdParamsSchema.parse(await context.params);
    const input = await parseJsonBody(request, tayqanIntakeAnswerSchema);
    return apiSuccess(await answerTayqanIntakeQuestion(actor, projectId, input));
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
