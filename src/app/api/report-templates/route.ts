import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { importTemplateFromSpec, listReportTemplatesForCompany } from "@/lib/services/report-template-service";
import { reportTemplateImportSchema, reportTemplateListQuerySchema } from "@/lib/validation/report-template-schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { searchParams } = new URL(request.url);
    const filters = reportTemplateListQuerySchema.parse(Object.fromEntries(searchParams));
    const data = await listReportTemplatesForCompany(actor, filters);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// Loads a report template from the same structured JSON shape the conversion tooling produces
// (front matter + ordered sections of heading/paragraph/table/callout blocks) — the "upload a
// template" entry point, mirroring how /api/imports accepts a BOQ master library file.
export async function POST(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const input = await parseJsonBody(request, reportTemplateImportSchema);
    const data = await importTemplateFromSpec(actor, input);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
