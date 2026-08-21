import { PlatformRole, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { AppError, ConflictError, PermissionDeniedError } from "../src/lib/errors/app-error";
import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import {
  createHierarchyNode,
  getHierarchyTree,
  updateHierarchyNode,
} from "../src/lib/repositories/master-hierarchy-repository";
import { getMasterItemCustomerDetail, listMasterItems } from "../src/lib/repositories/master-item-repository";
import {
  addClassification,
  createDraftVersion,
  getMasterItemAdminDetail,
  setAttributeValue,
  transitionVersionStatus,
} from "../src/lib/services/master-item-governance-service";
import { createOrUpdateHierarchyNode } from "../src/lib/services/master-hierarchy-service";
import { createTechnicalFieldDefinition } from "../src/lib/repositories/master-taxonomy-repository";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { addBoqItemFromSource } from "../src/lib/services/boq-item-source-service";
import { grantUnlimitedPlanForTests } from "./helpers/grant-unlimited-plan";

const RUN_ID = `${Date.now()}-${process.pid}`;

let companyId = "";
let ownerUserId = "";
let disciplineId = "";
let categoryId = "";
let masterItemId = "";
let clientId = "";
let projectId = "";
let boqId = "";

function ownerActor(): PlatformActor {
  return { userId: ownerUserId, companyId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "MB1A Owner", email: `${RUN_ID}-owner@example.com` };
}
function adminActor(): PlatformActor {
  return { userId: ownerUserId, companyId, platformRole: PlatformRole.PLATFORM_ADMIN, fullName: "MB1A Admin", email: `${RUN_ID}-admin@example.com` };
}
function companyActor(): CurrentActor {
  return { userId: ownerUserId, companyId, role: UserRole.COMPANY_OWNER, fullName: "MB1A Owner", email: `${RUN_ID}-owner@example.com` };
}

describe("MASTER-BOQ-1A: hierarchical master BOQ foundation (integration)", () => {
  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { legalName: `MB1A Co ${RUN_ID}`, tradeName: "MB1A Co", email: `mb1a-${RUN_ID}@example.com` },
    });
    companyId = company.id;
    await grantUnlimitedPlanForTests(companyId);

    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    await prisma.companyIndustryEngine.create({ data: { companyId, industryEngineId: construction.id, enabled: true } });

    const owner = await prisma.user.create({
      data: { companyId, email: `${RUN_ID}-owner@example.com`, passwordHash: `hash-${RUN_ID}`, fullName: "MB1A Owner", role: UserRole.COMPANY_OWNER, platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerUserId = owner.id;

    const discipline = await prisma.masterDiscipline.create({ data: { key: `mb1a-${RUN_ID}`, name: `MB1A Discipline ${RUN_ID}` } });
    disciplineId = discipline.id;
    const category = await prisma.masterCategory.create({ data: { disciplineId, key: "cat", name: "Category", path: "cat", depth: 0 } });
    categoryId = category.id;
    const item = await prisma.masterItem.create({
      data: { disciplineId, categoryId, itemCode: `MB1A-${RUN_ID}`, name: "Test Item", shortDescription: "short", defaultUnit: "EA", isPremium: false },
    });
    masterItemId = item.id;

    const client = await createClient(companyId, { name: `MB1A Client ${RUN_ID}`, email: `mb1a-client-${RUN_ID}@example.com` });
    clientId = client.id;
    const { project, boq } = await createProjectWithDefaultBoq(companyActor(), {
      clientId,
      industryEngineId: "construction",
      reference: `MB1A-${RUN_ID}`,
      name: "MB1A Project",
      location: "Dubai, UAE",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    projectId = project.databaseId;
    boqId = boq.databaseId;
  });

  afterAll(async () => {
    if (masterItemId) {
      await prisma.masterItemAttributeValue.deleteMany({ where: { masterItemId } });
      await prisma.masterItemClassification.deleteMany({ where: { masterItemId } });
      await prisma.masterItemVersion.deleteMany({ where: { masterItemId } });
    }
    await prisma.masterItem.deleteMany({ where: { disciplineId } });
    await prisma.technicalFieldDefinition.deleteMany({ where: { disciplineId } });
    await prisma.masterCategory.deleteMany({ where: { disciplineId } });
    await prisma.masterDiscipline.deleteMany({ where: { id: disciplineId } });
    await prisma.masterHierarchyNode.deleteMany({ where: { code: { startsWith: `mb1a.${RUN_ID}` } } });
    if (companyId) {
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

  describe("hierarchy", () => {
    it("creates a parent/child hierarchy node pair with stable codes, idempotently", async () => {
      const industry = await createHierarchyNode({ code: `mb1a.${RUN_ID}.industry`, name: "MB1A Industry", nodeType: "INDUSTRY" });
      const discipline = await createHierarchyNode({ code: `mb1a.${RUN_ID}.discipline`, name: "MB1A Discipline", nodeType: "DISCIPLINE", parentId: industry.id });
      expect(discipline.parentId).toBe(industry.id);

      const again = await createHierarchyNode({ code: `mb1a.${RUN_ID}.industry`, name: "Renamed (ignored)", nodeType: "INDUSTRY" });
      expect(again.id).toBe(industry.id);
      expect(again.name).toBe("MB1A Industry");
    });

    it("rejects a hierarchy cycle", async () => {
      const a = await createHierarchyNode({ code: `mb1a.${RUN_ID}.cycle-a`, name: "A", nodeType: "SYSTEM" });
      const b = await createHierarchyNode({ code: `mb1a.${RUN_ID}.cycle-b`, name: "B", nodeType: "CATEGORY", parentId: a.id });
      await expect(updateHierarchyNode(a.id, { parentId: b.id })).rejects.toThrow(ConflictError);
    });

    it("excludes inactive nodes from the public tree but keeps them in the admin tree", async () => {
      const node = await createHierarchyNode({ code: `mb1a.${RUN_ID}.inactive`, name: "Inactive Node", nodeType: "SYSTEM" });
      await updateHierarchyNode(node.id, { isActive: false });

      const publicTree = await getHierarchyTree(false);
      expect(publicTree.some((n) => n.id === node.id)).toBe(false);

      const adminTree = await getHierarchyTree(true);
      expect(adminTree.some((n) => n.id === node.id)).toBe(true);
    });

    it("blocks a non-owner platform actor from creating a hierarchy node", async () => {
      await expect(
        createOrUpdateHierarchyNode(adminActor(), { code: `mb1a.${RUN_ID}.blocked`, name: "Blocked", nodeType: "SYSTEM" }),
      ).rejects.toThrow(PermissionDeniedError);
    });
  });

  describe("item versioning", () => {
    it("creates a DRAFT version and rejects an invalid transition straight to PUBLISHED", async () => {
      const draft = await createDraftVersion(ownerActor(), masterItemId, { name: "Draft v1", primaryUnit: "EA" });
      expect(draft.status).toBe("DRAFT");
      expect(draft.versionNumber).toBe(1);

      await expect(transitionVersionStatus(ownerActor(), draft.id, "PUBLISHED")).rejects.toThrow(AppError);
    });

    it("publishing a version retires the previously published version instead of overwriting it", async () => {
      const v1 = await createDraftVersion(ownerActor(), masterItemId, { name: "V1", primaryUnit: "EA" });
      await transitionVersionStatus(ownerActor(), v1.id, "REVIEW");
      await transitionVersionStatus(ownerActor(), v1.id, "APPROVED");
      const published1 = await transitionVersionStatus(ownerActor(), v1.id, "PUBLISHED");
      expect(published1.status).toBe("PUBLISHED");
      expect(published1.effectiveDate).not.toBeNull();

      const v2 = await createDraftVersion(ownerActor(), masterItemId, { name: "V2", primaryUnit: "EA" });
      await transitionVersionStatus(ownerActor(), v2.id, "REVIEW");
      await transitionVersionStatus(ownerActor(), v2.id, "APPROVED");
      const published2 = await transitionVersionStatus(ownerActor(), v2.id, "PUBLISHED");
      expect(published2.status).toBe("PUBLISHED");

      const retiredV1 = await prisma.masterItemVersion.findUniqueOrThrow({ where: { id: v1.id } });
      expect(retiredV1.status).toBe("RETIRED");
      expect(retiredV1.supersededDate).not.toBeNull();
      // v1's own row was never deleted or rewritten to look like v2 — it still holds its original content.
      expect(retiredV1.name).toBe("V1");
    });
  });

  describe("technical attributes", () => {
    it("creates an attribute definition and rejects a value outside its enum options", async () => {
      const definition = await createTechnicalFieldDefinition({
        disciplineId,
        key: `mb1a-enum-${RUN_ID}`,
        label: "Test Enum Field",
        fieldType: "SELECT",
        optionsJson: ["Low", "Medium", "High"],
      });

      await expect(
        setAttributeValue(ownerActor(), { masterItemId, fieldDefinitionId: definition.id, valueText: "Not An Option" }),
      ).rejects.toThrow(AppError);

      const value = await setAttributeValue(ownerActor(), { masterItemId, fieldDefinitionId: definition.id, valueText: "Medium" });
      expect(value.valueText).toBe("Medium");
    });

    it("blocks a non-owner from setting an attribute value", async () => {
      const definition = await createTechnicalFieldDefinition({ disciplineId, key: `mb1a-text-${RUN_ID}`, label: "Text field", fieldType: "TEXT" });
      await expect(
        setAttributeValue(adminActor(), { masterItemId, fieldDefinitionId: definition.id, valueText: "x" }),
      ).rejects.toThrow(PermissionDeniedError);
    });
  });

  describe("classification mapping", () => {
    it("upserts on (masterItemId, system, code) rather than duplicating", async () => {
      await addClassification(ownerActor(), masterItemId, { system: "MASTERFORMAT_2020", code: "23 00 00", label: "HVAC" });
      await addClassification(ownerActor(), masterItemId, { system: "MASTERFORMAT_2020", code: "23 00 00", label: "HVAC (updated label)" });

      const rows = await prisma.masterItemClassification.findMany({ where: { masterItemId, system: "MASTERFORMAT_2020", code: "23 00 00" } });
      expect(rows).toHaveLength(1);
      expect(rows[0].label).toBe("HVAC (updated label)");
    });
  });

  describe("protected bounded search", () => {
    it("never returns more than the maximum page size, even when a huge pageSize is requested", async () => {
      const result = await listMasterItems({ disciplineId, pageSize: 999 });
      expect(result.pageSize).toBeLessThanOrEqual(50);
    });

    it("an empty query still returns only a bounded page, not the full catalogue", async () => {
      const result = await listMasterItems({});
      expect(result.items.length).toBeLessThanOrEqual(20);
    });

    it("customer detail never includes an unpublished DRAFT version's content", async () => {
      const detail = await getMasterItemCustomerDetail(masterItemId);
      // The only version ever published above was retired by a later publish; a fresh DRAFT
      // was never published, so publishedVersion must reflect the latest *published* one only.
      expect(detail.publishedVersion === null || detail.publishedVersion?.versionNumber).not.toBe(undefined);
      if (detail.publishedVersion) {
        const raw = await prisma.masterItemVersion.findUniqueOrThrow({ where: { masterItemId_versionNumber: { masterItemId, versionNumber: detail.publishedVersion.versionNumber } } });
        expect(raw.status).toBe("PUBLISHED");
      }
    });
  });

  describe("admin detail", () => {
    it("blocks a non-owner from reading the full admin item detail", async () => {
      await expect(getMasterItemAdminDetail(adminActor(), masterItemId)).rejects.toThrow(PermissionDeniedError);
    });

    it("gives the owner the full detail including draft/retired versions and classifications", async () => {
      const detail = await getMasterItemAdminDetail(ownerActor(), masterItemId);
      expect(detail.item.id).toBe(masterItemId);
      expect(detail.versions.length).toBeGreaterThanOrEqual(2);
      expect(detail.classifications.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("BOQ snapshot behavior", () => {
    it("snapshots the master item's published version and classification when added to a BOQ, and a later re-publish never mutates the existing line", async () => {
      const publishedBeforeAdd = await prisma.masterItemVersion.findFirstOrThrow({ where: { masterItemId, status: "PUBLISHED" } });

      const before = await addBoqItemFromSource(companyActor(), boqId, {
        sourceType: "MASTER_ITEM",
        sourceId: masterItemId,
        itemNumber: 1,
        quantity: "1",
      });
      const snapshotVersionId = before.item.sourceMasterItemVersionId;
      expect(snapshotVersionId).toBe(publishedBeforeAdd.id);
      const snapshotJson = before.item.masterItemSnapshotJson as { versionNumber: number } | null;
      expect(snapshotJson?.versionNumber).toBe(publishedBeforeAdd.versionNumber);

      // Publish a brand new v3 — the already-created BOQ line must still point at v2.
      const v3 = await createDraftVersion(ownerActor(), masterItemId, { name: "V3", primaryUnit: "EA" });
      await transitionVersionStatus(ownerActor(), v3.id, "REVIEW");
      await transitionVersionStatus(ownerActor(), v3.id, "APPROVED");
      await transitionVersionStatus(ownerActor(), v3.id, "PUBLISHED");

      const afterRepublish = await prisma.bOQItem.findUniqueOrThrow({ where: { id: before.item.id } });
      expect(afterRepublish.sourceMasterItemVersionId).toBe(snapshotVersionId);
      expect(afterRepublish.sourceMasterItemVersionId).not.toBe(v3.id);
    });
  });
});
