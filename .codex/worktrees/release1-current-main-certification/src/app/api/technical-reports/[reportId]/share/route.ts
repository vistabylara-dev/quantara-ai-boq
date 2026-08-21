import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { createTechnicalReportShareLink } from "@/lib/services/technical-report-email-service";
import { technicalReportIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ reportId: string }> };

/** Creates (or rotates) the report's secure client link (30-day expiry). The raw token/secureUrl
 *  is returned only in this response — only its hash is ever persisted, matching the proposal link
 *  pattern. No request body — mirrors /api/proposals/[proposalId]/regenerate-link. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { reportId } = technicalReportIdParamsSchema.parse(params);
    const data = await createTechnicalReportShareLink(actor, reportId);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
