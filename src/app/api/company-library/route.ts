import { CompanyLibrarySourceType } from "@prisma/client";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { createManualLibraryItem, listLibraryItemsForCompany } from "@/lib/services/company-library-service";
import { companyLibraryCreateSchema } from "@/lib/validation/phase7-schema";

export const dynamic = "force-dynamic";

function parseSourceType(raw: string | null): CompanyLibrarySourceType | undefined {
  return raw && (Object.values(CompanyLibrarySourceType) as string[]).includes(raw)
    ? (raw as CompanyLibrarySourceType)
    : undefined;
}

export async function GET(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const url = new URL(request.url);
    const data = await listLibraryItemsForCompany(actor, {
      disciplineId: url.searchParams.get("disciplineId") ?? undefined,
      categoryId: url.searchParams.get("categoryId") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      favoritesOnly: url.searchParams.get("favoritesOnly") === "true",
      activeOnly: url.searchParams.get("includeArchived") !== "true",
      sourceType: parseSourceType(url.searchParams.get("sourceType")),
      // "My Items" — resolved server-side from the authenticated session so a
      // client can never request another user's items by guessing an id.
      createdByUserId: url.searchParams.get("mine") === "true" ? actor.userId : undefined,
      page: url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined,
      pageSize: url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined,
    });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const input = await parseJsonBody(request, companyLibraryCreateSchema);
    const data = await createManualLibraryItem(actor, input);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
