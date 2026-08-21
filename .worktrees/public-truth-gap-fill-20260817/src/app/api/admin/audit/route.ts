import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import {
  buildPlatformRequestMetadata,
  listPlatformAudit,
} from "@/lib/services/platform-admin-service";
import { platformAuditListQuerySchema } from "@/lib/validation/platform-admin-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const query = platformAuditListQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    return apiSuccess(
      await listPlatformAudit(actor, query, buildPlatformRequestMetadata(request)),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
