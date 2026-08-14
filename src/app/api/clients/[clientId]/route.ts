import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import {
  archiveClientForCompany,
  getClientForCompany,
  updateClientForCompany,
} from "@/lib/services/client-service";
import { clientUpdateSchema } from "@/lib/validation/client-schema";
import { clientIdParamsSchema } from "@/lib/validation/route-params";

type RouteContext = {
  params: Promise<{ clientId: string }>;
};

async function GETHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { clientId } = clientIdParamsSchema.parse(params);
    return apiSuccess(await getClientForCompany(actor, clientId));
  } catch (error) {
    return handleApiError(error);
  }
}

async function PUTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { clientId } = clientIdParamsSchema.parse(params);
    const input = await parseJsonBody(request, clientUpdateSchema);
    const client = await updateClientForCompany(actor, clientId, input);
    return apiSuccess(client);
  } catch (error) {
    return handleApiError(error);
  }
}

async function DELETEHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { clientId } = clientIdParamsSchema.parse(params);
    const client = await archiveClientForCompany(actor, clientId);
    return apiSuccess(client);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
export const PUT = withActorRequestContext(PUTHandler);
export const DELETE = withActorRequestContext(DELETEHandler);
