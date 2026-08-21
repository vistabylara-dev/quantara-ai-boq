import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { getTemplateForCompany, updateTemplateForCompany } from "@/lib/services/document-template-service";
import { documentTemplateUpdateSchema } from "@/lib/validation/document-schema";
import { templateIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ templateId: string }> };

async function GETHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { templateId } = templateIdParamsSchema.parse(params);
    const data = await getTemplateForCompany(actor, templateId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

async function PUTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { templateId } = templateIdParamsSchema.parse(params);
    const input = await parseJsonBody(request, documentTemplateUpdateSchema);
    const data = await updateTemplateForCompany(actor, templateId, input);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
export const PUT = withActorRequestContext(PUTHandler);
