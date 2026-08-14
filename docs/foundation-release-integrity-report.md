# Foundation Release Integrity Report

Verified: 2026-08-14T01:36:37-04:00

Branch: `fix/foundation-release-integrity`

Parent commit: `3e9ae91e4e916d3cdecdf12e2644b61828c302fd`

## Verdict

The foundation branch is locally verified for pull-request review and merge. The release fixes
have not been deployed, and this report does not claim that the configured hosted Hyperdrive
resource or any production database has been provider-verified.

## Release fixes

- Prisma now uses its JavaScript engine and explicit PostgreSQL driver adapters in Node scripts,
  seeds, browser-test setup, and the Cloudflare runtime.
- Cloudflare requests create one-use Hyperdrive adapters instead of reusing request-bound I/O
  across requests. A Worker without Hyperdrive continues to fail closed.
- Every authenticated API handler that assigns an audit actor is initialized with an isolated
  `AsyncLocalStorage.run()` context. The audit covers 193 route files and 239 handlers, with no
  unwrapped handler remaining.
- The Cloudflare bundle aliases `@vercel/blob` to its fetch-only Undici shim. The guarded build
  fails if the dynamic-WASM llhttp parser reappears.
- Prisma's workerd Decimal implementation is supported without relying on the Node-only
  `Decimal#isFinite()` method.
- Preview, upload, and deploy commands all use the guarded Cloudflare build path.

## Verification evidence

| Gate | Result |
|---|---|
| Full test suite against reset and seeded PostgreSQL | PASS |
| ESLint with zero allowed warnings | PASS |
| Full TypeScript route generation and type check | PASS |
| Prisma schema validation | PASS |
| Next.js 15.5.22 production build | PASS |
| OpenNext Cloudflare 1.20.2 build | PASS |
| Prisma workerd package and external WASM checks | PASS |
| Undici llhttp dynamic-WASM absence check | PASS |
| Local Cloudflare health endpoint, five consecutive requests | 5/5 HTTP 200; database connected |
| Formerly failing signed-in BOQ list API | HTTP 200; one seeded revision returned |
| Browser journey: public page, login, dashboard, BOQ, Sources, Extraction, Validation, Output | PASS |
| Browser request failures, page errors, unexpected HTTP errors | None |
| Secure session attributes | HttpOnly, Secure, SameSite=Lax |
| Fresh preview crash-marker and HTTP 500 log scan | None |

The browser saw the expected `403` response from `/api/admin/simulation` for the seeded company
owner. This is the intended role boundary and was separated from unexpected failures.

## Recovery rehearsal

A new isolated database, `quantara_rollback_test_20260814_phase7`, received all 41 migrations and
the development seed. A compressed `pg_dump` backup was restored into the separate
`quantara_rollback_restore_test_20260814_phase7` database. The restored database retained the
unique sentinel value, all 41 completed migration records, and all eight Worker tables.

The rehearsal did not modify or replace the application's working database. Both explicitly
named rehearsal databases and the local dump were retained as recovery evidence rather than
deleted automatically.

## Non-blocking observations

- Prisma 6 warns that the legacy `package.json#prisma` configuration location will be removed in
  Prisma 7. This does not affect the current pinned Prisma 6.19.3 release.
- The PostgreSQL driver emits a pg 9 deprecation warning during some database-backed tests. The
  current dependency version passes the complete suite, but this should be handled as part of a
  future pg/Prisma upgrade.
- OpenNext warns that Windows is not its optimal build host. The actual generated Worker was
  nevertheless executed under local workerd and passed the signed-in runtime journey above.

## Release boundary

This evidence authorizes code review and merge only. Deployment remains a separate action that
requires fresh provider-state checks, production secrets, hosted Hyperdrive verification, and a
deliberate production database migration decision.
