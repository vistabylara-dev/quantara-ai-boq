import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { registerAndDryRun } from "@/lib/services/master-catalogue-import-job-service";

export const dynamic = "force-dynamic";
// Read-only pass over the whole dataset (up to 13k+ rows) — no writes, but
// generous headroom over the platform default so a large dataset never
// times out mid-read.
export const maxDuration = 120;

const paramsSchema = z.object({ datasetId: z.string().min(1).max(128) });

type RouteContext = { params: Promise<{ datasetId: string }> };

/** CATALOGUE-PROD-ACTIVATE — full read-only dry run of a registered dataset's approved source files. Never mutates the database. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { datasetId } = paramsSchema.parse(await context.params);
    return apiSuccess(await registerAndDryRun(actor, datasetId));
  } catch (error) {
    return handleApiError(error);
  }
}
