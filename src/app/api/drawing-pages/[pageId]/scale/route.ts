import { z } from "zod";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getPageScale, setManualScale } from "@/lib/services/scale-calibration-service";
import { drawingPageIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: { pageId: string } };

const setScaleBodySchema = z.object({
  scaleRatio: z.number().positive(),
  drawingUnit: z.string().trim().min(1).max(20),
  realWorldUnit: z.string().trim().min(1).max(20),
}).strict();

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { pageId } = drawingPageIdParamsSchema.parse(context.params);
    const data = await getPageScale(actor, pageId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { pageId } = drawingPageIdParamsSchema.parse(context.params);
    const body = await parseJsonBody(request, setScaleBodySchema);
    const data = await setManualScale(actor, pageId, body);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
