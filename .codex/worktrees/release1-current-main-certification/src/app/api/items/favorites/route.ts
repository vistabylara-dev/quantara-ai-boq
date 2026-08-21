import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { listFavorites } from "@/lib/services/item-search-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const data = await listFavorites(actor);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
