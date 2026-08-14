import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { getGeneratedDocument } from "@/lib/repositories/generated-document-repository";
import { deleteGeneratedDocument } from "@/lib/services/document-generation-service";
import { documentIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ documentId: string }> };

async function GETHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { documentId } = documentIdParamsSchema.parse(params);
    const data = await getGeneratedDocument(actor.companyId, documentId);
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
    const { documentId } = documentIdParamsSchema.parse(params);
    const data = await deleteGeneratedDocument(actor, documentId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
export const DELETE = withActorRequestContext(DELETEHandler);
