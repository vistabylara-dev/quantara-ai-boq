import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { listPublicCommerceProducts } from "@/lib/services/commerce-product-service";
import { commerceProductListQuerySchema } from "@/lib/validation/commerce-schema";

export const dynamic = "force-dynamic";

/**
 * STRIPE-1B — public, unauthenticated read of the commerce catalogue.
 * Always forced to active+public in the service layer regardless of what's
 * requested here; only exposes the public DTO shape (no internal IDs, no
 * Stripe fields — none exist yet — no draft/private products, no
 * unpublished prices). Intended to eventually replace the hardcoded
 * marketing-page pricing JSX in src/app/page.tsx (not wired up in this
 * phase — see STRIPE-1B report for why).
 */
export async function GET(request: Request) {
  try {
    const query = commerceProductListQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    const products = await listPublicCommerceProducts({ type: query.type, billingInterval: query.billingInterval });
    return apiSuccess(products);
  } catch (error) {
    return handleApiError(error);
  }
}
