import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { createTayqanCheckoutSession } from "@/lib/services/tayqan-checkout-service";
import { tayqanCheckoutSchema } from "@/lib/validation/tayqan-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function POSTHandler(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "entitlements:manage");
    const input = await parseJsonBody(request, tayqanCheckoutSchema);
    return apiSuccess(await createTayqanCheckoutSession(actor, input));
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
