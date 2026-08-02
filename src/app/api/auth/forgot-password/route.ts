import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { requestPasswordReset } from "@/lib/services/auth-service";
import { forgotPasswordSchema } from "@/lib/validation/auth-schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody(request, forgotPasswordSchema);
    await requestPasswordReset(input.email);
    return apiSuccess({ requested: true });
  } catch (error) {
    return handleApiError(error);
  }
}
