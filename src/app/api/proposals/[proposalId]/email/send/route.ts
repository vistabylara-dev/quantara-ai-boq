import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { sendProposalEmail } from "@/lib/services/email-service";
import { sendEmailSchema } from "@/lib/validation/proposal-schema";
import { proposalIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: { proposalId: string } };

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { proposalId } = proposalIdParamsSchema.parse(context.params);
    const input = await parseJsonBody(request, sendEmailSchema);
    const data = await sendProposalEmail(actor, { proposalId, ...input });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
