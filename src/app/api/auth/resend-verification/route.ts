import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { assertNotRateLimited, createInMemoryRateLimiter } from "@/lib/security/rate-limiter";
import { getRequestIp } from "@/lib/security/request-ip";
import { resendEmailVerification } from "@/lib/services/auth-service";
import { resendVerificationSchema } from "@/lib/validation/auth-schemas";

export const dynamic = "force-dynamic";

const resendIpLimiter = createInMemoryRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });
const resendEmailLimiter = createInMemoryRateLimiter({ max: 3, windowMs: 10 * 60 * 1000 });

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody(request, resendVerificationSchema);
    assertNotRateLimited(resendIpLimiter, `ip:${getRequestIp(request)}`);
    assertNotRateLimited(resendEmailLimiter, `email:${input.email.toLowerCase()}`);
    return apiSuccess(await resendEmailVerification(input));
  } catch (error) {
    return handleApiError(error);
  }
}
