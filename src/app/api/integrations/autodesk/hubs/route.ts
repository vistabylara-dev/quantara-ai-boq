import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { browseAutodeskHubs } from "@/lib/services/autodesk-integration-service";

export const dynamic = "force-dynamic";

/** Lists only the active company's accessible Autodesk hubs. */
async function GETHandler() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    return apiSuccess({ hubs: await browseAutodeskHubs(actor) });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
