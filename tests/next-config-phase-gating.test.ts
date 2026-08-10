import { describe, expect, it, vi } from "vitest";

/**
 * Regression test for the build-breaking bug fixed in next.config.mjs:
 * initOpenNextCloudflareForDev() was previously called unconditionally at
 * module load, so it also ran during `next build`, requiring every declared
 * Cloudflare binding (including Hyperdrive) to be locally emulatable and
 * failing the build over a dev-only concern. next.config.mjs now exports a
 * phase-aware function and only calls the initializer for
 * PHASE_DEVELOPMENT_SERVER.
 *
 * This imports the real next.config.mjs directly and calls it with each
 * phase constant — no need to go through Next.js's own config-loading
 * machinery, since the exported function is what Next.js itself would call.
 */
const initOpenNextCloudflareForDevMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@opennextjs/cloudflare", () => ({
  initOpenNextCloudflareForDev: (...args: unknown[]) => initOpenNextCloudflareForDevMock(...args),
}));

type NextConfigModule = {
  default: (phase: string) => Promise<Record<string, unknown>>;
};

const { default: nextConfigFn } = (await import("../next.config.mjs")) as NextConfigModule;
const { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } = await import(
  "next/constants.js"
);

describe("next.config.mjs phase gating", () => {
  it("invokes the OpenNext Cloudflare dev initializer only during the development-server phase", async () => {
    initOpenNextCloudflareForDevMock.mockClear();
    await nextConfigFn(PHASE_DEVELOPMENT_SERVER);
    expect(initOpenNextCloudflareForDevMock).toHaveBeenCalledTimes(1);
  });

  it("does not invoke it during the production build phase (this is the bug that broke `next build`)", async () => {
    initOpenNextCloudflareForDevMock.mockClear();
    await nextConfigFn(PHASE_PRODUCTION_BUILD);
    expect(initOpenNextCloudflareForDevMock).not.toHaveBeenCalled();
  });

  it("does not invoke it during the production server phase", async () => {
    initOpenNextCloudflareForDevMock.mockClear();
    await nextConfigFn(PHASE_PRODUCTION_SERVER);
    expect(initOpenNextCloudflareForDevMock).not.toHaveBeenCalled();
  });

  it("returns identical config values regardless of phase", async () => {
    const devConfig = await nextConfigFn(PHASE_DEVELOPMENT_SERVER);
    const buildConfig = await nextConfigFn(PHASE_PRODUCTION_BUILD);
    expect(devConfig).toEqual(buildConfig);
    expect(buildConfig).toMatchObject({
      reactStrictMode: true,
      serverExternalPackages: ["pdfkit", "pdf-parse", "pdfjs-dist"],
    });
  });

  it("ships the complete PDF runtime for table extraction without coupling it to screenshot preprocessing", async () => {
    const buildConfig = await nextConfigFn(PHASE_PRODUCTION_BUILD);
    const tracing = buildConfig.outputFileTracingIncludes as Record<string, string[]>;

    const requiredPdfRuntime = [
      "./node_modules/@napi-rs/canvas/**",
      "./node_modules/@napi-rs/canvas-linux-x64-gnu/**",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ];

    expect(tracing["/api/files/[fileId]/extract"]).toEqual(
      expect.arrayContaining(requiredPdfRuntime),
    );

    // The already-working screenshot/preprocessing route must retain the same
    // production runtime dependencies.
    expect(tracing["/api/files/[fileId]/preprocess"]).toEqual(
      expect.arrayContaining(requiredPdfRuntime),
    );

    const { readFile } = await import("node:fs/promises");
    const serviceSource = await readFile(
      new URL("../src/lib/services/table-extraction-service.ts", import.meta.url),
      "utf8",
    );

    expect(serviceSource).toContain(
      'from "@/lib/files/table-extraction-handler"',
    );
    expect(serviceSource).not.toContain(
      'import "@/lib/jobs/register-handlers"',
    );
  });
});
