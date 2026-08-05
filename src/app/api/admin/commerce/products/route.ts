import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { listAdminCommerceProducts } from "@/lib/services/commerce-product-service";
import { commerceProductListQuerySchema } from "@/lib/validation/commerce-schema";

export const dynamic = "force-dynamic";

/** STRIPE-1B — owner/admin/support read of the full commerce catalogue, including
 *  inactive and private products (never exposed on the public route). */
export async function GET(request: Request) {
  try {
    const actor = await requirePlatformActor();
    const query = commerceProductListQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    const products = await listAdminCommerceProducts(actor, {
      type: query.type,
      billingInterval: query.billingInterval,
      activeOnly: query.activeOnly === "true" ? true : undefined,
      publicOnly: query.publicOnly === "true" ? true : undefined,
    });
    return apiSuccess(products);
  } catch (error) {
    return handleApiError(error);
  }
}
