import { ExtractedTableType, ExtractionJobStatus, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { uploadProjectFile } from "../src/lib/services/project-file-service";
import { triggerFileExtraction } from "../src/lib/services/table-extraction-service";
import { manuallyAddExtractedEntity } from "../src/lib/services/extracted-entity-service";
import { NotFoundError } from "../src/lib/errors/app-error";
import {
  generateCandidatesFromStructuredTables,
  prepareStructuredSourceCandidates,
} from "../src/lib/services/source-candidate-bridge-service";
import { grantUnlimitedPlanForTests } from "./helpers/grant-unlimited-plan";

const RUN_ID = `${Date.now()}-${process.pid}`;

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 6000, intervalMs = 20): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("waitFor: condition not met within timeout");
}

describe("Structured source → human-review candidate bridge (real local Postgres)", () => {
  let companyAId: string;
  let companyBId: string;
  let ownerUserId: string;
  let ownerUserBId: string;
  let projectAId: string;
  let projectASlug: string;
  let projectA2Id: string; // second project, SAME company — for cross-project (not cross-tenant) checks
  let projectBId: string; // company B's project
  let fileBId: string; // a file that belongs to company B

  let fileCounter = 0;
  async function createFile(companyId: string, projectId: string, extension = "xlsx") {
    fileCounter += 1;
    return prisma.projectFile.create({
      data: {
        companyId,
        projectId,
        uploadedByUserId: ownerUserId,
        originalName: `bridge-fixture-${fileCounter}.${extension}`,
        safeFileName: `bridge-fixture-${fileCounter}.${extension}`,
        storageKey: `test/${RUN_ID}/bridge-fixture-${fileCounter}.${extension}`,
        mimeType: "application/octet-stream",
        extension,
        fileSize: 1024,
        checksum: `checksum-${RUN_ID}-${fileCounter}`,
      },
    });
  }

  type CellInput = { columnKey: string; rawValue: string; confidence?: number };

  async function createTable(params: {
    companyId: string;
    projectFileId: string;
    tableType: ExtractedTableType;
    confidence?: number;
    sheetName?: string;
    title?: string;
    drawingPageId?: string;
  }) {
    return prisma.extractedTable.create({
      data: {
        companyId: params.companyId,
        projectFileId: params.projectFileId,
        tableType: params.tableType,
        confidence: params.confidence ?? 90,
        sheetName: params.sheetName,
        title: params.title,
        drawingPageId: params.drawingPageId,
        status: "EXTRACTED",
      },
    });
  }

  async function createRow(params: {
    companyId: string;
    extractedTableId: string;
    rowNumber: number;
    parentRowId?: string;
    confidence?: number;
    cells: CellInput[];
  }) {
    const row = await prisma.extractedTableRow.create({
      data: {
        companyId: params.companyId,
        extractedTableId: params.extractedTableId,
        rowNumber: params.rowNumber,
        parentRowId: params.parentRowId,
        confidence: params.confidence ?? 90,
        status: "EXTRACTED",
      },
    });
    for (const cell of params.cells) {
      await prisma.extractedTableCell.create({
        data: {
          companyId: params.companyId,
          extractedTableRowId: row.id,
          columnKey: cell.columnKey,
          rawValue: cell.rawValue,
          confidence: cell.confidence ?? params.confidence ?? 90,
        },
      });
    }
    return row;
  }

  function ownerActor(): CurrentActor {
    return { userId: ownerUserId, companyId: companyAId, role: UserRole.COMPANY_OWNER, fullName: "Bridge Owner", email: `bridge-owner-${RUN_ID}@example.com` };
  }
  function otherCompanyActor(): CurrentActor {
    return { userId: ownerUserBId, companyId: companyBId, role: UserRole.COMPANY_OWNER, fullName: "Bridge Owner B", email: `bridge-owner-b-${RUN_ID}@example.com` };
  }

  beforeAll(async () => {
    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });

    const companyA = await prisma.company.create({ data: { legalName: `Bridge Co A ${RUN_ID}`, tradeName: "Bridge Co A", email: `bridge-a-${RUN_ID}@example.com` } });
    companyAId = companyA.id;
    await grantUnlimitedPlanForTests(companyAId); // this suite creates two projects for company A
    await prisma.companyIndustryEngine.create({ data: { companyId: companyAId, industryEngineId: construction.id, enabled: true } });

    const companyB = await prisma.company.create({ data: { legalName: `Bridge Co B ${RUN_ID}`, tradeName: "Bridge Co B", email: `bridge-b-${RUN_ID}@example.com` } });
    companyBId = companyB.id;
    await grantUnlimitedPlanForTests(companyBId);
    await prisma.companyIndustryEngine.create({ data: { companyId: companyBId, industryEngineId: construction.id, enabled: true } });

    const ownerUser = await prisma.user.create({ data: { companyId: companyAId, email: `bridge-owner-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Bridge Owner", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() } });
    ownerUserId = ownerUser.id;
    const ownerUserB = await prisma.user.create({ data: { companyId: companyBId, email: `bridge-owner-b-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Bridge Owner B", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() } });
    ownerUserBId = ownerUserB.id;

    const clientA = await createClient(companyAId, { name: "Bridge Client A", email: `bridge-client-a-${RUN_ID}@example.com` });
    const { project: projectA } = await createProjectWithDefaultBoq(ownerActor(), {
      clientId: clientA.id, industryEngineId: "construction", reference: `BRIDGE-A-${RUN_ID}`, name: "Bridge Project A",
      location: "Dubai", currency: "AED", taxRate: "5", language: "English",
    });
    projectAId = projectA.databaseId;
    projectASlug = projectA.id; // toProjectDTO's "id" is the SLUG, not the database UUID

    const clientA2 = await createClient(companyAId, { name: "Bridge Client A2", email: `bridge-client-a2-${RUN_ID}@example.com` });
    const { project: projectA2 } = await createProjectWithDefaultBoq(ownerActor(), {
      clientId: clientA2.id, industryEngineId: "construction", reference: `BRIDGE-A2-${RUN_ID}`, name: "Bridge Project A2",
      location: "Dubai", currency: "AED", taxRate: "5", language: "English",
    });
    projectA2Id = projectA2.databaseId;

    const clientB = await createClient(companyBId, { name: "Bridge Client B", email: `bridge-client-b-${RUN_ID}@example.com` });
    const { project: projectB } = await createProjectWithDefaultBoq(otherCompanyActor(), {
      clientId: clientB.id, industryEngineId: "construction", reference: `BRIDGE-B-${RUN_ID}`, name: "Bridge Project B",
      location: "Dubai", currency: "AED", taxRate: "5", language: "English",
    });
    projectBId = projectB.databaseId;

    const fileB = await prisma.projectFile.create({
      data: {
        companyId: companyBId, projectId: projectBId, uploadedByUserId: ownerUserBId,
        originalName: "company-b-file.xlsx", safeFileName: "company-b-file.xlsx",
        storageKey: `test/${RUN_ID}/company-b-file.xlsx`, mimeType: "application/octet-stream",
        extension: "xlsx", fileSize: 1024, checksum: `checksum-b-${RUN_ID}`,
      },
    });
    fileBId = fileB.id;
  });

  afterAll(async () => {
    const ids = [companyAId, companyBId];
    await prisma.auditLog.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.extractedEntity.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.extractedTableCell.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.extractedTableRow.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.extractedTable.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.extractionJob.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.projectFile.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.bOQItem.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.bOQSection.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.bOQ.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.project.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.client.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.companyIndustryEngine.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.user.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.company.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it("1. an EXISTING_BOQ flat table row becomes a SCHEDULE_ROW candidate", async () => {
    const file = await createFile(companyAId, projectAId);
    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "EXISTING_BOQ" });
    await createRow({
      companyId: companyAId, extractedTableId: table.id, rowNumber: 1,
      cells: [
        { columnKey: "item_code", rawValue: "B-01" },
        { columnKey: "description", rawValue: "Excavation to reduce levels" },
        { columnKey: "quantity", rawValue: "120" },
        { columnKey: "unit", rawValue: "m3" },
      ],
    });

    const result = await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    expect(result.status).toBe("generated");
    expect(result.candidatesCreated).toBe(1);

    const [entity] = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id } });
    expect(entity.entityType).toBe("SCHEDULE_ROW");
    expect(entity.label).toBe("Excavation to reduce levels");
  });

  it("2. a door schedule row becomes a DOOR candidate", async () => {
    const file = await createFile(companyAId, projectAId);
    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "DOOR_SCHEDULE" });
    await createRow({ companyId: companyAId, extractedTableId: table.id, rowNumber: 1, cells: [{ columnKey: "door_type", rawValue: "Single Timber Door" }] });

    await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    const [entity] = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id } });
    expect(entity.entityType).toBe("DOOR");
  });

  it("3. a furniture schedule row becomes a FURNITURE candidate", async () => {
    const file = await createFile(companyAId, projectAId);
    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "FURNITURE_SCHEDULE" });
    await createRow({ companyId: companyAId, extractedTableId: table.id, rowNumber: 1, cells: [{ columnKey: "item_name", rawValue: "Executive Desk" }] });

    await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    const [entity] = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id } });
    expect(entity.entityType).toBe("FURNITURE");
  });

  it("4. an equipment schedule row becomes an EQUIPMENT candidate", async () => {
    const file = await createFile(companyAId, projectAId);
    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "EQUIPMENT_SCHEDULE" });
    await createRow({ companyId: companyAId, extractedTableId: table.id, rowNumber: 1, cells: [{ columnKey: "name", rawValue: "Split AC Unit" }] });

    await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    const [entity] = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id } });
    expect(entity.entityType).toBe("EQUIPMENT");
  });

  it("5. a material schedule row becomes a MATERIAL candidate", async () => {
    const file = await createFile(companyAId, projectAId);
    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "MATERIAL_SCHEDULE" });
    await createRow({ companyId: companyAId, extractedTableId: table.id, rowNumber: 1, cells: [{ columnKey: "material", rawValue: "Porcelain Tile 600x600" }] });

    await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    const [entity] = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id } });
    expect(entity.entityType).toBe("MATERIAL");
  });

  it("6+7. automatic candidates are NEEDS_REVIEW with extractionMethod TABLE_PARSER", async () => {
    const file = await createFile(companyAId, projectAId);
    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "GENERIC_TABLE" });
    await createRow({ companyId: companyAId, extractedTableId: table.id, rowNumber: 1, cells: [{ columnKey: "description", rawValue: "Generic row" }] });

    await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    const [entity] = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id } });
    expect(entity.status).toBe("NEEDS_REVIEW");
    expect(entity.extractionMethod).toBe("TABLE_PARSER");
  });

  it("8. source file/table/row evidence is preserved", async () => {
    const file = await createFile(companyAId, projectAId);
    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "GENERIC_TABLE", sheetName: "Sheet1" });
    const row = await createRow({ companyId: companyAId, extractedTableId: table.id, rowNumber: 7, cells: [{ columnKey: "description", rawValue: "Evidence row" }] });

    await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    const [entity] = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id } });

    expect(entity.sourceReference).toContain(file.originalName);
    expect(entity.sourceReference).toContain("Sheet1");
    expect(entity.sourceReference).toContain("row 7");
    const technicalData = entity.technicalDataJson as Record<string, unknown>;
    expect(technicalData.sourceTableId).toBe(table.id);
    expect(technicalData.sourceRowId).toBe(row.id);
    expect(technicalData.rowNumber).toBe(7);
  });

  it("9. confidence never exceeds the minimum of table confidence and row confidence", async () => {
    const file = await createFile(companyAId, projectAId);
    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "GENERIC_TABLE", confidence: 75 });
    await createRow({ companyId: companyAId, extractedTableId: table.id, rowNumber: 1, confidence: 95, cells: [{ columnKey: "description", rawValue: "High row confidence" }] });
    await createRow({ companyId: companyAId, extractedTableId: table.id, rowNumber: 2, confidence: 60, cells: [{ columnKey: "description", rawValue: "Low row confidence" }] });

    await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    const entities = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id }, orderBy: { label: "asc" } });
    const highRowEntity = entities.find((e) => e.label === "High row confidence")!;
    const lowRowEntity = entities.find((e) => e.label === "Low row confidence")!;
    expect(highRowEntity.confidence.toNumber()).toBe(75); // min(75 table, 95 row) — never upgraded above the table's own confidence
    expect(lowRowEntity.confidence.toNumber()).toBe(60); // min(75 table, 60 row)
  });

  it("10. explicit Quantity=12 + Unit=nr resolves to quantity 12 / unit nr", async () => {
    const file = await createFile(companyAId, projectAId);
    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "DOOR_SCHEDULE" });
    await createRow({
      companyId: companyAId, extractedTableId: table.id, rowNumber: 1,
      cells: [{ columnKey: "description", rawValue: "Door" }, { columnKey: "quantity", rawValue: "12" }, { columnKey: "unit", rawValue: "nr" }],
    });

    await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    const [entity] = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id } });
    expect(entity.quantity?.toNumber()).toBe(12);
    expect(entity.unit).toBe("nr");
  });

  it("a combined quantity+unit value in a recognized quantity field is strictly split (0.58 tonne)", async () => {
    const file = await createFile(companyAId, projectAId);
    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "STRUCTURAL_QUANTITY_SCHEDULE" });
    await createRow({
      companyId: companyAId, extractedTableId: table.id, rowNumber: 1,
      cells: [{ columnKey: "diameter", rawValue: "25 mm" }, { columnKey: "quantity", rawValue: "0.58 tonne" }],
    });

    await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    const [entity] = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id } });
    expect(entity.quantity?.toNumber()).toBe(0.58);
    expect(entity.unit).toBe("tonne");
  });

  it("11. a number+unit value in a non-quantity field (Concrete = 53 m3) never becomes candidate.quantity", async () => {
    const file = await createFile(companyAId, projectAId);
    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "STRUCTURAL_QUANTITY_SCHEDULE" });
    await createRow({
      companyId: companyAId, extractedTableId: table.id, rowNumber: 1,
      cells: [{ columnKey: "parent_element", rawValue: "Foundations" }, { columnKey: "concrete", rawValue: "53 m3" }],
    });

    await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    const [entity] = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id } });
    expect(entity.quantity).toBeNull();
    expect(entity.unit).toBeNull();
  });

  it("12. an exact Wall Height header populates technicalData.wallHeight", async () => {
    const file = await createFile(companyAId, projectAId);
    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "FINISH_SCHEDULE" });
    await createRow({ companyId: companyAId, extractedTableId: table.id, rowNumber: 1, cells: [{ columnKey: "wall_height", rawValue: "3.4" }] });

    await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    const [entity] = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id } });
    const technicalData = entity.technicalDataJson as Record<string, unknown>;
    expect(technicalData.wallHeight).toBe(3.4);
  });

  it("13. an ambiguous 'Area' header never becomes netFloorArea/wallArea/ceilingArea/openingsArea", async () => {
    const file = await createFile(companyAId, projectAId);
    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "FINISH_SCHEDULE" });
    await createRow({ companyId: companyAId, extractedTableId: table.id, rowNumber: 1, cells: [{ columnKey: "area", rawValue: "45" }] });

    await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    const [entity] = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id } });
    const technicalData = entity.technicalDataJson as Record<string, unknown>;
    expect(technicalData.netFloorArea).toBeUndefined();
    expect(technicalData.wallArea).toBeUndefined();
    expect(technicalData.ceilingArea).toBeUndefined();
    expect(technicalData.openingsArea).toBeUndefined();
    expect(entity.quantity).toBeNull(); // "area" is also not a recognized quantity key
  });

  it("14. a child row never receives its parent's quantity, even though it retains parent context", async () => {
    const file = await createFile(companyAId, projectAId);
    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "STRUCTURAL_QUANTITY_SCHEDULE" });
    const parent = await createRow({
      companyId: companyAId, extractedTableId: table.id, rowNumber: 1,
      cells: [{ columnKey: "parent_element", rawValue: "Foundations" }, { columnKey: "concrete", rawValue: "53 m3" }],
    });
    await createRow({
      companyId: companyAId, extractedTableId: table.id, rowNumber: 2, parentRowId: parent.id,
      cells: [{ columnKey: "diameter", rawValue: "25 mm" }, { columnKey: "quantity", rawValue: "0.58 tonne" }],
    });

    await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    const entities = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id }, orderBy: { createdAt: "asc" } });
    expect(entities).toHaveLength(2);

    const parentEntity = entities.find((e) => (e.technicalDataJson as Record<string, unknown>).rowNumber === 1)!;
    const childEntity = entities.find((e) => (e.technicalDataJson as Record<string, unknown>).rowNumber === 2)!;

    expect(parentEntity.quantity).toBeNull(); // "concrete" is not a recognized quantity field
    expect(childEntity.quantity?.toNumber()).toBe(0.58);
    expect(childEntity.unit).toBe("tonne");

    const childTechnicalData = childEntity.technicalDataJson as Record<string, unknown>;
    const parentContext = childTechnicalData.parentContext as Record<string, unknown>;
    expect(parentContext.sourceRowId).toBe(parent.id);
    expect(parentContext.label).toBe("Foundations");
  });

  it("15. repeated generation before review never creates duplicates", async () => {
    const file = await createFile(companyAId, projectAId);
    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "DOOR_SCHEDULE" });
    await createRow({ companyId: companyAId, extractedTableId: table.id, rowNumber: 1, cells: [{ columnKey: "description", rawValue: "Door A" }] });

    const first = await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    const second = await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    expect(first.candidatesCreated).toBe(1);
    expect(second.candidatesCreated).toBe(1);

    const entities = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id } });
    expect(entities).toHaveLength(1);
  });

  it("16. a reviewed candidate is preserved and regeneration is skipped", async () => {
    const file = await createFile(companyAId, projectAId);
    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "DOOR_SCHEDULE" });
    await createRow({ companyId: companyAId, extractedTableId: table.id, rowNumber: 1, cells: [{ columnKey: "description", rawValue: "Reviewed Door" }] });

    await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    const [candidate] = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id } });
    await prisma.extractedEntity.update({ where: { id: candidate.id }, data: { status: "CONFIRMED", confirmedByUserId: ownerUserId, confirmedAt: new Date() } });

    const result = await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    expect(result.status).toBe("skipped");

    const entitiesAfter = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id } });
    expect(entitiesAfter).toHaveLength(1);
    expect(entitiesAfter[0].id).toBe(candidate.id);
    expect(entitiesAfter[0].status).toBe("CONFIRMED");
  });

  it("17. a reviewed candidate's source table is protected from replacement on re-extraction", async () => {
    const csv = "Item Code,Description,Quantity,Unit\nD-01,Single Timber Door,12,nr\n";
    const uploaded = await uploadProjectFile(ownerActor(), projectAId, { originalName: `reviewed-guard-${RUN_ID}.csv`, mimeType: "text/csv", buffer: Buffer.from(csv) });
    await prisma.projectFile.update({ where: { id: uploaded.file.id }, data: { classification: "DOOR_SCHEDULE" } });

    const firstJob = await triggerFileExtraction(ownerActor(), uploaded.file.id);
    await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: firstJob.id } })).status === ExtractionJobStatus.COMPLETED);

    const [table] = await prisma.extractedTable.findMany({ where: { companyId: companyAId, projectFileId: uploaded.file.id } });
    expect(table).toBeDefined();
    const candidatesBefore = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: uploaded.file.id, extractionMethod: "TABLE_PARSER" } });
    expect(candidatesBefore).toHaveLength(1);
    expect(candidatesBefore[0].status).toBe("NEEDS_REVIEW");

    await prisma.extractedEntity.update({ where: { id: candidatesBefore[0].id }, data: { status: "CONFIRMED", confirmedByUserId: ownerUserId, confirmedAt: new Date() } });

    const secondJob = await triggerFileExtraction(ownerActor(), uploaded.file.id);
    await waitFor(async () => (await prisma.extractionJob.findUniqueOrThrow({ where: { id: secondJob.id } })).status === ExtractionJobStatus.COMPLETED);

    const finalJob = await prisma.extractionJob.findUniqueOrThrow({ where: { id: secondJob.id } });
    expect((finalJob.resultSummaryJson as { skipped?: boolean })?.skipped).toBe(true);

    const tableAfter = await prisma.extractedTable.findUnique({ where: { id: table.id } });
    expect(tableAfter).not.toBeNull(); // the reviewed candidate's evidence table must still exist, unchanged

    const candidatesAfter = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: uploaded.file.id, extractionMethod: "TABLE_PARSER" } });
    expect(candidatesAfter).toHaveLength(1);
    expect(candidatesAfter[0].status).toBe("CONFIRMED");
  });

  it("18. a manual entity is unaffected by repeated automatic regeneration", async () => {
    const file = await createFile(companyAId, projectAId);
    const manual = await manuallyAddExtractedEntity(ownerActor(), {
      projectId: projectAId,
      projectFileId: file.id,
      entityType: "MATERIAL",
      label: "Manually added item",
      confidence: 100,
      extractionMethod: "MANUAL",
    });

    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "MATERIAL_SCHEDULE" });
    await createRow({ companyId: companyAId, extractedTableId: table.id, rowNumber: 1, cells: [{ columnKey: "material", rawValue: "Auto item" }] });

    await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });

    const manualAfter = await prisma.extractedEntity.findUniqueOrThrow({ where: { id: manual.id } });
    expect(manualAfter.label).toBe("Manually added item");
    expect(manualAfter.extractionMethod).toBe("MANUAL");
    expect(manualAfter.status).toBe("EXTRACTED");

    const autoEntities = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id, extractionMethod: "TABLE_PARSER" } });
    expect(autoEntities).toHaveLength(1); // still only one auto candidate — regeneration replaced, didn't duplicate, and never touched the manual one
  });

  it("19. cross-company project or file use is rejected", async () => {
    const file = await createFile(companyAId, projectAId);
    await expect(
      generateCandidatesFromStructuredTables({ companyId: companyBId, projectId: projectAId, projectFileId: file.id }),
    ).rejects.toThrow(NotFoundError);

    await expect(
      generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: fileBId }),
    ).rejects.toThrow(NotFoundError);
  });

  it("20. a file from another project in the same company is rejected", async () => {
    const file = await createFile(companyAId, projectAId); // belongs to project A
    await expect(
      generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectA2Id, projectFileId: file.id }),
    ).rejects.toMatchObject({ code: "FILE_PROJECT_MISMATCH" });
  });

  it("21. a project slug resolves to the canonical project UUID", async () => {
    const file = await createFile(companyAId, projectAId);
    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "GENERIC_TABLE" });
    await createRow({ companyId: companyAId, extractedTableId: table.id, rowNumber: 1, cells: [{ columnKey: "description", rawValue: "Slug resolution row" }] });

    await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectASlug, projectFileId: file.id });
    const [entity] = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id } });
    expect(entity.projectId).toBe(projectAId);
  });

  it("22. the existing-table backfill service creates candidates from already-stored tables", async () => {
    const file = await createFile(companyAId, projectAId);
    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "FURNITURE_SCHEDULE" });
    await createRow({ companyId: companyAId, extractedTableId: table.id, rowNumber: 1, cells: [{ columnKey: "item_name", rawValue: "Backfill Chair" }] });

    const result = await prepareStructuredSourceCandidates(ownerActor(), { projectId: projectAId, projectFileId: file.id });
    expect(result.filesConsidered).toBe(1);
    expect(result.filesPrepared).toBe(1);
    expect(result.filesSkippedBecauseReviewed).toBe(0);
    expect(result.candidatesCreated).toBe(1);

    const [entity] = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id } });
    expect(entity.entityType).toBe("FURNITURE");
    expect(entity.status).toBe("NEEDS_REVIEW");
  });

  it("23. a file with no stored tables produces zero candidates — no fabrication", async () => {
    const file = await createFile(companyAId, projectAId);
    const result = await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    expect(result.status).toBe("generated");
    expect(result.tablesConsidered).toBe(0);
    expect(result.candidatesCreated).toBe(0);

    const entities = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id } });
    expect(entities).toHaveLength(0);
  });

  it("24. plain PDF page text with no structured table produces zero candidates", async () => {
    const PDFDocument = (await import("pdfkit")).default;
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.font("Helvetica").fontSize(10).text("This is a plain paragraph of inspection notes with no tabular structure at all.");
      doc.end();
    });

    const uploaded = await uploadProjectFile(ownerActor(), projectAId, { originalName: `plain-text-${RUN_ID}.pdf`, mimeType: "application/pdf", buffer });
    const job = await triggerFileExtraction(ownerActor(), uploaded.file.id);
    await waitFor(async () => {
      const current = await prisma.extractionJob.findUniqueOrThrow({ where: { id: job.id } });
      return current.status === ExtractionJobStatus.NEEDS_REVIEW || current.status === ExtractionJobStatus.COMPLETED;
    });

    const entities = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: uploaded.file.id, extractionMethod: "TABLE_PARSER" } });
    expect(entities).toHaveLength(0);
  });

  it("25. candidate generation never creates a BOQ item", async () => {
    const file = await createFile(companyAId, projectA2Id);
    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "EXISTING_BOQ" });
    await createRow({
      companyId: companyAId, extractedTableId: table.id, rowNumber: 1,
      cells: [{ columnKey: "description", rawValue: "Should never reach the BOQ" }, { columnKey: "quantity", rawValue: "5" }, { columnKey: "unit", rawValue: "nr" }],
    });

    await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectA2Id, projectFileId: file.id });

    const itemCount = await prisma.bOQItem.count({ where: { section: { boq: { projectId: projectA2Id } } } });
    expect(itemCount).toBe(0);
  });

  it("dimension technicalData carries drawingPageId through from the source table when present", async () => {
    const file = await createFile(companyAId, projectAId);
    const drawingPage = await prisma.drawingPage.create({ data: { companyId: companyAId, projectFileId: file.id, pageNumber: 1, processingStatus: "COMPLETED" } });
    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "GENERIC_TABLE", drawingPageId: drawingPage.id });
    await createRow({ companyId: companyAId, extractedTableId: table.id, rowNumber: 1, cells: [{ columnKey: "description", rawValue: "Row with a drawing page" }] });

    await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    const [entity] = await prisma.extractedEntity.findMany({ where: { companyId: companyAId, projectFileId: file.id } });
    expect(entity.drawingPageId).toBe(drawingPage.id);

    await prisma.drawingPage.delete({ where: { id: drawingPage.id } });
  });

  it("records a STRUCTURED_SOURCE_CANDIDATES_GENERATED audit entry", async () => {
    const file = await createFile(companyAId, projectAId);
    const table = await createTable({ companyId: companyAId, projectFileId: file.id, tableType: "GENERIC_TABLE" });
    await createRow({ companyId: companyAId, extractedTableId: table.id, rowNumber: 1, cells: [{ columnKey: "description", rawValue: "Audited row" }] });

    await generateCandidatesFromStructuredTables({ companyId: companyAId, projectId: projectAId, projectFileId: file.id });
    const auditEntry = await prisma.auditLog.findFirst({
      where: { companyId: companyAId, entityId: file.id, action: "STRUCTURED_SOURCE_CANDIDATES_GENERATED" },
      orderBy: { createdAt: "desc" },
    });
    expect(auditEntry).not.toBeNull();
    expect((auditEntry!.payloadJson as { candidatesCreated: number }).candidatesCreated).toBe(1);
  });

  describe("Part 2 — manual entity tenant/project safety", () => {
    it("resolves a project slug to the canonical project UUID", async () => {
      const file = await createFile(companyAId, projectAId);
      const created = await manuallyAddExtractedEntity(ownerActor(), {
        projectId: projectASlug,
        projectFileId: file.id,
        entityType: "MATERIAL",
        label: "Slug-resolved manual entity",
        confidence: 100,
        extractionMethod: "MANUAL",
      });
      expect(created.projectId).toBe(projectAId);
    });

    it("rejects a file that belongs to a different project in the same company", async () => {
      const file = await createFile(companyAId, projectAId); // belongs to project A
      await expect(
        manuallyAddExtractedEntity(ownerActor(), {
          projectId: projectA2Id, // NOT the file's real project
          projectFileId: file.id,
          entityType: "MATERIAL",
          label: "Cross-project attempt",
          confidence: 100,
          extractionMethod: "MANUAL",
        }),
      ).rejects.toMatchObject({ code: "FILE_PROJECT_MISMATCH" });
    });

    it("rejects a cross-company file id outright", async () => {
      await expect(
        manuallyAddExtractedEntity(ownerActor(), {
          projectId: projectAId,
          projectFileId: fileBId, // belongs to company B
          entityType: "MATERIAL",
          label: "Cross-company attempt",
          confidence: 100,
          extractionMethod: "MANUAL",
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
