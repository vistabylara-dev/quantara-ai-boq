import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { submitProposalComment } from "@/lib/services/public-proposal-service";
import { publicCommentSchema } from "@/lib/validation/proposal-schema";
import { proposalTokenParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: { token: string } };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = proposalTokenParamsSchema.parse(context.params);
    const input = await parseJsonBody(request, publicCommentSchema);
    const data = await submitProposalComment(token, input, request);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
