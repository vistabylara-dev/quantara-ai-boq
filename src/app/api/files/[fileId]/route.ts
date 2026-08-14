import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { archiveProjectFile, getProjectFile } from "@/lib/services/project-file-service";
import { projectFileIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ fileId: string }> };

async function GETHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { fileId } = projectFileIdParamsSchema.parse(params);
    const data = await getProjectFile(actor, fileId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

async function DELETEHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { fileId } = projectFileIdParamsSchema.parse(params);
    const file = await archiveProjectFile(actor, fileId);
    return apiSuccess(file);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
export const DELETE = withActorRequestContext(DELETEHandler);
