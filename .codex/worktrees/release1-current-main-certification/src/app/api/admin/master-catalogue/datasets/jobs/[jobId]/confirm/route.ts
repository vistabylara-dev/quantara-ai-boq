import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { confirmExecution } from "@/lib/services/master-catalogue-import-job-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ jobId: z.string().uuid() });

type RouteContext = { params: Promise<{ jobId: string }> };

/**
 * CATALOGUE-PROD-ACTIVATE — arms a job for execution after the owner's
 * explicit confirmation. Re-verifies the source checksum against the dry
 * run's recorded identity and rejects if anything changed since.
 */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { jobId } = paramsSchema.parse(await context.params);
    return apiSuccess(await confirmExecution(actor, jobId));
  } catch (error) {
    return handleApiError(error);
  }
}
