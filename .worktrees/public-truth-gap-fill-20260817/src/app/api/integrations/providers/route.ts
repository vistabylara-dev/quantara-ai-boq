import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { listProvidersForCompany } from "@/lib/services/integration-service";

export const dynamic = "force-dynamic";

/** Authenticated, company-scoped. Provider catalog is code-driven (renders even before any DB migration runs); connection status is best-effort. */
async function GETHandler() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const data = await listProvidersForCompany(actor);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
