
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { prisma } from "../src/lib/db/prisma";
import { reserveTrialFinalExport, releaseTrialFinalExport } from "../src/lib/entitlements/entitlement-service";
import { generateDocument } from "../src/lib/services/document-generation-service";

const RUN_ID = `${Date.now()}-${process.pid}-trial-conc`;

describe("TRIAL EXPORT CONCURRENCY HARDENING (FIX 4)", () => {
  let companyId: string;
  let projectId: string;
  let boqId: string;
  let templateId: string;
  
  const actor = () => ({
    userId: `00000000-0000-4000-8000-000000000002`,
    companyId,
    role: "COMPANY_OWNER",
        passwordHash: "test",
        fullName: "Trial Export Tester",
    email: `trial-export-${RUN_ID}@example.com`,
  });

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: {
        legalName: `Trial Concurrency ${RUN_ID}`,
        tradeName: "Trial Concurrency",
        email: `trial-${RUN_ID}@example.com`,
        address: "123 Main St",
        taxRegistrationNumber: "123456789",
        defaultCurrency: "AED",
      },
    });
    companyId = company.id;

    const plan = await prisma.softwarePlan.findFirstOrThrow({ where: { key: "commerce_starter" } });
    await prisma.companySoftwareSubscription.create({
      data: {
        company: { connect: { id: companyId } },
        softwarePlan: { connect: { id: plan.id } },
        status: "TRIAL",
        trialStartedAt: new Date(),
        trialExpiresAt: new Date(Date.now() + 86400000 * 3),
        source: "stripe",
      },
    });

    const engine = await prisma.industryEngine.findFirstOrThrow();
    
    
    const client = await prisma.client.create({
      data: {
        company: { connect: { id: companyId } },
        name: `Test Client ${RUN_ID}`,
      }
    });

    const project = await prisma.project.create({
      data: {
        company: { connect: { id: companyId } },
        industryEngine: { connect: { id: engine.id } },
        client: { connect: { id: client.id } },
        name: `Test Project ${RUN_ID}`,
        reference: `TP-${RUN_ID}`,
        slug: `test-${RUN_ID}`,
      }
    });

    projectId = project.id;

    const boq = await prisma.bOQ.create({
      data: {
        company: { connect: { id: companyId } },
        project: { connect: { id: project.id } },
        revisionNumber: 1,
        title: "Draft BOQ",
        status: "LOCKED",
        isLocked: true,
      }
    });
    boqId = boq.id;
    await prisma.user.create({
      data: {
        id: "00000000-0000-4000-8000-000000000002",
        companyId,
        email: `trial-export-${RUN_ID}@example.com`,
        fullName: "Trial Export Tester",
        role: "COMPANY_OWNER",
        passwordHash: "test"
      }
    });
    
    
    const section = await prisma.bOQSection.create({
      data: {
        company: { connect: { id: companyId } },
        boq: { connect: { id: boqId } },
        title: "Test Section",
        code: "S1",
        sortOrder: 1,
      }
    });
    
    const item = await prisma.bOQItem.create({
      data: {
        company: { connect: { id: companyId } },
        section: { connect: { id: section.id } },
        itemCode: "1.1",
        description: "Test Item",
        unit: "m2",
        quantity: "10",
        itemNumber: 1,
        category: "General",
        sortOrder: 1
      }
    });
    
    await prisma.bOQRevisionSnapshot.create({
      data: {
        company: { connect: { id: companyId } },
        project: { connect: { id: projectId } },
        boq: { connect: { id: boqId } },
        revisionNumber: 1,
        createdByName: "Test Runner",
        snapshotJson: { 
          sections: [{ 
            id: section.id, 
            title: "Test Section",
            code: "S1",
            sortOrder: 1,
            items: [{ 
              id: item.id,
              itemCode: "1.1",
              description: "Test Item",
              unit: "m2",
              quantity: "10",
              unitCost: "0",
              freightCost: "0",
              installationCost: "0",
              additionalCost: "0",
              landedCost: "0",
              marginPercentage: "0",
              sellingRate: "0",
              totalAmount: "0",
              wastagePercentage: "0",
              category: "General",
              sortOrder: 1
            }] 
          }],
          discountPercentage: "0",
          taxRate: "0"
        }
      }
    });





    
    
    const template = await prisma.documentTemplate.create({
      data: {
        companyId,
        name: "Test Tpl",
        code: "test_tpl",
        type: "CORPORATE_TECHNICAL",
        contentConfigJson: {},
        styleConfigJson: {}
      }
    });

    templateId = template.id;

  });

  afterAll(async () => {
    await prisma.generatedDocument.deleteMany({ where: { companyId } });
    await prisma.bOQItem.deleteMany({ where: { companyId } });
    await prisma.bOQSection.deleteMany({ where: { companyId } });
    await prisma.bOQ.deleteMany({ where: { companyId } });
    await prisma.documentTemplate.deleteMany({ where: { companyId } });
    await prisma.project.deleteMany({ where: { companyId } });
    await prisma.client.deleteMany({ where: { companyId } });
    await prisma.companyTrialUsage.deleteMany({ where: { companyId } });
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it("ATOMIC PRIMITIVE TEST: reserveTrialFinalExport and releaseTrialFinalExport", async () => {
    const results = await Promise.allSettled([
      reserveTrialFinalExport(companyId),
      reserveTrialFinalExport(companyId)
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    console.log("SECOND TEST RESULTS:", JSON.stringify(results, null, 2));

    console.log("REJECTIONS:", rejected.map(r => r.reason));
    console.log("ALL RESULTS:", JSON.stringify(results, null, 2));
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ code: "TRIAL_EXPORT_LIMIT_REACHED" });

    let usage = await prisma.companyTrialUsage.findFirstOrThrow({ where: { companyId } });
    expect(usage.documentsGenerated).toBe(1);

    const reservation = fulfilled[0].value;
    expect(reservation).toBeDefined();

    await releaseTrialFinalExport(companyId, reservation);
    usage = await prisma.companyTrialUsage.findFirstOrThrow({ where: { companyId } });
    expect(usage.documentsGenerated).toBe(0);

    const again = await reserveTrialFinalExport(companyId);
    expect(again).not.toBeNull();
    usage = await prisma.companyTrialUsage.findFirstOrThrow({ where: { companyId } });
    expect(usage.documentsGenerated).toBe(1);

    await prisma.companyTrialUsage.update({
      where: { id: usage.id },
      data: { documentsGenerated: 0 }
    });
  });

  it("DOCUMENT GENERATION RACE: concurrent generateDocument calls for a final export", async () => {
    const results = await Promise.allSettled([
      generateDocument(actor() as any, projectId, {
        boqId,
        templateId,
        documentType: "PDF",
        audience: "CLIENT",
      }),
      generateDocument(actor() as any, projectId, {
        boqId,
        templateId,
        documentType: "PDF",
        audience: "CLIENT",
      })
    ]);

    
    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    console.log("SECOND TEST REJECTIONS:", rejected.map(r => r.reason));
    expect(fulfilled).toHaveLength(1);

    expect(rejected).toHaveLength(1);
    
    const successfulDoc = fulfilled[0].value;
    expect(successfulDoc.status).toBe("COMPLETED");
    expect(successfulDoc.isDraft).toBe(false);

    expect(rejected[0].reason).toMatchObject({ code: "TRIAL_EXPORT_LIMIT_REACHED" });

    const usage = await prisma.companyTrialUsage.findFirstOrThrow({ where: { companyId } });
    expect(usage.documentsGenerated).toBe(1);

    const docs = await prisma.generatedDocument.findMany({ where: { companyId, status: "COMPLETED" } });
    expect(docs).toHaveLength(1);

    const thirdReq = generateDocument(actor() as any, projectId, {
        boqId,
        templateId,
        documentType: "PDF",
        audience: "CLIENT",
    });
    await expect(thirdReq).rejects.toMatchObject({ code: "TRIAL_EXPORT_LIMIT_REACHED" });

    const usageAfter = await prisma.companyTrialUsage.findFirstOrThrow({ where: { companyId } });
    expect(usageAfter.documentsGenerated).toBe(1);

    const docsAfter = await prisma.generatedDocument.findMany({ where: { companyId, status: "COMPLETED" } });
    expect(docsAfter).toHaveLength(1);
  });
});
