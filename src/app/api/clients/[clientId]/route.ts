import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { getClient, updateClient } from "@/lib/repositories/client-repository";
import { clientUpdateSchema } from "@/lib/validation/backend-schemas";
import { clientIdParamsSchema } from "@/lib/validation/route-params";

type RouteContext = {
  params: { clientId: string };
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const actor = await getCurrentActor();
    const { clientId } = clientIdParamsSchema.parse(params);
    return apiSuccess(await getClient(actor.companyId, clientId));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const actor = await getCurrentActor();
    requireCapability(actor, "clients:manage");
    const { clientId } = clientIdParamsSchema.parse(params);
    const input = await parseJsonBody(request, clientUpdateSchema);
    const client = await updateClient(actor.companyId, clientId, input);
    return apiSuccess(client);
  } catch (error) {
    return handleApiError(error);
  }
}
