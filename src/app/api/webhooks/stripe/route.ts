import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { processStripeWebhookEvent, verifyStripeWebhookEvent } from "@/lib/services/stripe-webhook-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * STRIPE-COMMERCIAL-3 — Stripe webhook receiver. Authenticates via the
 * Stripe-Signature header against STRIPE_WEBHOOK_SECRET, never via the
 * user session cookie (middleware.ts already lets /api/... requests pass
 * through without a session; this route is reachable by Stripe's servers,
 * which never present one).
 *
 * request.text() reads the exact raw bytes Stripe signed — the body is
 * never JSON.parse()'d before signature verification, since that would
 * both risk parsing an unverified payload and could alter byte-for-byte
 * equivalence the HMAC depends on.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");
    const event = await verifyStripeWebhookEvent(rawBody, signature);
    const result = await processStripeWebhookEvent(event);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
