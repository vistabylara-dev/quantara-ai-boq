import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { listBoqTemplatesForAdmin } from "@/lib/services/template-admin-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const data = await listBoqTemplatesForAdmin(actor);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
