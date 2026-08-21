import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { createTemplateForCompany, listTemplatesForCompany } from "@/lib/services/document-template-service";
import { documentTemplateCreateSchema, templateListQuerySchema } from "@/lib/validation/document-schema";

export const dynamic = "force-dynamic";

async function GETHandler(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const url = new URL(request.url);
    const filters = templateListQuerySchema.parse({
      industryEngineId: url.searchParams.get("industryEngineId") ?? undefined,
      type: url.searchParams.get("type") ?? undefined,
      includeInactive: url.searchParams.get("includeInactive") ?? undefined,
    });
    const data = await listTemplatesForCompany(actor, filters);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

async function POSTHandler(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const input = await parseJsonBody(request, documentTemplateCreateSchema);
    const data = await createTemplateForCompany(actor, input);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
export const POST = withActorRequestContext(POSTHandler);
