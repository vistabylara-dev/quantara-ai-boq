import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { startTrial } from "@/lib/entitlements/entitlement-service";

export const dynamic = "force-dynamic";

async function POSTHandler() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const data = await startTrial(actor);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
