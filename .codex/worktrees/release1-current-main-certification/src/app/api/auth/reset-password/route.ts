import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { resetPassword } from "@/lib/services/auth-service";
import { resetPasswordSchema } from "@/lib/validation/auth-schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody(request, resetPasswordSchema);
    await resetPassword(input.token, input.password);
    return apiSuccess({ reset: true });
  } catch (error) {
    return handleApiError(error);
  }
}
