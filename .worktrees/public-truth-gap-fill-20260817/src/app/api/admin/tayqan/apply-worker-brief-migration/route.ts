import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { AppError } from "@/lib/errors/app-error";
import { handleApiError } from "@/lib/http/api-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Historical one-time TAYQAN worker-brief migration endpoint.
 *
 * The migration has already been applied and independently verified by the
 * production schema-recovery evidence. The historical URL remains owner-only,
 * but its mutation capability is permanently disabled.
 */
export async function POST() {
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);

    throw new AppError(
      "TAYQAN_MIGRATION_DISABLED",
      "The TAYQAN worker-brief migration has already been applied and verified. This one-time HTTP migration executor is permanently disabled.",
      410,
    );
  } catch (error) {
    return handleApiError(error);
  }
}