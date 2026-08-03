import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { archiveLibraryItemForCompany, getLibraryItemForCompany, updateLibraryItemForCompany } from "@/lib/services/company-library-service";
import { companyLibraryUpdateSchema } from "@/lib/validation/phase7-schema";
import { libraryItemIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ itemId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { itemId } = libraryItemIdParamsSchema.parse(params);
    const data = await getLibraryItemForCompany(actor, itemId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { itemId } = libraryItemIdParamsSchema.parse(params);
    const { changeReason, ...input } = await parseJsonBody(request, companyLibraryUpdateSchema);
    const data = await updateLibraryItemForCompany(actor, itemId, input, changeReason);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Archives rather than deletes — user-owned library data is never destroyed (spec Phase 7 amendment section 6). */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { itemId } = libraryItemIdParamsSchema.parse(params);
    const data = await archiveLibraryItemForCompany(actor, itemId, false);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
