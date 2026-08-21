import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getCompanyEntitlements, getTrialUsageSummary } from "@/lib/entitlements/entitlement-service";
import { listCompanyAccessiblePackages } from "@/lib/entitlements/package-entitlement-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const [entitlements, trialUsage, packages] = await Promise.all([
      getCompanyEntitlements(actor.companyId),
      getTrialUsageSummary(actor.companyId),
      listCompanyAccessiblePackages(actor.companyId),
    ]);
    return apiSuccess({ entitlements, trialUsage, packages });
  } catch (error) {
    return handleApiError(error);
  }
}
