import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { listStripeSyncHistory } from "@/lib/services/stripe-sync-service";
import { stripeHistoryQuerySchema } from "@/lib/validation/commerce-schema";

export const dynamic = "force-dynamic";

/** STRIPE-1C — owner/admin/support read of synchronization run history. Never raw Stripe responses. */
export async function GET(request: Request) {
  try {
    const actor = await requirePlatformActor();
    const query = stripeHistoryQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    return apiSuccess(await listStripeSyncHistory(actor, query.limit));
  } catch (error) {
    return handleApiError(error);
  }
}
