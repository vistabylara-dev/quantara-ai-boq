import { PlatformRole } from "@prisma/client";
import { requirePlatformActor, requirePlatformCapability } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { createExceptionRefundRequest } from "@/lib/services/refund-execution-service";
import { refundExceptionRequestSchema } from "@/lib/validation/commerce-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * REFUND-21 — owner-only. Creates a refund request that bypasses the normal
 * 7-day window for one of the four launch-approved categories. This is
 * creation only — it lands in REQUESTED status and still requires a
 * separate POST to [id]/approve before any Stripe refund happens. Never
 * reachable from a GET request; gated on the same platform:refund
 * capability as approve/reject.
 */
export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    requirePlatformCapability(actor, "platform:refund");

    const { companyId, category, reason } = await parseJsonBody(request, refundExceptionRequestSchema);
    const result = await createExceptionRefundRequest(actor, companyId, category, reason);
    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
