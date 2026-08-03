# Quantara AI BOQ — Project Instructions for Claude Code

## What this project is
Next.js 14 (App Router) + TypeScript + Prisma/PostgreSQL. Multi-tenant BOQ (Bill of Quantities)
workspace. Auth is real email/password with hashed, DB-backed sessions (no JWT, no LocalStorage
tokens). RBAC enforced server-side on every mutating route.

## Current state — READ BEFORE TOUCHING DEPLOYMENT
This repo has **no deployment configuration**. There is no `Dockerfile` for the app, no
`vercel.json`, `render.yaml`, `railway.json`, `netlify.toml`, `fly.toml`, `Procfile`, or
`.github/workflows`. The only documented workflow in `README.md` is **local development**:
`docker compose up` for Postgres + `npm run dev`.

Do NOT attempt to "deploy" this app by guessing at hosting config. There is no live database
provisioned anywhere. Before any deploy task can succeed, a human must:
1. Create a hosting account (Vercel recommended for Next.js App Router).
2. Provision a managed Postgres instance (Vercel Postgres, Neon, or Supabase) and obtain its
   connection string.
3. Set that connection string as `DATABASE_URL` in the host's environment variables — NOT the
   local Docker one from `.env`/`.env.example`.

If asked to "deploy" and the human hasn't provided a production `DATABASE_URL` and confirmed a
target host, stop and ask for those two things instead of guessing or retrying blindly.

## Environment variables
Documented in `.env.example` (local Docker dev only): `POSTGRES_DB`, `POSTGRES_USER`,
`POSTGRES_PASSWORD`, `DATABASE_URL`, `APP_BASE_URL`, `DEV_OWNER_EMAIL`, `DEV_OWNER_PASSWORD`,
`DEV_OWNER_NAME`.

Referenced in code but NOT in `.env.example` (add to production host config):
- `PROPOSAL_ACCESS_SECRET` — falls back to the hardcoded string
  `"dev-only-proposal-access-secret-not-for-production"` if unset
  (`src/lib/proposals/access-cookie.ts`). **This must be set to a real random secret before any
  production deploy.** Never leave it on the fallback.
- `EMAIL_PROVIDER` — set to `"smtp"` to use real email; anything else uses the
  development provider that logs links to the console instead of sending mail.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`,
  `SMTP_FROM_NAME` — only required if `EMAIL_PROVIDER=smtp`.

## Database / Prisma
- Schema: `prisma/schema.prisma`, PostgreSQL only.
- Local dev migrations: `npm run db:migrate` (wraps `prisma migrate dev`) — dev only, do not run
  against a production database.
- Production migrations: run `npx prisma migrate deploy` against the production `DATABASE_URL`.
  Never use `migrate dev` or `db:reset` against production — `db:reset` deletes all data.
- `@prisma/client`'s own postinstall runs `prisma generate` automatically on `npm install` — there
  is no separate `postinstall` script in `package.json`, and none is needed. If a build fails with
  missing Prisma types (e.g. `ProjectStatus` not exported from `@prisma/client`), the fix is
  re-running `prisma generate`, not adding scripts.

## Build / validation commands
```
npm install
npm run lint
npm run build
npm test          # runs vitest; tests/auth-service.test.ts and
                   # tests/client-project-service.test.ts hit a real local Postgres —
                   # Docker must be running for the full suite to pass
```

## Architecture rules (do not violate)
- React components never access Prisma directly. All DB access goes through
  `src/lib/repositories/*`, which require `companyId` on every call (multi-tenant isolation).
- Every mutating API route must call `src/lib/auth/rbac.ts` checks. Do not add a write route
  without an RBAC check.
- API responses use `{ "ok": true, "data": ... }` on success and `{ "ok": false, "error": ... }`
  on failure — keep this shape consistent on any new route.
- Money and quantities are `Decimal` in Prisma — never switch these to `number`/`float`.
- `pdfkit`, `pdf-parse`, and `pdfjs-dist` are deliberately excluded from webpack bundling in
  `next.config.mjs` (`serverComponentsExternalPackages`) because bundling breaks their runtime
  file/font access. Do not remove that exclusion without re-testing PDF generation end to end.

## Known local-only / not-yet-migrated modules
`/catalogue`, `/industries` (and `/industries/[industryId]`), `/settings`, `/templates`, document
generation, and client-preview pages still run on LocalStorage/Zustand demo data, not the database.
Do not "fix" these by wiring them to Prisma unless explicitly asked — they're intentionally staged
for a later phase per `README.md`.

## When something fails
1. Read the actual error message/stack before changing code — don't guess-and-retry.
2. If it's a missing env var, check the two env var lists above before assuming it's a code bug.
3. If it's a deploy/build failure, check for the presence of deploy config first (see "Current
   state" above) before touching application code.
4. If truly blocked on something requiring credentials, hosting access, or an account only the
   human has, say so explicitly and ask, rather than repeating the same failed attempt.
