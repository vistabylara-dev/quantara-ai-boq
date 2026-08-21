import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { requestRefund } from "@/lib/services/refund-request-service";
import { refundRequestSchema } from "@/lib/validation/commerce-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * REFUND-9 — customer creates a refund REQUEST only. The request body
 * carries only `reason`; every provider ID and amount is resolved
 * server-side (see refund-request-service.ts). Gated on the same
 * `entitlements:manage` capability as checkout — billing is a
 * company-owner/administrator action, not a general member action.
 */
async function POSTHandler(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "entitlements:manage");

    const input = await parseJsonBody(request, refundRequestSchema);
    const result = await requestRefund(actor, input);
    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);