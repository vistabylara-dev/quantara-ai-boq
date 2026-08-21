import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { getBOQRecord, toBOQDTO } from "@/lib/repositories/boq-repository";
import { getTemplate } from "@/lib/repositories/document-template-repository";
import { prisma } from "@/lib/db/prisma";
import { buildDocumentData } from "@/lib/documents/build-document-data";
import { generateHtml } from "@/lib/documents/generators/html-generator";
import { previewHtmlQuerySchema } from "@/lib/validation/document-schema";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";
import { NotFoundError } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

/**
 * Live, non-persisted HTML render for the interactive `/documents/preview`
 * page — no GeneratedDocument row, no audit log, no lock/verification
 * gating (the preview's whole purpose is to let you browse a draft,
 * including one with open issues, before committing to a real "Generate").
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { projectId } = projectIdParamsSchema.parse(params);
    const url = new URL(request.url);
    const { boqId, templateId, audience } = previewHtmlQuerySchema.parse({
      boqId: url.searchParams.get("boqId"),
      templateId: url.searchParams.get("templateId"),
      audience: url.searchParams.get("audience") ?? undefined,
    });

    const project = await getProjectRecord(actor.companyId, projectId);
    const boqRecord = await getBOQRecord(actor.companyId, boqId);
    if (boqRecord.projectId !== project.id) throw new NotFoundError("BOQ not found for this project.");
    const template = await getTemplate(actor.companyId, templateId);
    const company = await prisma.company.findUniqueOrThrow({ where: { id: actor.companyId } });

    const boqDto = toBOQDTO(boqRecord);
    const documentData = buildDocumentData({
      company: {
        legalName: company.legalName,
        tradeName: company.tradeName,
        email: company.email,
        phone: company.phone,
        website: company.website,
        address: company.address,
        taxRegistrationNumber: company.taxRegistrationNumber,
        defaultCurrency: company.defaultCurrency,
      },
      client: {
        name: project.client.name,
        companyName: project.client.companyName,
        email: project.client.email,
        phone: project.client.phone,
        address: project.client.address,
        taxRegistrationNumber: project.client.taxRegistrationNumber,
      },
      project: {
        name: project.name,
        reference: project.reference,
        location: project.location,
        currency: project.currency,
        taxRate: project.taxRate.toNumber(),
        language: project.language,
      },
      industryName: project.industryEngine.name,
      boq: boqDto,
      revisionNumber: boqRecord.revisionNumber,
      audience,
      templateName: template.name,
      documentType: "HTML",
      generatedByName: actor.fullName,
      isDraft: !boqRecord.isLocked,
      showInternalCostFieldsToClient: template.contentConfig.showInternalCostFieldsToClient,
    });

    const html = generateHtml({ data: documentData, style: template.styleConfig, content: template.contentConfig });
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (error) {
    return handleApiError(error);
  }
}
