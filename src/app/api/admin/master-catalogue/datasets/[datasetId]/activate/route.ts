import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { activateDataset } from "@/lib/services/industry-package-activation-service";

export const dynamic = "force-dynamic";
// Drives up to 40 x 200-row batches (8,000 rows) in one call plus dry-run/
// confirm/publish overhead — generous headroom for the larger datasets
// (Plumbing alone is 13,111 rows / ~66 batches, so this may need to be
// called more than once; each call always resumes from the persisted
// cursor, matching processNextBatch's own resumability contract).
export const maxDuration = 300;

const paramsSchema = z.object({ datasetId: z.string().min(1).max(128) });

type RouteContext = { params: Promise<{ datasetId: string }> };

/**
 * CATALOGUE-CREATE-1 — one-call driver for a registered dataset: reuses or
 * starts a dry run, confirms execution, runs batches to completion (or the
 * per-call cap), and publishes the completed items to their commercial
 * package. Call again to resume if a large dataset isn't finished yet
 * (`isComplete: false` in the response).
 */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { datasetId } = paramsSchema.parse(await context.params);
    return apiSuccess(await activateDataset(actor, datasetId));
  } catch (error) {
    return handleApiError(error);
  }
}
