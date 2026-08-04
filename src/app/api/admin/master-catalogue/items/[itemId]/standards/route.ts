import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { addStandardApplicabilityAsOwner, listApplicabilitiesForItemAsOwner } from "@/lib/services/standards-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ itemId: z.string().uuid() });
const createSchema = z.object({
  standardAuthorityId: z.string().uuid(),
  clauseReference: z.string().max(255).optional(),
  region: z.enum(["UAE", "GCC", "INTERNATIONAL", "COUNTRY_SPECIFIC"]).optional(),
  applicabilityType: z.enum(["MANDATORY", "ADVISORY"]).optional(),
  sourceDocumentReference: z.string().min(1).max(500),
});

type RouteContext = { params: Promise<{ itemId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { itemId } = paramsSchema.parse(await context.params);
    return apiSuccess(await listApplicabilitiesForItemAsOwner(actor, itemId));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { itemId } = paramsSchema.parse(await context.params);
    const input = createSchema.parse(await request.json());
    return apiSuccess(await addStandardApplicabilityAsOwner(actor, { masterItemId: itemId, ...input }), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
