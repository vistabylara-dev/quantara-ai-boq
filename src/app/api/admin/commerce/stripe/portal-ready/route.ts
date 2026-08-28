import { z } from "zod";
import { PLATFORM_OWNER_ROLES, requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { ensureStripeBillingPortalReady } from "@/lib/services/stripe-billing-portal-readiness-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({ confirm: z.literal(true) }).strict();

export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor(PLATFORM_OWNER_ROLES);
    await parseJsonBody(request, requestSchema);
    return apiSuccess(await ensureStripeBillingPortalReady(actor));
  } catch (error) {
    return handleApiError(error);
  }
}
