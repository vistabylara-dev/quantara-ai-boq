import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { disconnectGoogleDrive } from "@/lib/services/google-drive-integration-service";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    await disconnectGoogleDrive(actor);
    return apiSuccess({ disconnected: true });
  } catch (error) {
    return handleApiError(error);
  }
}
