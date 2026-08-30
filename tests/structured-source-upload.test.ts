import { readFileSync } from "node:fs";
import path from "node:path";
import { UserRole } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentActor: vi.fn(),
  setActorContext: vi.fn(),
  listProjectFilesForProject: vi.fn(),
  uploadProjectFile: vi.fn(),
}));

vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActor: mocks.getCurrentActor,
}));

vi.mock("@/lib/auth/request-context", () => ({
  setActorContext: mocks.setActorContext,
  withActorRequestContext: <T extends (...args: never[]) => unknown>(handler: T) => handler,
}));

vi.mock("@/lib/services/project-file-service", () => ({
  listProjectFilesForProject: mocks.listProjectFilesForProject,
  uploadProjectFile: mocks.uploadProjectFile,
}));

import { POST } from "../src/app/api/projects/[projectId]/files/route";
import {
  STRUCTURED_SOURCE_FILENAME_HEADER,
  STRUCTURED_SOURCE_MAX_FILE_SIZE_BYTES,
  STRUCTURED_SOURCE_MAX_REQUEST_SIZE_BYTES,
  STRUCTURED_SOURCE_SIZE_HEADER,
  preflightStructuredSourceRequest,
} from "../src/lib/files/structured-source-upload";
import { uploadStructuredProjectSource } from "../src/lib/services/structured-source-upload-service";

const actor = {
  userId: "22222222-2222-4222-8222-222222222222",
  companyId: "11111111-1111-4111-8111-111111111111",
  role: UserRole.COMPANY_OWNER,
  fullName: "Structured Upload Tester",
  email: "structured-upload@example.com",
};

const routeContext = { params: Promise.resolve({ projectId: "dubai-tower" }) };

function metadataHeaders(originalName: string, size: number, contentLength = size + 512): Headers {
  return new Headers({
    "content-type": "multipart/form-data; boundary=quantara-test",
    "content-length": String(contentLength),
    [STRUCTURED_SOURCE_FILENAME_HEADER]: encodeURIComponent(originalName),
    [STRUCTURED_SOURCE_SIZE_HEADER]: String(size),
  });
}

function multipartRequest(file: File, includeContentLength = true): Request {
  const formData = new FormData();
  formData.append("file", file);
  const request = new Request("http://localhost/api/projects/dubai-tower/files", {
    method: "POST",
    body: formData,
  });
  if (includeContentLength) {
    request.headers.set("content-length", String(file.size + 512));
  } else {
    request.headers.delete("content-length");
  }
  request.headers.set(STRUCTURED_SOURCE_FILENAME_HEADER, encodeURIComponent(file.name));
  request.headers.set(STRUCTURED_SOURCE_SIZE_HEADER, String(file.size));
  return request;
}

describe("structured source request preflight", () => {
  it("accepts only bounded CSV/XLSX/DOCX metadata", () => {
    expect(preflightStructuredSourceRequest(metadataHeaders("door-schedule.csv", 1024))).toEqual({
      originalName: "door-schedule.csv",
      declaredByteSize: 1024,
    });
  });

  it("rejects PDF metadata before any multipart parsing is necessary", () => {
    expect(() => preflightStructuredSourceRequest(metadataHeaders("drawing-set.pdf", 1024))).toThrowError(
      expect.objectContaining({ code: "DRAWING_UPLOAD_ROUTE_REQUIRED", status: 415 }),
    );
  });

  it("rejects a request body above the multipart ceiling", () => {
    expect(() => preflightStructuredSourceRequest(metadataHeaders(
      "schedule.xlsx",
      1024,
      STRUCTURED_SOURCE_MAX_REQUEST_SIZE_BYTES + 1,
    ))).toThrowError(expect.objectContaining({ code: "REQUEST_TOO_LARGE", status: 413 }));
  });
});

describe("POST /api/projects/[projectId]/files", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    mocks.getCurrentActor.mockResolvedValue(actor);
    mocks.uploadProjectFile.mockResolvedValue({
      file: { id: "project-file-1" },
      duplicateOfFileId: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects an old/manual PDF request without calling request.formData", async () => {
    const request = new Request("http://localhost/api/projects/dubai-tower/files", {
      method: "POST",
      headers: metadataHeaders("drawing-set.pdf", 1024),
    });
    const formDataSpy = vi.spyOn(request, "formData");

    const response = await POST(request, routeContext);
    const body = await response.json();

    expect(response.status).toBe(415);
    expect(body).toMatchObject({ ok: false, error: { code: "DRAWING_UPLOAD_ROUTE_REQUIRED" } });
    expect(formDataSpy).not.toHaveBeenCalled();
    expect(mocks.uploadProjectFile).not.toHaveBeenCalled();
  });

  it("preserves a small headerless structured-source client in local/test", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const file = new File(["item,quantity\nDoor,2\n"], "legacy-schedule.csv", { type: "text/csv" });
    const request = multipartRequest(file);
    request.headers.delete(STRUCTURED_SOURCE_FILENAME_HEADER);
    request.headers.delete(STRUCTURED_SOURCE_SIZE_HEADER);

    const response = await POST(request, routeContext);

    expect(response.status).toBe(201);
    expect(mocks.uploadProjectFile).toHaveBeenCalledTimes(1);
  });

  it("rejects an oversized multipart request before parsing its body", async () => {
    const request = new Request("http://localhost/api/projects/dubai-tower/files", {
      method: "POST",
      headers: metadataHeaders("schedule.csv", 1024, STRUCTURED_SOURCE_MAX_REQUEST_SIZE_BYTES + 1),
    });
    const formDataSpy = vi.spyOn(request, "formData");

    const response = await POST(request, routeContext);

    expect(response.status).toBe(413);
    expect((await response.json())).toMatchObject({ ok: false, error: { code: "REQUEST_TOO_LARGE" } });
    expect(formDataSpy).not.toHaveBeenCalled();
    expect(mocks.uploadProjectFile).not.toHaveBeenCalled();
  });

  it("stores a valid structured source through the narrow service", async () => {
    const file = new File(["item,quantity\nDoor,2\n"], "door-schedule.csv", { type: "text/csv" });
    const response = await POST(multipartRequest(file), routeContext);

    expect(response.status).toBe(201);
    expect(mocks.uploadProjectFile).toHaveBeenCalledTimes(1);
    expect(mocks.uploadProjectFile).toHaveBeenCalledWith(
      actor,
      "dubai-tower",
      expect.objectContaining({
        originalName: "door-schedule.csv",
        mimeType: "text/csv",
        buffer: expect.any(Buffer),
      }),
    );
  });

  it("accepts valid browser FormData when the transport omits Content-Length", async () => {
    const file = new File(["item,quantity\nWindow,4\n"], "window-schedule.csv", { type: "text/csv" });
    const request = multipartRequest(file, false);
    expect(request.headers.has("content-length")).toBe(false);

    const response = await POST(request, routeContext);

    expect(response.status).toBe(201);
    expect(mocks.uploadProjectFile).toHaveBeenCalledTimes(1);
  });

  it("keeps the headerless all-supported PDF contract in local/test only", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const file = new File(["%PDF-1.4\nlocal fixture\n%%EOF"], "legacy-local.pdf", { type: "application/pdf" });
    const request = multipartRequest(file);
    request.headers.delete(STRUCTURED_SOURCE_FILENAME_HEADER);
    request.headers.delete(STRUCTURED_SOURCE_SIZE_HEADER);

    const response = await POST(request, routeContext);

    expect(response.status).toBe(201);
    expect(mocks.uploadProjectFile).toHaveBeenCalledWith(
      actor,
      "dubai-tower",
      expect.objectContaining({ originalName: "legacy-local.pdf", mimeType: "application/pdf" }),
    );
  });

  it("preserves local/test structured files above the production 4 MiB buffered ceiling", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const file = new File(
      [new Uint8Array(STRUCTURED_SOURCE_MAX_FILE_SIZE_BYTES + 1)],
      "legacy-large.csv",
      { type: "text/csv" },
    );
    const request = multipartRequest(file);
    request.headers.delete(STRUCTURED_SOURCE_FILENAME_HEADER);
    request.headers.delete(STRUCTURED_SOURCE_SIZE_HEADER);

    const response = await POST(request, routeContext);

    expect(response.status).toBe(201);
    expect(mocks.uploadProjectFile).toHaveBeenCalledWith(
      actor,
      "dubai-tower",
      expect.objectContaining({
        originalName: "legacy-large.csv",
        buffer: expect.objectContaining({ byteLength: STRUCTURED_SOURCE_MAX_FILE_SIZE_BYTES + 1 }),
      }),
    );
  });

  it("rejects a headerless PDF in production before multipart parsing", async () => {
    const file = new File(["%PDF-1.4\nlegacy production\n%%EOF"], "legacy-production.pdf", { type: "application/pdf" });
    const request = multipartRequest(file);
    request.headers.delete(STRUCTURED_SOURCE_FILENAME_HEADER);
    request.headers.delete(STRUCTURED_SOURCE_SIZE_HEADER);
    const formDataSpy = vi.spyOn(request, "formData");

    const response = await POST(request, routeContext);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "UPLOAD_METADATA_REQUIRED" } });
    expect(formDataSpy).not.toHaveBeenCalled();
    expect(mocks.uploadProjectFile).not.toHaveBeenCalled();
  });
});

describe("structured source service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates the actual buffer size before delegating to project-file storage", async () => {
    await expect(uploadStructuredProjectSource(actor, "dubai-tower", {
      originalName: "oversized.csv",
      mimeType: "text/csv",
      buffer: Buffer.alloc(STRUCTURED_SOURCE_MAX_FILE_SIZE_BYTES + 1),
    })).rejects.toMatchObject({ code: "FILE_TOO_LARGE", status: 413 });

    expect(mocks.uploadProjectFile).not.toHaveBeenCalled();
  });

  it("rejects PDF bytes renamed as CSV before storage", async () => {
    await expect(uploadStructuredProjectSource(actor, "dubai-tower", {
      originalName: "renamed.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("%PDF-1.7\nrenamed drawing\n%%EOF"),
    })).rejects.toMatchObject({ code: "DRAWING_UPLOAD_ROUTE_REQUIRED", status: 415 });

    expect(mocks.uploadProjectFile).not.toHaveBeenCalled();
  });
});

describe("Source Processing upload UI", () => {
  it("offers one general source control, routes drawings directly, and sends buffered preflight metadata", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../src/app/projects/[projectId]/files/page.tsx"),
      "utf8",
    );

    expect(source).toContain("Upload source");
    expect(source).toContain("accept={PROJECT_SOURCE_ACCEPT}");
    expect(source).toContain("if (isDrawing)");
    expect(source).toContain("uploadDrawingWithSafeRouting(");
    expect(source).toContain("drawingUploadResumeRef.current,");
    expect(source).toContain("Retry the same drawing upload");
    expect(source).toContain("pendingDrawingFileRef.current = isDrawingProjectSource(file.name) ? file : null");
    expect(source).toContain("validateStructuredSourceUpload(file.name, mimeType, file.size)");
    expect(source).toContain("[STRUCTURED_SOURCE_FILENAME_HEADER]: encodeURIComponent(file.name)");
    expect(source).toContain("[STRUCTURED_SOURCE_SIZE_HEADER]: String(file.size)");
    expect(source).toContain("PDFs and drawings transfer directly to private storage");
    expect(source).not.toContain("Upload source (local development)");
  });
});
