import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { executeMasterCatalogueImport, listMasterCatalogueImportBatches } from "@/lib/services/master-catalogue-admin-service";

export const dynamic = "force-dynamic";

const executeSchema = z.object({
  disciplineId: z.string().uuid(),
  uploadedFileName: z.string().min(1).max(255),
  csvText: z.string().min(1),
});

export async function GET() {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    return apiSuccess(await listMasterCatalogueImportBatches(actor));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const body = await request.json();
    const input = executeSchema.parse(body);
    return apiSuccess(await executeMasterCatalogueImport(actor, input), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
