import { afterEach, describe, expect, it, vi } from "vitest";

const generateClientTokenMock = vi.hoisted(() => vi.fn(async () => "scoped-client-token"));

vi.mock("@vercel/blob/client", () => ({
  generateClientTokenFromReadWriteToken: generateClientTokenMock,
}));

import { generateDrawingUploadToken } from "../src/lib/storage/blob-client-upload";

describe("drawing Blob client-token scope", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("binds the token to the exact canonical MIME and declared byte size", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T12:00:00.000Z"));
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "present-only-for-unit-test");

    const result = await generateDrawingUploadToken({
      pathname: "companies/company-a/projects/project-a/drawings/file-a/plan.pdf",
      contentType: "application/pdf",
      maxSizeBytes: 4_718_593,
      ttlMs: 30 * 60 * 1000,
    });

    expect(result).toBe("scoped-client-token");
    expect(generateClientTokenMock).toHaveBeenCalledWith({
      pathname: "companies/company-a/projects/project-a/drawings/file-a/plan.pdf",
      allowedContentTypes: ["application/pdf"],
      maximumSizeInBytes: 4_718_593,
      validUntil: new Date("2026-08-30T12:30:00.000Z").getTime(),
      allowOverwrite: false,
      addRandomSuffix: false,
    });
  });
});
