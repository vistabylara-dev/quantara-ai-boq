import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { correctFurnitureCandidate } from "@/lib/services/furniture-review-service";
import {
  furnitureCandidateParamsSchema,
  furnitureCorrectionSchema,
} from "@/lib/validation/furniture-schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string; candidateId: string }> };

async function PATCHHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId, candidateId } = furnitureCandidateParamsSchema.parse(await context.params);
    const body = await parseJsonBody(request, furnitureCorrectionSchema);
    return apiSuccess(await correctFurnitureCandidate(actor, projectId, candidateId, body));
  } catch (error) {
    return handleApiError(error);
  }
}

export const PATCH = withActorRequestContext(PATCHHandler);
