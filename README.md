# Quantara AI BOQ

Quantara AI BOQ is a multi-industry BOQ workspace. Backend Foundation Phase 1 connects the existing project and BOQ experience to a real PostgreSQL database while preserving the remaining demo modules for later migrations.

## Phase 1 architecture

- Next.js 14 App Router and TypeScript provide the UI and route handlers.
- Zod validates every API write at the server boundary.
- Repository modules in `src/lib/repositories` own database access and require a `companyId`.
- Prisma maps the domain to PostgreSQL and stores money and quantities as fixed-precision `Decimal` values.
- `src/lib/calculations/boq-calculator.ts` is the deterministic financial calculation service.
- `src/lib/verification/run-verification.ts` is the deterministic verification rule engine.
- A temporary `getDevelopmentCompanyId()` helper scopes all requests to the seeded development company until authentication is introduced.
- API responses use `{ "ok": true, "data": ... }` on success and structured `{ "ok": false, "error": ... }` responses on failure.

React components do not access Prisma. The connected flow is:

`Company -> Industry Engines -> Projects -> BOQs -> Sections -> Items -> Verification Exceptions -> Revisions`

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

Open `http://localhost:3000`. Check database connectivity at `http://localhost:3000/api/health`.

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

Never commit `.env` or production credentials.

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

## Data model

The Prisma schema contains `Company`, `IndustryEngine`, `CompanyIndustryEngine`, `Client`, `Project`, `BOQ`, `BOQSection`, `BOQItem`, `BOQItemOption`, `VerificationException`, `BOQRevisionSnapshot`, `RateCatalogueItem`, and `AuditLog`.

All tenant-owned records carry `companyId`. Project references and slugs are unique within a company. BOQ revisions are unique within a project. Locking writes an immutable JSON snapshot and audit record. Editing a BOQ invalidates its previous verification version, so only the current verified version can be locked.

## Backend-connected pages

- `/dashboard`
- `/projects`
- `/projects/[projectId]`
- `/projects/[projectId]/boq`
- `/projects/[projectId]/verification`

These pages use the Phase 1 API and include loading, error, and empty states. The seeded end-to-end route is `/projects/project-construction-001`.

## Pages and modules still local

The following are intentionally outside the first frontend migration and retain their existing demo/static behavior:

- `/projects/new`
- `/catalogue`
- `/industries` and `/industries/[industryId]`
- `/settings`
- `/templates`
- project document and client-preview modules
- the marketing/home demo content

Their LocalStorage adapters and Zustand stores remain in place. Do not remove them until each exact module has a tested database-backed replacement. In particular, `/projects/new` is still a local demo workflow and does not create a project in the Phase 1 database.

## Validation

Run the Phase 1 quality gates with PostgreSQL running:

```powershell
npm run lint
npm run build
npm test
```

The API surface includes health, company, industries, clients, projects, BOQs, sections, items, verification, revision/lock, and rate catalogue routes under `/api`.

## Known limitations

- Authentication and authorization are not implemented. Every request uses one temporary seeded development company.
- Tenant isolation is enforced in repository queries, but production identity and role policies belong to the next backend phase.
- The initial project-creation UI remains local as required by the five-page migration boundary.
- Catalogue, industry administration, settings, documents, and client preview are not yet migrated.
- Verification is deterministic and rule-based; no OCR or AI extraction is present.
- The development actor name is a placeholder until authenticated users exist.

## Next backend phase

The next phase should introduce authentication and company membership/roles, migrate the remaining LocalStorage modules one at a time, connect the project-creation UI, and add database-backed catalogue and industry administration. OCR, drawing intelligence, email, document export, payments, client signatures, and portal security remain explicitly out of Phase 1 scope.
