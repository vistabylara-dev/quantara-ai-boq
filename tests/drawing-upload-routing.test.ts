import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createDrawingUploadResumeHandle,
  DIRECT_UPLOAD_CONFIG_ERROR_MARKER,
  shouldFallBackToBufferedUpload,
  uploadDrawingWithSafeRouting,
  type DrawingUploadDependencies,
} from "../src/lib/drawings/upload-routing";
import { generateDrawingUploadToken } from "../src/lib/storage/blob-client-upload";

const repoRoot = path.resolve(__dirname, "..");

class UploadApiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "UploadApiError";
  }
}

describe("drawing upload routing", () => {
  it("permits the buffered fallback only in local development with the exact missing-provider error", () => {
    const message = `Direct upload requires ${DIRECT_UPLOAD_CONFIG_ERROR_MARKER}.`;
    expect(shouldFallBackToBufferedUpload(message, false)).toBe(true);
    expect(shouldFallBackToBufferedUpload(message, true)).toBe(false);
    expect(shouldFallBackToBufferedUpload("Network error", false)).toBe(false);
  });

  it("transfers an actual PDF above 4.5 MiB authorize -> private Blob -> finalize, without POSTing bytes to an app route", async () => {
    const byteSize = Math.ceil(4.5 * 1024 * 1024) + 1;
    const bytes = new Uint8Array(byteSize);
    bytes.set(new TextEncoder().encode("%PDF-1.4\n"), 0);
    bytes.set(new TextEncoder().encode("\n%%EOF"), byteSize - 6);
    const file = new File([bytes], "above-function-limit.pdf", { type: "application/pdf" });

    const order: string[] = [];
    let transferredByteSize = 0;
    const bufferedUpload = vi.fn<DrawingUploadDependencies["bufferedUpload"]>();
    const dependencies: DrawingUploadDependencies = {
      authorize: vi.fn(async (declaration) => {
        order.push("authorize");
        expect(declaration).toEqual({
          originalName: file.name,
          declaredMimeType: file.type,
          declaredByteSize: file.size,
        });
        expect(declaration).not.toHaveProperty("file");
        return {
          sessionId: "11111111-1111-4111-8111-111111111111",
          uploadToken: "scoped-test-token-not-a-secret",
          pathname: "companies/company-a/projects/project-a/drawings/file-a/above-function-limit.pdf",
          contentType: "application/pdf",
          maxSizeBytes: 250 * 1024 * 1024,
          expiresAt: "2026-08-30T12:30:00.000Z",
        };
      }),
      transferToPrivateBlob: vi.fn(async (transfer) => {
        order.push("transfer");
        expect(transfer.access).toBe("private");
        expect(transfer.pathname).toContain("/drawings/");
        expect(transfer.file).toBe(file);
        const transferredBytes = await transfer.file.arrayBuffer();
        transferredByteSize = transferredBytes.byteLength;
        expect(new TextDecoder().decode(transferredBytes.slice(0, 8))).toBe("%PDF-1.4");
        transfer.onProgress(100);
      }),
      finalize: vi.fn(async (input) => {
        order.push("finalize");
        expect(input).toEqual({
          sessionId: "11111111-1111-4111-8111-111111111111",
          metadata: { discipline: "ARCHITECTURAL" },
        });
        expect(input).not.toHaveProperty("file");
      }),
      bufferedUpload,
      getErrorMessage: (error) => error instanceof Error ? error.message : "Unknown error",
    };

    const stages: string[] = [];
    const progress: number[] = [];
    const result = await uploadDrawingWithSafeRouting(
      {
        file,
        metadata: { discipline: "ARCHITECTURAL" },
        isProduction: true,
        onStage: (stage) => stages.push(stage),
        onProgress: (percentage) => progress.push(percentage),
      },
      dependencies,
    );

    expect(file.size).toBeGreaterThan(4.5 * 1024 * 1024);
    expect(transferredByteSize).toBe(file.size);
    expect(result).toBe("direct");
    expect(order).toEqual(["authorize", "transfer", "finalize"]);
    expect(stages).toEqual(["preparing", "uploading", "finalizing"]);
    expect(progress).toEqual([100]);
    expect(bufferedUpload).not.toHaveBeenCalled();
  });

  it("does not turn a production authorization configuration failure into a buffered upload", async () => {
    const file = new File(["%PDF-1.4\n%%EOF"], "small.pdf", { type: "application/pdf" });
    const bufferedUpload = vi.fn<DrawingUploadDependencies["bufferedUpload"]>();

    await expect(uploadDrawingWithSafeRouting(
      {
        file,
        metadata: {},
        isProduction: true,
        onStage: () => undefined,
        onProgress: () => undefined,
      },
      {
        authorize: async () => {
          throw new Error(`Direct upload requires ${DIRECT_UPLOAD_CONFIG_ERROR_MARKER}.`);
        },
        transferToPrivateBlob: async () => undefined,
        finalize: async () => undefined,
        bufferedUpload,
        getErrorMessage: (error) => error instanceof Error ? error.message : "Unknown error",
      },
    )).rejects.toThrow(DIRECT_UPLOAD_CONFIG_ERROR_MARKER);

    expect(bufferedUpload).not.toHaveBeenCalled();
  });

  it("gives Drawing Intake and the /files source control one-auth/one-transfer retry cardinality", async () => {
    const filesPage = readFileSync(path.join(repoRoot, "src/app/projects/[projectId]/files/page.tsx"), "utf8");
    expect(filesPage).toContain("drawingUploadResumeRef.current,");
    expect(filesPage).toContain("Retry the same drawing upload");

    const file = new File(["%PDF-1.4\nresume\n%%EOF"], "resume.pdf", { type: "application/octet-stream" });
    const resumeHandle = createDrawingUploadResumeHandle();
    const authorization = {
      sessionId: "22222222-2222-4222-8222-222222222222",
      uploadToken: "memory-only-scoped-token",
      pathname: "companies/company-a/projects/project-a/drawings/file-b/resume.pdf",
      contentType: "application/pdf",
      maxSizeBytes: 250 * 1024 * 1024,
      expiresAt: "2026-08-30T12:30:00.000Z",
    };
    const authorize = vi.fn(async () => authorization);
    const transferToPrivateBlob = vi.fn(async () => undefined);
    const finalize = vi.fn()
      .mockRejectedValueOnce(new Error("finalize response was lost"))
      .mockResolvedValueOnce(undefined);
    const dependencies: DrawingUploadDependencies = {
      authorize,
      transferToPrivateBlob,
      finalize,
      bufferedUpload: vi.fn(),
      getErrorMessage: (error) => error instanceof Error ? error.message : "Unknown error",
    };
    const input = {
      file,
      metadata: { discipline: "ARCHITECTURAL" as const },
      isProduction: true,
      onStage: () => undefined,
      onProgress: () => undefined,
    };

    await expect(uploadDrawingWithSafeRouting(input, dependencies, resumeHandle)).rejects.toThrow("response was lost");
    await expect(uploadDrawingWithSafeRouting(input, dependencies, resumeHandle)).resolves.toBe("direct");

    expect(authorize).toHaveBeenCalledTimes(1);
    expect(transferToPrivateBlob).toHaveBeenCalledTimes(1);
    expect(transferToPrivateBlob).toHaveBeenCalledWith(expect.objectContaining({
      pathname: authorization.pathname,
      token: authorization.uploadToken,
      contentType: authorization.contentType,
    }));
    expect(finalize).toHaveBeenCalledTimes(2);
    expect(finalize.mock.calls.map(([value]) => value.sessionId)).toEqual([
      authorization.sessionId,
      authorization.sessionId,
    ]);
    expect(resumeHandle.current).toBeNull();
  });

  it("finalizes first after an ambiguous Blob response, avoiding an overwrite-forbidden second PUT", async () => {
    const file = new File(["%PDF-1.4\nput reached Blob\n%%EOF"], "lost-put-response.pdf", { type: "application/pdf" });
    const resumeHandle = createDrawingUploadResumeHandle();
    const authorization = {
      sessionId: "33333333-3333-4333-8333-333333333333",
      uploadToken: "memory-only-transfer-token",
      pathname: "companies/company-a/projects/project-a/drawings/file-c/lost-put-response.pdf",
      contentType: "application/pdf",
      maxSizeBytes: 250 * 1024 * 1024,
      expiresAt: "2026-08-30T12:30:00.000Z",
    };
    const authorize = vi.fn(async () => authorization);
    const transferToPrivateBlob = vi.fn(async () => {
      throw new Error("PUT completed but its response was lost");
    });
    const finalize = vi.fn(async () => undefined);
    const dependencies: DrawingUploadDependencies = {
      authorize,
      transferToPrivateBlob,
      finalize,
      bufferedUpload: vi.fn(),
      getErrorMessage: (error) => error instanceof Error ? error.message : "Unknown error",
    };
    const input = {
      file,
      metadata: {},
      isProduction: true,
      onStage: () => undefined,
      onProgress: () => undefined,
    };

    await expect(uploadDrawingWithSafeRouting(input, dependencies, resumeHandle)).rejects.toThrow("response was lost");
    await expect(uploadDrawingWithSafeRouting(input, dependencies, resumeHandle)).resolves.toBe("direct");

    expect(authorize).toHaveBeenCalledTimes(1);
    expect(transferToPrivateBlob).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledWith({ sessionId: authorization.sessionId, metadata: {} });
  });

  it("clears retained authorization when the user supplies a different File object", async () => {
    const firstFile = new File(["%PDF-1.4\nfirst\n%%EOF"], "same-name.pdf", { type: "application/pdf" });
    const replacementFile = new File(["%PDF-1.4\nsecond\n%%EOF"], "same-name.pdf", { type: "application/pdf" });
    const resumeHandle = createDrawingUploadResumeHandle();
    let authorizationCount = 0;
    const authorize: DrawingUploadDependencies["authorize"] = vi.fn(async () => {
      authorizationCount += 1;
      const call = authorizationCount;
      return {
        sessionId: call === 1 ? "44444444-4444-4444-8444-444444444444" : "55555555-5555-4555-8555-555555555555",
        uploadToken: `replacement-token-${call}`,
        pathname: `companies/company-a/projects/project-a/drawings/file-${call}/same-name.pdf`,
        contentType: "application/pdf",
        maxSizeBytes: 250 * 1024 * 1024,
        expiresAt: "2026-08-30T12:30:00.000Z",
      };
    });
    const transferToPrivateBlob = vi.fn(async () => undefined);
    const finalize = vi.fn()
      .mockRejectedValueOnce(new Error("first finalize ambiguous"))
      .mockResolvedValueOnce(undefined);
    const dependencies: DrawingUploadDependencies = {
      authorize,
      transferToPrivateBlob,
      finalize,
      bufferedUpload: vi.fn(),
      getErrorMessage: (error) => error instanceof Error ? error.message : "Unknown error",
    };
    const makeInput = (file: File) => ({
      file,
      metadata: {},
      isProduction: true,
      onStage: () => undefined,
      onProgress: () => undefined,
    });

    await expect(uploadDrawingWithSafeRouting(makeInput(firstFile), dependencies, resumeHandle)).rejects.toThrow("ambiguous");
    await expect(uploadDrawingWithSafeRouting(makeInput(replacementFile), dependencies, resumeHandle)).resolves.toBe("direct");

    expect(authorize).toHaveBeenCalledTimes(2);
    expect(transferToPrivateBlob).toHaveBeenCalledTimes(2);
    expect(finalize.mock.calls[1]?.[0].sessionId).toBe("55555555-5555-4555-8555-555555555555");
    expect(resumeHandle.current).toBeNull();
  });

  it("re-PUTs the same path only after finalize authoritatively reports the Blob missing", async () => {
    const file = new File(["%PDF-1.4\nmissing then uploaded\n%%EOF"], "missing-recovery.pdf", { type: "application/pdf" });
    const resumeHandle = createDrawingUploadResumeHandle();
    const authorization = {
      sessionId: "66666666-6666-4666-8666-666666666666",
      uploadToken: "missing-recovery-token",
      pathname: "companies/company-a/projects/project-a/drawings/file-f/missing-recovery.pdf",
      contentType: "application/pdf",
      maxSizeBytes: 250 * 1024 * 1024,
      expiresAt: "2026-08-30T12:30:00.000Z",
    };
    const authorize = vi.fn(async () => authorization);
    const transferToPrivateBlob = vi.fn()
      .mockRejectedValueOnce(new Error("ambiguous initial PUT"))
      .mockResolvedValueOnce(undefined);
    const finalize = vi.fn()
      .mockRejectedValueOnce(new UploadApiError("BLOB_OBJECT_MISSING", "Blob missing"))
      .mockResolvedValueOnce(undefined);
    const dependencies: DrawingUploadDependencies = {
      authorize,
      transferToPrivateBlob,
      finalize,
      bufferedUpload: vi.fn(),
      getErrorMessage: (error) => error instanceof Error ? error.message : "Unknown error",
    };
    const input = { file, metadata: {}, isProduction: true, onStage: () => undefined, onProgress: () => undefined };

    await expect(uploadDrawingWithSafeRouting(input, dependencies, resumeHandle)).rejects.toThrow("initial PUT");
    await expect(uploadDrawingWithSafeRouting(input, dependencies, resumeHandle)).resolves.toBe("direct");

    expect(authorize).toHaveBeenCalledTimes(1);
    expect(transferToPrivateBlob).toHaveBeenCalledTimes(2);
    expect(transferToPrivateBlob.mock.calls[0]?.[0].pathname).toBe(authorization.pathname);
    expect(transferToPrivateBlob.mock.calls[1]?.[0].pathname).toBe(authorization.pathname);
    expect(finalize).toHaveBeenCalledTimes(2);
  });
});

describe("direct upload configuration failure", () => {
  it("returns a safe, actionable error when the Blob token is missing", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    try {
      await expect(generateDrawingUploadToken({
        pathname: "companies/company-a/projects/project-a/drawings/file-a/test.pdf",
        contentType: "application/pdf",
        maxSizeBytes: 250 * 1024 * 1024,
        ttlMs: 30 * 60 * 1000,
      })).rejects.toMatchObject({
        code: "DIRECT_UPLOAD_NOT_CONFIGURED",
        status: 503,
        message: "Drawing upload storage is not configured. Contact your administrator before retrying.",
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("upload workflow navigation and production controls", () => {
  it("routes every prominent drawing entry point to Drawing Intake", () => {
    const panel = readFileSync(path.join(repoRoot, "src/components/dashboard/project-intelligence-panel.tsx"), "utf8");
    expect(panel).toContain('href: `/projects/${project.id}/drawings`');
    expect(panel).not.toContain('actionUploadFirstDrawing"), href: `/projects/${project.id}/files`');
  });

  it("offers Source Processing in project navigation and after drawing intake", () => {
    const layout = readFileSync(path.join(repoRoot, "src/app/projects/[projectId]/layout.tsx"), "utf8");
    const drawings = readFileSync(path.join(repoRoot, "src/app/projects/[projectId]/drawings/page.tsx"), "utf8");
    expect(layout).toContain("Source Processing");
    expect(layout).toContain('href={`${basePath}/files`}');
    expect(drawings).toContain("View Source Processing");
    expect(drawings).not.toContain("Nothing here is scanned, extracted, or analyzed today.");
  });

  it("routes the single Source Processing upload control by source type", () => {
    const sources = readFileSync(path.join(repoRoot, "src/app/projects/[projectId]/files/page.tsx"), "utf8");
    expect(sources).toContain("Upload source");
    expect(sources).toContain("accept={PROJECT_SOURCE_ACCEPT}");
    expect(sources).toContain("if (isDrawing)");
    expect(sources).toContain("uploadDrawingWithSafeRouting(");
    expect(sources).not.toContain("Upload source (local development)");
  });

  it("keeps Drawing Intake retry credentials in component memory only and clears them on removal", () => {
    const drawings = readFileSync(path.join(repoRoot, "src/app/projects/[projectId]/drawings/page.tsx"), "utf8");
    expect(drawings).toContain("useRef<DrawingUploadResumeHandle>(createDrawingUploadResumeHandle())");
    expect(drawings).toContain("uploadResumeRef.current,");
    expect(drawings).toContain("clearDrawingUploadResumeState(uploadResumeRef.current)");
    expect(drawings).not.toContain("localStorage");
    expect(drawings).not.toContain("sessionStorage");
  });
});
