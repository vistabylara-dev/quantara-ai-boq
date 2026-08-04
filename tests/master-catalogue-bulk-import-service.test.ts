import { PlatformRole, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { PermissionDeniedError } from "../src/lib/errors/app-error";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { createHierarchyNode, getHierarchyNodeByCode } from "../src/lib/repositories/master-hierarchy-repository";
import { listMasterItems } from "../src/lib/repositories/master-item-repository";
import { dryRunPlumbingImport, executePlumbingImport } from "../src/lib/services/plumbing-master-import-service";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { addBoqItemFromSource } from "../src/lib/services/boq-item-source-service";
import { grantUnlimitedPlanForTests } from "./helpers/grant-unlimited-plan";

const RUN_ID = `${Date.now()}-${process.pid}`;
const CSV_HEADER = "itemCode,discipline,category,description,specification,quantity,unit,supplier,cost,margin,sellingRate,manufacturer,brand,model";

function csvRow(itemCode: string, category: string, description: string, specification: string, unit = "no.") {
  return `${itemCode},plumbing,${category},${description},"${specification}",,${unit},,,,,,,`;
}

function spec(subcategory: string, sentence: string, code: string, table: string, template: string) {
  return `Subcategory: ${subcategory} | ${sentence} | Code Ref: ${code} / OmniClass ${table} (indicative) | CSI: https://crmservice.csinet.org/widgets/masterformat/numbersandtitles.aspx | Spec: ${template}`;
}

let companyId = "";
let ownerUserId = "";
let clientId = "";
let boqId = "";

function ownerActor(): PlatformActor {
  return { userId: ownerUserId, companyId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "Bulk Owner", email: `${RUN_ID}-owner@example.com` };
}
function adminActor(): PlatformActor {
  return { userId: ownerUserId, companyId, platformRole: PlatformRole.PLATFORM_ADMIN, fullName: "Bulk Admin", email: `${RUN_ID}-admin@example.com` };
}
function companyActor(): CurrentActor {
  return { userId: ownerUserId, companyId, role: UserRole.COMPANY_OWNER, fullName: "Bulk Owner", email: `${RUN_ID}-owner@example.com` };
}

describe("CATALOGUE-CLOSE: generic master-catalogue-bulk-import-service via plumbing profile (integration)", () => {
  beforeAll(async () => {
    // "plumbing" MasterDiscipline is one of the 9 seeded disciplines — idempotently ensure it exists for a fresh test DB.
    await prisma.masterDiscipline.upsert({ where: { key: "plumbing" }, update: {}, create: { key: "plumbing", name: "Plumbing" } });
    const industry = await createHierarchyNode({ code: "construction", name: "Construction", nodeType: "INDUSTRY" });
    await createHierarchyNode({ code: "construction.plumbing", name: "Plumbing", nodeType: "DISCIPLINE", parentId: industry.id });

    const company = await prisma.company.create({ data: { legalName: `Bulk Co ${RUN_ID}`, tradeName: "Bulk Co", email: `bulk-${RUN_ID}@example.com` } });
    companyId = company.id;
    await grantUnlimitedPlanForTests(companyId);

    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    await prisma.companyIndustryEngine.create({ data: { companyId, industryEngineId: construction.id, enabled: true } });

    const owner = await prisma.user.create({
      data: { companyId, email: `${RUN_ID}-owner@example.com`, passwordHash: `hash-${RUN_ID}`, fullName: "Bulk Owner", role: UserRole.COMPANY_OWNER, platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerUserId = owner.id;

    const client = await createClient(companyId, { name: `Bulk Client ${RUN_ID}`, email: `bulk-client-${RUN_ID}@example.com` });
    clientId = client.id;
    const { boq } = await createProjectWithDefaultBoq(companyActor(), {
      clientId,
      industryEngineId: "construction",
      reference: `BULK-${RUN_ID}`,
      name: "Bulk Project",
      location: "Dubai, UAE",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    boqId = boq.databaseId;
  });

  afterAll(async () => {
    const plumbing = await prisma.masterDiscipline.findUnique({ where: { key: "plumbing" } });
    if (plumbing) {
      const testItems = await prisma.masterItem.findMany({ where: { disciplineId: plumbing.id, itemCode: { startsWith: `BULK-${RUN_ID}` } } });
      for (const item of testItems) {
        await prisma.masterItemClassification.deleteMany({ where: { masterItemId: item.id } });
        await prisma.masterItemVersion.deleteMany({ where: { masterItemId: item.id } });
      }
      await prisma.masterItem.deleteMany({ where: { disciplineId: plumbing.id, itemCode: { startsWith: `BULK-${RUN_ID}` } } });
      await prisma.masterCategory.deleteMany({ where: { disciplineId: plumbing.id, key: { contains: RUN_ID } } });
    }
    await prisma.masterCatalogueImportBatch.deleteMany({ where: { uploadedFileName: { contains: RUN_ID } } });
    await prisma.masterHierarchyNode.deleteMany({ where: { code: { contains: RUN_ID } } });

    if (companyId) {
      await prisma.bOQItem.deleteMany({ where: { companyId } });
      await prisma.bOQSection.deleteMany({ where: { companyId } });
      await prisma.bOQ.deleteMany({ where: { companyId } });
      await prisma.project.deleteMany({ where: { companyId } });
      await prisma.client.deleteMany({ where: { companyId } });
      await prisma.companyIndustryEngine.deleteMany({ where: { companyId } });
      await prisma.user.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } });
    }
    await prisma.$disconnect();
  });

  it("blocks a non-owner platform actor from importing", async () => {
    const csvText = `${CSV_HEADER}\n${csvRow(`BULK-${RUN_ID}-BLOCK-1`, `Test Category ${RUN_ID}`, "Blocked item", spec("Sub", "Sentence.", "22 00 00", "Table 22", "X: ___"))}`;
    await expect(executePlumbingImport(adminActor(), { uploadedFileName: `blocked-${RUN_ID}.csv`, csvText })).rejects.toThrow(PermissionDeniedError);
  });

  it("dry run performs no mutation", async () => {
    const csvText = `${CSV_HEADER}\n${csvRow(`BULK-${RUN_ID}-DRY-1`, `Test Category ${RUN_ID}`, "Dry run item", spec("Sub", "Sentence.", "22 00 00", "Table 22", "X: ___"))}`;
    const result = await dryRunPlumbingImport(ownerActor(), { uploadedFileName: `dry-${RUN_ID}.csv`, csvText });
    expect(result.inserted).toBe(1);

    const plumbing = await prisma.masterDiscipline.findUniqueOrThrow({ where: { key: "plumbing" } });
    const found = await prisma.masterItem.findUnique({ where: { disciplineId_itemCode: { disciplineId: plumbing.id, itemCode: `BULK-${RUN_ID}-DRY-1` } } });
    expect(found).toBeNull();
  });

  it("executes an insert, creating category + CATEGORY node + SUBCATEGORY node (from the Subcategory: field), a published version, and both classifications", async () => {
    const csvText = `${CSV_HEADER}\n${csvRow(`BULK-${RUN_ID}-EXEC-1`, `Test Category ${RUN_ID}`, "Exec item", spec(`Test Subcategory ${RUN_ID}`, "Longer sentence describing the work.", "22 61 13", "Table 23", "Working Pressure: ___ | Joint Type: ___"))}`;
    const batch = await executePlumbingImport(ownerActor(), { uploadedFileName: `exec-${RUN_ID}.csv`, csvText });
    expect(batch.insertedCount).toBe(1);

    const plumbing = await prisma.masterDiscipline.findUniqueOrThrow({ where: { key: "plumbing" } });
    const item = await prisma.masterItem.findUniqueOrThrow({ where: { disciplineId_itemCode: { disciplineId: plumbing.id, itemCode: `BULK-${RUN_ID}-EXEC-1` } } });
    expect(item.sourceBatchId).toBe(batch.id);

    const category = await prisma.masterCategory.findFirst({ where: { disciplineId: plumbing.id, name: `Test Category ${RUN_ID}` } });
    expect(category).not.toBeNull();

    const categoryNode = await getHierarchyNodeByCode(`construction.plumbing.${category!.key}`);
    expect(categoryNode).not.toBeNull();

    const subcategoryNode = await getHierarchyNodeByCode(`construction.plumbing.${category!.key}.test-subcategory-${RUN_ID}`.toLowerCase());
    expect(subcategoryNode).not.toBeNull();
    expect(subcategoryNode!.nodeType).toBe("SUBCATEGORY");
    expect(subcategoryNode!.parentId).toBe(categoryNode!.id);
    expect(item.hierarchyNodeId).toBe(subcategoryNode!.id);

    const versions = await prisma.masterItemVersion.findMany({ where: { masterItemId: item.id } });
    expect(versions).toHaveLength(1);
    expect(versions[0].status).toBe("PUBLISHED");
    expect(versions[0].specificationTemplate).toBe("Working Pressure: ___ | Joint Type: ___");

    const classifications = await prisma.masterItemClassification.findMany({ where: { masterItemId: item.id } });
    expect(classifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ system: "MASTERFORMAT_2020", code: "22 61 13" }),
        expect.objectContaining({ system: "OMNICLASS", code: "Table 23" }),
      ]),
    );
    // The CSI reference URL is never stored anywhere on the item or its classifications.
    expect(JSON.stringify({ item, classifications })).not.toContain("csinet.org");
  });

  it("a second identical execute run is fully idempotent — no duplicate item, version, or classification", async () => {
    const csvText = `${CSV_HEADER}\n${csvRow(`BULK-${RUN_ID}-IDEMP-1`, `Test Category ${RUN_ID}`, "Idempotency item", spec("Sub", "Sentence.", "22 00 00", "Table 22", "X: ___"))}`;

    const first = await executePlumbingImport(ownerActor(), { uploadedFileName: `idemp-${RUN_ID}.csv`, csvText });
    expect(first.insertedCount).toBe(1);

    const second = await executePlumbingImport(ownerActor(), { uploadedFileName: `idemp-${RUN_ID}.csv`, csvText });
    expect(second.insertedCount).toBe(0);
    expect(second.unchangedCount).toBe(1);

    const plumbing = await prisma.masterDiscipline.findUniqueOrThrow({ where: { key: "plumbing" } });
    const items = await prisma.masterItem.findMany({ where: { disciplineId: plumbing.id, itemCode: `BULK-${RUN_ID}-IDEMP-1` } });
    expect(items).toHaveLength(1);
    const versions = await prisma.masterItemVersion.findMany({ where: { masterItemId: items[0].id } });
    expect(versions).toHaveLength(1);
  });

  it("re-running with changed source content creates a new version instead of overwriting the published one", async () => {
    const itemCode = `BULK-${RUN_ID}-CHANGE-1`;
    const csvV1 = `${CSV_HEADER}\n${csvRow(itemCode, `Test Category ${RUN_ID}`, "Change item", spec("Sub", "Original sentence.", "22 00 00", "Table 22", "X: ___"))}`;
    await executePlumbingImport(ownerActor(), { uploadedFileName: `change-v1-${RUN_ID}.csv`, csvText: csvV1 });

    const plumbing = await prisma.masterDiscipline.findUniqueOrThrow({ where: { key: "plumbing" } });
    const item = await prisma.masterItem.findUniqueOrThrow({ where: { disciplineId_itemCode: { disciplineId: plumbing.id, itemCode } } });
    const v1 = await prisma.masterItemVersion.findFirstOrThrow({ where: { masterItemId: item.id } });

    const csvV2 = `${CSV_HEADER}\n${csvRow(itemCode, `Test Category ${RUN_ID}`, "Change item", spec("Sub", "Updated sentence with new content.", "22 00 00", "Table 22", "Y: ___"))}`;
    const result = await executePlumbingImport(ownerActor(), { uploadedFileName: `change-v2-${RUN_ID}.csv`, csvText: csvV2 });
    expect(result.updatedCount).toBe(1);

    const versions = await prisma.masterItemVersion.findMany({ where: { masterItemId: item.id }, orderBy: { versionNumber: "asc" } });
    expect(versions).toHaveLength(2);
    const originalV1 = await prisma.masterItemVersion.findUniqueOrThrow({ where: { id: v1.id } });
    expect(originalV1.specificationTemplate).toBe("X: ___");
    expect(versions[1].specificationTemplate).toBe("Y: ___");
  });

  it("rejects rows missing a required column and duplicate itemCodes within the same file", async () => {
    const csvText = [
      CSV_HEADER,
      csvRow(`BULK-${RUN_ID}-VALID-1`, `Test Category ${RUN_ID}`, "Valid item", spec("Sub", "Sentence.", "22 00 00", "Table 22", "X: ___")),
      `,plumbing,${`Test Category ${RUN_ID}`},Missing item code,"Sentence.",,no.,,,,,,,`,
      csvRow(`BULK-${RUN_ID}-VALID-1`, `Test Category ${RUN_ID}`, "Duplicate of valid item", "Sentence.", "no."),
    ].join("\n");
    const result = await dryRunPlumbingImport(ownerActor(), { uploadedFileName: `rejects-${RUN_ID}.csv`, csvText });
    expect(result.validRows).toBe(1);
    expect(result.rejectedRows).toBe(2);
  });

  it("an imported item is findable via the protected customer search, bounded to a max page size", async () => {
    const csvText = `${CSV_HEADER}\n${csvRow(`BULK-${RUN_ID}-SEARCH-1`, `Test Category ${RUN_ID}`, `Searchable valve unit ${RUN_ID}`, spec("Sub", "Sentence.", "22 00 00", "Table 22", "X: ___"))}`;
    await executePlumbingImport(ownerActor(), { uploadedFileName: `search-${RUN_ID}.csv`, csvText });

    const result = await listMasterItems({ search: `Searchable valve unit ${RUN_ID}`, pageSize: 999 });
    expect(result.pageSize).toBeLessThanOrEqual(50);
    expect(result.items.some((i) => i.itemCode === `BULK-${RUN_ID}-SEARCH-1`)).toBe(true);
  });

  it("adding an imported plumbing item to a BOQ snapshots the master item id, version id, and specification, without mutating the master item", async () => {
    const csvText = `${CSV_HEADER}\n${csvRow(`BULK-${RUN_ID}-BOQ-1`, `Test Category ${RUN_ID}`, "BOQ item", spec("Sub", "Sentence.", "22 00 00", "Table 22", "Capacity: ___"))}`;
    await executePlumbingImport(ownerActor(), { uploadedFileName: `boq-${RUN_ID}.csv`, csvText });

    const plumbing = await prisma.masterDiscipline.findUniqueOrThrow({ where: { key: "plumbing" } });
    const item = await prisma.masterItem.findUniqueOrThrow({ where: { disciplineId_itemCode: { disciplineId: plumbing.id, itemCode: `BULK-${RUN_ID}-BOQ-1` } } });
    const version = await prisma.masterItemVersion.findFirstOrThrow({ where: { masterItemId: item.id, status: "PUBLISHED" } });

    const added = await addBoqItemFromSource(companyActor(), boqId, { sourceType: "MASTER_ITEM", sourceId: item.id, itemNumber: 1, quantity: "5" });
    expect(added.item.sourceMasterItemId).toBe(item.id);
    expect(added.item.sourceMasterItemVersionId).toBe(version.id);

    const unchangedItem = await prisma.masterItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(unchangedItem.name).toBe("BOQ item");
  });
});
