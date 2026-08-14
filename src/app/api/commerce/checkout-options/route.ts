import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { getCheckoutAvailability } from "@/lib/services/commerce-checkout-availability-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * STRIPE-COMMERCIAL-8 — authenticated, safe checkout availability. Unlike
 * the public catalogue (/api/commerce/products), this folds in the actual
 * Stripe provider-mapping state and the company's existing-subscription
 * status, so the UI can enable a checkout button only when a real payment
 * would actually succeed. Never returns a Stripe price ID.
 */
async function GETHandler() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    return apiSuccess(await getCheckoutAvailability(actor));
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
