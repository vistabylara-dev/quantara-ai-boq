import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getProposalForCompany, updateProposalForCompany } from "@/lib/services/client-proposal-service";
import { updateProposalSchema } from "@/lib/validation/proposal-schema";
import { proposalIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: { proposalId: string } };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { proposalId } = proposalIdParamsSchema.parse(context.params);
    const data = await getProposalForCompany(actor, proposalId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { proposalId } = proposalIdParamsSchema.parse(context.params);
    const input = await parseJsonBody(request, updateProposalSchema);
    const data = await updateProposalForCompany(actor, proposalId, input);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
