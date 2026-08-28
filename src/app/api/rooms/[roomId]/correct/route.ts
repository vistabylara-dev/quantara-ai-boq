import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { correctDetectedRoom } from "@/lib/services/detected-room-service";
import { correctDetectedRoomSchema } from "@/lib/validation/detected-room-schema";
import { detectedRoomIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ roomId: string }> };

async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { roomId } = detectedRoomIdParamsSchema.parse(await context.params);
    const body = await parseJsonBody(request, correctDetectedRoomSchema);
    return apiSuccess(await correctDetectedRoom(actor, roomId, body));
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
