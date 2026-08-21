import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { getProposalForCompany, updateProposalForCompany } from "@/lib/services/client-proposal-service";
import { updateProposalSchema } from "@/lib/validation/proposal-schema";
import { proposalIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ proposalId: string }> };

async function GETHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { proposalId } = proposalIdParamsSchema.parse(params);
    const data = await getProposalForCompany(actor, proposalId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

async function PUTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { proposalId } = proposalIdParamsSchema.parse(params);
    const input = await parseJsonBody(request, updateProposalSchema);
    const data = await updateProposalForCompany(actor, proposalId, input);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
export const PUT = withActorRequestContext(PUTHandler);
