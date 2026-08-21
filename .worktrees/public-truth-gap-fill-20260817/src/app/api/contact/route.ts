import { AppError } from "@/lib/errors/app-error";
import { getCurrentActorOrNull } from "@/lib/auth/current-actor";
import { prisma } from "@/lib/db/prisma";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { createInMemoryRateLimiter, assertNotRateLimited } from "@/lib/security/rate-limiter";
import { buildSalesInquiryWrite, contactRequestSchema } from "@/lib/support/contact-request";

export const runtime = "nodejs";

const MAX_CONTACT_REQUEST_BYTES = 16 * 1024;
const contactRequestLimiter = createInMemoryRateLimiter({ max: 10, windowMs: 10 * 60 * 1000 });

function assertSafeRequest(request: Request): void {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new AppError("UNSUPPORTED_MEDIA_TYPE", "The request must use application/json.", 415);
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CONTACT_REQUEST_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE", "The request is too large.", 413);
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new AppError("INVALID_ORIGIN", "The request origin is not allowed.", 403);
  }
}

function limiterKey(request: Request, actorUserId: string | null): string {
  if (actorUserId) return `user:${actorUserId}`;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  return `public:${forwarded || "anonymous"}`;
}

export async function POST(request: Request) {
  try {
    assertSafeRequest(request);
    const input = await parseJsonBody(request, contactRequestSchema);
    const actor = await getCurrentActorOrNull();
    assertNotRateLimited(contactRequestLimiter, limiterKey(request, actor?.userId ?? null));

    const inquiry = await prisma.salesInquiry.create({
      data: buildSalesInquiryWrite(input, actor),
      select: { id: true },
    });

    return apiSuccess({ requestId: inquiry.id, deliveryStatus: "stored" as const }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
