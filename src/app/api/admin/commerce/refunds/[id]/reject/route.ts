import { PlatformRole } from "@prisma/client";
import { requirePlatformActor, requirePlatformCapability } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { rejectRefundRequest } from "@/lib/services/refund-execution-service";
import { refundRejectRequestSchema, refundRequestIdParamsSchema } from "@/lib/validation/commerce-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** REFUND-13 — owner-only rejection. Never calls Stripe. Gated on the same platform:refund capability as approval, since rejecting is still the same review authority, not a lower-stakes action. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    requirePlatformCapability(actor, "platform:refund");

    const { id } = refundRequestIdParamsSchema.parse(await context.params);
    const { reason } = await parseJsonBody(request, refundRejectRequestSchema);

    return apiSuccess(await rejectRefundRequest(actor, id, reason));
  } catch (error) {
    return handleApiError(error);
  }
}
