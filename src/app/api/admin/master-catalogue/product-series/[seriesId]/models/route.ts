import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { createProductModelAsOwner, listModelsForSeriesAsOwner } from "@/lib/services/manufacturer-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ seriesId: z.string().uuid() });
const createSchema = z.object({
  modelCode: z.string().min(1).max(100),
  masterItemVersionId: z.string().uuid().optional(),
  region: z.enum(["UAE", "GCC", "INTERNATIONAL", "COUNTRY_SPECIFIC"]).optional(),
  source: z.string().max(255).optional(),
});

type RouteContext = { params: Promise<{ seriesId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { seriesId } = paramsSchema.parse(await context.params);
    return apiSuccess(await listModelsForSeriesAsOwner(actor, seriesId));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { seriesId } = paramsSchema.parse(await context.params);
    const input = createSchema.parse(await request.json());
    return apiSuccess(await createProductModelAsOwner(actor, { productSeriesId: seriesId, ...input }), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
