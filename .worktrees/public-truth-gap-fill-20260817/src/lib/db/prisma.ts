import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { getHyperdriveBinding, isCloudflareRuntime } from "@/lib/cloudflare/env";

type ConnectionMethod = "direct" | "hyperdrive";

/**
 * Thrown when running inside a Cloudflare Worker with no `HYPERDRIVE`
 * binding configured. The generated client uses Prisma's JavaScript engine
 * and the pg driver adapter, but production Worker connections are still
 * required to go through the explicitly configured Hyperdrive binding.
 * Unlike local Node.js development, there is no authorized direct-origin
 * fallback in the Worker, so this is raised explicitly instead.
 */
export class HyperdriveNotConfiguredError extends Error {
  constructor() {
    super(
      "Running inside a Cloudflare Worker but no HYPERDRIVE binding is configured. " +
        "Direct-origin database fallback is disabled in the Workers runtime. " +
        "Add a Hyperdrive binding to wrangler.jsonc " +
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
 * TEMPORARY, remove once the MASTER-BOQ-1A migration
 * (`20260804000801_master_boq_1a_hierarchy_foundation`) is confirmed applied
 * to production. That migration ships in the same deploy as this file but,
 * unlike `prisma generate` (which Vercel's build runs automatically), it is
 * NOT applied automatically — it requires a human to run `prisma migrate
 * deploy` with the production `DATABASE_URL`, on its own timeline. Until
 * then, the generated Prisma Client's default field selection includes
 * columns (MasterItem.hierarchyNodeId/replacementItemId,
 * TechnicalFieldDefinition.unitFamily/allowedUnitsJson/isActive/
 * applicableHierarchyNodeId, BOQItem.sourceMasterItemVersionId/
 * masterItemSnapshotJson) that don't exist yet in the production database,
 * so *every* unscoped query against these very hot, pre-existing tables
 * (BOQ item lists, master-item search, item detail, document generation)
 * fails with "column ... does not exist" — not just the new MASTER-BOQ-1A
 * code paths. `VERCEL_ENV` is only ever "production" in the actual
 * production runtime (never local dev, never `vitest`), so this never
 * masks the columns in the environment where the migration has already run.
 */
const PENDING_MASTER_BOQ_1A_OMIT =
  process.env.VERCEL_ENV === "production"
    ? {
        masterItem: { hierarchyNodeId: true, replacementItemId: true } as const,
        technicalFieldDefinition: {
          unitFamily: true,
          allowedUnitsJson: true,
          isActive: true,
          applicableHierarchyNodeId: true,
        } as const,
        bOQItem: { sourceMasterItemVersionId: true, masterItemSnapshotJson: true } as const,
      }
    : undefined;

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
  // Prisma rejects an explicit `omit: undefined` key outright ("omit"
  // option is expected to be an object) — the key must be absent entirely
  // outside production, not just falsy.
  return new PrismaClient({ adapter, log: logLevels, ...(PENDING_MASTER_BOQ_1A_OMIT ? { omit: PENDING_MASTER_BOQ_1A_OMIT } : {}) });
}

/**
 * Hyperdrive already pools connections to the origin Postgres centrally.
 * OpenNext requests must not share a pg Pool across request boundaries, so
 * the Worker path creates a fresh adapter for each top-level Prisma operation
 * and retires each borrowed connection after one use. The Node/local path
 * below remains cached because it runs in a normal long-lived process.
 */
function createHyperdriveClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({
    connectionString,
    max: 1,
    maxUses: 1,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return new PrismaClient({ adapter, log: logLevels, ...(PENDING_MASTER_BOQ_1A_OMIT ? { omit: PENDING_MASTER_BOQ_1A_OMIT } : {}) });
}

let cachedClient: PrismaClient | undefined;
let cachedConnectionMethod: ConnectionMethod | undefined;

function resolveClient(): PrismaClient {
  // A Worker may reuse its module scope for many requests, but pg sockets and
  // pools are request-scoped resources in workerd. Never put the Hyperdrive
  // client into `cachedClient`; doing so makes the first request succeed and a
  // later request hang when it tries to reuse the earlier request's I/O state.
  const hyperdrive = getHyperdriveBinding();
  if (hyperdrive) {
    cachedConnectionMethod = "hyperdrive";
    return createHyperdriveClient(hyperdrive.connectionString);
  }

  if (isCloudflareRuntime()) {
    throw new HyperdriveNotConfiguredError();
  }

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
  cachedClient = createDirectClient();
  cachedConnectionMethod = "direct";

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
