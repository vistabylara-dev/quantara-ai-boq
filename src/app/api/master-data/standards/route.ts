import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { listStandardAuthoritiesPublic } from "@/lib/services/standards-service";

export const dynamic = "force-dynamic";

/** Authenticated, read-only — a reference lookup list (BS, IEC, UAE Civil Defense, ...), not proprietary catalogue data. */
async function GETHandler() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    return apiSuccess(await listStandardAuthoritiesPublic());
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
