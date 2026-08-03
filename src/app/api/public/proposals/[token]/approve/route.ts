import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { approveProposalPublic } from "@/lib/services/public-proposal-service";
import { publicApprovalSchema } from "@/lib/validation/proposal-schema";
import { proposalTokenParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = await context.params;
    const { token } = proposalTokenParamsSchema.parse(params);
    const input = await parseJsonBody(request, publicApprovalSchema);
    const data = await approveProposalPublic(token, input, request);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
