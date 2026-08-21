import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { revokeTechnicalReportShareLink } from "@/lib/services/technical-report-email-service";
import { technicalReportIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ reportId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { reportId } = technicalReportIdParamsSchema.parse(params);
    const data = await revokeTechnicalReportShareLink(actor, reportId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
