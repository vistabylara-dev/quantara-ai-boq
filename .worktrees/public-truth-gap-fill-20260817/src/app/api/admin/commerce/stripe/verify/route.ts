import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { buildPlatformRequestMetadata } from "@/lib/services/platform-admin-service";
import { verifyStripeMapping } from "@/lib/services/stripe-sync-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** STRIPE-1C — owner/admin, fetches live Stripe state for every mapping and reports drift. Never overwrites internal values. */
export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor();
    return apiSuccess(await verifyStripeMapping(actor, buildPlatformRequestMetadata(request)));
  } catch (error) {
    return handleApiError(error);
  }
}
