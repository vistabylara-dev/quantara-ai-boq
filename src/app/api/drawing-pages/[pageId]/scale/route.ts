import { z } from "zod";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { getPageScale, setManualScale } from "@/lib/services/scale-calibration-service";
import { drawingPageIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ pageId: string }> };

const setScaleBodySchema = z.object({
  scaleRatio: z.number().positive(),
  drawingUnit: z.string().trim().min(1).max(20),
  realWorldUnit: z.string().trim().min(1).max(20),
}).strict();

async function GETHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { pageId } = drawingPageIdParamsSchema.parse(params);
    const data = await getPageScale(actor, pageId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { pageId } = drawingPageIdParamsSchema.parse(params);
    const body = await parseJsonBody(request, setScaleBodySchema);
    const data = await setManualScale(actor, pageId, body);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
export const POST = withActorRequestContext(POSTHandler);
