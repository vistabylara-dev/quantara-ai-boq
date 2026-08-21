import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { verifyEmail } from "@/lib/services/auth-service";
import { verifyEmailSchema } from "@/lib/validation/auth-schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody(request, verifyEmailSchema);
    await verifyEmail(input.token);
    return apiSuccess({ verified: true });
  } catch (error) {
    return handleApiError(error);
  }
}
