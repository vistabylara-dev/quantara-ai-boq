import { PlatformRole, UserRole, GeneratedDocumentType } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { getEffectiveEntitlements } from "../src/lib/entitlements/effective-entitlement-service";
import { startOrChangeSimulation, exitSimulation } from "../src/lib/services/platform-simulation-service";
import { resolveBoqCommercialRequirements, resolveBoqCommercialRequirementsEffective } from "../src/lib/commercial/commercial-requirement-service";
import { generateDocument } from "../src/lib/services/document-generation-service";
import { addBoqItemFromSource } from "../src/lib/services/boq-item-source-service";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";

describe("PLATFORM_OWNER commercial bypass (FIX 2)", () => {
  const runId = Math.random().toString(36).substring(7);
  let companyId: string;
  let ownerActor: CurrentActor;
  let adminActor: CurrentActor;
  let normalActor: CurrentActor;
  
  let projectId: string;
  let boqId: string;
  let sectionId: string;
  let templateId: string;
  
  let premiumItemId: string;

  beforeAll(async () => {
    // 1. Create company
    const company = await prisma.company.create({
      data: { legalName: `Bypass LLC ${runId}`, tradeName: `Bypass ${runId}`, email: `test${runId}@quantara.ai`, isTestCompany: true, address: "123 Main St", taxRegistrationNumber: "123456789" },
    });
    companyId = company.id;

    // 2. Create Users
    const owner = await prisma.user.create({
      data: {
        companyId,
        email: `owner${runId}@quantara.ai`,
        passwordHash: "hash",
        fullName: "Plat Owner",
        role: "COMPANY_OWNER",
        platformRole: "PLATFORM_OWNER",
        isActive: true,
        emailVerifiedAt: new Date(),
      }
    });
    ownerActor = { userId: owner.id, fullName: "Plat Owner", companyId, role: "COMPANY_OWNER", platformRole: "PLATFORM_OWNER", permissions: [] } as any;

    const admin = await prisma.user.create({
      data: {
        companyId,
        email: `admin${runId}@quantara.ai`,
        passwordHash: "hash",
        fullName: "Plat Admin",
        role: "COMPANY_OWNER",
        platformRole: "PLATFORM_ADMIN",
        isActive: true,
        emailVerifiedAt: new Date(),
      }
    });
    adminActor = { userId: admin.id, fullName: "Plat Admin", companyId, role: "COMPANY_OWNER", platformRole: "PLATFORM_ADMIN", permissions: [] } as any;

    const normal = await prisma.user.create({
      data: {
        companyId,
        email: `normal${runId}@quantara.ai`,
        passwordHash: "hash",
        fullName: "Normal User",
        role: "COMPANY_OWNER",
        isActive: true,
        emailVerifiedAt: new Date(),
      }
    });
    normalActor = { userId: normal.id, fullName: "Normal User", companyId, role: "COMPANY_OWNER", platformRole: null, permissions: [] } as any;

    // 3. Create Project & BOQ
    const engine = await prisma.industryEngine.create({ data: { name: "Test Eng", description: "Test", key: `test_eng_${runId}`, configJson: {} }});
    const client = await prisma.client.create({ data: { companyId, name: "Test Client", email: `client${runId}@test.com` } });
    const project = await prisma.project.create({
      data: { companyId, clientId: client.id, industryEngineId: engine.id, name: "Proj", slug: "proj", reference: "PRJ" }
    });
    projectId = project.id;

    const boq = await prisma.bOQ.create({
      data: { companyId, projectId, revisionNumber: 1, title: "Draft BOQ" }
    });
    boqId = boq.id;

    const section = await prisma.bOQSection.create({
      data: { companyId, boqId, title: "Sec 1", code: "S1", sortOrder: 1 }
    });
    sectionId = section.id;

    // 4. Create premium catalogue package & master item
    const pkg = await prisma.industryDataPackage.create({
      data: { name: "Premium Pkg", key: `premium_pkg_${runId}`, description: "Premium", packageType: "SPECIALIST", discipline: { create: { key: `td_${runId}`, name: "Test Disc", description: "TD" } } }
    });
    const masterItem = await prisma.masterItem.create({
      data: {
        itemCode: `PREMIUM-01-${runId}`,
        name: "Premium Item",
        shortDescription: "Premium Item",
        defaultUnit: "m",
        category: { create: { key: `m_cat_${runId}`, name: "Materials", path: `m_cat_path_${runId}`, discipline: { connect: { key: `td_${runId}` } } } },
        isPremium: true,
        discipline: { connect: { key: `td_${runId}` } }
      }
    });
    premiumItemId = masterItem.id;

    await prisma.industryDataPackageItem.create({
      data: { packageId: pkg.id, masterItemId: premiumItemId }
    });

    // 5. Add premium item to BOQ using standard service
    await addBoqItemFromSource(ownerActor, boqId, {
      sourceType: "MASTER_ITEM",
      sourceId: premiumItemId,
      sectionId: sectionId,
      itemNumber: 1,
      quantity: "10"
    });

    // 6. Create Template
    const template = await prisma.documentTemplate.create({
      data: {
        companyId,
        name: "Test Tpl",
        code: `TPL1_${runId}`,
        type: "CORPORATE_TECHNICAL",
        styleConfigJson: {},
        contentConfigJson: {}
      }
    });
    templateId = template.id;
  });

  afterAll(async () => {
    // Unlock BOQ so triggers don't block deletion
    await prisma.bOQ.updateMany({ where: { id: boqId }, data: { isLocked: false, status: "DRAFT" } });
    
    await prisma.industryDataPackageItem.deleteMany({ where: { masterItemId: premiumItemId } });
    await prisma.masterItem.deleteMany({ where: { id: premiumItemId } });
    await prisma.industryDataPackage.deleteMany({ where: { key: `premium_pkg_${runId}` } });
    await prisma.masterCategory.deleteMany({ where: { key: `m_cat_${runId}` } });
    await prisma.masterDiscipline.deleteMany({ where: { key: `td_${runId}` } });
    await prisma.user.deleteMany({ where: { companyId } });
    try {
      await prisma.company.delete({ where: { id: companyId } });
    } catch (e) {
      // Ignore constraints
    }
    try {
      await prisma.industryEngine.deleteMany({ where: { key: `test_eng_${runId}` } });
    } catch (e) {}
    await prisma.$disconnect();
  });

  it("1. Verify the raw state is COMMERCIAL_UNLOCK_REQUIRED", async () => {
    const decision = await resolveBoqCommercialRequirements(companyId, boqId);
    expect(decision.status).toBe("COMMERCIAL_UNLOCK_REQUIRED");
  });

  it("2. PLATFORM_OWNER gets effective decision ALLOW", async () => {
    const decision = await resolveBoqCommercialRequirementsEffective(ownerActor, boqId);
    expect(decision.status).toBe("ALLOW");
    expect(decision.requirements.length).toBe(0);
  });

  it("3. NORMAL CUSTOMER gets effective decision COMMERCIAL_UNLOCK_REQUIRED", async () => {
    const decision = await resolveBoqCommercialRequirementsEffective(normalActor, boqId);
    expect(decision.status).toBe("COMMERCIAL_UNLOCK_REQUIRED");
  });

  it("4. PLATFORM_ADMIN gets effective decision COMMERCIAL_UNLOCK_REQUIRED", async () => {
    const decision = await resolveBoqCommercialRequirementsEffective(adminActor, boqId);
    expect(decision.status).toBe("COMMERCIAL_UNLOCK_REQUIRED");
  });

  it("5. Owner Simulation falls back to simulated normal state", async () => {
    await startOrChangeSimulation(ownerActor as any, "FREE");
    
    const effectiveEnt = await getEffectiveEntitlements(ownerActor);
    expect(effectiveEnt.source).toBe("simulation");

    const reqs = await resolveBoqCommercialRequirementsEffective(ownerActor, boqId);
    expect(reqs.status).toBe("COMMERCIAL_UNLOCK_REQUIRED");
    
    await exitSimulation(ownerActor as any);
    const restoredEnt = await getEffectiveEntitlements(ownerActor);
    expect(restoredEnt.source).toBe("owner-override");
  });

  it("6. PLATFORM_OWNER can generate clean final PDF successfully", async () => {
    await prisma.bOQ.update({
      where: { id: boqId },
      data: { status: "LOCKED", isLocked: true }
    });

    await prisma.bOQRevisionSnapshot.create({
      data: {
        company: { connect: { id: companyId } },
        boq: { connect: { id: boqId } },
        project: { connect: { id: projectId } },
        revisionNumber: 1,
        createdByName: "Plat Owner",
        snapshotJson: { sections: [], discountPercentage: 0, taxRate: 0 }
      }
    });

    const docResult = await generateDocument(ownerActor, projectId, {
      boqId,
      documentType: "PDF",
      templateId,
      audience: "CLIENT",
      pricingMode: "WITH_PRICES"
    } as any);

    expect(docResult.id).toBeDefined();
    expect(docResult.status).toBe("COMPLETED");

    const subs = await prisma.companyPackageSubscription.count({ where: { companyId } });
    expect(subs).toBe(0);
  });

});
