import { PlatformRole, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { PermissionDeniedError } from "../src/lib/errors/app-error";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { createHierarchyNode, getHierarchyNodeByCode } from "../src/lib/repositories/master-hierarchy-repository";
import { listMasterItems, getMasterItemCustomerDetail } from "../src/lib/repositories/master-item-repository";
import { dryRunHvacMasterImport, executeHvacMasterImport } from "../src/lib/services/hvac-master-import-service";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { addBoqItemFromSource } from "../src/lib/services/boq-item-source-service";
import { grantUnlimitedPlanForTests } from "./helpers/grant-unlimited-plan";

const RUN_ID = `${Date.now()}-${process.pid}`;
const CSV_HEADER = "itemCode,discipline,category,description,specification,quantity,unit,supplier,cost,margin,sellingRate,manufacturer,brand,model";

function csvRow(itemCode: string, category: string, description: string, specification: string, unit = "LS") {
  return `${itemCode},hvac,${category},${description},"${specification}",,${unit},,,,,,,`;
}

let companyId = "";
let ownerUserId = "";
let clientId = "";
let boqId = "";

function ownerActor(): PlatformActor {
  return { userId: ownerUserId, companyId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "MSB Owner", email: `${RUN_ID}-owner@example.com` };
}
function adminActor(): PlatformActor {
  return { userId: ownerUserId, companyId, platformRole: PlatformRole.PLATFORM_ADMIN, fullName: "MSB Admin", email: `${RUN_ID}-admin@example.com` };
}
function companyActor(): CurrentActor {
  return { userId: ownerUserId, companyId, role: UserRole.COMPANY_OWNER, fullName: "MSB Owner", email: `${RUN_ID}-owner@example.com` };
}

describe("MASTER-SCALE-1B: HVAC master catalogue import service (integration)", () => {
  beforeAll(async () => {
    // The service resolves the real "mechanical" discipline and the real
    // "construction.mechanical.hvac" hierarchy chain by fixed code (matching
    // production and the MASTER-BOQ-1A backfill) — idempotently ensure both
    // exist here too, so this test is self-sufficient in a fresh test DB.
    const mechanical = await prisma.masterDiscipline.upsert({
      where: { key: "mechanical" },
      update: {},
      create: { key: "mechanical", name: "Mechanical" },
    });
    const industry = await createHierarchyNode({ code: "construction", name: "Construction", nodeType: "INDUSTRY" });
    const discipline = await createHierarchyNode({ code: "construction.mechanical", name: "Mechanical", nodeType: "DISCIPLINE", parentId: industry.id });
    await createHierarchyNode({ code: "construction.mechanical.hvac", name: "HVAC", nodeType: "SYSTEM", parentId: discipline.id });
    void mechanical;

    const company = await prisma.company.create({ data: { legalName: `MSB Co ${RUN_ID}`, tradeName: "MSB Co", email: `msb-${RUN_ID}@example.com` } });
    companyId = company.id;
    await grantUnlimitedPlanForTests(companyId);

    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    await prisma.companyIndustryEngine.create({ data: { companyId, industryEngineId: construction.id, enabled: true } });

    const owner = await prisma.user.create({
      data: { companyId, email: `${RUN_ID}-owner@example.com`, passwordHash: `hash-${RUN_ID}`, fullName: "MSB Owner", role: UserRole.COMPANY_OWNER, platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerUserId = owner.id;

    const client = await createClient(companyId, { name: `MSB Client ${RUN_ID}`, email: `msb-client-${RUN_ID}@example.com` });
    clientId = client.id;
    const { boq } = await createProjectWithDefaultBoq(companyActor(), {
      clientId,
      industryEngineId: "construction",
      reference: `MSB-${RUN_ID}`,
      name: "MSB Project",
      location: "Dubai, UAE",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    boqId = boq.databaseId;
  });

  afterAll(async () => {
    const mechanical = await prisma.masterDiscipline.findUnique({ where: { key: "mechanical" } });
    if (mechanical) {
      const testItems = await prisma.masterItem.findMany({ where: { disciplineId: mechanical.id, itemCode: { startsWith: `MSB-${RUN_ID}` } } });
      for (const item of testItems) {
        await prisma.masterItemClassification.deleteMany({ where: { masterItemId: item.id } });
        await prisma.masterItemVersion.deleteMany({ where: { masterItemId: item.id } });
      }
      await prisma.masterItem.deleteMany({ where: { disciplineId: mechanical.id, itemCode: { startsWith: `MSB-${RUN_ID}` } } });
      await prisma.masterCategory.deleteMany({ where: { disciplineId: mechanical.id, key: { contains: RUN_ID } } });
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
    const csvText = `${CSV_HEADER}\n${csvRow(`MSB-${RUN_ID}-BLOCK-1`, `Test Category ${RUN_ID}`, "Blocked item", "Sentence. | MasterFormat: 23 00 00 | OmniClass: Table 22 – Label | Spec: X: ___")}`;
    await expect(executeHvacMasterImport(adminActor(), { uploadedFileName: `blocked-${RUN_ID}.csv`, csvText })).rejects.toThrow(PermissionDeniedError);
  });

  it("dry run performs no mutation", async () => {
    const csvText = `${CSV_HEADER}\n${csvRow(`MSB-${RUN_ID}-DRY-1`, `Test Category ${RUN_ID}`, "Dry run item", "Sentence. | MasterFormat: 23 00 00 | OmniClass: Table 22 – Label | Spec: X: ___")}`;
    const result = await dryRunHvacMasterImport(ownerActor(), { uploadedFileName: `dry-${RUN_ID}.csv`, csvText });
    expect(result.inserted).toBe(1);

    const mechanical = await prisma.masterDiscipline.findUniqueOrThrow({ where: { key: "mechanical" } });
    const found = await prisma.masterItem.findUnique({ where: { disciplineId_itemCode: { disciplineId: mechanical.id, itemCode: `MSB-${RUN_ID}-DRY-1` } } });
    expect(found).toBeNull();
  });

  it("rejects rows missing a required column and duplicate itemCodes within the same file", async () => {
    const csvText = [
      CSV_HEADER,
      csvRow(`MSB-${RUN_ID}-VALID-1`, `Test Category ${RUN_ID}`, "Valid item", "Sentence. | MasterFormat: 23 00 00 | OmniClass: Table 22 – Label | Spec: X: ___"),
      `,hvac,${`Test Category ${RUN_ID}`},Missing item code,"Sentence.",,LS,,,,,,,`,
      csvRow(`MSB-${RUN_ID}-VALID-1`, `Test Category ${RUN_ID}`, "Duplicate of valid item", "Sentence.", "LS"),
    ].join("\n");
    const result = await dryRunHvacMasterImport(ownerActor(), { uploadedFileName: `rejects-${RUN_ID}.csv`, csvText });
    expect(result.validRows).toBe(1);
    expect(result.rejectedRows).toBe(2);
  });

  it("executes an insert, creating a category, hierarchy node, published version, and classifications", async () => {
    const csvText = `${CSV_HEADER}\n${csvRow(`MSB-${RUN_ID}-EXEC-1`, `Test Category ${RUN_ID}`, "Exec item", "Longer sentence describing the work. | MasterFormat: 23 05 53 | OmniClass: Table 22 – HVAC work results | Spec: Material: ___ | Size: ___")}`;
    const batch = await executeHvacMasterImport(ownerActor(), { uploadedFileName: `exec-${RUN_ID}.csv`, csvText });
    expect(batch.insertedCount).toBe(1);

    const mechanical = await prisma.masterDiscipline.findUniqueOrThrow({ where: { key: "mechanical" } });
    const item = await prisma.masterItem.findUniqueOrThrow({ where: { disciplineId_itemCode: { disciplineId: mechanical.id, itemCode: `MSB-${RUN_ID}-EXEC-1` } } });
    expect(item.sourceBatchId).toBe(batch.id);

    const category = await prisma.masterCategory.findFirst({ where: { disciplineId: mechanical.id, name: `Test Category ${RUN_ID}` } });
    expect(category).not.toBeNull();

    const hierarchyNode = await getHierarchyNodeByCode(`construction.mechanical.hvac.${category!.key}`);
    expect(hierarchyNode).not.toBeNull();
    expect(item.hierarchyNodeId).toBe(hierarchyNode!.id);

    const versions = await prisma.masterItemVersion.findMany({ where: { masterItemId: item.id } });
    expect(versions).toHaveLength(1);
    expect(versions[0].status).toBe("PUBLISHED");
    expect(versions[0].specificationTemplate).toBe("Material: ___ | Size: ___");

    const classifications = await prisma.masterItemClassification.findMany({ where: { masterItemId: item.id } });
    expect(classifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ system: "MASTERFORMAT_2020", code: "23 05 53" }),
        expect.objectContaining({ system: "OMNICLASS", code: "Table 22" }),
      ]),
    );
  });

  it("a second identical execute run is fully idempotent — no duplicate item, version, or classification", async () => {
    const csvText = `${CSV_HEADER}\n${csvRow(`MSB-${RUN_ID}-IDEMP-1`, `Test Category ${RUN_ID}`, "Idempotency item", "Sentence. | MasterFormat: 23 00 00 | OmniClass: Table 22 – Label | Spec: X: ___")}`;

    const first = await executeHvacMasterImport(ownerActor(), { uploadedFileName: `idemp-${RUN_ID}.csv`, csvText });
    expect(first.insertedCount).toBe(1);

    const second = await executeHvacMasterImport(ownerActor(), { uploadedFileName: `idemp-${RUN_ID}.csv`, csvText });
    expect(second.insertedCount).toBe(0);
    expect(second.unchangedCount).toBe(1);

    const mechanical = await prisma.masterDiscipline.findUniqueOrThrow({ where: { key: "mechanical" } });
    const items = await prisma.masterItem.findMany({ where: { disciplineId: mechanical.id, itemCode: `MSB-${RUN_ID}-IDEMP-1` } });
    expect(items).toHaveLength(1);
    const versions = await prisma.masterItemVersion.findMany({ where: { masterItemId: items[0].id } });
    expect(versions).toHaveLength(1);
    const classifications = await prisma.masterItemClassification.findMany({ where: { masterItemId: items[0].id } });
    expect(classifications).toHaveLength(2);
  });

  it("re-running with changed source content creates a new version instead of overwriting the published one", async () => {
    const itemCode = `MSB-${RUN_ID}-CHANGE-1`;
    const csvV1 = `${CSV_HEADER}\n${csvRow(itemCode, `Test Category ${RUN_ID}`, "Change item", "Original sentence. | MasterFormat: 23 00 00 | OmniClass: Table 22 – Label | Spec: X: ___")}`;
    await executeHvacMasterImport(ownerActor(), { uploadedFileName: `change-v1-${RUN_ID}.csv`, csvText: csvV1 });

    const mechanical = await prisma.masterDiscipline.findUniqueOrThrow({ where: { key: "mechanical" } });
    const item = await prisma.masterItem.findUniqueOrThrow({ where: { disciplineId_itemCode: { disciplineId: mechanical.id, itemCode } } });
    const v1 = await prisma.masterItemVersion.findFirstOrThrow({ where: { masterItemId: item.id } });

    const csvV2 = `${CSV_HEADER}\n${csvRow(itemCode, `Test Category ${RUN_ID}`, "Change item", "Updated sentence with new content. | MasterFormat: 23 00 00 | OmniClass: Table 22 – Label | Spec: Y: ___")}`;
    const result = await executeHvacMasterImport(ownerActor(), { uploadedFileName: `change-v2-${RUN_ID}.csv`, csvText: csvV2 });
    expect(result.updatedCount).toBe(1);

    const versions = await prisma.masterItemVersion.findMany({ where: { masterItemId: item.id }, orderBy: { versionNumber: "asc" } });
    expect(versions).toHaveLength(2);
    const originalV1 = await prisma.masterItemVersion.findUniqueOrThrow({ where: { id: v1.id } });
    expect(originalV1.specificationTemplate).toBe("X: ___");
    expect(versions[1].specificationTemplate).toBe("Y: ___");
  });

  it("an imported item is findable via the protected customer search and never returns more than a bounded page", async () => {
    const csvText = `${CSV_HEADER}\n${csvRow(`MSB-${RUN_ID}-SEARCH-1`, `Test Category ${RUN_ID}`, `Searchable diffuser unit ${RUN_ID}`, "Sentence. | MasterFormat: 23 37 00 | OmniClass: Table 22 – Label | Spec: X: ___")}`;
    await executeHvacMasterImport(ownerActor(), { uploadedFileName: `search-${RUN_ID}.csv`, csvText });

    const result = await listMasterItems({ search: `Searchable diffuser unit ${RUN_ID}`, pageSize: 999 });
    expect(result.pageSize).toBeLessThanOrEqual(50);
    expect(result.items.some((i) => i.itemCode === `MSB-${RUN_ID}-SEARCH-1`)).toBe(true);
  });

  it("an imported item's customer detail exposes only its published version and real classifications", async () => {
    const csvText = `${CSV_HEADER}\n${csvRow(`MSB-${RUN_ID}-DETAIL-1`, `Test Category ${RUN_ID}`, "Detail item", "Sentence. | MasterFormat: 23 00 00 | OmniClass: Table 22 – Label | Spec: X: ___")}`;
    await executeHvacMasterImport(ownerActor(), { uploadedFileName: `detail-${RUN_ID}.csv`, csvText });

    const mechanical = await prisma.masterDiscipline.findUniqueOrThrow({ where: { key: "mechanical" } });
    const item = await prisma.masterItem.findUniqueOrThrow({ where: { disciplineId_itemCode: { disciplineId: mechanical.id, itemCode: `MSB-${RUN_ID}-DETAIL-1` } } });
    const detail = await getMasterItemCustomerDetail(item.id);
    expect(detail.publishedVersion?.versionNumber).toBe(1);
    expect(detail.publishedVersion?.specificationTemplate).toBe("X: ___");
    expect(detail.classifications.length).toBeGreaterThanOrEqual(1);
  });

  it("adding an imported HVAC item to a BOQ snapshots the master item id, version id, and specification, without mutating the master item", async () => {
    const csvText = `${CSV_HEADER}\n${csvRow(`MSB-${RUN_ID}-BOQ-1`, `Test Category ${RUN_ID}`, "BOQ item", "Sentence. | MasterFormat: 23 00 00 | OmniClass: Table 22 – Label | Spec: Capacity: ___")}`;
    await executeHvacMasterImport(ownerActor(), { uploadedFileName: `boq-${RUN_ID}.csv`, csvText });

    const mechanical = await prisma.masterDiscipline.findUniqueOrThrow({ where: { key: "mechanical" } });
    const item = await prisma.masterItem.findUniqueOrThrow({ where: { disciplineId_itemCode: { disciplineId: mechanical.id, itemCode: `MSB-${RUN_ID}-BOQ-1` } } });
    const version = await prisma.masterItemVersion.findFirstOrThrow({ where: { masterItemId: item.id, status: "PUBLISHED" } });

    const added = await addBoqItemFromSource(companyActor(), boqId, {
      sourceType: "MASTER_ITEM",
      sourceId: item.id,
      itemNumber: 1,
      quantity: "5",
    });
    expect(added.item.sourceMasterItemId).toBe(item.id);
    expect(added.item.sourceMasterItemVersionId).toBe(version.id);
    const snapshot = added.item.masterItemSnapshotJson as { itemCode: string } | null;
    expect(snapshot?.itemCode).toBe(`MSB-${RUN_ID}-BOQ-1`);

    // Company-specific quantity/rate entry never touches the master item.
    expect(added.item.quantity.toString()).toBe("5");
    const unchangedItem = await prisma.masterItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(unchangedItem.name).toBe("BOQ item");
  });
});
