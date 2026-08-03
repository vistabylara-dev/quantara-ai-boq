import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { selectProposalOption } from "@/lib/services/public-proposal-service";
import { publicOptionSelectionSchema } from "@/lib/validation/proposal-schema";
import { proposalTokenParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = await context.params;
    const { token } = proposalTokenParamsSchema.parse(params);
    const input = await parseJsonBody(request, publicOptionSelectionSchema);
    const data = await selectProposalOption(token, input, request);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
