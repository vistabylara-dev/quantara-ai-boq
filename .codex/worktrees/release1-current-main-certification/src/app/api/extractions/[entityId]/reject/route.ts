import { z } from "zod";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { rejectExtractedEntity } from "@/lib/services/extracted-entity-service";
import { entityIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ entityId: string }> };

const bodySchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { entityId } = entityIdParamsSchema.parse(params);
    const body = await parseJsonBody(request, bodySchema);
    const data = await rejectExtractedEntity(actor, entityId, body.reason);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
