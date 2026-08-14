import { PlatformRole } from "@prisma/client";
import { requirePlatformActor, requirePlatformCapability } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { approveRefundRequest, executeApprovedRefund } from "@/lib/services/refund-execution-service";
import { refundApproveRequestSchema, refundRequestIdParamsSchema } from "@/lib/validation/commerce-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * REFUND-12 — owner-only. A monetary action, so it is never reachable from a
 * GET request, requires the dedicated platform:refund capability (owner
 * only for launch — see platform-authorization.ts), and requires the
 * explicit request body `action` field the UI's confirmation dialog fills
 * in — there is no implicit default. Approval and Stripe refund execution
 * happen as two calls inside this one handler (see refund-execution-service.ts
 * for why they are still separate functions): a re-verification failure at
 * the approve step never reaches Stripe at all.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    requirePlatformCapability(actor, "platform:refund");

    const { id } = refundRequestIdParamsSchema.parse(await context.params);
    const { action } = await parseJsonBody(request, refundApproveRequestSchema);

    await approveRefundRequest(actor, id, action);
    const result = await executeApprovedRefund(actor, id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
