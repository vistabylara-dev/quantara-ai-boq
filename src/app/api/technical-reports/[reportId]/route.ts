import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { deleteReport, getReport, updateReportFields } from "@/lib/services/technical-report-service";
import { technicalReportFieldValuesSchema } from "@/lib/validation/report-template-schema";
import { technicalReportIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ reportId: string }> };

async function GETHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { reportId } = technicalReportIdParamsSchema.parse(params);
    const data = await getReport(actor, reportId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

async function PATCHHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { reportId } = technicalReportIdParamsSchema.parse(params);
    const input = await parseJsonBody(request, technicalReportFieldValuesSchema);
    const data = await updateReportFields(actor, reportId, input.fieldValues);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

async function DELETEHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { reportId } = technicalReportIdParamsSchema.parse(params);
    const data = await deleteReport(actor, reportId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
export const PATCH = withActorRequestContext(PATCHHandler);
export const DELETE = withActorRequestContext(DELETEHandler);
