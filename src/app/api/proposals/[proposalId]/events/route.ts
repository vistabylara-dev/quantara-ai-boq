import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { listProposalEventsForCompany } from "@/lib/services/client-proposal-service";
import { proposalIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: { proposalId: string } };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { proposalId } = proposalIdParamsSchema.parse(context.params);
    const data = await listProposalEventsForCompany(actor, proposalId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
