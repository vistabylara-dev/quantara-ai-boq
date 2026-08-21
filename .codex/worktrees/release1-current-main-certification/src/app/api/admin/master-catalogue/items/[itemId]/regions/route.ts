import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { addRegionalApplicability } from "@/lib/services/master-item-governance-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ itemId: z.string().uuid() });
const bodySchema = z.object({
  scope: z.enum(["UAE", "GCC", "INTERNATIONAL", "COUNTRY_SPECIFIC"]),
  countryCode: z.string().max(10).nullable().optional(),
  effectiveFrom: z.string().datetime().nullable().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
});

type RouteContext = { params: Promise<{ itemId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { itemId } = paramsSchema.parse(await context.params);
    const input = bodySchema.parse(await request.json());
    return apiSuccess(await addRegionalApplicability(actor, itemId, input), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
