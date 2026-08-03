import { z } from "zod";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { importExtractedEntityToBoq } from "@/lib/services/extraction-to-boq-service";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

const bodySchema = z.object({
  boqId: z.string().uuid(),
  entityId: z.string().uuid(),
  sectionId: z.string().uuid(),
  itemNumber: z.number().int().positive(),
  itemCode: z.string().min(1).max(50),
  category: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  unit: z.string().min(1).max(20),
  quantity: z.number().positive(),
  unitCost: z.number().min(0),
  marginPercentage: z.number().min(0),
}).strict();

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    projectIdParamsSchema.parse(params);
    const body = await parseJsonBody(request, bodySchema);
    const data = await importExtractedEntityToBoq(actor, body.boqId, body.entityId, body);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
