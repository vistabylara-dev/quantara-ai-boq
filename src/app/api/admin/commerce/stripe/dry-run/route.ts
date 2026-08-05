import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { buildPlatformRequestMetadata } from "@/lib/services/platform-admin-service";
import { runDryRun } from "@/lib/services/stripe-sync-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** STRIPE-1C — owner/admin, computes the sync plan and persists it as history. Makes zero Stripe mutation calls. */
export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor();
    return apiSuccess(await runDryRun(actor, buildPlatformRequestMetadata(request)));
  } catch (error) {
    return handleApiError(error);
  }
}
