import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { setEmailTemplateDefaultForCompany } from "@/lib/services/email-template-service";
import { templateIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ templateId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { templateId } = templateIdParamsSchema.parse(params);
    const data = await setEmailTemplateDefaultForCompany(actor, templateId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
