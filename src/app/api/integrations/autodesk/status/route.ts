import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getAutodeskRuntimeStatus } from "@/lib/services/autodesk-integration-service";

export const dynamic = "force-dynamic";

/** Returns browser-safe configuration and live connection state without tokens or provider data. */
async function GETHandler() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    return apiSuccess(await getAutodeskRuntimeStatus(actor));
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
