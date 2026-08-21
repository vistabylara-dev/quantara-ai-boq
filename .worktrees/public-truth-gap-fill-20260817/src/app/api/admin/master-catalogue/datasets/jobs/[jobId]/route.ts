import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getJob } from "@/lib/services/master-catalogue-import-job-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ jobId: z.string().uuid() });

type RouteContext = { params: Promise<{ jobId: string }> };

/** CATALOGUE-PROD-ACTIVATE — current job state (progress survives a page refresh — it's read straight from here). */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { jobId } = paramsSchema.parse(await context.params);
    return apiSuccess(await getJob(actor, jobId));
  } catch (error) {
    return handleApiError(error);
  }
}
