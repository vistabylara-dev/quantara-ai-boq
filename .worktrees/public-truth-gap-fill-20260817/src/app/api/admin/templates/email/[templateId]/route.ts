import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getEmailTemplateForAdmin } from "@/lib/services/template-admin-service";
import { templateIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ templateId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { templateId } = templateIdParamsSchema.parse(await context.params);
    const data = await getEmailTemplateForAdmin(actor, templateId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
