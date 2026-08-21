import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { logout } from "@/lib/services/auth-service";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await logout();
    return apiSuccess({ signedOut: true });
  } catch (error) {
    return handleApiError(error);
  }
}
