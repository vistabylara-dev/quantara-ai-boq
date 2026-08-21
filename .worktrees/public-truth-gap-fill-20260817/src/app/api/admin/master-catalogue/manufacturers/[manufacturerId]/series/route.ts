import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { createProductSeriesAsOwner, listSeriesForManufacturerAsOwner } from "@/lib/services/manufacturer-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ manufacturerId: z.string().uuid() });
const createSchema = z.object({ seriesName: z.string().min(1).max(255), hierarchyNodeId: z.string().uuid().optional() });

type RouteContext = { params: Promise<{ manufacturerId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { manufacturerId } = paramsSchema.parse(await context.params);
    return apiSuccess(await listSeriesForManufacturerAsOwner(actor, manufacturerId));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { manufacturerId } = paramsSchema.parse(await context.params);
    const input = createSchema.parse(await request.json());
    return apiSuccess(await createProductSeriesAsOwner(actor, { manufacturerId, ...input }), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
