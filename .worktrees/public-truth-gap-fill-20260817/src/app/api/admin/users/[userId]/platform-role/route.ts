import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import {
  buildPlatformRequestMetadata,
  updatePlatformUserRole,
} from "@/lib/services/platform-admin-service";
import {
  platformAdminUserIdParamsSchema,
  platformUserRoleUpdateSchema,
} from "@/lib/validation/platform-admin-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { userId } = platformAdminUserIdParamsSchema.parse(await context.params);
    const input = await parseJsonBody(request, platformUserRoleUpdateSchema);
    return apiSuccess(
      await updatePlatformUserRole(
        actor,
        userId,
        input,
        buildPlatformRequestMetadata(request),
      ),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
