import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { upsertDrawingProfile } from "@/lib/services/master-item-governance-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ itemId: z.string().uuid() });
const bodySchema = z.object({
  drawingTypes: z.array(z.string().max(100)).max(50).optional(),
  scheduleTypes: z.array(z.string().max(100)).max(50).optional(),
  symbolReference: z.string().max(255).optional(),
  cadLayerReference: z.string().max(255).optional(),
  ifcClass: z.string().max(255).optional(),
  revitCategory: z.string().max(255).optional(),
  roomSpaceTypes: z.array(z.string().max(100)).max(50).optional(),
  quantityMethod: z.enum(["COUNT", "LENGTH", "AREA", "VOLUME", "WEIGHT"]).optional(),
});

type RouteContext = { params: Promise<{ itemId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { itemId } = paramsSchema.parse(await context.params);
    const input = bodySchema.parse(await request.json());
    return apiSuccess(await upsertDrawingProfile(actor, itemId, input), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
