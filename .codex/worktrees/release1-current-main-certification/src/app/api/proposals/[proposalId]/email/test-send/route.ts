import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { testSendProposalEmail } from "@/lib/services/email-service";
import { testSendEmailSchema } from "@/lib/validation/proposal-schema";
import { proposalIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ proposalId: string }> };

/** Always routed through the development provider — see email-service.ts's testSendProposalEmail for why this can never be mistaken for a real send. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { proposalId } = proposalIdParamsSchema.parse(params);
    const input = await parseJsonBody(request, testSendEmailSchema);
    const data = await testSendProposalEmail(actor, { proposalId, ...input });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
