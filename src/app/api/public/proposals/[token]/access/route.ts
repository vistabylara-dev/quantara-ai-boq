import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { submitProposalPasscode } from "@/lib/services/public-proposal-service";
import { publicPasscodeSchema } from "@/lib/validation/proposal-schema";
import { proposalTokenParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: { token: string } };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = proposalTokenParamsSchema.parse(context.params);
    const { passcode } = await parseJsonBody(request, publicPasscodeSchema);
    const data = await submitProposalPasscode(token, passcode, request);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
