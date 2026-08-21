import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { previewBoqValidation } from "@/lib/services/boq-validation-service";
import { boqIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ boqId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { boqId } = boqIdParamsSchema.parse(await context.params);
    const data = await previewBoqValidation(actor, boqId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
