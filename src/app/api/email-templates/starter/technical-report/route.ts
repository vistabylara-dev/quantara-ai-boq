import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { installTechnicalReportStarterTemplatesForCompany } from "@/lib/services/email-template-service";

export const dynamic = "force-dynamic";

/**
 * Installs the two built-in technical-report email starter templates (attached / secure-link) into
 * the caller's company. Idempotent — safe to call more than once (see
 * installTechnicalReportStarterTemplatesForCompany).
 */
export async function POST() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const data = await installTechnicalReportStarterTemplatesForCompany(actor);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
