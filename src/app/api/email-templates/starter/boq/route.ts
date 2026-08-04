import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { installBoqStarterTemplatesForCompany } from "@/lib/services/email-template-service";

export const dynamic = "force-dynamic";

/**
 * Installs the two built-in BOQ proposal email starter templates (attached / secure-link) into the
 * caller's company. Idempotent — safe to call more than once.
 */
export async function POST() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const data = await installBoqStarterTemplatesForCompany(actor);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
