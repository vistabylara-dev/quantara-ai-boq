import fs from "node:fs";
import path from "node:path";
import { bundleServer } from "../node_modules/@opennextjs/cloudflare/dist/cli/build/bundle-server.js";
import { transformPackageJson } from "../node_modules/@opennextjs/cloudflare/dist/cli/build/utils/workerd.js";
import {
  compileConfig,
  getNormalizedOptions,
  nextAppDir,
} from "../node_modules/@opennextjs/cloudflare/dist/cli/commands/utils/utils.js";

const projectRoot = path.resolve(import.meta.dirname, "..");
const serverRoot = path.join(projectRoot, ".open-next", "server-functions", "default");
const outputNodeModules = path.join(serverRoot, "node_modules");
const prismaPackages = ["@prisma/client", ".prisma/client"];

function assertFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} is missing at ${filePath}`);
  }
}

assertFile(path.join(serverRoot, "index.mjs"), "OpenNext server entry");

for (const packageName of prismaPackages) {
  const source = path.join(projectRoot, "node_modules", packageName);
  const destination = path.join(outputNodeModules, packageName);
  const sourcePackageJson = path.join(source, "package.json");

  assertFile(sourcePackageJson, `${packageName} source package manifest`);
  fs.cpSync(source, destination, { recursive: true, force: true });

  const destinationPackageJson = path.join(destination, "package.json");
  const original = JSON.parse(fs.readFileSync(destinationPackageJson, "utf8"));
  const { transformed, hasBuildCondition } = transformPackageJson(original);
  if (!hasBuildCondition) {
    throw new Error(`${packageName} does not expose the workerd condition expected by OpenNext.`);
  }

  fs.writeFileSync(destinationPackageJson, `${JSON.stringify(transformed)}\n`, "utf8");
}

// On Windows, OpenNext can miss these package rewrites while preparing its
// package map. Re-running only its exported final bundler after the guarded
// copy is deterministic on every platform and keeps the actual bundling logic
// owned by OpenNext rather than duplicating it here.
process.chdir(projectRoot);
const { config, buildDir } = await compileConfig();
const options = getNormalizedOptions(config, buildDir);
await bundleServer(options, { minify: true, sourceDir: nextAppDir });

const generatedClientRoot = path.join(outputNodeModules, ".prisma", "client");
assertFile(path.join(generatedClientRoot, "wasm.js"), "Prisma workerd entry");
assertFile(path.join(generatedClientRoot, "wasm-worker-loader.mjs"), "Prisma workerd loader");
assertFile(path.join(generatedClientRoot, "query_compiler_bg.wasm"), "Prisma query compiler WASM");

const generatedPackage = JSON.parse(
  fs.readFileSync(path.join(generatedClientRoot, "package.json"), "utf8"),
);
const requireConditions = Object.keys(generatedPackage.exports?.["."]?.require ?? {});
const importConditions = Object.keys(generatedPackage.exports?.["."]?.import ?? {});
if (requireConditions.join(",") !== "workerd" || importConditions.join(",") !== "workerd") {
  throw new Error("The generated Prisma client package was not narrowed to its workerd exports.");
}

const bundleMeta = JSON.parse(fs.readFileSync(path.join(serverRoot, "handler.mjs.meta.json"), "utf8"));
const loaderEntry = Object.entries(bundleMeta.inputs ?? {}).find(([inputPath]) =>
  inputPath.endsWith("/wasm-worker-loader.mjs"),
);
const compilerImport = loaderEntry?.[1]?.imports?.find(
  (entry) => entry.external === true && entry.path.endsWith("query_compiler_bg.wasm"),
);
if (!compilerImport) {
  throw new Error("The OpenNext handler does not import Prisma's compiler as an external workerd WASM module.");
}

const handlerSource = fs.readFileSync(path.join(serverRoot, "handler.mjs"), "utf8");
const incompatibleUndiciMarkers = ["wasm_on_url", "llhttp_alloc"];
const bundledUndiciMarker = incompatibleUndiciMarkers.find((marker) =>
  handlerSource.includes(marker),
);
if (bundledUndiciMarker) {
  throw new Error(
    `The OpenNext handler contains Undici's dynamic-WASM HTTP parser (${bundledUndiciMarker}), which Cloudflare Workers cannot compile at runtime.`,
  );
}

console.log("Verified OpenNext Prisma workerd packaging and fetch-only Undici bundling.");
