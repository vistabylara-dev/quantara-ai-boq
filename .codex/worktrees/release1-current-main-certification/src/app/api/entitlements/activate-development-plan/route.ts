import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { activateDevelopmentSoftwarePlan } from "@/lib/entitlements/entitlement-service";
import { activateDevelopmentPlanSchema } from "@/lib/validation/phase7-schema";

export const dynamic = "force-dynamic";

/** Development-only activation — never a real payment flow. See spec Phase 7 amendment sections 1/11. */
export async function POST(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "entitlements:manage");
    const { planKey } = await parseJsonBody(request, activateDevelopmentPlanSchema);
    await activateDevelopmentSoftwarePlan(actor, planKey);
    return apiSuccess({ activated: true });
  } catch (error) {
    return handleApiError(error);
  }
}
