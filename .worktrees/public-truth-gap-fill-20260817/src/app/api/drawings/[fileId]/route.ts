import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { archiveProjectDrawing, getProjectDrawing, updateProjectDrawingMetadata } from "@/lib/services/drawing-service";
import { drawingMetadataSchema } from "@/lib/validation/drawing-schema";
import { projectFileIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ fileId: string }> };

async function GETHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { fileId } = projectFileIdParamsSchema.parse(params);
    const data = await getProjectDrawing(actor, fileId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

async function PATCHHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { fileId } = projectFileIdParamsSchema.parse(params);
    const body = await request.json();
    const metadata = drawingMetadataSchema.parse(body);
    const data = await updateProjectDrawingMetadata(actor, fileId, metadata);
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
    const drawing = await archiveProjectDrawing(actor, fileId);
    return apiSuccess(drawing);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
export const PATCH = withActorRequestContext(PATCHHandler);
export const DELETE = withActorRequestContext(DELETEHandler);
