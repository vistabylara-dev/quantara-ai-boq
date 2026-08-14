import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { disconnectAutodesk } from "@/lib/services/autodesk-integration-service";

export const dynamic = "force-dynamic";

/** Removes encrypted local credentials; it does not remotely revoke the Autodesk grant. */
async function POSTHandler() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    await disconnectAutodesk(actor);
    return apiSuccess({ disconnected: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
