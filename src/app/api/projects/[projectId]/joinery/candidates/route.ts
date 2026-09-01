import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { listFurnitureCandidates } from "@/lib/services/furniture-review-service";
import { furnitureProjectParamsSchema } from "@/lib/validation/furniture-schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

async function GETHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId } = furnitureProjectParamsSchema.parse(await context.params);
    return apiSuccess(await listFurnitureCandidates(actor, projectId));
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
