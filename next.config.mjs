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
  experimental: {
    serverComponentsExternalPackages: ["pdfkit", "pdf-parse", "pdfjs-dist"],
  },
};

export default nextConfig;
