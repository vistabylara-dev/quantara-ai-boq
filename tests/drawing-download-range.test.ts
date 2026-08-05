import { UserRole } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const currentActorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActor: currentActorMock,
}));

import { GET as downloadGET } from "../src/app/api/files/[fileId]/download/route";
import { POST as authorizePOST } from "../src/app/api/projects/[projectId]/drawings/upload-authorization/route";
import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { uploadProjectFile } from "../src/lib/services/project-file-service";
import { UnauthorizedError } from "../src/lib/errors/app-error";
import type { CurrentActor } from "../src/lib/auth/current-actor";

const RUN_ID = `${Date.now()}-${process.pid}`;

function pdfBuffer(content: string): Buffer {
  return Buffer.from(`%PDF-1.4\n${content}\n%%EOF`);
}

describe("file download route — streaming + Range support (integration, real local Postgres)", () => {
  let companyAId: string;
  let companyBId: string;
  let projectAId: string;
  let ownerActorA: CurrentActor;
  let ownerActorB: CurrentActor;
  let fileId: string;
  let fileBody: Buffer;

  beforeAll(async () => {
    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });

    const companyA = await prisma.company.create({ data: { legalName: `Range Test Co A ${RUN_ID}`, tradeName: "Range A", email: `range-a-${RUN_ID}@example.com` } });
    companyAId = companyA.id;
    await prisma.companyIndustryEngine.create({ data: { companyId: companyAId, industryEngineId: construction.id, enabled: true } });
    const clientA = await createClient(companyAId, { name: "Range Client A", email: `range-client-a-${RUN_ID}@example.com` });
    const ownerUserA = await prisma.user.create({
      data: { companyId: companyAId, email: `range-owner-a-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Owner A", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerActorA = { userId: ownerUserA.id, companyId: companyAId, role: UserRole.COMPANY_OWNER, fullName: "Owner A", email: ownerUserA.email };

    const { project } = await createProjectWithDefaultBoq(ownerActorA, {
      clientId: clientA.id,
      industryEngineId: "construction",
      reference: `RANGE-A-${RUN_ID}`,
      name: "Range Test Project",
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    projectAId = project.databaseId;

    const companyB = await prisma.company.create({ data: { legalName: `Range Test Co B ${RUN_ID}`, tradeName: "Range B", email: `range-b-${RUN_ID}@example.com` } });
    companyBId = companyB.id;
    const ownerUserB = await prisma.user.create({
      data: { companyId: companyBId, email: `range-owner-b-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Owner B", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerActorB = { userId: ownerUserB.id, companyId: companyBId, role: UserRole.COMPANY_OWNER, fullName: "Owner B", email: ownerUserB.email };

    fileBody = pdfBuffer("0123456789".repeat(50)); // 550+ bytes, enough for meaningful range slicing
    const uploaded = await uploadProjectFile(ownerActorA, projectAId, { originalName: "range-test.pdf", mimeType: "application/pdf", buffer: fileBody });
    fileId = uploaded.file.id;
  });

  beforeEach(() => {
    currentActorMock.mockReset();
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.projectFile.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQItem.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQSection.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQ.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.project.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.client.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.companyIndustryEngine.deleteMany({ where: { companyId: companyAId } });
    await prisma.user.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    await prisma.$disconnect();
  });

  async function readBody(res: Response): Promise<Buffer> {
    return Buffer.from(await res.arrayBuffer());
  }

  it("returns 401 when unauthenticated", async () => {
    currentActorMock.mockRejectedValueOnce(new UnauthorizedError());
    const res = await downloadGET(new Request(`http://localhost/api/files/${fileId}/download`), { params: Promise.resolve({ fileId }) });
    expect(res.status).toBe(401);
  });

  it("returns the full file with 200 and Accept-Ranges: bytes when no Range header is sent", async () => {
    currentActorMock.mockResolvedValueOnce(ownerActorA);
    const res = await downloadGET(new Request(`http://localhost/api/files/${fileId}/download`), { params: Promise.resolve({ fileId }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("content-length")).toBe(String(fileBody.byteLength));
    expect((await readBody(res)).toString()).toBe(fileBody.toString());
  });

  it("returns 206 with the correct Content-Range for a valid Range request", async () => {
    currentActorMock.mockResolvedValueOnce(ownerActorA);
    const res = await downloadGET(
      new Request(`http://localhost/api/files/${fileId}/download`, { headers: { Range: "bytes=0-9" } }),
      { params: Promise.resolve({ fileId }) },
    );
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(`bytes 0-9/${fileBody.byteLength}`);
    expect(res.headers.get("content-length")).toBe("10");
    const body = await readBody(res);
    expect(body.toString()).toBe(fileBody.subarray(0, 10).toString());
  });

  it("serves a mid-file range correctly", async () => {
    currentActorMock.mockResolvedValueOnce(ownerActorA);
    const res = await downloadGET(
      new Request(`http://localhost/api/files/${fileId}/download`, { headers: { Range: "bytes=20-39" } }),
      { params: Promise.resolve({ fileId }) },
    );
    expect(res.status).toBe(206);
    const body = await readBody(res);
    expect(body.toString()).toBe(fileBody.subarray(20, 40).toString());
  });

  it("clamps an open-ended range to the actual end of the file", async () => {
    currentActorMock.mockResolvedValueOnce(ownerActorA);
    const start = fileBody.byteLength - 10;
    const res = await downloadGET(
      new Request(`http://localhost/api/files/${fileId}/download`, { headers: { Range: `bytes=${start}-` } }),
      { params: Promise.resolve({ fileId }) },
    );
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(`bytes ${start}-${fileBody.byteLength - 1}/${fileBody.byteLength}`);
  });

  it("returns 416 for a range starting beyond the end of the file", async () => {
    currentActorMock.mockResolvedValueOnce(ownerActorA);
    const res = await downloadGET(
      new Request(`http://localhost/api/files/${fileId}/download`, { headers: { Range: `bytes=${fileBody.byteLength + 100}-${fileBody.byteLength + 200}` } }),
      { params: Promise.resolve({ fileId }) },
    );
    expect(res.status).toBe(416);
  });

  it("denies a cross-tenant download with a safe not-found, never a raw storage error", async () => {
    currentActorMock.mockResolvedValueOnce(ownerActorB);
    const res = await downloadGET(new Request(`http://localhost/api/files/${fileId}/download`), { params: Promise.resolve({ fileId }) });
    expect(res.status).toBe(404);
  });

  it("sets inline disposition only when explicitly requested", async () => {
    currentActorMock.mockResolvedValueOnce(ownerActorA);
    const res = await downloadGET(new Request(`http://localhost/api/files/${fileId}/download?disposition=inline`), { params: Promise.resolve({ fileId }) });
    expect(res.headers.get("content-disposition")).toMatch(/^inline;/);
  });
});

describe("drawing upload-authorization route RBAC (integration, real local Postgres)", () => {
  it("returns 401 when unauthenticated", async () => {
    currentActorMock.mockReset();
    currentActorMock.mockRejectedValueOnce(new UnauthorizedError());
    const res = await authorizePOST(
      new Request("http://localhost/api/projects/some-project/drawings/upload-authorization", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ originalName: "x.pdf", declaredMimeType: "application/pdf", declaredByteSize: 100 }),
      }),
      { params: Promise.resolve({ projectId: "some-project" }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for a malformed authorization request body", async () => {
    currentActorMock.mockReset();
    currentActorMock.mockResolvedValueOnce({ userId: "x", companyId: "y", role: "COMPANY_OWNER", fullName: "X", email: "x@example.com" });
    const res = await authorizePOST(
      new Request("http://localhost/api/projects/some-project/drawings/upload-authorization", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ originalName: "" }),
      }),
      { params: Promise.resolve({ projectId: "some-project" }) },
    );
    expect(res.status).toBe(400);
  });
});
