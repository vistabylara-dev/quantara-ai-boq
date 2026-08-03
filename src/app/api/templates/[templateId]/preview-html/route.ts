import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getTemplateForCompany } from "@/lib/services/document-template-service";
import { buildSampleDocumentData } from "@/lib/documents/sample-document-data";
import { generateHtml } from "@/lib/documents/generators/html-generator";
import { templateIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ templateId: string }> };

/** Renders the template against hardcoded sample data — used by the template management UI's "Preview" action, where no real project/BOQ is selected. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { templateId } = templateIdParamsSchema.parse(params);
    const template = await getTemplateForCompany(actor, templateId);

    const documentData = buildSampleDocumentData({
      templateName: template.name,
      documentType: "HTML",
      audience: "CLIENT",
      showInternalCostFieldsToClient: template.contentConfig.showInternalCostFieldsToClient,
    });
    const html = generateHtml({ data: documentData, style: template.styleConfig, content: template.contentConfig });
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (error) {
    return handleApiError(error);
  }
}
