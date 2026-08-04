import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { transitionDocumentTemplateVersion } from "@/lib/services/template-governance-service";
import { templateVersionIdParamsSchema } from "@/lib/validation/route-params";
import { templateVersionTransitionSchema } from "@/lib/validation/template-governance-schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ versionId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { versionId } = templateVersionIdParamsSchema.parse(await context.params);
    const { status } = await parseJsonBody(request, templateVersionTransitionSchema);
    const data = await transitionDocumentTemplateVersion(actor, versionId, status);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
