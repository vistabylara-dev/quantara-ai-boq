# Quantara AI BOQ

Quantara is a private, multi-tenant BOQ and quantity-workflow application for construction and related industries. It combines controlled drawing intake, professional review, quantity calculation, BOQ revisioning, catalogue/rate data, document and proposal workflows, and guarded commercial integrations.

This repository is under active development. A passing local build proves code integrity; it does not by itself prove a production deployment, provider configuration, payment readiness, or professional approval of any extracted quantity.

## Release contract

- Node.js `24.17.0` and npm `11.13.0` are pinned in `.nvmrc`, `package.json`, and the lockfile.
- PostgreSQL is the system of record through Prisma.
- `npm ci` is the only supported dependency install for verification and CI.
- TypeScript and Next.js build errors are release blockers; the build does not ignore them.
- Tests reset and seed a dedicated database whose name must contain `test` or `ci`.
- Production proposal links require a private `PROPOSAL_ACCESS_SECRET` of at least 32 bytes.
- Database migrations and seeds run through explicit commands, not public HTTP routes.

## Architecture

- Next.js 15 App Router, React 18, and TypeScript
- PostgreSQL with Prisma repositories and tenant-scoped services
- Zod validation at server boundaries
- Database-backed sessions and server-enforced role checks
- Immutable BOQ revision snapshots and audit records
- Background extraction/catalogue job state with idempotency and recovery checks
- PDF, DOCX, XLSX, and CSV document workflows where supported by the relevant feature
- OpenNext build target for Cloudflare

The central ownership path is:

`Company -> Users -> Clients -> Projects -> BOQs -> Sections -> Items -> Verification -> Revisions`

React components do not access Prisma directly. API success responses use `{ "ok": true, "data": ... }`; failures use structured `{ "ok": false, "error": ... }` responses.

## Requirements

- Node.js `24.17.0`
- npm `11.13.0`
- PostgreSQL 16 or newer (local PostgreSQL or the included Docker Compose service)

Confirm the pinned tools before installing:

```powershell
node --version
npm --version
npm ci
```

The repository sets `engine-strict=true`, so a mismatched runtime fails instead of silently producing different results.

## Local setup

1. Copy `.env.example` to `.env` and replace the placeholders.
2. Start PostgreSQL.
3. Apply the committed migrations and seed development data.
4. Start the application.

```powershell
Copy-Item .env.example .env
docker compose up -d
npm ci
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. The public health endpoints are `/api/health` and `/api/ready`.

For local schema development, create a migration with:

```powershell
npm run db:migrate -- --name <migration-name>
```

Never run `db:reset` against retained data. It destroys and recreates the selected database.

## Environment and secrets

`.env.example` documents the complete local contract. At minimum, configure:

- `DATABASE_URL`
- `APP_BASE_URL`
- `DEV_OWNER_EMAIL` and `DEV_OWNER_PASSWORD` before seeding anything non-throwaway
- `PROPOSAL_ACCESS_SECRET` with at least 32 private random bytes
- `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY` before connecting an external provider

Email defaults to a development adapter that logs rather than sends. Storage defaults to a private local adapter. Stripe, SMTP, Blob, Google Drive, OpenAI, and Arcade credentials are optional feature-specific secrets and must never be committed.

Production startup must fail closed when a required security secret is missing or weak. Provider credentials and production database access belong in the hosting provider's secret store, not `.env` in Git.

## Quality gates

Use a disposable PostgreSQL database whose name contains `test` or `ci`:

```powershell
$env:TEST_DATABASE_URL = "postgresql://quantara:password@localhost:5432/quantara_ai_boq_test?schema=public"
npm run db:validate
npm run lint
npm run typecheck
npm test
npm run build
npm run build:cloudflare
```

`npm test` is intentionally destructive only to `TEST_DATABASE_URL`: it verifies the database name, creates a missing local test database when needed, runs all committed migrations, seeds it, and then executes Vitest. If `TEST_DATABASE_URL` is omitted, the runner derives a separate `_test` database from `DATABASE_URL`; if both are omitted it uses the documented local test default. Never point it at production or any database containing retained data.

CI repeats the same gates with PostgreSQL 16 and the pinned Node/npm versions.

## Authentication and tenant safety

Authentication uses hashed passwords, hashed database-backed session tokens, active-account and email-verification gates, and server-side role enforcement. Tenant-owned records carry `companyId`, and repository/service boundaries must derive authority from the current actor rather than client-supplied tenant IDs.

See [authentication](docs/authentication.md) and [multi-tenancy](docs/multi-tenancy.md) for the detailed contracts.

## Operational boundaries

- Drawing extraction creates evidence and review candidates; it does not grant professional approval.
- Confirming or correcting an extracted entity is separate from importing it into a BOQ.
- BOQ verification and locking use explicit state transitions and immutable revision evidence.
- Stripe checkout, synchronization, and webhooks remain configuration-gated. Local tests use mocked provider calls and do not prove a live account is ready.
- Autodesk/AutoCAD support is limited to the explicitly declared beta metadata path; unattended native geometry extraction is not represented as available.
- Deployments, live provider writes, owner provisioning, and production migrations are deliberate operator actions and are not performed by CI.

## Administrative commands

```powershell
npm run admin:bootstrap-owner
npm run admin:provision-owner
```

These commands change privileged identity state. Run them only for an already verified target account and never from build or deploy hooks.

## Release status

The canonical release-integrity workflow is `.github/workflows/ci.yml`. A release candidate is locally verified only after clean install, Prisma validation, lint, type checking, the full database-backed test suite, the Next.js build, and the Cloudflare adapter build all pass from the same checkout. Deployment and provider verification are separate evidence states.
