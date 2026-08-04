import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { setAttributeValue } from "@/lib/services/master-item-governance-service";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    masterItemId: z.string().uuid().optional(),
    variantId: z.string().uuid().optional(),
    fieldDefinitionId: z.string().uuid(),
    valueText: z.string().max(2000).optional(),
    valueNumber: z.number().optional(),
    valueBoolean: z.boolean().optional(),
    valueDate: z.string().datetime().optional(),
    unit: z.string().max(50).optional(),
    source: z.string().max(255).optional(),
    verificationState: z.enum(["UNVERIFIED", "VERIFIED", "NEEDS_REVIEW"]).optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const input = bodySchema.parse(await request.json());
    return apiSuccess(await setAttributeValue(actor, input), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
