import { z } from "zod";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { createBoqItemsFromFinding } from "@/lib/services/finding-to-boq-service";
import { findingIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ findingId: string }> };

const bodySchema = z.object({
  boqId: z.string().uuid(),
  correctiveActionId: z.string().uuid().optional(),
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
    const { findingId } = findingIdParamsSchema.parse(params);
    const body = await parseJsonBody(request, bodySchema);
    const data = await createBoqItemsFromFinding(actor, body.boqId, findingId, body);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
