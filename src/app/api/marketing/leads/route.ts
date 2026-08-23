import { getCurrentActorOrNull } from "@/lib/auth/current-actor";
import { AppError } from "@/lib/errors/app-error";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { appendMarketingLeadToGoogleSheets } from "@/lib/integrations/connectors/google-sheets-lead-client";
import {
  buildMarketingLeadRecord,
  createRapidLeadSubmissionGuard,
  marketingLeadFingerprint,
  marketingLeadRequestSchema,
} from "@/lib/marketing/lead-capture";
import { assertNotRateLimited, createInMemoryRateLimiter } from "@/lib/security/rate-limiter";
import { getRequestIp } from "@/lib/security/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 16 * 1024;
const leadIpLimiter = createInMemoryRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });
const rapidLeadGuard = createRapidLeadSubmissionGuard({ windowMs: 60 * 1000 });

function limiterKey(request: Request, actorUserId: string | null): string {
  return actorUserId
    ? `marketing-lead:user:${actorUserId}`
    : `marketing-lead:public:${getRequestIp(request)}`;
}

function assertSafeRequest(request: Request): void {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new AppError("UNSUPPORTED_MEDIA_TYPE", "The request must use application/json.", 415);
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE", "The request is too large.", 413);
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new AppError("INVALID_ORIGIN", "The request origin is not allowed.", 403);
  }
}

export async function POST(request: Request) {
  try {
    assertSafeRequest(request);
    const input = await parseJsonBody(request, marketingLeadRequestSchema);
    const actor = await getCurrentActorOrNull();
    assertNotRateLimited(leadIpLimiter, limiterKey(request, actor?.userId ?? null));

    const lead = buildMarketingLeadRecord(input, actor);
    const claim = rapidLeadGuard.begin(marketingLeadFingerprint(lead));

    try {
      await appendMarketingLeadToGoogleSheets(lead);
      claim.complete();
    } catch (error) {
      claim.release();
      throw error;
    }

    return apiSuccess({ received: true as const }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
