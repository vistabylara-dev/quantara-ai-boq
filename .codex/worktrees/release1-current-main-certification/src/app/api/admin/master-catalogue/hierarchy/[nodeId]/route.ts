import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { setHierarchyNodeActive, updateHierarchyNodeAsOwner } from "@/lib/services/master-hierarchy-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ nodeId: z.string().uuid() });
const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  parentId: z.string().uuid().nullable().optional(),
  regionScope: z.enum(["UAE", "GCC", "INTERNATIONAL", "COUNTRY_SPECIFIC"]).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ nodeId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { nodeId } = paramsSchema.parse(await context.params);
    const body = patchSchema.parse(await request.json());

    if (Object.keys(body).length === 1 && body.isActive !== undefined) {
      return apiSuccess(await setHierarchyNodeActive(actor, nodeId, body.isActive));
    }
    const { isActive, ...rest } = body;
    const updated = await updateHierarchyNodeAsOwner(actor, nodeId, rest);
    if (isActive !== undefined) {
      return apiSuccess(await setHierarchyNodeActive(actor, nodeId, isActive));
    }
    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
