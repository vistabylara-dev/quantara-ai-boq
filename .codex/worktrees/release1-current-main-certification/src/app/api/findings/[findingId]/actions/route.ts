import { z } from "zod";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { addCorrectiveAction } from "@/lib/services/finding-service";
import { findingIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ findingId: string }> };

const bodySchema = z.object({
  actionType: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.string().max(20).optional(),
}).strict();

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { findingId } = findingIdParamsSchema.parse(params);
    const body = await parseJsonBody(request, bodySchema);
    const data = await addCorrectiveAction(actor, findingId, body);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
