import { EmailTemplateCategory } from "@prisma/client";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import {
  createEmailTemplateForCompany,
  listEmailTemplatesForCompany,
  listEmailTemplatesForCompanyByCategory,
} from "@/lib/services/email-template-service";
import { emailTemplateCreateSchema } from "@/lib/validation/proposal-schema";

export const dynamic = "force-dynamic";

function parseCategory(value: string | null): EmailTemplateCategory | null {
  if (!value) return null;
  return (Object.values(EmailTemplateCategory) as string[]).includes(value) ? (value as EmailTemplateCategory) : null;
}

/** ?category=BOQ|TECHNICAL_REPORT|GENERAL scopes the list to a single send flow's own templates
 *  (active only) — used by the proposal and technical-report send pickers. Omit it to get the full
 *  list (active + inactive, per includeInactive) for the Settings management page. */
async function GETHandler(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const url = new URL(request.url);
    const category = parseCategory(url.searchParams.get("category"));
    if (category) {
      const data = await listEmailTemplatesForCompanyByCategory(actor, category);
      return apiSuccess(data);
    }
    const includeInactive = url.searchParams.get("includeInactive") === "true";
    const data = await listEmailTemplatesForCompany(actor, includeInactive);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

async function POSTHandler(request: Request) {
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

export const GET = withActorRequestContext(GETHandler);
export const POST = withActorRequestContext(POSTHandler);
