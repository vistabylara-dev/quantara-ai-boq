import { z } from "zod";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { setEmailTemplateActiveForCompany } from "@/lib/services/email-template-service";
import { templateIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

const activeBodySchema = z.object({ isActive: z.boolean() }).strict();

type RouteContext = { params: Promise<{ templateId: string }> };

async function PUTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { templateId } = templateIdParamsSchema.parse(params);
    const { isActive } = await parseJsonBody(request, activeBodySchema);
    const data = await setEmailTemplateActiveForCompany(actor, templateId, isActive);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const PUT = withActorRequestContext(PUTHandler);
