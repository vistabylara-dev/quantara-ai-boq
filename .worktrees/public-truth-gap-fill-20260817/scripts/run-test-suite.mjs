import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultTestUrl = "postgresql://quantara:quantara_local_password@localhost:5432/quantara_ai_boq_test?schema=public";

function resolveTestDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) return defaultTestUrl;

  const derived = new URL(process.env.DATABASE_URL);
  const currentName = decodeURIComponent(derived.pathname.slice(1));
  derived.pathname = `/${encodeURIComponent(`${currentName}_test`)}`;
  return derived.toString();
}

function assertTestDatabase(url) {
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (!/(^|[_-])(test|ci)([_-]|$)/i.test(databaseName)) {
    throw new Error(`Refusing to run tests against non-test database "${databaseName}".`);
  }
  return databaseName;
}

async function ensureDatabaseExists(testUrl, databaseName) {
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";
  adminUrl.search = "";

  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
    if (existing.rowCount) return;

    const localHost = ["localhost", "127.0.0.1", "::1"].includes(adminUrl.hostname);
    if (!localHost) {
      throw new Error(`Test database "${databaseName}" does not exist; automatic creation is local-only.`);
    }

    const quotedName = databaseName.replaceAll('"', '""');
    await client.query(`CREATE DATABASE "${quotedName}"`);
  } finally {
    await client.end();
  }
}

function runNode(entrypoint, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entrypoint, ...args], {
      cwd: repoRoot,
      env,
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

const testDatabaseUrl = resolveTestDatabaseUrl();
const parsedTestUrl = new URL(testDatabaseUrl);
const databaseName = assertTestDatabase(parsedTestUrl);
await ensureDatabaseExists(parsedTestUrl, databaseName);

const testEnv = {
  ...process.env,
  DATABASE_URL: parsedTestUrl.toString(),
  NODE_ENV: "test",
  QUANTARA_TEST_DATABASE: "1",
};

const prismaCli = path.join(repoRoot, "node_modules", "prisma", "build", "index.js");
// Every invocation starts from the same disposable schema. This makes repeated
// local and CI runs deterministic and prevents one suite's records from leaking
// into a later run. assertTestDatabase above is the fail-closed safety gate.
await runNode(prismaCli, ["migrate", "reset", "--force", "--skip-seed"], testEnv);
await runNode(prismaCli, ["db", "seed"], testEnv);

const requestedArgs = process.argv.slice(2);
const watch = requestedArgs.includes("--watch");
const vitestArgs = watch
  ? ["--config", "vitest.config.ts", ...requestedArgs]
  : ["run", "--config", "vitest.config.ts", ...requestedArgs];
await runNode(path.join(repoRoot, "node_modules", "vitest", "vitest.mjs"), vitestArgs, testEnv);