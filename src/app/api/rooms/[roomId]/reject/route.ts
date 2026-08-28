import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { rejectDetectedRoom } from "@/lib/services/detected-room-service";
import { rejectDetectedRoomSchema } from "@/lib/validation/detected-room-schema";
import { detectedRoomIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ roomId: string }> };

async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { roomId } = detectedRoomIdParamsSchema.parse(await context.params);
    const { reason } = await parseJsonBody(request, rejectDetectedRoomSchema);
    return apiSuccess(await rejectDetectedRoom(actor, roomId, reason));
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
