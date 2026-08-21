import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { addBoqItemFromSource } from "@/lib/services/boq-item-source-service";
import { boqItemFromSourceSchema } from "@/lib/validation/phase7-schema";
import { boqIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ boqId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);

    const params = await context.params;
    const { boqId } = boqIdParamsSchema.parse(params);

    const input = await parseJsonBody(request, boqItemFromSourceSchema);
    const data = await addBoqItemFromSource(actor, boqId, input);

    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}