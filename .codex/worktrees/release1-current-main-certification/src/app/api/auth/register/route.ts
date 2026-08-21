import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { registerCompanyOwner } from "@/lib/services/auth-service";
import { registerSchema } from "@/lib/validation/auth-schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody(request, registerSchema);
    const result = await registerCompanyOwner(input);
    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
