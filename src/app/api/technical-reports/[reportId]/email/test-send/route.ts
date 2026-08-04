import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { testSendTechnicalReportEmail } from "@/lib/services/technical-report-email-service";
import { testSendTechnicalReportEmailSchema } from "@/lib/validation/technical-report-email-schema";
import { technicalReportIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ reportId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { reportId } = technicalReportIdParamsSchema.parse(params);
    const input = await parseJsonBody(request, testSendTechnicalReportEmailSchema);
    const data = await testSendTechnicalReportEmail(actor, { reportId, ...input });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
