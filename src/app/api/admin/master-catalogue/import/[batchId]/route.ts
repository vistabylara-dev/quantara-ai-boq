import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getMasterCatalogueImportBatch } from "@/lib/services/master-catalogue-admin-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ batchId: z.string().uuid() });

type RouteContext = { params: Promise<{ batchId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { batchId } = paramsSchema.parse(await context.params);
    return apiSuccess(await getMasterCatalogueImportBatch(actor, batchId));
  } catch (error) {
    return handleApiError(error);
  }
}
