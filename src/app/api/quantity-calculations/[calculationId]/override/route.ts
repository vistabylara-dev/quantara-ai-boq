import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { overrideCalculationResult } from "@/lib/services/quantity-calculation-service";
import { calculationIdParamsSchema, overrideCalculationSchema } from "@/lib/validation/quantity-calculation-schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ calculationId: string }> };

async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { calculationId } = calculationIdParamsSchema.parse(await context.params);
    const body = await parseJsonBody(request, overrideCalculationSchema);
    const data = await overrideCalculationResult(actor, calculationId, body.resultValue, body.reason);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
