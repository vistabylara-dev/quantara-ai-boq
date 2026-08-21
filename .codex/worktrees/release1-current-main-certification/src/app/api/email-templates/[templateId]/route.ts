import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getEmailTemplateForCompany, updateEmailTemplateForCompany } from "@/lib/services/email-template-service";
import { emailTemplateUpdateSchema } from "@/lib/validation/proposal-schema";
import { templateIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ templateId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { templateId } = templateIdParamsSchema.parse(params);
    const data = await getEmailTemplateForCompany(actor, templateId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { templateId } = templateIdParamsSchema.parse(params);
    const input = await parseJsonBody(request, emailTemplateUpdateSchema);
    const data = await updateEmailTemplateForCompany(actor, templateId, input);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
