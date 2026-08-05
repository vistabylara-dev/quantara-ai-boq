import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Without this, Next.js walks up from the project directory looking for a
  // workspace root and can misdetect an unrelated lockfile elsewhere on the
  // machine (e.g. C:\Users\<name>\pnpm-lock.yaml) as the root, which breaks
  // the build's output file tracing step (ENOENT on *.nft.json) even after
  // compilation and page generation succeed. Pinning it explicitly avoids
  // that machine-dependent misdetection entirely.
  outputFileTracingRoot: projectRoot,
  // CATALOGUE-PROD-ACTIVATE — the approved HVAC/plumbing dataset CSVs are
  // read server-side at runtime (catalogue-dataset-registry.ts) via a path
  // built from a config-controlled directory + registry filename, not a
  // statically analyzable literal `fs.readFileSync("...")` call, so
  // Vercel's build-time output tracing (@vercel/nft) can't be trusted to
  // discover and include them on its own. Declaring them here guarantees
  // they ship in the deployed function bundle regardless.
  outputFileTracingIncludes: {
    "/api/admin/master-catalogue/datasets/[datasetId]/dry-run": ["./data-imports/hvac/*.csv", "./data-imports/plumbing/*.csv"],
    "/api/admin/master-catalogue/datasets/jobs/[jobId]/continue": ["./data-imports/hvac/*.csv", "./data-imports/plumbing/*.csv"],
    // CORE-FLOW-1 — every route below transitively imports the extraction
    // pipeline (project-file-service/drawing-service -> register-handlers ->
    // preprocessing-handler -> pdfjs-dist's legacy Node build), which tries
    // to `require("@napi-rs/canvas")` inside a try/catch at module-load time
    // to polyfill DOMMatrix/ImageData/Path2D. That require is dynamic, so
    // @vercel/nft's static trace misses it and the package is absent from
    // the deployed function's node_modules — the catch swallows the load
    // failure (only a warning), but the next line dereferences the
    // now-unpolyfilled DOMMatrix directly, crashing with a bare
    // ReferenceError before any route handler code runs. Same tracing-gap
    // class as the catalogue CSVs above; same fix. Only the linux-x64-gnu
    // native binary is needed since that's Vercel's runtime target.
    "/api/drawings/[fileId]": ["./node_modules/@napi-rs/canvas/**", "./node_modules/@napi-rs/canvas-linux-x64-gnu/**"],
    "/api/files/[fileId]": ["./node_modules/@napi-rs/canvas/**", "./node_modules/@napi-rs/canvas-linux-x64-gnu/**"],
    "/api/files/[fileId]/classification": ["./node_modules/@napi-rs/canvas/**", "./node_modules/@napi-rs/canvas-linux-x64-gnu/**"],
    "/api/files/[fileId]/classify": ["./node_modules/@napi-rs/canvas/**", "./node_modules/@napi-rs/canvas-linux-x64-gnu/**"],
    "/api/files/[fileId]/download": ["./node_modules/@napi-rs/canvas/**", "./node_modules/@napi-rs/canvas-linux-x64-gnu/**"],
    "/api/projects/[projectId]/drawings": ["./node_modules/@napi-rs/canvas/**", "./node_modules/@napi-rs/canvas-linux-x64-gnu/**"],
    "/api/projects/[projectId]/drawings/upload-authorization": ["./node_modules/@napi-rs/canvas/**", "./node_modules/@napi-rs/canvas-linux-x64-gnu/**"],
    "/api/projects/[projectId]/drawings/upload-authorization/[sessionId]/finalize": ["./node_modules/@napi-rs/canvas/**", "./node_modules/@napi-rs/canvas-linux-x64-gnu/**"],
    "/api/projects/[projectId]/files": ["./node_modules/@napi-rs/canvas/**", "./node_modules/@napi-rs/canvas-linux-x64-gnu/**"],
  },
  // pdfkit reads its standard-14 font metrics (data/*.afm) from disk via a
  // path relative to its own package directory at runtime. Letting webpack
  // bundle it moves/mangles that relative path and the AFM files are never
  // copied into .next, so ENOENT at request time — excluding it from
  // bundling keeps it a plain runtime `require` from node_modules instead.
  //
  // pdf-parse / pdfjs-dist: webpack-bundling pdfjs-dist's legacy build
  // breaks its own top-level environment feature-detection ("Object.
  // defineProperty called on non-object") inside Next's RSC/route-handler
  // module wrapping — same class of problem, same fix.
  serverExternalPackages: ["pdfkit", "pdf-parse", "pdfjs-dist"],
};

// initOpenNextCloudflareForDev() sets up local Cloudflare binding emulation
// (Miniflare) for `next dev` only. Calling it unconditionally at module load
// also runs it during `next build`, where it has no purpose but still
// requires every declared binding (e.g. Hyperdrive) to be locally
// emulatable — failing the build over a dev-only concern. Gating on the
// official phase constant instead of NODE_ENV keeps this correct across all
// non-dev phases (build, start, export, test) without guessing at process
// state.
export default async function config(phase) {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
    await initOpenNextCloudflareForDev();
  }

  return nextConfig;
}
