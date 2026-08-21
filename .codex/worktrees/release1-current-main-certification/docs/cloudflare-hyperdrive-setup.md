# Cloudflare Hyperdrive setup

This document is the operational companion to `src/lib/db/prisma.ts` and
`src/lib/cloudflare/env.ts`. It covers what's already implemented in the
codebase versus what still requires a human with Cloudflare account access to
complete. **No secrets are included in this file.**

## 1. Prerequisites

- A Cloudflare account with Workers + Hyperdrive access (the same account
  the Worker is deployed to).
- `wrangler` authenticated against that account (`npx wrangler login`, or
  `CLOUDFLARE_API_TOKEN` set for non-interactive use).
- The origin PostgreSQL database's connection details (host, port, database
  name, username, password) — the *same* database `DATABASE_URL` already
  points Prisma migrations at.

## 2. Origin PostgreSQL requirements

Hyperdrive connects *to* your existing Postgres instance — it does not
replace it. The origin database must be:

- Reachable from the public internet (or via Cloudflare Access / a Workers
  VPC service binding, if it's private — see the `--access-client-id` /
  `--service-id` flags below).
- Running a Postgres version Hyperdrive supports (Postgres 10+; check
  [Cloudflare's current compatibility notes](https://developers.cloudflare.com/hyperdrive/reference/)
  before creating the resource, since this can change).

## 3. TLS requirements

If the origin requires TLS (most managed Postgres providers do), pass
`--sslmode` when creating the Hyperdrive config (see §5). Self-signed or
private CAs need a certificate uploaded to Cloudflare first
(`--ca-certificate-uuid`) — see `npx wrangler hyperdrive create --help` for
the exact current flags before assuming syntax.

## 4. Creating Hyperdrive — exact command (verified against the installed Wrangler version)

This project has `wrangler@4.118.0` installed. The verified command syntax
(run `npx wrangler hyperdrive create --help` yourself to reconfirm before
running, in case the installed version has changed) is:

```sh
npx wrangler hyperdrive create quantara-ai-boq-db \
  --connection-string="postgresql://USER:PASSWORD@HOST:PORT/DATABASE" \
  --update-config
```

- `quantara-ai-boq-db` — the Hyperdrive config's name (your choice; this is
  not a secret).
- `--connection-string` — the *origin* database's real connection string.
  **Never commit this value anywhere.** Pass it directly on the command
  line (or via an env var you don't commit) at creation time only —
  Hyperdrive stores it server-side, and your Worker only ever sees a
  short-lived proxy connection string via the binding at runtime, not this
  value.
- `--update-config` — has Wrangler automatically write the resulting
  `hyperdrive` binding block into `wrangler.jsonc` for you (see §7).
- Add `--sslmode=require` (or `verify-ca` / `verify-full`) if the origin
  requires TLS.

This command has **not** been run as part of this change — it requires
Cloudflare authentication and points at a real database, both of which need
explicit human approval first.

## 5. Obtaining the real Hyperdrive ID

`wrangler hyperdrive create` prints the new config's `id` on success. You
can also retrieve it later:

```sh
npx wrangler hyperdrive list
npx wrangler hyperdrive get <id>
```

## 6. Adding the HYPERDRIVE binding

If you used `--update-config` in §4, `wrangler.jsonc` already has this —
skip to §8. Otherwise, add it manually where `wrangler.jsonc` currently has
a comment block marking exactly this spot:

```jsonc
"hyperdrive": [
  {
    "binding": "HYPERDRIVE",
    "id": "<REAL_HYPERDRIVE_ID>"
  }
]
```

No application code changes are needed after this — `src/lib/db/prisma.ts`
and `src/lib/cloudflare/env.ts` already detect and use `env.HYPERDRIVE` the
moment the binding exists. Regenerate local types afterward:

```sh
npm run cf-typegen
```

## 7. Setting database-related secrets

`DATABASE_URL` (used by Prisma migrations/`prisma generate`/Prisma Studio,
and by the plain Node.js runtime — see §11) is **not** consumed by the
Worker at all; it never needs to become a Worker secret. The only
credential the Worker touches is what Hyperdrive hands it via the binding,
which Cloudflare manages — there is nothing to `wrangler secret put` for
the database connection itself.

If other secrets (SMTP credentials, etc.) are later needed by the Worker,
use:

```sh
npx wrangler secret put SECRET_NAME
```

Never put secret values in `wrangler.jsonc` — that file is committed.

## 8. Deploying the Worker

```sh
npm run deploy
```

(runs `opennextjs-cloudflare build && opennextjs-cloudflare deploy`). This
has intentionally **not** been run as part of this change — deployment
requires explicit approval per the project's standing rules.

## 9. Testing `/api/health`

```sh
curl https://<your-worker-url>/api/health
```

Expect `{"ok":true,"data":{"status":"ok","database":"connected","runtime":"cloudflare-worker","connectionMethod":"hyperdrive", ...}}`.
If you instead see a 503 with `DATABASE_UNAVAILABLE`, check the Worker's
tail logs (`npx wrangler tail`) for the specific reason — the server-side
log line is always more specific than the public response body (which
deliberately never includes connection details). See §13.

## 10. Testing `/api/ready`

```sh
curl https://<your-worker-url>/api/ready
```

Same pass/fail semantics as `/api/health`, but a lighter query — intended
for frequent orchestrator/load-balancer polling rather than diagnostics.

## 11. Why Prisma migrations still use direct `DATABASE_URL`

Hyperdrive is a connection *proxy* for query traffic from the Worker at
request time — it is not a migration runner and Cloudflare does not
recommend running schema migrations through it. `prisma migrate`, `prisma
generate`, `prisma studio`, and this project's `db:*` npm scripts all
continue to connect directly to the origin Postgres via `DATABASE_URL`,
exactly as before Hyperdrive was introduced. Only the Worker's *request-time
application queries* go through Hyperdrive. Do not attempt to point
`DATABASE_URL` at a Hyperdrive connection string for migration purposes.

## 12. Rollback

Hyperdrive is additive — removing the `hyperdrive` block from
`wrangler.jsonc` and redeploying reverts the Worker to attempting the
Node.js direct-connection path. **Note:** as of this change, that direct
path intentionally throws `HyperdriveNotConfiguredError` when running
inside a Cloudflare Worker (see §13) rather than silently attempting a
binary-engine connection that cannot work there — so removing the binding
does not restore database connectivity in the Worker, it only removes the
Hyperdrive dependency. To fully roll back Cloudflare database connectivity,
revert to serving traffic from the existing Node.js host (Railway) instead.

## 13. Troubleshooting `DATABASE_UNAVAILABLE`

The public API response is deliberately generic (`503`,
`{"error":{"code":"DATABASE_UNAVAILABLE"}}`) so it never leaks connection
strings, hostnames, or credentials. Always check the Worker's own logs
(`npx wrangler tail`, or the Cloudflare dashboard's Logs tab) for the real
cause, logged server-side only:

- **`Running inside a Cloudflare Worker but no HYPERDRIVE binding is
  configured...`** — exactly what it says: complete §4–§6.
- **`Prisma Client could not locate the Query Engine for runtime
  "debian-openssl-1.1.x"`** — this means the Worker attempted the
  binary-engine fallback anyway; if you see this *after* configuring
  Hyperdrive, it means `getHyperdriveBinding()` didn't detect the binding
  (check the binding name is exactly `HYPERDRIVE`, redeploy after editing
  `wrangler.jsonc`, and confirm `npx wrangler hyperdrive get <id>` shows an
  active config).
- **A raw Postgres connection error** (timeout, auth failure, etc.) with
  `connectionMethod: "hyperdrive"` already reported — this means Hyperdrive
  itself can't reach the *origin* database. Check the origin database is
  reachable from the internet (or that the Access/VPC configuration used at
  creation time in §4 is still valid), and that its credentials haven't
  rotated since the Hyperdrive config was created.
