import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { createEmailTemplateForCompany, listEmailTemplatesForCompany } from "@/lib/services/email-template-service";
import { emailTemplateCreateSchema } from "@/lib/validation/proposal-schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("includeInactive") === "true";
    const data = await listEmailTemplatesForCompany(actor, includeInactive);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const input = await parseJsonBody(request, emailTemplateCreateSchema);
    const data = await createEmailTemplateForCompany(actor, input);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
