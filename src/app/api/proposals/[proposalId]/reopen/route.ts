import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { reopenProposalForCompany } from "@/lib/services/client-proposal-service";
import { proposalIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: { proposalId: string } };

/** Internal-only escape hatch: brings a REVISION_REQUESTED proposal back to OPENED so the same link can be approved after the requested changes are addressed out of band. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { proposalId } = proposalIdParamsSchema.parse(context.params);
    const data = await reopenProposalForCompany(actor, proposalId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
