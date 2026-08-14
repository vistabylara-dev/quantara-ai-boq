import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { createClientForCompany, listClientsForCompany } from "@/lib/services/client-service";
import { clientCreateSchema, clientListQuerySchema } from "@/lib/validation/client-schema";

async function GETHandler(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const url = new URL(request.url);
    const query = clientListQuerySchema.parse({
      search: url.searchParams.get("search") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      includeArchived: url.searchParams.get("includeArchived") ?? undefined,
    });
    const result = await listClientsForCompany(actor, query);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

async function POSTHandler(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const input = await parseJsonBody(request, clientCreateSchema);
    const client = await createClientForCompany(actor, input);
    return apiSuccess(client, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
export const POST = withActorRequestContext(POSTHandler);
