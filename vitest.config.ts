import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL("./", import.meta.url)),
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
