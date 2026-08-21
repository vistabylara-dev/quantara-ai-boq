import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { inspectStripeConfiguration } from "@/lib/services/stripe-sync-service";

export const dynamic = "force-dynamic";

/** STRIPE-1C — owner/admin/support read of safe Stripe configuration state. Never the key. */
export async function GET() {
  try {
    await requirePlatformActor();
    return apiSuccess(await inspectStripeConfiguration());
  } catch (error) {
    return handleApiError(error);
  }
}
