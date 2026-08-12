import { PLATFORM_OWNER_ROLES, requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { buildPlatformRequestMetadata } from "@/lib/services/platform-admin-service";
import { verifyLiveStripeMapping } from "@/lib/services/stripe-live-sync-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** STRIPE-COMMERCIAL-4 — platform owner only. Fetches live Stripe state for every LIVE mapping and reports drift. Never overwrites internal values. */
export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor(PLATFORM_OWNER_ROLES);
    return apiSuccess(await verifyLiveStripeMapping(actor, buildPlatformRequestMetadata(request)));
  } catch (error) {
    return handleApiError(error);
  }
}
