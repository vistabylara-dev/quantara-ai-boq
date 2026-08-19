import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { assertNotRateLimited, createInMemoryRateLimiter } from "@/lib/security/rate-limiter";
import { getRequestIp } from "@/lib/security/request-ip";
import { loginWithPassword } from "@/lib/services/auth-service";
import { loginSchema } from "@/lib/validation/auth-schemas";

export const dynamic = "force-dynamic";

// An attacker rotating IPs must still be throttled per-account, and an
// attacker hitting one account from a fixed IP must still be throttled
// per-IP — two independent limiters, not one shared key.
const loginIpLimiter = createInMemoryRateLimiter({ max: 10, windowMs: 5 * 60 * 1000 });
const loginEmailLimiter = createInMemoryRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody(request, loginSchema);
    assertNotRateLimited(loginIpLimiter, `ip:${getRequestIp(request)}`);
    assertNotRateLimited(loginEmailLimiter, `email:${input.email.toLowerCase()}`);
    await loginWithPassword(input);
    return apiSuccess({ signedIn: true });
  } catch (error) {
    return handleApiError(error);
  }
}
