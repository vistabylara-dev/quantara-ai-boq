import { PLATFORM_OWNER_ROLES, requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { buildPlatformRequestMetadata } from "@/lib/services/platform-admin-service";
import { synchronizeLiveCommerceCatalogue } from "@/lib/services/stripe-live-sync-service";
import { stripeSynchronizeRequestSchema } from "@/lib/validation/commerce-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * STRIPE-COMMERCIAL-4 — the only route that mutates live Stripe. Platform
 * owner only, requires a fresh catalogueFingerprint from a recent live dry
 * run and explicit confirm: true. Only APPROVED + DIRECT commerce objects
 * are ever created (enforced in stripe-live-sync-service.ts's plan
 * building, not here) — this route never promotes a price to APPROVED and
 * never syncs a quotation/contact-sales SKU as a direct-checkout price.
 */
export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor(PLATFORM_OWNER_ROLES);
    const input = await parseJsonBody(request, stripeSynchronizeRequestSchema);
    return apiSuccess(await synchronizeLiveCommerceCatalogue(actor, input, buildPlatformRequestMetadata(request)));
  } catch (error) {
    return handleApiError(error);
  }
}
