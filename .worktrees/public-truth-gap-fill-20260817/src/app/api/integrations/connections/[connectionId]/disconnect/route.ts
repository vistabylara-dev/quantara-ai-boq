import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { disconnectConnection } from "@/lib/services/integration-connection-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ connectionId: z.string().uuid() });

type RouteContext = { params: Promise<{ connectionId: string }> };

async function POSTHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { connectionId } = paramsSchema.parse(await context.params);
    return apiSuccess(await disconnectConnection(actor, connectionId));
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
