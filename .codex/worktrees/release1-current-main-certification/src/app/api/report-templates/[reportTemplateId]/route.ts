import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getReportTemplateForCompany, setReportTemplateActiveState } from "@/lib/services/report-template-service";
import { reportTemplateActiveSchema } from "@/lib/validation/report-template-schema";
import { reportTemplateIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ reportTemplateId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { reportTemplateId } = reportTemplateIdParamsSchema.parse(params);
    const data = await getReportTemplateForCompany(actor, reportTemplateId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { reportTemplateId } = reportTemplateIdParamsSchema.parse(params);
    const input = await parseJsonBody(request, reportTemplateActiveSchema);
    const data = await setReportTemplateActiveState(actor, reportTemplateId, input.isActive);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
