import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getGoogleDriveRuntimeStatus } from "@/lib/services/google-drive-integration-service";

export const dynamic = "force-dynamic";

/** Returns configuration and live grant state without credentials or provider data. */
async function GETHandler() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    return apiSuccess(await getGoogleDriveRuntimeStatus(actor));
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
