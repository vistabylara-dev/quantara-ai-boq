import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getGeneratedDocument } from "@/lib/repositories/generated-document-repository";
import { deleteGeneratedDocument } from "@/lib/services/document-generation-service";
import { documentIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ documentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
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

export async function DELETE(_request: Request, context: RouteContext) {
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
