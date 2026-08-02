const nextConfig = {
  reactStrictMode: true,
  // pdfkit reads its standard-14 font metrics (data/*.afm) from disk via a
  // path relative to its own package directory at runtime. Letting webpack
  // bundle it moves/mangles that relative path and the AFM files are never
  // copied into .next, so ENOENT at request time — excluding it from
  // bundling keeps it a plain runtime `require` from node_modules instead.
  experimental: {
    serverComponentsExternalPackages: ["pdfkit"],
  },
};

export default nextConfig;
