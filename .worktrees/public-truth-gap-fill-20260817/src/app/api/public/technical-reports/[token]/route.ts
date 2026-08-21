import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { AppError } from "@/lib/errors/app-error";
import { getPublicTechnicalReportView } from "@/lib/services/public-technical-report-service";
import { technicalReportTokenParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

const REASON_STATUS: Record<string, number> = { NOT_FOUND: 404, REVOKED: 410, EXPIRED: 410, NOT_READY: 409 };
const REASON_MESSAGE: Record<string, string> = {
  NOT_FOUND: "This report link is not valid.",
  REVOKED: "This report link has been revoked.",
  EXPIRED: "This report link has expired.",
  NOT_READY: "This report is not ready for download yet.",
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const params = await context.params;
    const { token } = technicalReportTokenParamsSchema.parse(params);
    const result = await getPublicTechnicalReportView(token);
    if (!result.ok) {
      throw new AppError(`TECHNICAL_REPORT_SHARE_${result.reason}`, REASON_MESSAGE[result.reason], REASON_STATUS[result.reason]);
    }
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
