import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { createFromCatalogue } from "@/lib/services/company-library-service";
import { companyLibraryFromCatalogueSchema } from "@/lib/validation/phase7-schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { rateCatalogueItemId, ...overrides } = await parseJsonBody(request, companyLibraryFromCatalogueSchema);
    const data = await createFromCatalogue(actor, rateCatalogueItemId, overrides);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
