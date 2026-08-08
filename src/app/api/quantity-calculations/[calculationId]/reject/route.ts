import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { rejectCalculation } from "@/lib/services/quantity-calculation-service";
import { calculationIdParamsSchema, rejectCalculationSchema } from "@/lib/validation/quantity-calculation-schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ calculationId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { calculationId } = calculationIdParamsSchema.parse(await context.params);
    const body = await parseJsonBody(request, rejectCalculationSchema);
    const data = await rejectCalculation(actor, calculationId, body.reason);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
