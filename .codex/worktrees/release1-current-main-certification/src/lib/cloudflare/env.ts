import { getCloudflareContext } from "@opennextjs/cloudflare";

// Extends the ambient `CloudflareEnv` interface (declared by both
// `@opennextjs/cloudflare` and the generated `cloudflare-env.d.ts`) with the
// Hyperdrive binding. This is a type-only augmentation — it does not require
// `wrangler.jsonc` to actually declare a `hyperdrive` binding yet, since the
// `Hyperdrive` runtime type ships as part of the generated workerd types
// regardless of whether any binding uses it.
declare global {
  interface CloudflareEnv {
    HYPERDRIVE?: Hyperdrive;
  }
}

/**
 * Synchronously resolves the Hyperdrive binding for the current request.
 *
 * `getCloudflareContext({ async: false })` only succeeds when a Cloudflare
 * context has already been placed on `globalThis` — which happens before
 * Next.js route code runs, both in the deployed Worker (set by the OpenNext
 * entrypoint) and in `next dev` (set by `initOpenNextCloudflareForDev`, see
 * next.config.mjs). Everywhere else — Vitest, `next build`, a plain Node.js
 * server (e.g. Railway) — no context exists and this throws, which is
 * caught here and normalized to `undefined` so callers can fall back to a
 * direct database connection without knowing which runtime they're in.
 */
export function getHyperdriveBinding(): Hyperdrive | undefined {
  try {
    const { env } = getCloudflareContext({ async: false });
    return env.HYPERDRIVE;
  } catch {
    return undefined;
  }
}

/** True when running inside a Cloudflare Worker (or its local dev simulation). */
export function isCloudflareRuntime(): boolean {
  try {
    getCloudflareContext({ async: false });
    return true;
  } catch {
    return false;
  }
}
