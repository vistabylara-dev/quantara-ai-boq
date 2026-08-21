# Quantara AI BOQ

Quantara is a private, multi-tenant BOQ and quantity-workflow application for construction and related industries. It combines controlled drawing intake, professional review, quantity calculation, BOQ revisioning, catalogue/rate data, document and proposal workflows, and guarded commercial integrations.

This repository is under active development. A passing local build proves code integrity; it does not by itself prove a production deployment, provider configuration, payment readiness, or professional approval of any extracted quantity.

## Release contract

- Local development and CI pin Node.js `24.17.0` and npm `11.13.0`; the deploy-time engine contract accepts compatible Node `24.x` and npm `11.x` security releases.
- PostgreSQL is the system of record through Prisma.
- `npm ci` is the only supported dependency install for verification and CI.
- TypeScript and Next.js build errors are release blockers; the build does not ignore them.
- Tests reset and seed a dedicated database whose name must contain `test` or `ci`.
- Production proposal links require a private `PROPOSAL_ACCESS_SECRET` of at least 32 bytes.
- The private durable-worker drain endpoint requires a separate `WORKER_RUNNER_SECRET` of at least 32 bytes.
- Database migrations and seeds run through explicit commands, not public HTTP routes.
- The production deploy command runs `prisma migrate deploy` first and stops before publishing code if migration application fails.

## Architecture

- Next.js 15 App Router, React 18, and TypeScript
- PostgreSQL with Prisma repositories and tenant-scoped services
- Zod validation at server boundaries
- Database-backed sessions and server-enforced role checks
- Immutable BOQ revision snapshots and audit records
- Background extraction/catalogue job state with idempotency and recovery checks
- PostgreSQL-backed BOQ review runs with atomic leases, bounded retries, and an immutable execution journal
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

The repository sets `engine-strict=true`, so a mismatched major runtime fails instead of silently producing incompatible results. Hosting platforms may select newer compatible Node 24 and npm 11 minor or patch releases.

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

For a controlled production release, set the direct origin `DATABASE_URL` and run:

```powershell
npm run db:migrate:deploy
npm run deploy
```

`npm run deploy` repeats the idempotent `prisma migrate deploy` gate before building and publishing the Worker. It never seeds data. There is no application or browser endpoint for applying schema changes; a migration failure must be investigated and resolved by an operator before code deployment continues.

## Environment and secrets

`.env.example` documents the complete local contract. At minimum, configure:

- `DATABASE_URL`
- `APP_BASE_URL`
- `DEV_OWNER_EMAIL` and `DEV_OWNER_PASSWORD` before seeding anything non-throwaway
- `PROPOSAL_ACCESS_SECRET` with at least 32 private random bytes
- `WORKER_RUNNER_SECRET` with at least 32 private random bytes
- `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY` before connecting an external provider

Email defaults to a development adapter that logs rather than sends. Storage defaults to a private local adapter. Stripe, SMTP, Blob, Google Drive, OpenAI, and Arcade credentials are optional feature-specific secrets and must never be committed.

Production readiness fails closed when a required security secret is missing or weak. `/api/ready` validates the proposal-signing secret, durable-runner secret, and 32-byte integration-credential encryption key before reporting ready, without returning any value or secret name. Provider credentials and production database access belong in the hosting provider's secret store, not `.env` in Git.

## Durable BOQ review worker

`POST /api/boqs/{boqId}/worker/review` requires an authenticated actor with `verification:manage` and a caller-supplied `Idempotency-Key` header. It records a durable `REVIEW_EXISTING_BOQ` run and returns `202`; it does not depend on request-lifecycle background execution. `GET /api/worker/runs/{runId}` returns only the active company's run, immutable event journal, deterministic assignment link, and optional advisory plan.

A private scheduler or operator drains queued work through `POST /api/internal/worker/drain` with `Authorization: Bearer <WORKER_RUNNER_SECRET>`. The endpoint accepts at most five runs per request. Never place this secret in a browser, public scheduler payload, source file, or log.

The AI planner is disabled unless `WORKER_AI_PLANNER_ENABLED=true`. Enabling it also requires server-only `OPENAI_API_KEY` and `WORKER_AI_MODEL`. Its single structured call receives a bounded context with commercial numeric values removed, and its validated output is stored as immutable advice requiring human review. It cannot change BOQ quantities, rates, provenance, verification, approval, or revision evidence.

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
- Deterministic worker review remains authoritative; optional AI output is advisory coordination only and never grants professional or commercial approval.
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
