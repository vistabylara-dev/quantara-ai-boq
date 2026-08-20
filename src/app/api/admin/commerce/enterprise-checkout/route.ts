import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { buildPlatformRequestMetadata } from "@/lib/services/platform-admin-service";
import { createEnterpriseSalesCheckoutSession } from "@/lib/services/enterprise-sales-checkout-service";
import { enterpriseCheckoutRequestSchema } from "@/lib/validation/commerce-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * v5 — issues a Stripe-hosted Checkout Session for a sales-led Enterprise
 * annual subscription, bound to the target company's Quantara-owned Stripe
 * customer. The returned URL is what sales sends to that one customer;
 * payment is then fulfilled automatically by the existing, unmodified Stripe
 * webhook path (see enterprise-sales-checkout-service.ts).
 *
 * Deliberately under /api/admin: this is a PLATFORM_OWNER/PLATFORM_ADMIN
 * operator action, never a customer-reachable route. It is NOT a public
 * Enterprise checkout route — an unauthenticated or ordinary-company caller
 * cannot reach it, and self-serve /api/commerce/checkout continues to reject
 * all three Enterprise products outright.
 *
 * The request body carries only a trusted internal companyId and one of three
 * allowlisted Enterprise price codes; amount, currency, Stripe Price ID, and
 * Stripe Customer ID are all resolved server-side and are never accepted from
 * the caller.
 */
export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER, PlatformRole.PLATFORM_ADMIN]);
    const input = await parseJsonBody(request, enterpriseCheckoutRequestSchema);
    const result = await createEnterpriseSalesCheckoutSession(
      actor,
      input,
      buildPlatformRequestMetadata(request),
    );
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
