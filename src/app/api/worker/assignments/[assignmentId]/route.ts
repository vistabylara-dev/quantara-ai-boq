import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getWorkerAssignmentWorkspace } from "@/lib/services/worker-review-service";
import { workerAssignmentIdParamsSchema } from "@/lib/validation/worker-route-schemas";

export const dynamic = "force-dynamic";

async function GETHandler(_request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { assignmentId } = workerAssignmentIdParamsSchema.parse(await context.params);
    return apiSuccess(await getWorkerAssignmentWorkspace(actor.companyId, assignmentId));
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
