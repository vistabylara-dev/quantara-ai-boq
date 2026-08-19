import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { assertNotRateLimited, createInMemoryRateLimiter } from "@/lib/security/rate-limiter";
import { getRequestIp } from "@/lib/security/request-ip";
import { requestPasswordReset } from "@/lib/services/auth-service";
import { forgotPasswordSchema } from "@/lib/validation/auth-schemas";

export const dynamic = "force-dynamic";

// requestPasswordReset already returns the same { requested: true } response
// regardless of whether the email exists (confirmed by reading
// auth-service.ts) — rate limiting here throttles enumeration/spam volume,
// it does not fix a leak that doesn't exist.
const forgotPasswordIpLimiter = createInMemoryRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });
const forgotPasswordEmailLimiter = createInMemoryRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody(request, forgotPasswordSchema);
    assertNotRateLimited(forgotPasswordIpLimiter, `ip:${getRequestIp(request)}`);
    assertNotRateLimited(forgotPasswordEmailLimiter, `email:${input.email.toLowerCase()}`);
    await requestPasswordReset(input.email);
    return apiSuccess({ requested: true });
  } catch (error) {
    return handleApiError(error);
  }
}
