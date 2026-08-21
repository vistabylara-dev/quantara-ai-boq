import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { publishJobToPackage } from "@/lib/services/industry-package-activation-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ jobId: z.string().uuid() });

type RouteContext = { params: Promise<{ jobId: string }> };

/** CATALOGUE-CREATE-1 — assigns a completed job's MasterItems to its dataset's commercial package (creating the package if needed). Idempotent. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { jobId } = paramsSchema.parse(await context.params);
    return apiSuccess(await publishJobToPackage(actor, jobId));
  } catch (error) {
    return handleApiError(error);
  }
}
