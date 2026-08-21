import { MarginMode, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { createClient as createClientRecord } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { createSupplier, findSupplierByName } from "../src/lib/repositories/supplier-repository";
import {
  createCatalogueItem,
  getCatalogueItemById,
  updateCatalogueItem,
  getPriceHistory,
} from "../src/lib/repositories/rate-catalogue-repository";
import { applyCatalogueRateToBOQItem } from "../src/lib/services/apply-catalogue-rate-service";
import { createSupplierForCompany } from "../src/lib/services/supplier-service";
import { createBOQItem, updateBOQItem, lockBOQ } from "../src/lib/repositories/boq-repository";
import { runBOQVerification } from "../src/lib/repositories/verification-repository";
import { runVerification } from "../src/lib/verification/run-verification";
import { ConflictError, NotFoundError, PermissionDeniedError, AppError } from "../src/lib/errors/app-error";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { grantUnlimitedPlanForTests } from "./helpers/grant-unlimited-plan";
import { preserveIssuedEvidenceDuringCleanup } from "./helpers/preserve-issued-evidence";

const RUN_ID = Date.now();

function actor(companyId: string, role: UserRole = UserRole.COMPANY_OWNER): CurrentActor {
  return { userId: "test-user", companyId, role, fullName: "Test Actor", email: "actor@example.com" };
}

describe("supplier and catalogue services (integration, real local Postgres)", () => {
  let companyAId: string;
  let companyBId: string;
  let clientAId: string;

  beforeAll(async () => {
    const companyA = await prisma.company.create({
      data: { legalName: `Phase4 Test Co A ${RUN_ID}`, tradeName: "Phase4 Co A", email: `phase4-a-${RUN_ID}@example.com` },
    });
    const companyB = await prisma.company.create({
      data: { legalName: `Phase4 Test Co B ${RUN_ID}`, tradeName: "Phase4 Co B", email: `phase4-b-${RUN_ID}@example.com` },
    });
    companyAId = companyA.id;
    await grantUnlimitedPlanForTests(companyAId);
    companyBId = companyB.id;
    await grantUnlimitedPlanForTests(companyBId);

    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    await prisma.companyIndustryEngine.create({ data: { companyId: companyAId, industryEngineId: construction.id, enabled: true } });
    await prisma.companyIndustryEngine.create({ data: { companyId: companyBId, industryEngineId: construction.id, enabled: true } });

    const client = await createClientRecord(companyAId, { name: "Phase4 Client", email: `phase4-client-${RUN_ID}@example.com` });
    clientAId = client.id;
  });

  afterAll(async () => {
    if (await preserveIssuedEvidenceDuringCleanup([companyAId, companyBId])) {
      await prisma.$disconnect();
      return;
    }
    await prisma.rateCataloguePriceHistory.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.rateCatalogueItem.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.supplier.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.verificationException.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.auditLog.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQItem.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQSection.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQ.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.project.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.client.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.companyIndustryEngine.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    await prisma.$disconnect();
  });

  describe("supplier repository and service", () => {
    it("creates a supplier and prevents a duplicate name within the same company", async () => {
      const supplier = await createSupplier(companyAId, { name: "Gulf Steel Traders" });
      expect(supplier.companyId).toBe(companyAId);
      await expect(createSupplier(companyAId, { name: "gulf steel traders" })).rejects.toThrow(ConflictError);
    });

    it("allows the same supplier name in a different company (tenant isolation)", async () => {
      const supplierB = await createSupplier(companyBId, { name: "Gulf Steel Traders" });
      expect(supplierB.companyId).toBe(companyBId);
      const foundInA = await findSupplierByName(companyAId, "Gulf Steel Traders");
      expect(foundInA?.companyId).toBe(companyAId);
    });

    it("blocks a role without suppliers:manage from creating a supplier", async () => {
      await expect(
        createSupplierForCompany(actor(companyAId, UserRole.DESIGNER), { name: "Blocked Supplier" }),
      ).rejects.toThrow(PermissionDeniedError);
    });
  });

  describe("catalogue repository: deterministic pricing and status", () => {
    it("computes landed cost and markup selling rate on create", async () => {
      const item = await createCatalogueItem(companyAId, {
        industryEngineId: "construction",
        itemCode: `CAT-MARKUP-${RUN_ID}`,
        category: "Concrete",
        description: "Test markup item",
        unit: "m3",
        baseCost: "500",
        freightCost: "20",
        installationCost: "0",
        additionalCost: "0",
        marginMode: MarginMode.MARKUP,
        defaultMargin: "20",
        effectiveDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      expect(item.landedCost).toBe(520);
      expect(item.sellingRate).toBe(624); // 520 * 1.20
      expect(item.status).toBe("ACTIVE");
    });

    it("computes gross-margin selling rate correctly", async () => {
      const item = await createCatalogueItem(companyAId, {
        industryEngineId: "construction",
        itemCode: `CAT-GROSS-${RUN_ID}`,
        category: "Concrete",
        description: "Test gross margin item",
        unit: "m3",
        baseCost: "400",
        marginMode: MarginMode.GROSS_MARGIN,
        defaultMargin: "20",
        effectiveDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      expect(item.landedCost).toBe(400);
      expect(item.sellingRate).toBe(500); // 400 / (1 - 0.20)
    });

    it("marks a future-effective item as PENDING and an expired one as EXPIRED", async () => {
      const pending = await createCatalogueItem(companyAId, {
        industryEngineId: "construction",
        itemCode: `CAT-PENDING-${RUN_ID}`,
        category: "Concrete",
        description: "Future item",
        unit: "m3",
        baseCost: "100",
        defaultMargin: "10",
        effectiveDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      expect(pending.status).toBe("PENDING");

      const expired = await createCatalogueItem(companyAId, {
        industryEngineId: "construction",
        itemCode: `CAT-EXPIRED-${RUN_ID}`,
        category: "Concrete",
        description: "Expired item",
        unit: "m3",
        baseCost: "100",
        defaultMargin: "10",
        effectiveDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      });
      expect(expired.status).toBe("EXPIRED");
    });

    it("rejects a duplicate item code within the same company", async () => {
      const code = `CAT-DUP-${RUN_ID}`;
      await createCatalogueItem(companyAId, {
        industryEngineId: "construction",
        itemCode: code,
        category: "Concrete",
        description: "First",
        unit: "m3",
        baseCost: "100",
        defaultMargin: "10",
        effectiveDate: new Date(),
      });
      await expect(
        createCatalogueItem(companyAId, {
          industryEngineId: "construction",
          itemCode: code,
          category: "Concrete",
          description: "Second",
          unit: "m3",
          baseCost: "100",
          defaultMargin: "10",
          effectiveDate: new Date(),
        }),
      ).rejects.toThrow();
    });

    it("records price history only when pricing fields actually change", async () => {
      const item = await createCatalogueItem(companyAId, {
        industryEngineId: "construction",
        itemCode: `CAT-HISTORY-${RUN_ID}`,
        category: "Concrete",
        description: "History test item",
        unit: "m3",
        baseCost: "300",
        defaultMargin: "10",
        effectiveDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      await updateCatalogueItem(companyAId, item.id, { description: "Renamed only, no pricing change" });
      let history = await getPriceHistory(companyAId, item.id);
      expect(history).toHaveLength(0);

      await updateCatalogueItem(companyAId, item.id, { baseCost: "350" });
      history = await getPriceHistory(companyAId, item.id);
      expect(history).toHaveLength(1);
      expect(history[0].previousBaseCost).toBe(300);
      expect(history[0].newBaseCost).toBe(350);
    });

    it("does not allow reading a catalogue item that belongs to a different company", async () => {
      const item = await createCatalogueItem(companyBId, {
        industryEngineId: "construction",
        itemCode: `CAT-CROSSTENANT-${RUN_ID}`,
        category: "Concrete",
        description: "Company B item",
        unit: "m3",
        baseCost: "100",
        defaultMargin: "10",
        effectiveDate: new Date(),
      });
      await expect(getCatalogueItemById(companyAId, item.id)).rejects.toThrow(NotFoundError);
    });
  });

  describe("apply catalogue rate to a BOQ item", () => {
    it("applies a rate, preserves quantity/notes, recalculates totals, and audits the change", async () => {
      const { boq } = await createProjectWithDefaultBoq(actor(companyAId), {
        clientId: clientAId,
        industryEngineId: "construction",
        reference: `APPLY-RATE-${RUN_ID}`,
        name: "Apply Rate Test Project",
        location: "Dubai",
        currency: "AED",
        taxRate: "5",
        language: "English",
      });

      const catalogueItem = await createCatalogueItem(companyAId, {
        industryEngineId: "construction",
        itemCode: `CAT-APPLY-${RUN_ID}`,
        category: "Concrete",
        description: "Catalogue concrete rate",
        unit: "m3",
        baseCost: "500",
        freightCost: "20",
        defaultMargin: "20",
        effectiveDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const sectionId = boq.sections[0].id;
      const created = await createBOQItem(companyAId, sectionId, {
        itemNumber: 1,
        itemCode: "MANUAL-001",
        category: "Manual",
        description: "Manually entered item",
        quantity: "42",
        unit: "m3",
        unitCost: "10",
        marginMode: MarginMode.MARKUP,
        marginPercentage: "5",
        notes: "Do not lose this note",
        sortOrder: 1,
      });
      const boqItemId = created.item.id;

      const result = await applyCatalogueRateToBOQItem(actor(companyAId), {
        catalogueItemId: catalogueItem.id,
        boqItemId,
        applyMode: "REPLACE_COMMERCIAL_FIELDS",
        confirmReplaceOverrides: false,
      });

      const updatedItem = result.sections.flatMap((s) => s.items).find((i) => i.id === boqItemId)!;
      expect(updatedItem.quantity).toBe(42); // preserved
      expect(updatedItem.notes).toBe("Do not lose this note"); // preserved
      expect(updatedItem.unitCost).toBe(500); // copied from catalogue baseCost
      expect(updatedItem.landedCost).toBe(520);
      expect(updatedItem.sellingRate).toBe(624);
      expect(updatedItem.totalAmount).toBe(624 * 42);
      expect(updatedItem.pricingMetadata?.commercialSource).toBe("catalogue");
      expect(updatedItem.pricingMetadata?.catalogueItemId).toBe(catalogueItem.id);
      const rateProvenance = await prisma.bOQItemRateProvenance.findUniqueOrThrow({ where: { boqItemId } });
      expect(rateProvenance.sourceType).toBe("RATE_CATALOGUE");
      expect(rateProvenance.rateCatalogueItemId).toBe(catalogueItem.id);
      expect(rateProvenance.unitCostSnapshot.toNumber()).toBe(500);

      const auditRows = await prisma.auditLog.findMany({
        where: { companyId: companyAId, entityId: boqItemId, action: "CATALOGUE_RATE_APPLIED" },
      });
      expect(auditRows.length).toBeGreaterThan(0);
    });

    it("warns before replacing manual overrides, then applies when confirmed", async () => {
      const { boq } = await createProjectWithDefaultBoq(actor(companyAId), {
        clientId: clientAId,
        industryEngineId: "construction",
        reference: `OVERRIDE-${RUN_ID}`,
        name: "Override Test Project",
        location: "Dubai",
        currency: "AED",
        taxRate: "5",
        language: "English",
      });
      const catalogueItem = await createCatalogueItem(companyAId, {
        industryEngineId: "construction",
        itemCode: `CAT-OVERRIDE-${RUN_ID}`,
        category: "Concrete",
        description: "Catalogue rate for override test",
        unit: "m3",
        baseCost: "500",
        defaultMargin: "20",
        effectiveDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const sectionId = boq.sections[0].id;
      const created = await createBOQItem(companyAId, sectionId, {
        itemNumber: 1,
        itemCode: "MANUAL-002",
        category: "Manual",
        description: "Item to be overridden",
        quantity: "10",
        unit: "m3",
        unitCost: "10",
        marginMode: MarginMode.MARKUP,
        marginPercentage: "5",
        sortOrder: 1,
      });
      const boqItemId = created.item.id;

      // Apply once so it has a catalogue commercial source.
      await applyCatalogueRateToBOQItem(actor(companyAId), {
        catalogueItemId: catalogueItem.id,
        boqItemId,
        applyMode: "REPLACE_COMMERCIAL_FIELDS",
        confirmReplaceOverrides: false,
      });

      // Manually change unitCost -- should be recorded as an override.
      await updateBOQItem(companyAId, boqItemId, { unitCost: "999" });
      expect((await prisma.bOQItemRateProvenance.findUniqueOrThrow({ where: { boqItemId } })).sourceType).toBe("MANUAL_CONFIRMED");

      // Reapplying without confirmation should be rejected.
      await expect(
        applyCatalogueRateToBOQItem(actor(companyAId), {
          catalogueItemId: catalogueItem.id,
          boqItemId,
          applyMode: "REPLACE_COMMERCIAL_FIELDS",
          confirmReplaceOverrides: false,
        }),
      ).rejects.toThrow(AppError);

      // Reapplying with confirmation succeeds and clears the override flag.
      const result = await applyCatalogueRateToBOQItem(actor(companyAId), {
        catalogueItemId: catalogueItem.id,
        boqItemId,
        applyMode: "REPLACE_COMMERCIAL_FIELDS",
        confirmReplaceOverrides: true,
      });
      const updatedItem = result.sections.flatMap((s) => s.items).find((i) => i.id === boqItemId)!;
      expect(updatedItem.pricingMetadata?.manuallyOverriddenFields).toEqual([]);
    });

    it("rejects applying a rate to a locked BOQ", async () => {
      const { boq } = await createProjectWithDefaultBoq(actor(companyAId), {
        clientId: clientAId,
        industryEngineId: "construction",
        reference: `LOCKED-${RUN_ID}`,
        name: "Locked Test Project",
        location: "Dubai",
        currency: "AED",
        taxRate: "5",
        language: "English",
      });
      const catalogueItem = await createCatalogueItem(companyAId, {
        industryEngineId: "construction",
        itemCode: `CAT-LOCKED-${RUN_ID}`,
        category: "Concrete",
        description: "Catalogue rate for locked test",
        unit: "m3",
        baseCost: "500",
        defaultMargin: "20",
        effectiveDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      const sectionId = boq.sections[0].id;
      const created = await createBOQItem(companyAId, sectionId, {
        itemNumber: 1,
        itemCode: "MANUAL-003",
        category: "Manual",
        description: "Item in a BOQ that will be locked",
        quantity: "1",
        unit: "m3",
        unitCost: "10",
        marginMode: MarginMode.MARKUP,
        marginPercentage: "5",
        sortOrder: 1,
      });
      const boqItemId = created.item.id;

      await runBOQVerification(companyAId, boq.id);
      await lockBOQ(companyAId, boq.id, "Test Locker");

      await expect(
        applyCatalogueRateToBOQItem(actor(companyAId), {
          catalogueItemId: catalogueItem.id,
          boqItemId,
          applyMode: "REPLACE_COMMERCIAL_FIELDS",
          confirmReplaceOverrides: false,
        }),
      ).rejects.toThrow();
    });

    it("blocks applying a catalogue item that belongs to a different company", async () => {
      const { boq } = await createProjectWithDefaultBoq(actor(companyAId), {
        clientId: clientAId,
        industryEngineId: "construction",
        reference: `CROSSAPPLY-${RUN_ID}`,
        name: "Cross Apply Test Project",
        location: "Dubai",
        currency: "AED",
        taxRate: "5",
        language: "English",
      });
      const foreignCatalogueItem = await createCatalogueItem(companyBId, {
        industryEngineId: "construction",
        itemCode: `CAT-FOREIGN-${RUN_ID}`,
        category: "Concrete",
        description: "Company B catalogue item",
        unit: "m3",
        baseCost: "500",
        defaultMargin: "20",
        effectiveDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      const sectionId = boq.sections[0].id;
      const created = await createBOQItem(companyAId, sectionId, {
        itemNumber: 1,
        itemCode: "MANUAL-004",
        category: "Manual",
        description: "Item for cross-tenant apply attempt",
        quantity: "1",
        unit: "m3",
        unitCost: "10",
        marginMode: MarginMode.MARKUP,
        marginPercentage: "5",
        sortOrder: 1,
      });
      const boqItemId = created.item.id;

      await expect(
        applyCatalogueRateToBOQItem(actor(companyAId), {
          catalogueItemId: foreignCatalogueItem.id,
          boqItemId,
          applyMode: "REPLACE_COMMERCIAL_FIELDS",
          confirmReplaceOverrides: false,
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("verification: pricing-aware rules", () => {
    it("flags an expired supplier rate, a below-minimum selling rate, and a manual override", () => {
      const asOf = new Date();
      const drafts = runVerification({
        boqId: "test-boq",
        asOf,
        items: [
          {
            id: "item-expired",
            itemCode: "X-1",
            description: "Expired rate item",
            quantity: "1",
            unit: "m3",
            unitCost: "100",
            landedCost: "100",
            sellingRate: "120",
            marginPercentage: "20",
            confidenceScore: "95",
            drawingReference: "DRW-1",
            specification: "spec",
            supplierRateExpiryDate: new Date(asOf.getTime() - 24 * 60 * 60 * 1000),
          },
          {
            id: "item-below-min",
            itemCode: "X-2",
            description: "Below minimum item",
            quantity: "1",
            unit: "m3",
            unitCost: "100",
            landedCost: "100",
            sellingRate: "110",
            minimumSellingRate: "150",
            marginPercentage: "10",
            confidenceScore: "95",
            drawingReference: "DRW-2",
            specification: "spec",
          },
          {
            id: "item-overridden",
            itemCode: "X-3",
            description: "Overridden item",
            quantity: "1",
            unit: "m3",
            unitCost: "100",
            landedCost: "100",
            sellingRate: "150",
            marginPercentage: "50",
            confidenceScore: "95",
            drawingReference: "DRW-3",
            specification: "spec",
            manualOverrideFields: ["unitCost"],
          },
        ],
      });

      expect(drafts.some((d) => d.boqItemId === "item-expired" && d.type === "EXPIRED_SUPPLIER_RATE")).toBe(true);
      expect(drafts.some((d) => d.boqItemId === "item-below-min" && d.type === "SELLING_RATE_BELOW_MINIMUM")).toBe(true);
      expect(drafts.some((d) => d.boqItemId === "item-overridden" && d.type === "MANUAL_COMMERCIAL_OVERRIDE")).toBe(true);
    });

    it("flags a selling rate below landed cost as critical", () => {
      const drafts = runVerification({
        boqId: "test-boq-2",
        asOf: new Date(),
        items: [
          {
            id: "item-underwater",
            itemCode: "Y-1",
            description: "Underpriced item",
            quantity: "1",
            unit: "m3",
            unitCost: "100",
            landedCost: "150",
            sellingRate: "120",
            marginPercentage: "0",
            confidenceScore: "95",
            drawingReference: "DRW-4",
            specification: "spec",
          },
        ],
      });
      const finding = drafts.find((d) => d.type === "SELLING_RATE_BELOW_LANDED_COST");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("CRITICAL");
    });
  });
});
