import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { createDocumentTemplateDraftVersion, listDocumentTemplateVersions } from "@/lib/services/template-governance-service";
import { templateIdParamsSchema } from "@/lib/validation/route-params";
import { boqTemplateDraftVersionSchema } from "@/lib/validation/template-governance-schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ templateId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { templateId } = templateIdParamsSchema.parse(await context.params);
    const data = await listDocumentTemplateVersions(actor, templateId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { templateId } = templateIdParamsSchema.parse(await context.params);
    const input = await parseJsonBody(request, boqTemplateDraftVersionSchema);
    const data = await createDocumentTemplateDraftVersion(actor, templateId, input);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
