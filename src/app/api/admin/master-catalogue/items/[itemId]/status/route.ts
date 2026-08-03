import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { setMasterItemStatus } from "@/lib/services/master-catalogue-admin-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ itemId: z.string().uuid() });
const bodySchema = z.object({ status: z.enum(["ACTIVE", "DEPRECATED", "ARCHIVED"]) });

type RouteContext = { params: Promise<{ itemId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { itemId } = paramsSchema.parse(await context.params);
    const { status } = bodySchema.parse(await request.json());
    return apiSuccess(await setMasterItemStatus(actor, itemId, status));
  } catch (error) {
    return handleApiError(error);
  }
}
