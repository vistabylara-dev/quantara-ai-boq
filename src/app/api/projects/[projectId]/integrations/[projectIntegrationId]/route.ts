import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { unlinkProjectSource } from "@/lib/services/project-integration-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  projectId: z.string().trim().min(1, "A project ID or slug is required.").max(120),
  projectIntegrationId: z.string().uuid(),
});

type RouteContext = { params: Promise<{ projectId: string; projectIntegrationId: string }> };

async function DELETEHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId, projectIntegrationId } = paramsSchema.parse(await context.params);
    return apiSuccess(await unlinkProjectSource(actor, projectId, projectIntegrationId));
  } catch (error) {
    return handleApiError(error);
  }
}

export const DELETE = withActorRequestContext(DELETEHandler);
