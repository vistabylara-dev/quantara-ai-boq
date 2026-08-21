import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { installStarterReportTemplatesForCompany } from "@/lib/services/report-template-service";

export const dynamic = "force-dynamic";

/**
 * Installs the built-in FM/technical condition report template into the caller's company —
 * so a customer never needs to prepare or upload a template JSON file themselves. Idempotent —
 * safe to call more than once.
 */
export async function POST() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const data = await installStarterReportTemplatesForCompany(actor);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
