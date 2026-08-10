import { PLATFORM_OWNER_ROLES, requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { listLiveStripeSyncHistory } from "@/lib/services/stripe-live-sync-service";
import { stripeHistoryQuerySchema } from "@/lib/validation/commerce-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** STRIPE-COMMERCIAL-4 — platform owner only. Read-only history of LIVE sync runs. */
export async function GET(request: Request) {
  try {
    const actor = await requirePlatformActor(PLATFORM_OWNER_ROLES);
    const query = stripeHistoryQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    return apiSuccess(await listLiveStripeSyncHistory(actor, query.limit));
  } catch (error) {
    return handleApiError(error);
  }
}
