import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { listTechnicalReportTemplatesForAdmin } from "@/lib/services/template-admin-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const data = await listTechnicalReportTemplatesForAdmin(actor);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
