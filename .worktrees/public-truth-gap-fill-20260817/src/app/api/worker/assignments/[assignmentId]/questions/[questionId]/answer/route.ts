import { getCurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { answerWorkerMaterialQuestion } from "@/lib/services/worker-review-service";
import {
  workerQuestionAnswerSchema,
  workerQuestionParamsSchema,
} from "@/lib/validation/worker-route-schemas";

export const dynamic = "force-dynamic";

async function POSTHandler(request: Request, context: {
  params: Promise<{ assignmentId: string; questionId: string }>;
}) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "verification:manage");
    const { assignmentId, questionId } = workerQuestionParamsSchema.parse(await context.params);
    const input = await parseJsonBody(request, workerQuestionAnswerSchema);
    return apiSuccess(await answerWorkerMaterialQuestion(actor, assignmentId, questionId, input));
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
