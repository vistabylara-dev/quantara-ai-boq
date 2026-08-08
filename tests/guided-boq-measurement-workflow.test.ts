import { ExtractedEntityType, ExtractionMethod, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { NotFoundError } from "../src/lib/errors/app-error";
import { LockedBOQError } from "../src/lib/domain/boq-guards";
import { lockBOQ } from "../src/lib/repositories/boq-repository";
import { runBOQVerification } from "../src/lib/repositories/verification-repository";
import { grantUnlimitedPlanForTests } from "./helpers/grant-unlimited-plan";

import { getRequiredDimensions, getMissingRequiredDimensions } from "../src/lib/calculations/required-dimensions-registry";
import type { DimensionValue } from "../src/lib/calculations/required-dimensions-registry";
import {
  createCalculation,
  confirmCalculation,
  overrideCalculationResult,
  getCalculation,
  previewCalculation,
} from "../src/lib/services/quantity-calculation-service";
import { proposeCalculatedQuantityForItem, confirmCalculatedQuantityForItem } from "../src/lib/services/boq-quantity-update-service";
import { importExtractedEntityToBoq } from "../src/lib/services/extraction-to-boq-service";
import { correctExtractedEntity } from "../src/lib/services/extracted-entity-service";

const RUN_ID = `${Date.now()}-${process.pid}`;

function dim(key: string, label: string, unit: string | null, required: boolean, value: number | null): DimensionValue {
  return { key, label, unit, required, value, source: value !== null ? "manual_professional_input" : null, confidence: value !== null ? 100 : null, reviewStatus: value !== null ? "MANUAL_ENTRY" : "MISSING" };
}

describe("Guided BOQ measurement workflow (Release 1) — pure required-dimensions registry", () => {
  it("declares FLOOR_AREA's required inputs exactly as the spec's own example, matching quantity-formulas.ts's parameters", () => {
    const definition = getRequiredDimensions("FLOOR_AREA");
    expect(definition).not.toBeNull();
    expect(definition!.inputs.map((i) => i.key)).toEqual(["netFloorArea", "wastagePercentage"]);
    expect(definition!.inputs.find((i) => i.key === "netFloorArea")!.required).toBe(true);
    expect(definition!.inputs.find((i) => i.key === "wastagePercentage")!.required).toBe(false);
  });

  it("reports every required dimension missing when nothing has been supplied — never defaults to zero", () => {
    const definition = getRequiredDimensions("WALL_AREA")!;
    const missing = getMissingRequiredDimensions(definition, []);
    expect(missing.map((m) => m.key).sort()).toEqual(["wallHeight", "wallLength"]);
  });

  it("never invents a missing required dimension — compute() throws rather than silently using 0", () => {
    const definition = getRequiredDimensions("CONCRETE_VOLUME")!;
    expect(() => definition.compute({ length: 2, width: 3 })).toThrow(/Missing required dimension "depth"/);
  });

  it("previewCalculation returns no result while required dimensions are missing, and the deterministic result once they're present", () => {
    const missingPreview = previewCalculation("CONCRETE_VOLUME", [dim("length", "Length", "m", true, 2), dim("width", "Width", "m", true, 3)]);
    expect(missingPreview.result).toBeNull();
    expect(missingPreview.missingRequiredDimensions.map((d) => d.key)).toEqual(["depth"]);

    const fullPreview = previewCalculation("CONCRETE_VOLUME", [
      dim("length", "Length", "m", true, 2),
      dim("width", "Width", "m", true, 3),
      dim("depth", "Depth", "m", true, 0.5),
    ]);
    expect(fullPreview.result).not.toBeNull();
    expect(fullPreview.result!.resultValue).toBe(3);
    expect(fullPreview.result!.resultUnit).toBe("m3");
    expect(fullPreview.result!.formula).toBe("length × width × depth");
  });

  it("returns null for a calculation type with no deterministic formula wired yet, rather than fabricating a required-input list", () => {
    expect(getRequiredDimensions("CUSTOM")).toBeNull();
    expect(getRequiredDimensions("AREA")).toBeNull();
  });
});

describe("Guided BOQ measurement workflow (Release 1) — integration (real local Postgres)", () => {
  let companyAId: string;
  let companyBId: string;
  let ownerUserId: string;
  let projectAId: string;
  let boqAId: string;
  let sectionAId: string;
  let projectFileAId: string;

  function ownerActor(): CurrentActor {
    return { userId: ownerUserId, companyId: companyAId, role: UserRole.COMPANY_OWNER, fullName: "Guided Workflow Owner", email: `guided-owner-${RUN_ID}@example.com` };
  }
  function otherCompanyActor(): CurrentActor {
    return { userId: ownerUserId, companyId: companyBId, role: UserRole.COMPANY_OWNER, fullName: "Guided Workflow Other Owner", email: `guided-owner-b-${RUN_ID}@example.com` };
  }

  beforeAll(async () => {
    const companyA = await prisma.company.create({ data: { legalName: `Guided Co A ${RUN_ID}`, tradeName: "Guided Co A", email: `guided-a-${RUN_ID}@example.com` } });
    companyAId = companyA.id;
    await grantUnlimitedPlanForTests(companyAId);
    const companyB = await prisma.company.create({ data: { legalName: `Guided Co B ${RUN_ID}`, tradeName: "Guided Co B", email: `guided-b-${RUN_ID}@example.com` } });
    companyBId = companyB.id;
    await grantUnlimitedPlanForTests(companyBId);

    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    await prisma.companyIndustryEngine.create({ data: { companyId: companyAId, industryEngineId: construction.id, enabled: true } });
    await prisma.companyIndustryEngine.create({ data: { companyId: companyBId, industryEngineId: construction.id, enabled: true } });

    const owner = await prisma.user.create({
      data: { companyId: companyAId, email: `guided-owner-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Guided Workflow Owner", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerUserId = owner.id;

    const client = await createClient(companyAId, { name: "Guided Workflow Client", email: `guided-client-${RUN_ID}@example.com` });
    const { project, boq } = await createProjectWithDefaultBoq(ownerActor(), {
      clientId: client.id,
      industryEngineId: "construction",
      reference: `GUIDED-${RUN_ID}`,
      name: "Guided Workflow Project",
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    projectAId = project.databaseId;
    boqAId = boq.databaseId;
    sectionAId = boq.sections[0].id;

    const projectFile = await prisma.projectFile.create({
      data: {
        companyId: companyAId,
        projectId: projectAId,
        uploadedByUserId: ownerUserId,
        originalName: "test-drawing.pdf",
        safeFileName: "test-drawing.pdf",
        storageKey: `test/${RUN_ID}/test-drawing.pdf`,
        mimeType: "application/pdf",
        extension: "pdf",
        fileSize: 1024,
        checksum: `checksum-${RUN_ID}`,
      },
    });
    projectFileAId = projectFile.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.quantityCalculation.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.extractedEntity.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.projectFile.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQRevisionSnapshot.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.verificationException.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQItem.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQSection.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQ.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.project.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.client.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.companyIndustryEngine.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.user.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    await prisma.$disconnect();
  });

  it("rejects creating a calculation while a required dimension is missing — never invents it", async () => {
    await expect(
      createCalculation(ownerActor(), {
        projectId: projectAId,
        calculationType: "WALL_AREA",
        dimensionValues: [dim("wallLength", "Wall Length", "m", true, 5)], // wallHeight intentionally omitted
      }),
    ).rejects.toMatchObject({ code: "MISSING_REQUIRED_DIMENSIONS" });
  });

  it("creates, previews, and confirms a calculation end-to-end, recording confirmedBy/confirmedAt", async () => {
    const created = await createCalculation(ownerActor(), {
      projectId: projectAId,
      calculationType: "WALL_AREA",
      dimensionValues: [
        dim("wallLength", "Wall Length", "m", true, 15.8),
        dim("wallHeight", "Wall Height", "m", true, 3.4),
        dim("openingsArea", "Openings Area", "m2", false, 4.2),
      ],
    });
    expect(created.formula).toBe("(wallLength × wallHeight - openings) + wastage%");
    expect(created.resultValue).toBeCloseTo(49.52, 2);
    expect(created.resultUnit).toBe("m2");
    expect(created.status).toBe("EXTRACTED"); // not yet confirmed
    expect(created.confirmedByUserId).toBeNull();

    const confirmed = await confirmCalculation(ownerActor(), created.id);
    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.confirmedByUserId).toBe(ownerUserId);
    expect(confirmed.confirmedAt).not.toBeNull();

    const reloaded = await getCalculation(ownerActor(), created.id);
    expect(reloaded.status).toBe("CONFIRMED");
  });

  it("preserves the ORIGINAL result across repeated overrides, never drifting to the last overridden value", async () => {
    const created = await createCalculation(ownerActor(), {
      projectId: projectAId,
      calculationType: "CONCRETE_VOLUME",
      dimensionValues: [dim("length", "Length", "m", true, 2), dim("width", "Width", "m", true, 3), dim("depth", "Depth", "m", true, 0.5)],
    });
    expect(created.resultValue).toBe(3);

    const firstOverride = await overrideCalculationResult(ownerActor(), created.id, 3.5, "Adjusted for site measurement discrepancy");
    expect(firstOverride.manuallyOverridden).toBe(true);
    expect(firstOverride.originalResultValue).toBe(3);
    expect(firstOverride.resultValue).toBe(3.5);

    const secondOverride = await overrideCalculationResult(ownerActor(), created.id, 4, "Further site correction");
    expect(secondOverride.originalResultValue).toBe(3); // still the TRUE original, not 3.5
    expect(secondOverride.resultValue).toBe(4);
  });

  it("requires a non-empty reason to override a calculation result", async () => {
    const created = await createCalculation(ownerActor(), {
      projectId: projectAId,
      calculationType: "PARTITION_AREA",
      dimensionValues: [dim("length", "Length", "m", true, 4), dim("height", "Height", "m", true, 2.5), dim("faces", "Faces", null, true, 2)],
    });
    await expect(overrideCalculationResult(ownerActor(), created.id, 25, "")).rejects.toMatchObject({ code: "OVERRIDE_REASON_REQUIRED" });
  });

  it("proposeCalculatedQuantityForItem never mutates the BOQ item; confirmCalculatedQuantityForItem only writes after explicit confirmation of the CALCULATION first", async () => {
    // Seed a real starting quantity distinct from the calculated one, matching the spec's own
    // example (current 45.00 vs proposed 49.52).
    const item = await prisma.bOQItem.create({
      data: {
        companyId: companyAId,
        sectionId: sectionAId,
        itemNumber: 800,
        itemCode: `PROPOSE-${RUN_ID}`,
        category: "General",
        description: "Item awaiting a calculated quantity",
        quantity: 45,
        unit: "m2",
        unitCost: 10,
        marginPercentage: 10,
        sellingRate: 11,
        totalAmount: 495,
        landedCost: 10,
        sortOrder: 800,
      },
    });

    const calculation = await createCalculation(ownerActor(), {
      projectId: projectAId,
      calculationType: "WALL_AREA",
      dimensionValues: [dim("wallLength", "Wall Length", "m", true, 15.8), dim("wallHeight", "Wall Height", "m", true, 3.4), dim("openingsArea", "Openings", "m2", false, 4.2)],
    });

    // Not yet confirmed — proposing is fine (read-only), but confirming the quantity update
    // must be refused until the calculation itself is professionally confirmed.
    const proposal = await proposeCalculatedQuantityForItem(ownerActor(), item.id, calculation.id);
    expect(proposal.currentQuantity).toBe(45);
    expect(proposal.proposedQuantity).toBeCloseTo(49.52, 2);
    expect(proposal.calculationConfirmed).toBe(false);

    const untouchedAfterPropose = await prisma.bOQItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(untouchedAfterPropose.quantity.toNumber()).toBe(45); // proposing never mutates

    await expect(confirmCalculatedQuantityForItem(ownerActor(), item.id, calculation.id)).rejects.toMatchObject({ code: "CALCULATION_NOT_CONFIRMED" });
    const stillUntouched = await prisma.bOQItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(stillUntouched.quantity.toNumber()).toBe(45);

    await confirmCalculation(ownerActor(), calculation.id);
    await confirmCalculatedQuantityForItem(ownerActor(), item.id, calculation.id);
    const updatedItem = await prisma.bOQItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(updatedItem.quantity.toNumber()).toBeCloseTo(49.52, 2);

    const auditEntry = await prisma.auditLog.findFirst({
      where: { companyId: companyAId, entityId: item.id, action: "BOQ_QUANTITY_UPDATED_FROM_CALCULATION" },
      orderBy: { createdAt: "desc" },
    });
    expect(auditEntry).not.toBeNull();
    expect((auditEntry!.payloadJson as { previousQuantity: number }).previousQuantity).toBe(45);
  });

  it("manual quantity entry with no QuantityCalculation remains fully supported — never blocked or overridden", async () => {
    const before = await prisma.bOQItem.count({ where: { section: { boqId: boqAId } } });
    const manualItem = await prisma.bOQItem.create({
      data: {
        companyId: companyAId,
        sectionId: sectionAId,
        itemNumber: 900,
        itemCode: `MANUAL-${RUN_ID}`,
        category: "General",
        description: "Purely manual professional entry",
        quantity: 12.5,
        unit: "m2",
        unitCost: 10,
        marginPercentage: 10,
        sellingRate: 11,
        totalAmount: 137.5,
        landedCost: 10,
        sortOrder: 900,
      },
    });
    expect(manualItem.quantity.toNumber()).toBe(12.5);
    const after = await prisma.bOQItem.count({ where: { section: { boqId: boqAId } } });
    expect(after).toBe(before + 1);
  });

  it("an extracted entity cannot bypass human review — importExtractedEntityToBoq rejects an unconfirmed entity, and rejects a calculation that isn't confirmed or doesn't belong to the entity", async () => {
    const entity = await prisma.extractedEntity.create({
      data: {
        companyId: companyAId,
        projectId: projectAId,
        projectFileId: projectFileAId,
        entityType: ExtractedEntityType.WALL_FINISH,
        label: "North wall finish",
        confidence: 85,
        extractionMethod: ExtractionMethod.VISION_MODEL,
      },
    });

    // Still EXTRACTED (never reviewed) — must be refused.
    await expect(
      importExtractedEntityToBoq(ownerActor(), boqAId, entity.id, {
        sectionId: sectionAId,
        itemNumber: 901,
        itemCode: `EXT-${RUN_ID}`,
        category: "Finishes",
        description: "North wall finish",
        unit: "m2",
        quantity: 10,
        unitCost: 20,
        marginPercentage: 10,
      }),
    ).rejects.toMatchObject({ code: "ENTITY_NOT_CONFIRMED" });

    await correctExtractedEntity(ownerActor(), entity.id, { quantity: 10, reason: "Confirmed on-site" });

    const unrelatedCalculation = await createCalculation(ownerActor(), {
      projectId: projectAId,
      calculationType: "PAINT_AREA",
      dimensionValues: [dim("wallArea", "Wall Area", "m2", true, 30), dim("openingsArea", "Openings", "m2", false, 0), dim("coats", "Coats", null, true, 2)],
    });
    await confirmCalculation(ownerActor(), unrelatedCalculation.id);

    // A confirmed calculation that does NOT belong to this entity must still be refused.
    await expect(
      importExtractedEntityToBoq(ownerActor(), boqAId, entity.id, {
        sectionId: sectionAId,
        itemNumber: 902,
        itemCode: `EXT2-${RUN_ID}`,
        category: "Finishes",
        description: "North wall finish",
        unit: "m2",
        quantity: 10,
        unitCost: 20,
        marginPercentage: 10,
        quantityCalculationId: unrelatedCalculation.id,
      }),
    ).rejects.toMatchObject({ code: "CALCULATION_ENTITY_MISMATCH" });

    // Now genuinely confirmed and corrected — the simple direct-quantity path (no
    // calculation) must still work exactly as before this feature existed.
    const imported = await importExtractedEntityToBoq(ownerActor(), boqAId, entity.id, {
      sectionId: sectionAId,
      itemNumber: 903,
      itemCode: `EXT3-${RUN_ID}`,
      category: "Finishes",
      description: "North wall finish",
      unit: "m2",
      quantity: 10,
      unitCost: 20,
      marginPercentage: 10,
    });
    expect(imported.item.quantity.toNumber()).toBe(10);
    expect(imported.item.sourceReference).toBe(""); // entity had no sourceReference set
    expect(imported.item.confidenceScore.toNumber()).toBe(85);

    const reloadedEntity = await prisma.extractedEntity.findUniqueOrThrow({ where: { id: entity.id } });
    expect(reloadedEntity.status).toBe("IMPORTED");

    // A second import attempt of the same (now IMPORTED) entity must also be refused.
    await expect(
      importExtractedEntityToBoq(ownerActor(), boqAId, entity.id, {
        sectionId: sectionAId,
        itemNumber: 904,
        itemCode: `EXT4-${RUN_ID}`,
        category: "Finishes",
        description: "North wall finish",
        unit: "m2",
        quantity: 10,
        unitCost: 20,
        marginPercentage: 10,
      }),
    ).rejects.toMatchObject({ code: "ENTITY_NOT_CONFIRMED" });
  });

  it("cross-company isolation: a calculation created by company A is invisible to company B", async () => {
    const calculation = await createCalculation(ownerActor(), {
      projectId: projectAId,
      calculationType: "SKIRTING_LENGTH",
      dimensionValues: [dim("perimeter", "Perimeter", "m", true, 20), dim("totalDoorWidths", "Door Widths", "m", false, 1.8)],
    });

    await expect(getCalculation(otherCompanyActor(), calculation.id)).rejects.toThrow(NotFoundError);
    await expect(confirmCalculation(otherCompanyActor(), calculation.id)).rejects.toThrow(NotFoundError);
    await expect(overrideCalculationResult(otherCompanyActor(), calculation.id, 99, "attempted cross-tenant override")).rejects.toThrow(NotFoundError);
  });

  it("a locked BOQ cannot have its quantity mutated by a confirmed calculation, even though propose (read-only) still works", async () => {
    const client = await createClient(companyAId, { name: "Lock Test Client", email: `guided-lock-client-${RUN_ID}@example.com` });
    const { boq } = await createProjectWithDefaultBoq(ownerActor(), {
      clientId: client.id,
      industryEngineId: "construction",
      reference: `GUIDED-LOCK-${RUN_ID}`,
      name: "Guided Lock Test Project",
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    const lockBoqId = boq.databaseId;
    const lockSectionId = boq.sections[0].id;
    const lockItem = await prisma.bOQItem.create({
      data: {
        companyId: companyAId,
        sectionId: lockSectionId,
        itemNumber: 1,
        itemCode: `LOCK-${RUN_ID}`,
        category: "General",
        description: "Item to be locked",
        quantity: 5,
        unit: "m2",
        unitCost: 10,
        marginPercentage: 10,
        sellingRate: 11,
        totalAmount: 55,
        landedCost: 10,
        sortOrder: 1,
      },
    });

    await runBOQVerification(companyAId, lockBoqId);
    await lockBOQ(companyAId, lockBoqId, ownerActor().fullName, ownerUserId);

    const calculation = await createCalculation(ownerActor(), {
      projectId: projectAId,
      calculationType: "FLOOR_AREA",
      dimensionValues: [dim("netFloorArea", "Net Floor Area", "m2", true, 20), dim("wastagePercentage", "Wastage", "%", false, 5)],
    });
    await confirmCalculation(ownerActor(), calculation.id);

    // Read-only propose still works even on a locked BOQ (it never mutates anything).
    const proposal = await proposeCalculatedQuantityForItem(ownerActor(), lockItem.id, calculation.id);
    expect(proposal.currentQuantity).toBe(5);

    // But the actual write must be refused.
    await expect(confirmCalculatedQuantityForItem(ownerActor(), lockItem.id, calculation.id)).rejects.toThrow(LockedBOQError);
    const stillLocked = await prisma.bOQItem.findUniqueOrThrow({ where: { id: lockItem.id } });
    expect(stillLocked.quantity.toNumber()).toBe(5);
  });
});
