import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { createFromMaster } from "@/lib/services/company-library-service";
import { companyLibraryFromMasterSchema } from "@/lib/validation/phase7-schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { masterItemId, ...overrides } = await parseJsonBody(request, companyLibraryFromMasterSchema);
    const data = await createFromMaster(actor, masterItemId, overrides);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
