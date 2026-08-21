import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedTypesDirectory = path.join(repoRoot, ".next", "types");

function runNode(entrypoint, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entrypoint, ...args], {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) reject(new Error(`${path.basename(entrypoint)} exited on signal ${signal}.`));
      else if (code === 0) resolve();
      else reject(new Error(`${path.basename(entrypoint)} exited with code ${code}.`));
    });
  });
}

// next typegen updates the current route inventory but does not remove files
// for deleted routes. Removing only its generated types directory first keeps
// repeated local runs identical to a clean CI checkout.
await rm(generatedTypesDirectory, { recursive: true, force: true });

await runNode(
  path.join(repoRoot, "node_modules", "next", "dist", "bin", "next"),
  ["typegen"],
);
await runNode(
  path.join(repoRoot, "node_modules", "typescript", "bin", "tsc"),
  ["--noEmit"],
);
