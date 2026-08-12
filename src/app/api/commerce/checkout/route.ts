import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { createCommerceCheckoutSession } from "@/lib/services/commerce-checkout-service";
import { commerceCheckoutRequestSchema } from "@/lib/validation/commerce-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * STRIPE-COMMERCIAL-2 — creates a Stripe Checkout Session for the
 * authenticated actor's company. The request body carries only a trusted
 * internal `priceCode`; amount, currency, Stripe price ID, and company
 * identity are all resolved server-side (see commerce-checkout-service.ts).
 * Gated on `entitlements:manage`, the same capability that already governs
 * the development plan-activation routes — billing is a company-owner/
 * administrator action, not a general member action.
 */
export async function POST(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "entitlements:manage");

    const input = await parseJsonBody(request, commerceCheckoutRequestSchema);
    const intentPayload = {
      intent: input.checkoutMode === "BOQ_UNLOCK" ? "BOQ_FINAL_OUTPUT" as const : "LEGACY_PRICE_CODE" as const,
      priceCode: input.priceCode,
      boqId: input.boqId
    };
    const result = await createCommerceCheckoutSession(actor, intentPayload);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
