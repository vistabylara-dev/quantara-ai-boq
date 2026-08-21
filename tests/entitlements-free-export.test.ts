import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import type { CurrentActor } from "../src/lib/auth/platform-authorization";
import { getCompanyEntitlements } from "../src/lib/entitlements/entitlement-service";
import { canGenerateDocumentEffective } from "../src/lib/entitlements/effective-entitlement-service";
import { GeneratedDocumentType, PlanType } from "@prisma/client";
import { generateDocument } from "../src/lib/services/document-generation-service";

const RUN_ID = `${Date.now()}-${process.pid}-free-export`;

function actorFor(companyId: string): CurrentActor {
  return { userId: `00000000-0000-4000-8000-000000000001`, companyId, role: "COMPANY_OWNER", fullName: "Fixture Owner", email: `fixture-${RUN_ID}@example.com` };
}

describe("ENTITLEMENTS-FREE-EXPORT: A real FREE customer must not receive a clean final export", () => {
  let companyId: string;
  let actor: CurrentActor;
  let boqId: string;
  let projectId: string;
  let templateId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { legalName: `Free Export Test Co ${RUN_ID}`, tradeName: "Free Export Test", email: `free-export-${RUN_ID}@example.com` },
    });
    companyId = company.id;
    actor = actorFor(companyId);

    const client = await prisma.client.create({
      data: { companyId, name: `Client ${RUN_ID}` },
    });
    const engine = await prisma.industryEngine.findFirstOrThrow();
    const project = await prisma.project.create({
      data: { companyId, clientId: client.id, industryEngineId: engine.id, slug: `p-${RUN_ID}`, reference: `ref-${RUN_ID}`, name: `Project ${RUN_ID}`, status: "DRAFT" },
    });
    projectId = project.id;
    // We must lock the BOQ so that generation doesn't fail with "LOCKED_REVISION_REQUIRED"
    const boq = await prisma.bOQ.create({
      data: { companyId, projectId: project.id, revisionNumber: 1, status: "LOCKED", isLocked: true, title: "BOQ" },
    });
    boqId = boq.id;
    
    // Create at least one item to bypass BOQ_REVISION_EMPTY
    const section = await prisma.bOQSection.create({ data: { companyId, boqId: boq.id, code: "S1", title: "Sec 1", sortOrder: 1 } });
    await prisma.bOQItem.create({ data: { companyId, sectionId: section.id, itemNumber: 1, itemCode: "ITM", description: "Item", quantity: 1, unit: "m", unitCost: 10, marginPercentage: 10, sortOrder: 1, category: "M" } });

    // Create a template for generation
    const template = await prisma.documentTemplate.create({
      data: {
        companyId,
        name: "Test Template",
        code: "TPL1",
        type: "CORPORATE_TECHNICAL",
        styleConfigJson: {},
        contentConfigJson: {},
      },
    });
    templateId = template.id;
  });

  afterAll(async () => {
    await prisma.documentTemplate.deleteMany({ where: { companyId } });
    await prisma.generatedDocument.deleteMany({ where: { companyId } });
    await prisma.bOQItem.deleteMany({ where: { companyId } });
    await prisma.bOQSection.deleteMany({ where: { companyId } });
    await prisma.bOQ.deleteMany({ where: { companyId } });
    await prisma.project.deleteMany({ where: { companyId } });
    await prisma.client.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it("1. getCompanyEntitlements: planType FREE, status NONE", async () => {
    const entitlements = await getCompanyEntitlements(companyId);
    expect(entitlements.planType).toBe("FREE");
    expect(entitlements.status).toBe("NONE");
  });

  it("2. PDF clean final is blocked, throws DOCUMENT_EXPORT_NOT_ALLOWED, creates no output", async () => {
    await expect(generateDocument(actor, projectId, { boqId, documentType: GeneratedDocumentType.PDF, audience: "EXTERNAL", templateId, pricingMode: "WITH_PRICES" })).rejects.toMatchObject({ code: "DOCUMENT_EXPORT_NOT_ALLOWED" });
    const docs = await prisma.generatedDocument.count({ where: { boqId, type: GeneratedDocumentType.PDF } });
    expect(docs).toBe(0);
  });

  it("3. DOCX WITH_PRICES clean final is blocked, throws DOCUMENT_EXPORT_NOT_ALLOWED, creates no output", async () => {
    await expect(generateDocument(actor, projectId, { boqId, documentType: GeneratedDocumentType.DOCX, audience: "EXTERNAL", templateId, pricingMode: "WITH_PRICES" })).rejects.toMatchObject({ code: "DOCUMENT_EXPORT_NOT_ALLOWED" });
    const docs = await prisma.generatedDocument.count({ where: { boqId, type: GeneratedDocumentType.DOCX } });
    expect(docs).toBe(0);
  });

  it("4. XLSX clean final is blocked, throws DOCUMENT_EXPORT_NOT_ALLOWED, creates no output", async () => {
    await expect(generateDocument(actor, projectId, { boqId, documentType: GeneratedDocumentType.XLSX, audience: "EXTERNAL", templateId, pricingMode: "WITH_PRICES" })).rejects.toMatchObject({ code: "DOCUMENT_EXPORT_NOT_ALLOWED" });
    const docs = await prisma.generatedDocument.count({ where: { boqId, type: GeneratedDocumentType.XLSX } });
    expect(docs).toBe(0);
  });

  it("5. an ACTIVE paid-plan control still permits the existing clean-export path", async () => {
    const paidCompany = await prisma.company.create({
      data: { legalName: `Paid Export Test Co ${RUN_ID}`, tradeName: "Paid Export Test", email: `paid-export-${RUN_ID}@example.com` },
    });
    
    const softwarePlan = await prisma.softwarePlan.findFirstOrThrow({ where: { planType: PlanType.PRO, isActive: true } });
    await prisma.companySoftwareSubscription.create({
      data: {
        companyId: paidCompany.id,
        softwarePlanId: softwarePlan.id,
        status: "ACTIVE",
        startsAt: new Date(),
        source: "stripe",
      },
    });

    const paidActor = actorFor(paidCompany.id);
    const entitlements = await getCompanyEntitlements(paidCompany.id);
    expect(entitlements.planType).toBe("PRO");

    const paidPdfCheck = await canGenerateDocumentEffective(paidActor, false, boqId);
    expect(paidPdfCheck.reason).toBeNull();
    expect(paidPdfCheck.allowed).toBe(true);

    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: paidCompany.id } });
    await prisma.company.deleteMany({ where: { id: paidCompany.id } });
  });
});
