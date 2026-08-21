# Quantara AI BOQ

Quantara AI BOQ is a multi-industry BOQ workspace. Backend Foundation Phase 1 connected the core project/BOQ experience to real PostgreSQL; Phase 2 adds real email/password authentication, database-backed sessions, and role-based access control. Remaining demo modules (catalogue, industries admin, settings, documents, client preview, project creation) are still local and migrate in later phases.

## Architecture

- Next.js 14 App Router and TypeScript provide the UI and route handlers.
- Zod validates every API write at the server boundary.
- Repository modules in `src/lib/repositories` own database access and require a `companyId`.
- Prisma maps the domain to PostgreSQL and stores money and quantities as fixed-precision `Decimal` values.
- `src/lib/calculations/boq-calculator.ts` is the deterministic financial calculation service.
- `src/lib/verification/run-verification.ts` is the deterministic verification rule engine.
- `src/lib/auth/current-actor.ts` resolves the authenticated `{ userId, companyId, role }` from a hashed, database-backed session cookie — see [docs/authentication.md](docs/authentication.md). The old `getDevelopmentCompanyId()` bridge has been removed from every API route.
- `src/lib/auth/rbac.ts` enforces role-based capability checks on every mutating route — see the same doc.
- API responses use `{ "ok": true, "data": ... }` on success and structured `{ "ok": false, "error": ... }` responses on failure.

React components do not access Prisma. The connected flow is:

`Company -> Users -> Industry Engines -> Projects -> BOQs -> Sections -> Items -> Verification Exceptions -> Revisions`

## PostgreSQL with Docker

Requirements:

- Node.js 20 or later
- npm
- Docker Desktop with Docker Compose

Create a local environment file before starting. `.env.example` contains placeholders only. Replace both password placeholders with the same development password; `.env` is ignored by Git.

```powershell
Copy-Item .env.example .env
notepad .env
docker compose up -d
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

Open `http://localhost:3000` and go to `/register` to create a company, or sign in with the
seeded development owner (`DEV_OWNER_EMAIL` / `DEV_OWNER_PASSWORD` from `.env`). Check database
connectivity at `http://localhost:3000/api/health` (public, no auth required).

To stop PostgreSQL without deleting its named volume:

```powershell
docker compose stop
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `POSTGRES_DB` | Local Docker database name |
| `POSTGRES_USER` | Local Docker database user |
| `POSTGRES_PASSWORD` | Local Docker database password |
| `DATABASE_URL` | Prisma PostgreSQL connection string using the same values |
| `APP_BASE_URL` | Base URL used to build links inside dev-mode auth emails |
| `DEV_OWNER_EMAIL` | Seeded development company owner's login email |
| `DEV_OWNER_PASSWORD` | Seeded development company owner's login password |
| `DEV_OWNER_NAME` | Seeded development company owner's display name |

Never commit `.env` or production credentials. If `DEV_OWNER_EMAIL`/`DEV_OWNER_PASSWORD` are unset, the seed falls back to an insecure default and prints a warning — set both for anything beyond a throwaway local run.

## Database commands

```powershell
npm run db:generate
npm run db:migrate -- --name <migration-name>
npm run db:seed
npm run db:studio
npm run db:reset
```

`db:reset` deletes local database data and reseeds it. Use it only for disposable development data.

The seed is repeatable and creates:

- Quantara AI Development Workspace
- 10 industry engines
- 6 demo projects, including the stable `project-construction-001` route slug
- realistic BOQs, sections, items, options, catalogue rates, verification examples, and audit history

## Authentication

Real email/password authentication with hashed, database-backed sessions (no JWTs, no
LocalStorage tokens) and server-enforced role-based access control. Full detail, including why
JWTs were deliberately not used and exactly how tenant isolation is enforced, is in
[docs/authentication.md](docs/authentication.md) and [docs/multi-tenancy.md](docs/multi-tenancy.md).

Public routes: `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`,
`/api/health`, `/api/auth/*`. Every other page and API route requires a valid session.

## Data model

The Prisma schema contains `Company`, `User`, `Session`, `EmailVerificationToken`, `PasswordResetToken`, `IndustryEngine`, `CompanyIndustryEngine`, `Client`, `Project`, `BOQ`, `BOQSection`, `BOQItem`, `BOQItemOption`, `VerificationException`, `BOQRevisionSnapshot`, `RateCatalogueItem`, and `AuditLog`.

All tenant-owned records carry `companyId`. Project references and slugs are unique within a company. BOQ revisions are unique within a project. Locking writes an immutable JSON snapshot and audit record. Editing a BOQ invalidates its previous verification version, so only the current verified version can be locked. `AuditLog.userId` links each entry to the authenticated user who caused it (nullable, `SetNull` on user deletion — `actorName` remains as a point-in-time display label).

## Backend-connected pages

- `/dashboard`
- `/projects`, `/projects/new`, `/projects/[projectId]`
- `/projects/[projectId]/boq`
- `/projects/[projectId]/verification`
- `/clients`, `/clients/new`, `/clients/[clientId]`
- `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`

These pages use the real API and include loading, error, and empty states. The seeded end-to-end route is `/projects/project-construction-001`.

Creating a project (`/projects/new` or `POST /api/projects`) requires a real client — select an
existing one or create one inline without leaving the form — and an enabled industry engine. It
atomically creates the project, its default R01 BOQ, and the industry's default sections in one
database transaction (`src/lib/services/project-service.ts`): if section creation fails, the
project and BOQ roll back too, so there is never an orphan project without a BOQ. New companies
get every industry engine enabled at registration so this works immediately after sign-up.

## Pages and modules still local

The following are intentionally outside the frontend migration so far and retain their existing demo/static behavior:

- `/catalogue`
- `/industries` and `/industries/[industryId]`
- `/settings`
- `/templates`
- project document and client-preview modules
- the marketing/home demo content

Their LocalStorage adapters and Zustand stores remain in place. Do not remove them until each exact module has a tested database-backed replacement.

## Validation

Run the quality gates with PostgreSQL running:

```powershell
npm run lint
npm run build
npm test
```

`npm test` includes integration suites (`tests/auth-service.test.ts`,
`tests/client-project-service.test.ts`) that talk to the real local Postgres database — Docker
must be running for the full suite to pass.

The API surface includes auth, health, company, industries, clients, projects, BOQs, sections, items, verification, revision/lock, and rate catalogue routes under `/api`.

## Known limitations

- User management UI (invite, list, change role, deactivate) is not built — the data model and RBAC support it, but there is no `/settings/users` page or `/api/users` route yet.
- Rate limiting on `/api/auth/*` is not implemented.
- CSRF protection relies on `SameSite=Lax` cookies and same-origin fetches only; no dedicated CSRF token exists yet.
- Client duplicate-email detection is an application-level check, not a database constraint — a genuine race between two concurrent requests could still create two clients with the same email. Low risk at current scale; noted rather than fixed with a partial unique index.
- Catalogue, industry administration, settings, documents, and client preview are not yet migrated. A brand-new company gets every industry engine enabled at registration specifically so this gap doesn't block project creation, but engines can only be *disabled* once the industries admin page is migrated.
- Verification is deterministic and rule-based; no OCR or AI extraction is present.
- No SMTP integration yet — verification and password-reset links are logged to the server console in development mode only.

## Next backend phase

Phase 4 connects the rate catalogue and supplier pricing to BOQ items before document generation.
After that: `/catalogue`, `/settings`, and `/industries` admin migration to the database, a
user-management UI on top of the existing `User`/RBAC model, then file upload, structured
extraction, document generation, email delivery, and the client proposal portal. OCR, drawing
intelligence, payments, and legally qualified e-signatures remain explicitly out of scope for now.
