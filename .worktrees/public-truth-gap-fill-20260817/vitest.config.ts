import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL("./", import.meta.url)),
  // Without this, esbuild's default classic JSX transform requires `React`
  // in scope, which nothing in this codebase provides (everywhere else
  // relies on the automatic runtime) — surfaced by the first test that
  // calls a JSX-returning Server Component function directly.
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // These are integration tests sharing one local Postgres instance;
    // running test files in parallel causes intermittent transaction
    // serialization/deadlock errors unrelated to actual test correctness.
    fileParallelism: false,
  },
});
