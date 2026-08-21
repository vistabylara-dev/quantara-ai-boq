import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { addClassification } from "@/lib/services/master-item-governance-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ itemId: z.string().uuid() });
const bodySchema = z.object({
  system: z.enum(["MASTERFORMAT_2020", "CSI", "OMNICLASS", "UNIFORMAT", "IFC", "INTERNAL_QUANTARA", "REVIT_CATEGORY", "CAD_LAYER", "REGIONAL_CODE", "COST_CODE"]),
  code: z.string().min(1).max(100),
  label: z.string().max(255).optional(),
  version: z.string().max(50).optional(),
  isPrimary: z.boolean().optional(),
  source: z.string().max(255).optional(),
});

type RouteContext = { params: Promise<{ itemId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { itemId } = paramsSchema.parse(await context.params);
    const input = bodySchema.parse(await request.json());
    return apiSuccess(await addClassification(actor, itemId, input), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
