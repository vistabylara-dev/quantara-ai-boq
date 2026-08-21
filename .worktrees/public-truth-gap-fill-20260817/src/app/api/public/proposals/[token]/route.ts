import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { AppError } from "@/lib/errors/app-error";
import { getPublicProposalView } from "@/lib/services/public-proposal-service";
import { proposalTokenParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

const REASON_STATUS: Record<string, number> = { NOT_FOUND: 404, REVOKED: 410, EXPIRED: 410, INVALID_STATUS: 409 };
const REASON_MESSAGE: Record<string, string> = {
  NOT_FOUND: "This proposal link is not valid.",
  REVOKED: "This proposal link has been revoked.",
  EXPIRED: "This proposal link has expired.",
  INVALID_STATUS: "This proposal is not yet available.",
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const params = await context.params;
    const { token } = proposalTokenParamsSchema.parse(params);
    const result = await getPublicProposalView(token, request);
    if (!result.ok) {
      throw new AppError(`PROPOSAL_${result.reason}`, REASON_MESSAGE[result.reason], REASON_STATUS[result.reason]);
    }
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
