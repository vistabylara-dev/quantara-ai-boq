import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
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

export async function GET(_request: Request, context: RouteContext) {
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

export async function PUT(request: Request, context: RouteContext) {
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

export async function DELETE(_request: Request, context: RouteContext) {
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
