import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// CATALOGUE-PROD-ACTIVATE — every data-imports/ subdirectory backing a
// registered dataset in catalogue-dataset-registry.ts (src/lib/services/
// catalogue-dataset-registry.ts's DATASETS/GENERATED_DATASETS). Originally
// this list only had hvac/plumbing — the 13 datasets added later
// (architectural-finishes, bim-digital-deliverables, civil-works, closeout,
// doors-and-windows, facade, general-requirements, landscaping, roofing,
// site-infrastructure, structural, temporary-works, uae-authority-regulatory)
// were never added here, so their CSVs were silently absent from the
// deployed Vercel function bundle: readFileSync in loadApprovedDatasetFiles
// threw SOURCE_FILE_MISSING for all 13, which is why only the HVAC and
// Plumbing marketplace categories could ever be activated in production —
// every other category's admin activation call failed outright.
const CATALOGUE_DATASET_CSV_GLOBS = [
  "./data-imports/hvac/*.csv",
  "./data-imports/plumbing/*.csv",
  "./data-imports/architectural-finishes/*.csv",
  "./data-imports/bim-digital-deliverables/*.csv",
  "./data-imports/civil-works/*.csv",
  "./data-imports/closeout/*.csv",
  "./data-imports/doors-and-windows/*.csv",
  "./data-imports/facade/*.csv",
  "./data-imports/general-requirements/*.csv",
  "./data-imports/landscaping/*.csv",
  "./data-imports/roofing/*.csv",
  "./data-imports/site-infrastructure/*.csv",
  "./data-imports/structural/*.csv",
  "./data-imports/temporary-works/*.csv",
  "./data-imports/uae-authority-regulatory/*.csv",
];

// PDF-WORKER-VERCEL — pdfjs-dist's legacy Node build lazily sets up a
// same-thread "fake worker" the first time any PDFParse method triggers a
// document load (getInfo/getText/getTable/getScreenshot all go through it,
// not just rendering). That setup dynamically imports its own worker
// script by a real node_modules-relative path — @vercel/nft's static trace
// doesn't see that dynamic import, so the file is absent from the deployed
// function bundle: confirmed in staged testing via the exact runtime error
// `Cannot find module '/var/task/node_modules/pdfjs-dist/legacy/build/
// pdf.worker.mjs' imported from .../pdf.mjs`. Same tracing-gap class as the
// @napi-rs/canvas entries below; same fix — declare the one file actually
// missing, nothing broader.
const PDFJS_WORKER_GLOB = ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"];

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
  // CATALOGUE-PROD-ACTIVATE — the approved dataset CSVs are read
  // server-side at runtime (catalogue-dataset-registry.ts) via a path
  // built from a config-controlled directory + registry filename, not a
  // statically analyzable literal `fs.readFileSync("...")` call, so
  // Vercel's build-time output tracing (@vercel/nft) can't be trusted to
  // discover and include them on its own. Declaring them here guarantees
  // they ship in the deployed function bundle regardless. Every route below
  // transitively reaches loadApprovedDatasetFiles or checkDatasetReadiness
  // (both real, per-dataset disk reads) — see master-catalogue-import-job-
  // service.ts and industry-package-activation-service.ts.
  outputFileTracingIncludes: {
    "/api/admin/master-catalogue/datasets/[datasetId]/dry-run": CATALOGUE_DATASET_CSV_GLOBS,
    "/api/admin/master-catalogue/datasets/[datasetId]/execute": CATALOGUE_DATASET_CSV_GLOBS,
    "/api/admin/master-catalogue/datasets/[datasetId]/readiness": CATALOGUE_DATASET_CSV_GLOBS,
    "/api/admin/master-catalogue/datasets/jobs/[jobId]/continue": CATALOGUE_DATASET_CSV_GLOBS,
    "/api/admin/master-catalogue/datasets/activate-all": CATALOGUE_DATASET_CSV_GLOBS,
    "/api/admin/master-catalogue/activate-next": CATALOGUE_DATASET_CSV_GLOBS,
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
    // PDF-WORKER-VERCEL — the two routes that actually call PDFParse methods
    // (getScreenshot/getText/getTable) and were confirmed hitting the missing-
    // worker crash. Every other PDFParse call site (extractPdfPageCount's
    // getInfo(), in drawing-service.ts) is untouched by this PR — flagged
    // separately, not fixed here, since it isn't the confirmed blocker this
    // task scopes to.
    "/api/files/[fileId]/preprocess": ["./node_modules/@napi-rs/canvas/**", "./node_modules/@napi-rs/canvas-linux-x64-gnu/**", ...PDFJS_WORKER_GLOB],
    "/api/files/[fileId]/extract": [...PDFJS_WORKER_GLOB],
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
