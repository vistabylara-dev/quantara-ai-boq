import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { AppError } from "@/lib/errors/app-error";
import { getCatalogueDataset } from "@/lib/services/catalogue-dataset-registry";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ datasetKey: z.string().min(1).max(64) });
const bodySchema = z.object({ uploadedFileName: z.string().min(1).max(255), csvText: z.string().min(1) });

type RouteContext = { params: Promise<{ datasetKey: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { datasetKey } = paramsSchema.parse(await context.params);
    const dataset = getCatalogueDataset(datasetKey);
    if (!dataset) throw new AppError("UNKNOWN_DATASET", `No catalogue dataset registered for key "${datasetKey}".`, 404);
    const input = bodySchema.parse(await request.json());
    return apiSuccess(await dataset.execute(actor, input));
  } catch (error) {
    return handleApiError(error);
  }
}
