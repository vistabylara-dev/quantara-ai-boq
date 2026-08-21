import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { buildPlatformRequestMetadata } from "@/lib/services/platform-admin-service";
import { getAdminCommerceProduct, updateAdminCommerceProductState } from "@/lib/services/commerce-product-service";
import { commerceProductIdParamsSchema, commerceProductStateUpdateSchema } from "@/lib/validation/commerce-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ productId: string }>;
};

/** STRIPE-1B — owner/admin/support detail read, including inactive/private. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor();
    const { productId } = commerceProductIdParamsSchema.parse(await context.params);
    return apiSuccess(await getAdminCommerceProduct(actor, productId));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * STRIPE-1B — minimal admin mutation: activate/deactivate, publish/
 * unpublish, reorder only. Deliberately does not accept code/type/name/
 * prices/entitlement fields — those are seed-managed in this phase, not
 * hand-edited through the admin UI, to keep the catalogue's source of
 * truth single (the seed script) until a real product-editing workflow is
 * designed.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER, PlatformRole.PLATFORM_ADMIN]);
    const { productId } = commerceProductIdParamsSchema.parse(await context.params);
    const input = await parseJsonBody(request, commerceProductStateUpdateSchema);
    return apiSuccess(
      await updateAdminCommerceProductState(actor, productId, input, buildPlatformRequestMetadata(request)),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
