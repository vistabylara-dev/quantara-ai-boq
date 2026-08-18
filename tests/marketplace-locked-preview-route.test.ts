import { IndustryPackageType, MasterHierarchyNodeType, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const currentActorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/current-actor", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/auth/current-actor")>("../src/lib/auth/current-actor");
  return { ...actual, getCurrentActor: currentActorMock };
});

import { GET as previewGET } from "../src/app/api/data-packages/[packageId]/preview/route";
import { GET as itemsGET } from "../src/app/api/data-packages/[packageId]/items/route";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { prisma } from "../src/lib/db/prisma";
import { UnauthorizedError } from "../src/lib/errors/app-error";
import { addItemsToPackage, createPackage } from "../src/lib/repositories/industry-package-repository";

const RUN_ID = `${Date.now()}-${process.pid}`;

let companyId = "";
let userId = "";
let disciplineId = "";
let categoryId = "";
let hierarchyNodeId = "";
let packageId = "";
let masterItemId = "";

function actor(): CurrentActor {
  return { userId, companyId, role: UserRole.COMPANY_OWNER, fullName: "Preview Route Owner", email: `preview-route-${RUN_ID}@example.com` };
}

async function json(res: Response): Promise<any> {
  return res.json();
}

describe("GET /api/data-packages/[packageId]/preview (locked package preview)", () => {
  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { legalName: `Preview Route Co ${RUN_ID}`, tradeName: "Preview Route Co", email: `preview-route-co-${RUN_ID}@example.com` },
    });
    companyId = company.id;
    const owner = await prisma.user.create({
      data: { companyId, email: `preview-route-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Preview Route Owner", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    userId = owner.id;

    const discipline = await prisma.masterDiscipline.create({
      data: { key: `preview-route-${RUN_ID}`, name: `Preview Route Discipline ${RUN_ID}`, sortOrder: 999 },
    });
    disciplineId = discipline.id;
    const category = await prisma.masterCategory.create({
      data: { disciplineId, key: `preview-route-cat-${RUN_ID}`, name: "Preview Route Category", path: `preview-route-cat-${RUN_ID}`, depth: 0 },
    });
    categoryId = category.id;
    const node = await prisma.masterHierarchyNode.create({
      data: { code: `preview-route-node-${RUN_ID}`, name: "Preview Route Node", nodeType: MasterHierarchyNodeType.CATEGORY, parentId: null, sortOrder: 0 },
    });
    hierarchyNodeId = node.id;

    const item = await prisma.masterItem.create({
      data: {
        disciplineId, categoryId, hierarchyNodeId,
        itemCode: `PRV-${RUN_ID}`,
        name: "Preview Route Sensitive Item",
        shortDescription: "Short, safe-to-preview description",
        fullDescription: "SENSITIVE full technical description that must never leak to a locked company",
        technicalFieldsJson: { secretSpec: "SENSITIVE-VALUE" },
        defaultSpecificationJson: { secretSpecTemplate: "SENSITIVE-TEMPLATE" },
        defaultUnit: "no",
        isPremium: true,
      },
    });
    masterItemId = item.id;

    const pkg = await createPackage({
      key: `preview-route-pkg-${RUN_ID}`,
      name: "Preview Route Package",
      disciplineId,
      packageType: IndustryPackageType.CORE,
    });
    packageId = pkg.id;
    await addItemsToPackage(packageId, [masterItemId]);
  });

  afterAll(async () => {
    await prisma.companyPackageSubscription.deleteMany({ where: { companyId, packageId } });
    await prisma.industryDataPackageItem.deleteMany({ where: { packageId } });
    await prisma.industryDataPackage.delete({ where: { id: packageId } }).catch(() => undefined);
    await prisma.masterItem.delete({ where: { id: masterItemId } }).catch(() => undefined);
    await prisma.masterCategory.delete({ where: { id: categoryId } }).catch(() => undefined);
    await prisma.masterHierarchyNode.delete({ where: { id: hierarchyNodeId } }).catch(() => undefined);
    await prisma.masterDiscipline.delete({ where: { id: disciplineId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("returns 401 for an anonymous request", async () => {
    currentActorMock.mockRejectedValueOnce(new UnauthorizedError());
    const res = await previewGET(new Request(`http://localhost/api/data-packages/${packageId}/preview`), {
      params: Promise.resolve({ packageId }),
    });
    expect(res.status).toBe(401);
  });

  it("returns a safe not-found for a nonexistent package id", async () => {
    currentActorMock.mockResolvedValueOnce(actor());
    const res = await previewGET(new Request("http://localhost/api/data-packages/00000000-0000-4000-8000-000000000000/preview"), {
      params: Promise.resolve({ packageId: "00000000-0000-4000-8000-000000000000" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 200 with truncated preview fields only for a company with NO package access — sensitive fields are actually absent", async () => {
    // No CompanyPackageSubscription created for this company — genuinely unentitled.
    currentActorMock.mockResolvedValueOnce(actor());
    const res = await previewGET(new Request(`http://localhost/api/data-packages/${packageId}/preview`), {
      params: Promise.resolve({ packageId }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.total).toBe(1);
    const item = body.data.items.find((row: { id: string }) => row.id === masterItemId);
    expect(item).toBeDefined();

    // What a locked preview MUST show.
    expect(item.name).toBe("Preview Route Sensitive Item");
    expect(item.shortDescription).toBe("Short, safe-to-preview description");
    expect(item.locked).toBe(true);
    expect(item.packageNames).toContain("Preview Route Package");

    // What it must NEVER show — asserting absence, not just a falsy value,
    // since toMasterItemPreviewDTO simply omits these keys entirely.
    expect(item.fullDescription).toBeUndefined();
    expect("fullDescription" in item).toBe(false);
    expect(item.technicalFieldsJson).toBeUndefined();
    expect("technicalFieldsJson" in item).toBe(false);
    expect(item.defaultSpecificationJson).toBeUndefined();
    expect("defaultSpecificationJson" in item).toBe(false);
    expect(JSON.stringify(body.data)).not.toContain("SENSITIVE");
  });

  it("supports pagination/search params the same way the full-access /items route does", async () => {
    currentActorMock.mockResolvedValueOnce(actor());
    const res = await previewGET(new Request(`http://localhost/api/data-packages/${packageId}/preview?page=1&pageSize=50&search=Sensitive`), {
      params: Promise.resolve({ packageId }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.total).toBe(1);

    currentActorMock.mockResolvedValueOnce(actor());
    const noMatch = await previewGET(new Request(`http://localhost/api/data-packages/${packageId}/preview?search=NoSuchItemAtAll`), {
      params: Promise.resolve({ packageId }),
    });
    const noMatchBody = await json(noMatch);
    expect(noMatchBody.data.total).toBe(0);
  });

  it("a company WITH package access is unaffected — the existing /items route still returns full, untruncated data (no regression)", async () => {
    const sub = await prisma.companyPackageSubscription.create({
      data: { companyId, packageId, status: "ACTIVE", startsAt: new Date(), source: "development" },
    });
    try {
      currentActorMock.mockResolvedValueOnce(actor());
      const res = await itemsGET(new Request(`http://localhost/api/data-packages/${packageId}/items`), {
        params: Promise.resolve({ packageId }),
      });
      expect(res.status).toBe(200);
      const body = await json(res);
      const item = body.data.items.find((row: { id: string }) => row.id === masterItemId);
      expect(item).toBeDefined();
      expect(item.name).toBe("Preview Route Sensitive Item");
      // The full-access route's own established shape — untouched by this fix.
      expect(item.locked).toBeUndefined();
      expect(item.packageNames).toBeUndefined();
    } finally {
      await prisma.companyPackageSubscription.delete({ where: { id: sub.id } });
    }
  });

  it("the /items route still refuses a company with no access (unchanged, pre-existing behavior)", async () => {
    currentActorMock.mockResolvedValueOnce(actor());
    const res = await itemsGET(new Request(`http://localhost/api/data-packages/${packageId}/items`), {
      params: Promise.resolve({ packageId }),
    });
    // Pre-existing behavior: listAccessibleMasterItemsPaginated throws PermissionDeniedError (403).
    expect(res.status).toBe(403);
  });
});
