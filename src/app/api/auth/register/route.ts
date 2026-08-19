import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { assertNotRateLimited, createInMemoryRateLimiter } from "@/lib/security/rate-limiter";
import { getRequestIp } from "@/lib/security/request-ip";
import { registerCompanyOwner } from "@/lib/services/auth-service";
import { registerSchema } from "@/lib/validation/auth-schemas";

export const dynamic = "force-dynamic";

// IP-only, deliberately: there is no existing account to key against, and
// keying by the submitted email would let an attacker permanently block a
// real signup by pre-submitting junk registrations with that email.
const registerIpLimiter = createInMemoryRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody(request, registerSchema);
    assertNotRateLimited(registerIpLimiter, `ip:${getRequestIp(request)}`);
    const result = await registerCompanyOwner(input);
    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
