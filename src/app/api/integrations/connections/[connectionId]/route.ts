import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getConnectionDetailForActor } from "@/lib/services/integration-connection-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ connectionId: z.string().uuid() });

type RouteContext = { params: Promise<{ connectionId: string }> };

/** 404 (never 403) for a connection belonging to another company — cross-tenant IDs must not disclose existence. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { connectionId } = paramsSchema.parse(await context.params);
    return apiSuccess(await getConnectionDetailForActor(actor, connectionId));
  } catch (error) {
    return handleApiError(error);
  }
}
