import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { confirmExtractedEntity } from "@/lib/services/extracted-entity-service";
import { entityIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ entityId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { entityId } = entityIdParamsSchema.parse(params);
    const data = await confirmExtractedEntity(actor, entityId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
