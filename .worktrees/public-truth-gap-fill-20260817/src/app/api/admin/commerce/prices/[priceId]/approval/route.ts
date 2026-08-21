import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { buildPlatformRequestMetadata } from "@/lib/services/platform-admin-service";
import { setCommercePriceReview } from "@/lib/services/commerce-price-approval-service";
import { commercePriceIdParamsSchema, commercePriceReviewUpdateSchema } from "@/lib/validation/commerce-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ priceId: string }>;
};

/** STRIPE-1C — owner/admin sets a CommercePrice's commercial review status. Never touches amount/currency/interval. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER, PlatformRole.PLATFORM_ADMIN]);
    const { priceId } = commercePriceIdParamsSchema.parse(await context.params);
    const input = await parseJsonBody(request, commercePriceReviewUpdateSchema);
    return apiSuccess(await setCommercePriceReview(actor, priceId, input, buildPlatformRequestMetadata(request)));
  } catch (error) {
    return handleApiError(error);
  }
}
