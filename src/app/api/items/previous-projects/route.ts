import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { listPreviousProjectItems } from "@/lib/services/item-search-service";

export const dynamic = "force-dynamic";

async function GETHandler(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
    const data = await listPreviousProjectItems(actor, query, limit);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
