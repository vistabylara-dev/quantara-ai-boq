import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { assertNotRateLimited, createInMemoryRateLimiter } from "@/lib/security/rate-limiter";
import { getRequestIp } from "@/lib/security/request-ip";
import { resetPassword } from "@/lib/services/auth-service";
import { resetPasswordSchema } from "@/lib/validation/auth-schemas";

export const dynamic = "force-dynamic";

// IP-only: there is no email in this payload to key on, and the token must
// not be inspected/derived from before it's validated by resetPassword.
const resetPasswordIpLimiter = createInMemoryRateLimiter({ max: 10, windowMs: 10 * 60 * 1000 });

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody(request, resetPasswordSchema);
    assertNotRateLimited(resetPasswordIpLimiter, `ip:${getRequestIp(request)}`);
    await resetPassword(input.token, input.password);
    return apiSuccess({ reset: true });
  } catch (error) {
    return handleApiError(error);
  }
}
