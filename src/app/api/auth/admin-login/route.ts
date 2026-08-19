import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { assertNotRateLimited, createInMemoryRateLimiter } from "@/lib/security/rate-limiter";
import { getRequestIp } from "@/lib/security/request-ip";
import { loginPlatformActor } from "@/lib/services/auth-service";
import { loginSchema } from "@/lib/validation/auth-schemas";

export const dynamic = "force-dynamic";

// Same combined IP + account key as /api/auth/login — a separate limiter
// instance so an attack on one never exhausts the other's budget.
const adminLoginIpLimiter = createInMemoryRateLimiter({ max: 10, windowMs: 5 * 60 * 1000 });
const adminLoginEmailLimiter = createInMemoryRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody(request, loginSchema);
    assertNotRateLimited(adminLoginIpLimiter, `ip:${getRequestIp(request)}`);
    assertNotRateLimited(adminLoginEmailLimiter, `email:${input.email.toLowerCase()}`);
    await loginPlatformActor(input);
    return apiSuccess({ signedIn: true });
  } catch (error) {
    return handleApiError(error);
  }
}
