import fs from "fs";
import path from "path";
import { UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { createImportJob, updateImportMapping, validateImportJob, actOnImportRows, executeImportJob } from "../src/lib/services/import-service";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { createClient } from "../src/lib/repositories/client-repository";

const RUN_ID = `${Date.now()}-${process.pid}`;

let companyId = "";
let userId = "";
let clientId = "";
let projectId = "";
let boqId = "";

function actor(): CurrentActor {
  return { userId, companyId, role: UserRole.COMPANY_OWNER, fullName: "Test Actor", email: `${RUN_ID}@example.com` };
}

describe("CostX CSV File Import", () => {
  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { legalName: `CostX Test Co ${RUN_ID}`, tradeName: "CostX Test Co", email: `costx-${RUN_ID}@example.com` },
    });
    companyId = company.id;

    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    await prisma.companyIndustryEngine.create({ data: { companyId, industryEngineId: construction.id, enabled: true } });

    const user = await prisma.user.create({
      data: { companyId, email: `${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Test Actor", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    userId = user.id;

    const client = await createClient(companyId, { name: `CostX Client ${RUN_ID}`, email: `costx-client-${RUN_ID}@example.com` });
    clientId = client.id;
    
    const { project, boq } = await createProjectWithDefaultBoq(actor(), {
      clientId,
      industryEngineId: "construction",
      reference: `COSTX-${RUN_ID}`,
      name: "CostX Test Project",
      location: "Dubai, UAE",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    projectId = project.databaseId;
    boqId = boq.databaseId;
  });

  afterAll(async () => {
    await prisma.bOQItem.deleteMany({ where: { companyId } });
    await prisma.bOQSection.deleteMany({ where: { companyId } });
    await prisma.bOQ.deleteMany({ where: { companyId } });
    await prisma.project.deleteMany({ where: { companyId } });
    await prisma.client.deleteMany({ where: { companyId } });
    await prisma.importRow.deleteMany({ where: { companyId } });
    await prisma.importJob.deleteMany({ where: { companyId } });
    await prisma.companyIndustryEngine.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it("proves upload → mapping → validation → approval → execute for a CostX CSV export", async () => {
    const fixturePath = path.join(__dirname, "fixtures", "costx-export.csv");
    const csvBuffer = fs.readFileSync(fixturePath);

    // 1. Upload
    const job = await createImportJob(actor(), {
      uploadedFileName: "costx-export.csv",
      buffer: csvBuffer,
      sourceType: "CSV",
      destinationType: "DRAFT_BOQ",
      projectId,
    });
    expect(job.totalRows).toBe(4);
    expect(job.status).toBe("PENDING");

    // 2. Mapping
    await updateImportMapping(actor(), job.id, {
      mappingJson: {
        itemCode: "Code",
        description: "Description",
        quantity: "Quantity",
        unit: "Unit",
        cost: "Rate",
      },
    });

    const mappedJob = await prisma.importJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(mappedJob.status).toBe("PENDING");

    // 3. Validation
    const validationResult = await validateImportJob(actor(), job.id);
    expect(validationResult.job.status).toBe("VALIDATED");
    expect(validationResult.job.validRows).toBe(4);
    expect(validationResult.job.errorRows).toBe(0);

    // 4. Approve
    const rows = await prisma.importRow.findMany({ where: { importJobId: job.id } });
    await actOnImportRows(actor(), job.id, { action: "CREATE_NEW", rowIds: rows.map(r => r.id) });

    // 5. Execute
    const executionResult = await executeImportJob(actor(), job.id);
    expect(executionResult.job.status).toBe("COMPLETED");

    // Verify
    const items = await prisma.bOQItem.findMany({ where: { section: { boqId } }, orderBy: { itemNumber: "asc" } });
    expect(items.length).toBe(4);
    
    expect(items[0].itemCode).toBe("STR.01");
    expect(items[0].description).toBe("Concrete Column C1");
    expect(items[0].quantity.toString()).toBe("12.5");
    expect(items[0].unit).toBe("m3");
    expect(items[0].unitCost.toString()).toBe("350");

    expect(items[3].itemCode).toBe("STR.04");
    expect(items[3].description).toBe("Formwork for columns");
    expect(items[3].quantity.toString()).toBe("85");
    expect(items[3].unitCost.toString()).toBe("45");
  });
});
