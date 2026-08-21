import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getMasterItemAdminDetail } from "@/lib/services/master-item-governance-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ itemId: z.string().uuid() });

type RouteContext = { params: Promise<{ itemId: string }> };

/** Full admin detail: versions (including drafts), classifications, region, drawing profile, attribute values, hierarchy breadcrumb. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { itemId } = paramsSchema.parse(await context.params);
    return apiSuccess(await getMasterItemAdminDetail(actor, itemId));
  } catch (error) {
    return handleApiError(error);
  }
}
