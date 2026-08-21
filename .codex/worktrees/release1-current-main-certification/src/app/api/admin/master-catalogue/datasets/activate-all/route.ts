import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { activateAllDatasets } from "@/lib/services/industry-package-activation-service";

export const dynamic = "force-dynamic";
// Drives as many registered datasets as fit in one call (each already
// resumable on its own) — generous headroom since this may process
// several datasets' worth of batches in a single invocation.
export const maxDuration = 300;

const bodySchema = z.object({ datasetIds: z.array(z.string().min(1)).optional() }).strict();

async function parseOptionalBody(request: Request): Promise<{ datasetIds?: string[] }> {
  const text = await request.text();
  if (!text.trim()) return {};
  return bodySchema.parse(JSON.parse(text));
}

/**
 * CATALOGUE-COMMERCIAL-RECOVERY — one call to drive every registered
 * dataset toward CUSTOMER_ACTIVE instead of the owner opening the admin
 * panel once per dataset. Safe to call repeatedly: already-active datasets
 * are skipped, in-progress ones resume from their persisted cursor. Large
 * datasets may need this called more than once — check the response's
 * `results[].outcome` for IN_PROGRESS / TIME_BUDGET_EXCEEDED entries.
 */
export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const input = await parseOptionalBody(request);
    return apiSuccess(await activateAllDatasets(actor, { datasetIds: input.datasetIds }));
  } catch (error) {
    return handleApiError(error);
  }
}
