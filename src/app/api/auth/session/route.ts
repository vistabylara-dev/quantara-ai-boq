import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActorOrNull } from "@/lib/auth/current-actor";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await getCurrentActorOrNull();
    if (!actor) {
      return apiSuccess({ authenticated: false });
    }
    return apiSuccess({
      authenticated: true,
      user: {
        id: actor.userId,
        companyId: actor.companyId,
        role: actor.role,
        fullName: actor.fullName,
        email: actor.email,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
