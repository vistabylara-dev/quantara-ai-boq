import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

const nextConfig = {
  reactStrictMode: true,
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
