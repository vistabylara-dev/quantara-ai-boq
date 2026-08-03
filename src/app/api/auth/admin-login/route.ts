import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { loginPlatformActor } from "@/lib/services/auth-service";
import { loginSchema } from "@/lib/validation/auth-schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody(request, loginSchema);
    await loginPlatformActor(input);
    return apiSuccess({ signedIn: true });
  } catch (error) {
    return handleApiError(error);
  }
}
