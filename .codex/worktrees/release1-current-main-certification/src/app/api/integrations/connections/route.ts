import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { listConnectionsForActor } from "@/lib/services/integration-connection-service";

export const dynamic = "force-dynamic";

/** Connected Accounts — every ExternalConnection belonging to the caller's own company, including disconnected ones (shown with their status). */
export async function GET() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    return apiSuccess(await listConnectionsForActor(actor));
  } catch (error) {
    return handleApiError(error);
  }
}
