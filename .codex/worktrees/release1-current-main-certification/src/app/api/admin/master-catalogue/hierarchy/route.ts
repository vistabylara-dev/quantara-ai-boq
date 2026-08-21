import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { createOrUpdateHierarchyNode, getAdminHierarchyTree } from "@/lib/services/master-hierarchy-service";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  code: z.string().min(1).max(160),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  nodeType: z.enum(["INDUSTRY", "DISCIPLINE", "SYSTEM", "CATEGORY", "SUBCATEGORY", "ITEM_FAMILY"]),
  parentId: z.string().uuid().nullable().optional(),
  regionScope: z.enum(["UAE", "GCC", "INTERNATIONAL", "COUNTRY_SPECIFIC"]).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET() {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    return apiSuccess(await getAdminHierarchyTree(actor));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const input = createSchema.parse(await request.json());
    return apiSuccess(await createOrUpdateHierarchyNode(actor, input), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
