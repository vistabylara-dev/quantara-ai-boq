import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { listLibraryItemVersionsForCompany } from "@/lib/services/company-library-service";
import { libraryItemIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ itemId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { itemId } = libraryItemIdParamsSchema.parse(params);
    const data = await listLibraryItemVersionsForCompany(actor, itemId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
