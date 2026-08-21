import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { createDraftVersion, listVersionsForItem } from "@/lib/services/master-item-governance-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ itemId: z.string().uuid() });
const createSchema = z.object({
  name: z.string().min(1).max(255),
  shortDescription: z.string().max(2000).optional(),
  fullDescription: z.string().max(20000).optional(),
  specificationTemplate: z.string().max(20000).optional(),
  inclusionTemplate: z.string().max(20000).optional(),
  exclusionTemplate: z.string().max(20000).optional(),
  notesTemplate: z.string().max(20000).optional(),
  primaryUnit: z.string().min(1).max(50),
  measurementMethod: z.string().max(255).optional(),
  quantityBasis: z.string().max(255).optional(),
  roundingRule: z.string().max(255).optional(),
  changeSummary: z.string().max(2000).optional(),
});

type RouteContext = { params: Promise<{ itemId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { itemId } = paramsSchema.parse(await context.params);
    return apiSuccess(await listVersionsForItem(actor, itemId));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { itemId } = paramsSchema.parse(await context.params);
    const input = createSchema.parse(await request.json());
    return apiSuccess(await createDraftVersion(actor, itemId, input), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
