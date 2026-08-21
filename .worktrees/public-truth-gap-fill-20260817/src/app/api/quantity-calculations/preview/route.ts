import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { previewCalculation } from "@/lib/services/quantity-calculation-service";
import { previewCalculationSchema } from "@/lib/validation/quantity-calculation-schema";

export const dynamic = "force-dynamic";

/** Read-only — never persists a calculation. Powers the "visible equation" preview (spec section 5) before commitment. */
async function POSTHandler(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const body = await parseJsonBody(request, previewCalculationSchema);
    const data = previewCalculation(body.calculationType, body.dimensionValues);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
