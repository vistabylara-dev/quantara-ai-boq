import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { listRecentlyUsed } from "@/lib/services/item-search-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const url = new URL(request.url);
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
    const data = await listRecentlyUsed(actor, limit);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
