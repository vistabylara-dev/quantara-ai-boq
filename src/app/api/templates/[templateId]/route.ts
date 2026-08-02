import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getTemplateForCompany, updateTemplateForCompany } from "@/lib/services/document-template-service";
import { documentTemplateUpdateSchema } from "@/lib/validation/document-schema";
import { templateIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: { templateId: string } };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { templateId } = templateIdParamsSchema.parse(context.params);
    const data = await getTemplateForCompany(actor, templateId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { templateId } = templateIdParamsSchema.parse(context.params);
    const input = await parseJsonBody(request, documentTemplateUpdateSchema);
    const data = await updateTemplateForCompany(actor, templateId, input);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
