import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { getRefundEligibility } from "@/lib/services/refund-request-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** REFUND-20 — read-only. Lets the customer UI show the exact refund deadline (or why it's unavailable) before ever attempting a submission. Same capability posture as GET /api/commerce/refunds: every authenticated company member may view it. */
async function GETHandler() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    return apiSuccess(await getRefundEligibility(actor));
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
