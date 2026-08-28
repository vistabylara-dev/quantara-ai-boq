import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { confirmDetectedRoom } from "@/lib/services/detected-room-service";
import { detectedRoomIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ roomId: string }> };

async function POSTHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { roomId } = detectedRoomIdParamsSchema.parse(await context.params);
    return apiSuccess(await confirmDetectedRoom(actor, roomId));
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
