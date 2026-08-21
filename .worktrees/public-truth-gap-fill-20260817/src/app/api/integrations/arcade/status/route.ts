import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getArcadeRuntime } from "@/lib/integrations/arcade/arcade-runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Runtime configuration only. Never returns the API key or provider OAuth data. */
async function GETHandler() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    return apiSuccess(getArcadeRuntime().getConfigurationStatus());
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
