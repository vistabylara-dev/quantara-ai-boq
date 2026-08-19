import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { assertNotRateLimited, createInMemoryRateLimiter } from "@/lib/security/rate-limiter";
import { getRequestIp } from "@/lib/security/request-ip";
import { verifyEmail } from "@/lib/services/auth-service";
import { verifyEmailSchema } from "@/lib/validation/auth-schemas";

export const dynamic = "force-dynamic";

// IP-only, same reasoning as reset-password: no email in this payload.
const verifyEmailIpLimiter = createInMemoryRateLimiter({ max: 10, windowMs: 10 * 60 * 1000 });

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody(request, verifyEmailSchema);
    assertNotRateLimited(verifyEmailIpLimiter, `ip:${getRequestIp(request)}`);
    await verifyEmail(input.token);
    return apiSuccess({ verified: true });
  } catch (error) {
    return handleApiError(error);
  }
}
