import { PLATFORM_OWNER_ROLES, requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { buildPlatformRequestMetadata } from "@/lib/services/platform-admin-service";
import { runLiveDryRun } from "@/lib/services/stripe-live-sync-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** STRIPE-COMMERCIAL-4 — platform owner only. Computes the LIVE sync plan and persists it as history. Zero Stripe calls. */
export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor(PLATFORM_OWNER_ROLES);
    return apiSuccess(await runLiveDryRun(actor, buildPlatformRequestMetadata(request)));
  } catch (error) {
    return handleApiError(error);
  }
}
