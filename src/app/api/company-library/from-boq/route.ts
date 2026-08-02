import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { createFromBoqItem } from "@/lib/services/company-library-service";
import { companyLibraryFromBoqSchema } from "@/lib/validation/phase7-schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { boqItemId, ...overrides } = await parseJsonBody(request, companyLibraryFromBoqSchema);
    const data = await createFromBoqItem(actor, boqItemId, overrides);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
