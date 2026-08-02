import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { createProposalForProject, listProposalsForProjectCompany } from "@/lib/services/client-proposal-service";
import { createProposalSchema } from "@/lib/validation/proposal-schema";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: { projectId: string } };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId } = projectIdParamsSchema.parse(context.params);
    const data = await listProposalsForProjectCompany(actor, projectId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId } = projectIdParamsSchema.parse(context.params);
    const input = await parseJsonBody(request, createProposalSchema);
    const data = await createProposalForProject(actor, projectId, input);
    return apiSuccess(data, data.isExisting ? 200 : 201);
  } catch (error) {
    return handleApiError(error);
  }
}
