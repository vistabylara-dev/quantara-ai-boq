// default open-next.config.ts file created by @opennextjs/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
// import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// Loaded by the OpenNext CLI before it starts `next build`. This build-only
// marker lets next.config.mjs replace Node native PDF canvas bindings with a
// workerd-safe shim without changing the Vercel/Node production bundle.
process.env.QUANTARA_CLOUDFLARE_BUILD = "1";

export default defineCloudflareConfig({
	// For best results consider enabling R2 caching
	// See https://opennext.js.org/cloudflare/caching for more details
	// incrementalCache: r2IncrementalCache
});
