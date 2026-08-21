import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { searchItems } from "@/lib/services/item-search-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const disciplineId = url.searchParams.get("disciplineId") ?? undefined;
    const categoryId = url.searchParams.get("categoryId") ?? undefined;
    const data = await searchItems(actor, query, { disciplineId, categoryId });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
