import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { dryRunMasterCatalogueImport } from "@/lib/services/master-catalogue-admin-service";

export const dynamic = "force-dynamic";

const dryRunSchema = z.object({
  disciplineId: z.string().uuid(),
  uploadedFileName: z.string().min(1).max(255),
  csvText: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const body = await request.json();
    const input = dryRunSchema.parse(body);
    return apiSuccess(await dryRunMasterCatalogueImport(actor, input));
  } catch (error) {
    return handleApiError(error);
  }
}
