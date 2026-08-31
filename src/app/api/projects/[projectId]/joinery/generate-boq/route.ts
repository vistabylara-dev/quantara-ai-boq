import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { regenerateFurnitureManagedBOQ } from "@/lib/services/furniture-boq-service";
import {
  furnitureBoqGenerationSchema,
  furnitureProjectParamsSchema,
} from "@/lib/validation/furniture-schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId } = furnitureProjectParamsSchema.parse(await context.params);
    const body = await parseJsonBody(request, furnitureBoqGenerationSchema);
    return apiSuccess(await regenerateFurnitureManagedBOQ(actor, {
      projectIdentifier: projectId,
      boqId: body.boqId,
      wastagePercentage: body.wastagePercentage,
    }));
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
