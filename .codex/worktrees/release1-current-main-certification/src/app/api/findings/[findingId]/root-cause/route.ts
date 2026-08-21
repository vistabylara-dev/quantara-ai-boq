import { z } from "zod";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { addRootCauseAnalysis } from "@/lib/services/finding-service";
import { findingIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ findingId: string }> };

const bodySchema = z.object({
  method: z.string().min(1).max(100),
  primaryCauseCategory: z.string().min(1),
  conclusion: z.string().max(2000).optional(),
  furtherTestingRequired: z.boolean().optional(),
}).strict();

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { findingId } = findingIdParamsSchema.parse(params);
    const body = await parseJsonBody(request, bodySchema);
    const data = await addRootCauseAnalysis(actor, findingId, body);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
