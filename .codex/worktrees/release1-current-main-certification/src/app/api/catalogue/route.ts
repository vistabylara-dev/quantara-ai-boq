import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { createCatalogueItemForCompany, listCatalogueItemsForCompany } from "@/lib/services/catalogue-service";
import { catalogueItemCreateSchema, catalogueListQuerySchema } from "@/lib/validation/catalogue-schema";

export async function GET(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const url = new URL(request.url);
    const query = catalogueListQuerySchema.parse({
      search: url.searchParams.get("search") ?? undefined,
      industryEngineId: url.searchParams.get("industryEngineId") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      supplierId: url.searchParams.get("supplierId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      expired: url.searchParams.get("expired") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });
    const result = await listCatalogueItemsForCompany(actor, query);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const input = await parseJsonBody(request, catalogueItemCreateSchema);
    const item = await createCatalogueItemForCompany(actor, input);
    return apiSuccess(item, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
