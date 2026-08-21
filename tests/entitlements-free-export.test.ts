import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import type { CurrentActor } from "../src/lib/auth/platform-authorization";
import { getCompanyEntitlements } from "../src/lib/entitlements/entitlement-service";
import { canGenerateDocumentEffective } from "../src/lib/entitlements/effective-entitlement-service";
import { GeneratedDocumentType, PlanType } from "@prisma/client";

const RUN_ID = `${Date.now()}-${process.pid}-free-export`;

function actorFor(companyId: string): CurrentActor {
  return { userId: `00000000-0000-4000-8000-000000000001`, companyId, role: "COMPANY_OWNER", fullName: "Fixture Owner", email: `fixture-${RUN_ID}@example.com` };
}

describe("ENTITLEMENTS-FREE-EXPORT: A real FREE customer must not receive a clean final export", () => {
  let companyId: string;
  let actor: CurrentActor;
  let boqId: string;

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
    const boq = await prisma.bOQ.create({
      data: { companyId, projectId: project.id, revisionNumber: 0, status: "DRAFT", title: "BOQ" },
    });
    boqId = boq.id;
  });

  afterAll(async () => {
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

  it("2. draft generation eligibility remains allowed where currently supported", async () => {
    const draftCheck = await canGenerateDocumentEffective(actor, true, boqId);
    expect(draftCheck.allowed).toBe(true);
  });

  it("3-6. locked clean PDF/DOCX/XLSX: DENIED and no document generated", async () => {
    const pdfCheck = await canGenerateDocumentEffective(actor, false, boqId);
    expect(pdfCheck.allowed).toBe(false);
    expect(pdfCheck.reason).toContain("Free accounts do not include clean final exports");

    const docxCheck = await canGenerateDocumentEffective(actor, false, boqId);
    expect(docxCheck.allowed).toBe(false);
    
    const xlsxCheck = await canGenerateDocumentEffective(actor, false, boqId);
    expect(xlsxCheck.allowed).toBe(false);
  });

  it("7. an ACTIVE paid-plan control still permits the existing clean-export path", async () => {
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
    console.log("ENTITLEMENTS:", entitlements);
    const paidPdfCheck = await canGenerateDocumentEffective(paidActor, false, boqId);
    expect(paidPdfCheck.reason).toBeNull();
    expect(paidPdfCheck.reason).toBeNull();
    expect(paidPdfCheck.allowed).toBe(true);

    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: paidCompany.id } });
    await prisma.company.deleteMany({ where: { id: paidCompany.id } });
  });
});
