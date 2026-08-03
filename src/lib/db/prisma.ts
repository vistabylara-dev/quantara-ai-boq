import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { getHyperdriveBinding, isCloudflareRuntime } from "@/lib/cloudflare/env";

type ConnectionMethod = "direct" | "hyperdrive";

/**
 * Thrown when running inside a Cloudflare Worker with no `HYPERDRIVE`
 * binding configured. Verified empirically (via `wrangler dev` against the
 * actual OpenNext build): the standard Prisma Client's binary query engine
 * cannot load inside the Workers V8 isolate at all — attempting the
 * Node.js "direct" fallback there fails with a low-level, confusing
 * "could not locate the Query Engine for runtime ..." error instead of an
 * actionable one. Unlike Node.js, there is no safe direct-connection
 * fallback in a Worker, so this is raised explicitly instead.
 */
export class HyperdriveNotConfiguredError extends Error {
  constructor() {
    super(
      "Running inside a Cloudflare Worker but no HYPERDRIVE binding is configured. " +
        "The Prisma binary query engine cannot run in the Workers runtime, so there is " +
        "no direct-connection fallback here. Add a hyperdrive binding to wrangler.jsonc " +
        "— see docs/cloudflare-hyperdrive-setup.md.",
    );
    this.name = "HyperdriveNotConfiguredError";
  }
}

const globalForPrisma = globalThis as unknown as {
  quantaraPrisma: PrismaClient | undefined;
  quantaraPrismaConnectionMethod: ConnectionMethod | undefined;
};

const logLevels = (process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]) as Array<
  "warn" | "error"
>;

/**
 * With `engineType = "client"` in schema.prisma, the generated client uses
 * Prisma's WASM query compiler instead of a native/binary query engine —
 * required because the native engine cannot load inside the Cloudflare
 * Workers V8 isolate. Confirmed empirically: in this mode `new
 * PrismaClient()` throws immediately without an adapter ("Missing
 * configured driver adapter. Engine type `client` requires an active
 * driver adapter."), so the Node/local path needs one too, not just the
 * Cloudflare path — there is no more engine-only fallback anywhere.
 */
function createDirectClient(): PrismaClient {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter, log: logLevels });
}

/**
 * Hyperdrive already pools connections to the origin Postgres centrally, so
 * each Worker isolate only needs a small local pool to borrow connections
 * from it. Workers can scale to many concurrent isolates, so a large
 * per-isolate `max` here would multiply against isolate count and exhaust
 * Hyperdrive's own connection budget rather than protect it.
 */
function createHyperdriveClient(connectionString: string): PrismaClient {
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter, log: logLevels });
}

let cachedClient: PrismaClient | undefined;
let cachedConnectionMethod: ConnectionMethod | undefined;

function resolveClient(): PrismaClient {
  if (cachedClient) return cachedClient;

  // Outside production (i.e. `next dev`), Next.js Fast Refresh re-evaluates
  // this module on every edit; stash the client on `globalThis` so hot
  // reload reuses the existing connection instead of opening a new one on
  // every save. `next build` statically replaces `NODE_ENV` with the
  // literal `"production"`, so this branch never runs in the built Worker —
  // there, the module-scope `cachedClient` alone is correct, because a
  // Worker isolate loads this module once and reuses it for every request
  // it handles for the rest of its lifetime.
  if (process.env.NODE_ENV !== "production" && globalForPrisma.quantaraPrisma) {
    cachedClient = globalForPrisma.quantaraPrisma;
    cachedConnectionMethod = globalForPrisma.quantaraPrismaConnectionMethod ?? "direct";
    return cachedClient;
  }

  // Resolved lazily (on first real use) rather than at module load: in a
  // Cloudflare Worker, bindings like Hyperdrive only become available once
  // a request is being handled, not during cold-start module evaluation.
  const hyperdrive = getHyperdriveBinding();
  if (hyperdrive) {
    cachedClient = createHyperdriveClient(hyperdrive.connectionString);
    cachedConnectionMethod = "hyperdrive";
  } else if (isCloudflareRuntime()) {
    throw new HyperdriveNotConfiguredError();
  } else {
    cachedClient = createDirectClient();
    cachedConnectionMethod = "direct";
  }

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.quantaraPrisma = cachedClient;
    globalForPrisma.quantaraPrismaConnectionMethod = cachedConnectionMethod;
  }

  return cachedClient;
}

/**
 * The canonical Prisma client used by every repository and service.
 *
 * This is a lazy Proxy rather than a plain `new PrismaClient()` so that the
 * runtime (direct DATABASE_URL vs. Cloudflare Hyperdrive) can be detected on
 * first use instead of at import time — repositories keep importing and
 * calling `prisma` exactly as before and never need to know which runtime
 * resolved underneath it.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = resolveClient();
    const value = Reflect.get(client as object, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/**
 * Which path the canonical client resolved to. Used only for safe,
 * non-sensitive reporting (e.g. the health endpoint) — never exposes the
 * connection string, host, or credentials. Returns "unresolved" if nothing
 * has queried `prisma` yet in this process/isolate.
 */
export function getPrismaConnectionMethod(): ConnectionMethod | "unresolved" {
  return cachedConnectionMethod ?? "unresolved";
}

export default prisma;
