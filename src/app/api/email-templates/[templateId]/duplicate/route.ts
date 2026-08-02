import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { duplicateEmailTemplateForCompany } from "@/lib/services/email-template-service";
import { templateIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: { templateId: string } };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { templateId } = templateIdParamsSchema.parse(context.params);
    const data = await duplicateEmailTemplateForCompany(actor, templateId);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
