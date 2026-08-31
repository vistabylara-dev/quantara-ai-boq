import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { approveFurnitureOrderItemCandidate } from "@/lib/services/furniture-order-review-service";
import {
  furnitureApprovalSchema,
  furnitureCandidateParamsSchema,
} from "@/lib/validation/furniture-schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string; candidateId: string }> };

async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId, candidateId } = furnitureCandidateParamsSchema.parse(await context.params);
    const body = await parseJsonBody(request, furnitureApprovalSchema);
    return apiSuccess(await approveFurnitureOrderItemCandidate(
      actor,
      projectId,
      candidateId,
      body.acknowledgedIssueCodes,
    ));
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
