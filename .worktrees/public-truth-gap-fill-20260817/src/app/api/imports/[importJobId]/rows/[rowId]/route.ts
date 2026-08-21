import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { updateImportRow } from "@/lib/services/import-service";
import { importRowUpdateSchema } from "@/lib/validation/phase7-schema";
import { importJobRowIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ importJobId: string; rowId: string }> };

/** Patches in values a reviewer fills in by hand (missing item code, unit, etc.) and re-validates
 * the whole job so status/counts stay correct — used from the "ignore missing / fix in place"
 * flow on the import job page instead of forcing a full re-upload for one bad row. */
async function PATCHHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { importJobId, rowId } = importJobRowIdParamsSchema.parse(params);
    const input = await parseJsonBody(request, importRowUpdateSchema);
    const data = await updateImportRow(actor, importJobId, rowId, input);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const PATCH = withActorRequestContext(PATCHHandler);
