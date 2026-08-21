import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { transitionVersionStatus } from "@/lib/services/master-item-governance-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ itemId: z.string().uuid(), versionId: z.string().uuid() });
const bodySchema = z.object({
  status: z.enum(["REVIEW", "APPROVED", "PUBLISHED", "RETIRED", "DRAFT"]),
  note: z.string().max(2000).optional(),
});

type RouteContext = { params: Promise<{ itemId: string; versionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { versionId } = paramsSchema.parse(await context.params);
    const { status, note } = bodySchema.parse(await request.json());
    return apiSuccess(await transitionVersionStatus(actor, versionId, status, note));
  } catch (error) {
    return handleApiError(error);
  }
}
