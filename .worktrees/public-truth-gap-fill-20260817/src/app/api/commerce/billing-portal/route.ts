import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { createBillingPortalSession } from "@/lib/services/commerce-checkout-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** STRIPE-COMMERCIAL-2 — authenticated Stripe Billing Portal session for the actor's company. 404s truthfully if no Stripe customer exists yet for this mode (never fabricates a portal link). */
async function POSTHandler() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "entitlements:manage");

    const result = await createBillingPortalSession(actor);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
