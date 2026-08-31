import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { correctFurnitureOrderItemCandidate } from "@/lib/services/furniture-order-review-service";
import {
  furnitureCandidateParamsSchema,
  furnitureOrderItemCorrectionSchema,
} from "@/lib/validation/furniture-schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string; candidateId: string }> };

async function PATCHHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId, candidateId } = furnitureCandidateParamsSchema.parse(await context.params);
    const body = await parseJsonBody(request, furnitureOrderItemCorrectionSchema);
    return apiSuccess(await correctFurnitureOrderItemCandidate(actor, projectId, candidateId, body));
  } catch (error) {
    return handleApiError(error);
  }
}

export const PATCH = withActorRequestContext(PATCHHandler);
