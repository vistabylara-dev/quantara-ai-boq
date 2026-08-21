import { z } from "zod";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { createFinding } from "@/lib/services/finding-service";
import { inspectionIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ inspectionId: string }> };

const bodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  observedCondition: z.string().max(2000).optional(),
  expectedCondition: z.string().max(2000).optional(),
  severity: z.string().max(20).optional(),
  location: z.string().max(200).optional(),
}).strict();

async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { inspectionId } = inspectionIdParamsSchema.parse(params);
    const body = await parseJsonBody(request, bodySchema);
    const data = await createFinding(actor, inspectionId, body);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
