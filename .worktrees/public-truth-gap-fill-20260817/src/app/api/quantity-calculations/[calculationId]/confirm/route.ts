import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { confirmCalculation } from "@/lib/services/quantity-calculation-service";
import { calculationIdParamsSchema } from "@/lib/validation/quantity-calculation-schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ calculationId: string }> };

async function POSTHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { calculationId } = calculationIdParamsSchema.parse(await context.params);
    const data = await confirmCalculation(actor, calculationId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
