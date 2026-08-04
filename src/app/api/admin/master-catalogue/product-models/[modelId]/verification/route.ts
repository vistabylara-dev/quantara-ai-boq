import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { setProductModelVerificationStateAsOwner } from "@/lib/services/manufacturer-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ modelId: z.string().uuid() });
const bodySchema = z.object({ verificationState: z.enum(["UNVERIFIED", "VERIFIED", "NEEDS_REVIEW"]) });

type RouteContext = { params: Promise<{ modelId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { modelId } = paramsSchema.parse(await context.params);
    const { verificationState } = bodySchema.parse(await request.json());
    return apiSuccess(await setProductModelVerificationStateAsOwner(actor, modelId, verificationState));
  } catch (error) {
    return handleApiError(error);
  }
}
