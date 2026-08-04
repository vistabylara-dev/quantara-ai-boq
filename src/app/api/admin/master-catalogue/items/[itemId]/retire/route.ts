import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { retireMasterItem } from "@/lib/services/master-item-governance-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ itemId: z.string().uuid() });
const bodySchema = z.object({ replacementItemId: z.string().uuid().nullable().optional() });

type RouteContext = { params: Promise<{ itemId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { itemId } = paramsSchema.parse(await context.params);
    const { replacementItemId } = bodySchema.parse(await request.json().catch(() => ({})));
    return apiSuccess(await retireMasterItem(actor, itemId, replacementItemId));
  } catch (error) {
    return handleApiError(error);
  }
}
