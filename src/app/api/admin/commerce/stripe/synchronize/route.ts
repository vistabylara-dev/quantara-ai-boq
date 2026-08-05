import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { buildPlatformRequestMetadata } from "@/lib/services/platform-admin-service";
import { synchronizeCommerceCatalogue } from "@/lib/services/stripe-sync-service";
import { stripeSynchronizeRequestSchema } from "@/lib/validation/commerce-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * STRIPE-1C — the only route that mutates Stripe. requirePlatformActor()
 * admits owner/admin/support at the auth layer; synchronizeCommerceCatalogue
 * itself enforces PLATFORM_OWNER specifically, matching the task's explicit
 * "Execution must require PLATFORM_OWNER" (stricter than the shared
 * platform:operate capability used elsewhere in this codebase).
 */
export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor();
    const input = await parseJsonBody(request, stripeSynchronizeRequestSchema);
    return apiSuccess(await synchronizeCommerceCatalogue(actor, input, buildPlatformRequestMetadata(request)));
  } catch (error) {
    return handleApiError(error);
  }
}
