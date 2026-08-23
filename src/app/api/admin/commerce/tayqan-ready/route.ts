import { z } from "zod";
import { PLATFORM_OWNER_ROLES, requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { buildPlatformRequestMetadata } from "@/lib/services/platform-admin-service";
import { ensureTayqanCommerceReady } from "@/lib/services/tayqan-commerce-readiness-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

const tayqanReadyRequestSchema = z.object({
  confirm: z.literal(true),
}).strict();

/**
 * One-time internal catalogue/Stripe initialization only. Customer purchases
 * remain self-service through POST /api/tayqan/checkout.
 */
export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor(PLATFORM_OWNER_ROLES);
    await parseJsonBody(request, tayqanReadyRequestSchema);
    return apiSuccess(await ensureTayqanCommerceReady(
      actor,
      buildPlatformRequestMetadata(request),
    ));
  } catch (error) {
    return handleApiError(error);
  }
}
