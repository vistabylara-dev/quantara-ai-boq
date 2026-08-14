import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { listOwnRefundRequests } from "@/lib/services/refund-request-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** REFUND-10 — every authenticated company member may view their own company's refund requests; only entitlements:manage may create one. Read access is never company-role-gated elsewhere in this codebase (see rbac.ts's own header comment), and refund status is not more sensitive than the subscription state it's read from. */
export async function GET() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    return apiSuccess(await listOwnRefundRequests(actor));
  } catch (error) {
    return handleApiError(error);
  }
}
