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
