import { DocumentTemplateType, PlatformRole } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const requirePlatformActorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/platform-authorization", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/platform-authorization")>("@/lib/auth/platform-authorization");
  return { ...actual, requirePlatformActor: requirePlatformActorMock };
});

import { GET as boqListGET } from "../src/app/api/admin/templates/boq/route";
import { GET as boqDetailGET } from "../src/app/api/admin/templates/boq/[templateId]/route";
import { GET as boqVersionsGET, POST as boqVersionsPOST } from "../src/app/api/admin/templates/boq/[templateId]/versions/route";
import { PATCH as boqVersionPATCH } from "../src/app/api/admin/templates/boq/versions/[versionId]/route";
import { GET as emailListGET } from "../src/app/api/admin/templates/email/route";
import { POST as emailVersionsPOST } from "../src/app/api/admin/templates/email/[templateId]/versions/route";
import { PATCH as emailVersionPATCH } from "../src/app/api/admin/templates/email/versions/[versionId]/route";
import { GET as reportListGET } from "../src/app/api/admin/templates/technical-reports/route";

import type { PlatformActor } from "../src/lib/auth/platform-authorization";
import { prisma } from "../src/lib/db/prisma";
import { PermissionDeniedError, UnauthorizedError } from "../src/lib/errors/app-error";
import { createTemplate } from "../src/lib/repositories/document-template-repository";
import { createEmailTemplate } from "../src/lib/repositories/email-template-repository";

const RUN_ID = `${Date.now()}-${process.pid}`;

async function json(res: Response): Promise<any> {
  return res.json();
}

let ownerUserId: string;

function ownerActor(companyId: string): PlatformActor {
  return { userId: ownerUserId, companyId, platformRole: PlatformRole.PLATFORM_OWNER, fullName: "Route Owner", email: `route-owner-${RUN_ID}@example.com` };
}

describe("admin template centre routes (integration, real local Postgres)", () => {
  let companyAId: string;
  let companyBId: string;
  let boqTemplateAId: string;
  let boqTemplateBId: string;
  let emailTemplateAId: string;

  beforeAll(async () => {
    const companyA = await prisma.company.create({
      data: { legalName: `Admin Routes Co A ${RUN_ID}`, tradeName: "Admin Routes A", email: `admin-routes-a-${RUN_ID}@example.com` },
    });
    companyAId = companyA.id;
    const companyB = await prisma.company.create({
      data: { legalName: `Admin Routes Co B ${RUN_ID}`, tradeName: "Admin Routes B", email: `admin-routes-b-${RUN_ID}@example.com` },
    });
    companyBId = companyB.id;
    const owner_ = await prisma.user.create({
      data: { companyId: companyAId, email: `route-owner-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Route Owner", role: "COMPANY_OWNER", platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerUserId = owner_.id;

    const boqA = await createTemplate(companyAId, { name: "Route BOQ A", code: `route-boq-a-${RUN_ID}`, type: DocumentTemplateType.CORPORATE_TECHNICAL });
    boqTemplateAId = boqA.id;
    const boqB = await createTemplate(companyBId, { name: "Route BOQ B", code: `route-boq-b-${RUN_ID}`, type: DocumentTemplateType.CORPORATE_TECHNICAL });
    boqTemplateBId = boqB.id;

    const emailA = await createEmailTemplate(companyAId, {
      name: "Route Email A",
      code: `route-email-a-${RUN_ID}`,
      subject: "Subject",
      bodyHtml: "<p>Body</p>",
      bodyText: "Body",
    });
    emailTemplateAId = emailA.id;
  });

  beforeEach(() => {
    requirePlatformActorMock.mockReset();
  });

  afterAll(async () => {
    await prisma.emailTemplateVersion.deleteMany({ where: { emailTemplateId: emailTemplateAId } });
    await prisma.emailTemplate.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.documentTemplateVersion.deleteMany({ where: { documentTemplateId: { in: [boqTemplateAId, boqTemplateBId] } } });
    await prisma.documentTemplate.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.auditLog.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.platformAuditLog.deleteMany({ where: { actorUserId: ownerUserId } });
    await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    await prisma.$disconnect();
  });

  describe("access control", () => {
    it("returns 401 when unauthenticated", async () => {
      requirePlatformActorMock.mockRejectedValueOnce(new UnauthorizedError());
      const res = await boqListGET();
      expect(res.status).toBe(401);
      expect((await json(res)).ok).toBe(false);
    });

    it("returns 403 for a non-owner platform actor", async () => {
      requirePlatformActorMock.mockRejectedValueOnce(new PermissionDeniedError());
      const res = await boqListGET();
      expect(res.status).toBe(403);
    });
  });

  describe("BOQ template routes", () => {
    it("lists templates across every company (owner cross-tenant surface)", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor(companyAId));
      const res = await boqListGET();
      expect(res.status).toBe(200);
      const body = await json(res);
      const ids = (body.data as Array<{ id: string }>).map((t) => t.id);
      expect(ids).toContain(boqTemplateAId);
      expect(ids).toContain(boqTemplateBId);
    });

    it("returns the full version history for a single template", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor(companyAId));
      const res = await boqDetailGET(new Request(`http://localhost/api/admin/templates/boq/${boqTemplateAId}`), {
        params: Promise.resolve({ templateId: boqTemplateAId }),
      });
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data.versions).toHaveLength(1);
      expect(body.data.versions[0].status).toBe("PUBLISHED");
    });

    it("rejects a malformed template id with a validation error", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor(companyAId));
      const res = await boqDetailGET(new Request("http://localhost/api/admin/templates/boq/not-a-uuid"), {
        params: Promise.resolve({ templateId: "not-a-uuid" }),
      });
      expect(res.status).toBe(400);
    });

    it("creates a draft version, then moves it through review/approve/publish, retiring the prior published version", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor(companyAId));
      const createRes = await boqVersionsPOST(
        new Request(`http://localhost/api/admin/templates/boq/${boqTemplateAId}/versions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ styleConfigJson: { primaryColor: "#222222" }, contentConfigJson: {}, changeSummary: "Route test" }),
        }),
        { params: Promise.resolve({ templateId: boqTemplateAId }) },
      );
      expect(createRes.status).toBe(201);
      const created = (await json(createRes)).data as { id: string; status: string; versionNumber: number };
      expect(created.status).toBe("DRAFT");
      expect(created.versionNumber).toBe(2);

      requirePlatformActorMock.mockResolvedValueOnce(ownerActor(companyAId));
      const reviewRes = await boqVersionPATCH(
        new Request(`http://localhost/api/admin/templates/boq/versions/${created.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "REVIEW" }),
        }),
        { params: Promise.resolve({ versionId: created.id }) },
      );
      expect(reviewRes.status).toBe(200);

      requirePlatformActorMock.mockResolvedValueOnce(ownerActor(companyAId));
      await boqVersionPATCH(
        new Request(`http://localhost/api/admin/templates/boq/versions/${created.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "APPROVED" }),
        }),
        { params: Promise.resolve({ versionId: created.id }) },
      );

      requirePlatformActorMock.mockResolvedValueOnce(ownerActor(companyAId));
      const publishRes = await boqVersionPATCH(
        new Request(`http://localhost/api/admin/templates/boq/versions/${created.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "PUBLISHED" }),
        }),
        { params: Promise.resolve({ versionId: created.id }) },
      );
      expect(publishRes.status).toBe(200);
      expect((await json(publishRes)).data.status).toBe("PUBLISHED");

      requirePlatformActorMock.mockResolvedValueOnce(ownerActor(companyAId));
      const list = await boqVersionsGET(new Request(`http://localhost/api/admin/templates/boq/${boqTemplateAId}/versions`), {
        params: Promise.resolve({ templateId: boqTemplateAId }),
      });
      const versions = (await json(list)).data as Array<{ versionNumber: number; status: string }>;
      expect(versions.filter((v) => v.status === "PUBLISHED")).toHaveLength(1);
      expect(versions.find((v) => v.versionNumber === 1)!.status).toBe("RETIRED");
    });

    it("returns 409 for an invalid version transition", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor(companyAId));
      const createRes = await boqVersionsPOST(
        new Request(`http://localhost/api/admin/templates/boq/${boqTemplateAId}/versions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ styleConfigJson: {}, contentConfigJson: {} }),
        }),
        { params: Promise.resolve({ templateId: boqTemplateAId }) },
      );
      const created = (await json(createRes)).data as { id: string };

      requirePlatformActorMock.mockResolvedValueOnce(ownerActor(companyAId));
      const res = await boqVersionPATCH(
        new Request(`http://localhost/api/admin/templates/boq/versions/${created.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "PUBLISHED" }),
        }),
        { params: Promise.resolve({ versionId: created.id }) },
      );
      expect(res.status).toBe(409);
      expect((await json(res)).error.code).toBe("INVALID_VERSION_TRANSITION");
    });
  });

  describe("technical report template routes", () => {
    it("lists report templates cross-tenant (empty is fine — no fixture seeded here)", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor(companyAId));
      const res = await reportListGET();
      expect(res.status).toBe(200);
      expect(Array.isArray((await json(res)).data)).toBe(true);
    });
  });

  describe("email template routes", () => {
    it("lists email templates cross-tenant and supports the draft->publish version flow", async () => {
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor(companyAId));
      const listRes = await emailListGET();
      const ids = ((await json(listRes)).data as Array<{ id: string }>).map((t) => t.id);
      expect(ids).toContain(emailTemplateAId);

      requirePlatformActorMock.mockResolvedValueOnce(ownerActor(companyAId));
      const createRes = await emailVersionsPOST(
        new Request(`http://localhost/api/admin/templates/email/${emailTemplateAId}/versions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ subject: "New subject", bodyHtml: "<p>New</p>", bodyText: "New" }),
        }),
        { params: Promise.resolve({ templateId: emailTemplateAId }) },
      );
      expect(createRes.status).toBe(201);
      const created = (await json(createRes)).data as { id: string };

      requirePlatformActorMock.mockResolvedValueOnce(ownerActor(companyAId));
      await emailVersionPATCH(
        new Request(`http://localhost/api/admin/templates/email/versions/${created.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "REVIEW" }),
        }),
        { params: Promise.resolve({ versionId: created.id }) },
      );
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor(companyAId));
      await emailVersionPATCH(
        new Request(`http://localhost/api/admin/templates/email/versions/${created.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "APPROVED" }),
        }),
        { params: Promise.resolve({ versionId: created.id }) },
      );
      requirePlatformActorMock.mockResolvedValueOnce(ownerActor(companyAId));
      const publishRes = await emailVersionPATCH(
        new Request(`http://localhost/api/admin/templates/email/versions/${created.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "PUBLISHED" }),
        }),
        { params: Promise.resolve({ versionId: created.id }) },
      );
      expect(publishRes.status).toBe(200);
      expect((await json(publishRes)).data.subject).toBe("New subject");
    });
  });
});
