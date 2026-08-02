# Current-State Audit

Date: 2026-08-02
Scope: full repository inspection performed before any new implementation work, per the SaaS-core execution plan.

## Correction to the assumed starting state

The build brief that triggered this audit assumed the app was still LocalStorage-only with no backend. That is not the actual state of this repository. A prior, uncommitted session ("Backend Foundation Phase 1", see `README.md`) already connected five pages to a real PostgreSQL database via Prisma. **Nothing in this repo is committed to git yet** — `git log` shows zero commits; everything is untracked. Treat this audit as the true baseline, not the brief's assumption.

## Working functions (verified this session)

- `npm run lint` — passes, zero warnings.
- `npm run build` — passes (`next build`, 14 routes + API handlers compile and type-check).
- `npm test` (vitest) — 6 files / 15 tests, all passing after a fix (see "Defect fixed" below).
- PostgreSQL is running locally via `docker-compose.yml` (`quantara-ai-boq-postgres`, healthy) and `npx prisma migrate status` reports the schema up to date (2 migrations applied).
- Database-backed pages (real Prisma reads/writes, loading/error/empty states): `/dashboard`, `/projects`, `/projects/[projectId]`, `/projects/[projectId]/boq`, `/projects/[projectId]/verification`.
- API routes under `/api` for health, company, industries, clients, projects, project→BOQs, BOQ (get/sections/lock/recalculate/revisions/verification), sections→items, items (edit/duplicate), catalogue, verification-exception resolve.
- Repository layer (`src/lib/repositories/*`) — every query goes through `getDevelopmentCompanyId()` and repository functions take `companyId` explicitly (spot-checked `boq-repository.ts`). This is the *pattern* the real multi-tenant model will reuse; there's just one hardcoded tenant today.
- Deterministic financial engine (`src/lib/calculations/boq-calculator.ts`): landed cost, markup, gross-margin, row totals, subtotal/discount/tax/grand total, all on `Prisma.Decimal`, with precision-overflow and negative-value guards matching the DB column precisions. Fully unit-tested.
- Deterministic verification engine (`src/lib/verification/run-verification.ts`) with its own repository and tests.
- Revision numbering (`src/lib/revisions/revision-number.ts`) and BOQ lock/edit guards (`src/lib/domain/boq-guards.ts`), tested.
- Structured API error envelope (`src/lib/http/api-response.ts`) already matches the `{ ok, data }` / `{ ok: false, error: { code, message, fieldErrors } }` shape, with Prisma error normalization (unique constraint, FK constraint, not-found, concurrent-write conflict, DB unavailable).
- Theme system (`src/lib/theme.ts` + `src/components/settings/theme-selector.tsx`): light/dark/system modes, persisted to `localStorage` under `quantara-theme-mode`, applied via `data-theme` on `<html>`, with CSS rules in `globals.css`. Wired into `/settings`.
- All 10 required industry engine configs exist and are indexed (`src/config/industries/*` + `index.ts`): construction, interior-fitout, furniture, mep, electrical, hvac, plumbing, firefighting, joinery, landscaping.
- Seed script (`prisma/seed.ts`) creates the dev company, 10 industry engines, 6 demo projects including the stable `project-construction-001` slug, plus BOQs/sections/items/catalogue/verification/audit history (per README; not re-verified row-by-row this session).

## Defect fixed this session

`tests/boq-calculator.test.ts` had one failing assertion: it expected `calculateBOQItem({ unitCost: "99999999999999.9999", quantity: "100", ... })` to throw a precision-overflow error. It doesn't, and shouldn't — `totalAmount` is `Decimal(20,4)` (16 integer digits) while `landedCost`/`sellingRate` are `Decimal(18,4)` (14 integer digits), so multiplying a boundary landed cost by quantity 100 lands just *under* the totalAmount ceiling, not over it. The calculation engine was correct; the test's overflow expectation was miscalibrated. Fixed by raising the test's quantity to `1000`, which genuinely overflows. All 15 tests now pass.

## Demo-only / not-yet-migrated (still LocalStorage + Zustand, per README's own documented boundary)

- `/projects/new` — local demo workflow; does **not** create a project in the real database yet.
- `/catalogue`, `/industries`, `/industries/[industryId]`, `/settings`, `/templates`
- `/projects/[projectId]/documents`, `/projects/[projectId]/client-preview`
- `src/store/*` (Zustand), `src/data/demo-*.ts`, `src/lib/storage/local-storage-adapter.ts` + `storage-adapter.ts` interface — these back the pages above and are intentionally left alone until each has a tested DB-backed replacement.

## Missing entirely (required by the execution plan, not started)

- **Authentication/sessions**: no `src/lib/auth/`, no `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password` routes, no `User`, `Session`, `EmailVerificationToken`, `PasswordResetToken` Prisma models. Every request is scoped to one hardcoded `DEVELOPMENT_COMPANY_ID` via `getDevelopmentCompanyId()` — explicitly marked in the source as a temporary bridge.
- **RBAC**: no roles, no permission helpers. `UserRole` enum doesn't exist yet.
- **Service layer**: `src/lib/services/` doesn't exist — business logic currently lives directly in API route handlers calling repositories. The execution plan wants a service layer between routes and repositories.
- **Prisma models not yet created**: `User`, `EmailVerificationToken`, `PasswordResetToken`, `Session`, `CompanyIndustryEngine` settings JSON, `ProjectFile`, `Supplier`, `DocumentTemplate`, `GeneratedDocument`, `ClientProposal`, `ClientProposalEvent`, `EmailTemplate`, `EmailDispatch`. Current schema has `Company`, `IndustryEngine`, `CompanyIndustryEngine` (partial), `Client`, `Project`, `BOQ`, `BOQSection`, `BOQItem`, `BOQItemOption`, `VerificationException`, `BOQRevisionSnapshot`, `RateCatalogueItem`, `AuditLog` — a solid subset, missing everything client/auth/document/email-facing.
- **File upload foundation**: no upload routes, no storage adapter for server-side object storage (the two `storage-adapter.ts`/`local-storage-adapter.ts` files that exist are the *client-side LocalStorage* data adapter for demo pages, not a file/blob storage abstraction).
- **Table/schedule extraction MVP**: not started.
- **Document generation** (PDF/DOCX/XLSX/CSV): not started; `/projects/[projectId]/documents` is still the static demo page.
- **Email templates/delivery**: not started.
- **Client proposal portal** (`/proposal/[token]`): not started.
- **Dashboard real metrics**: `/dashboard` is DB-connected but should be re-checked once auth/company-per-user exists (right now it reflects the single dev company only).
- **Reset Demo Data (dev-only)**: not implemented as a UI action.
- **Rate limiting, CSRF-conscious mutation design**: not implemented (no auth yet, so nothing to rate-limit).
- **`docs/` set**: only this audit file exists so far; `architecture.md`, `database-model.md`, `authentication.md`, `multi-tenancy.md`, `boq-calculation-rules.md`, `verification-rules.md`, `document-generation.md`, `client-proposal-flow.md`, `security-model.md`, `ai-roadmap.md` are all outstanding.
- **`.gitignore`/commits**: repo has never been committed. Nothing has been pushed or lost — this is just a fact worth flagging since "no commits yet" means there is no rollback point.

## Existing data contracts (source of truth today)

- Prisma schema: `prisma/schema.prisma` (see enums `ProjectStatus`, `BOQStatus`, `BOQItemStatus`, `MarginMode`, `VerificationSeverity`, `RateStatus`).
- Frontend/demo types (separate from Prisma, used by the not-yet-migrated pages): `src/types/{boq,catalogue,dashboard,document,industry,project,verification}.ts`.
- API validation: `src/lib/validation/{backend-schemas,boq-route-schemas,boq-schema,project-schema,route-params}.ts` (Zod).

## Route map (actual, verified via `next build` output)

Static/DB-connected pages: `/`, `/dashboard`, `/catalogue`, `/industries`, `/industries/[industryId]`, `/projects`, `/projects/[projectId]`, `/projects/[projectId]/boq`, `/projects/[projectId]/client-preview`, `/projects/[projectId]/documents`, `/projects/[projectId]/verification`, `/projects/new`, `/settings`, `/templates`.

API routes: listed under "Working functions" above — 23 route files, all compiling.

No `/login`, `/register`, `/proposal/[token]`, or `/settings/appearance`, `/settings/users` sub-routes exist yet (settings is a single page today, not split).

## Current risks

1. **Single hardcoded tenant.** Every DB query resolves to one `DEVELOPMENT_COMPANY_ID`. This is fine for continued local development but must not be mistaken for real multi-tenancy — there is no user/session/company-membership concept yet to enforce it.
2. **No authentication.** Nothing prevents any client from calling any API route. This is acceptable only because the app isn't deployed anywhere reachable.
3. **Uncommitted work.** The entire repository — including the completed Phase 1 backend work — has zero git commits. A filesystem accident would lose everything. (Not fixing this without asking, since committing wasn't requested, but flagging it as a real risk.)
4. **Two different "storage adapter" concepts share similar names** (`src/lib/storage/storage-adapter.ts` = client LocalStorage interface for demo pages; a server-side file/blob storage abstraction per the plan's Section 19 doesn't exist yet). Future work must not conflate them.
5. **Prisma deprecation warning**: `package.json#prisma.seed` config is deprecated in favor of `prisma.config.ts` (Prisma 7 will remove it). Not urgent, but will need migrating eventually.

## Migration order (recommended, matches the execution plan's own dependency chain)

1. Auth + session system + `User`/role model (unblocks everything tenant/identity-related below).
2. Service layer extraction (`src/lib/services/`) between routes and repositories, retrofitted onto the existing BOQ/project/verification flows before adding new ones.
3. Migrate `/projects/new` to the real database (currently the biggest functional gap — you can't create a real project from the UI yet).
4. Client management (real `/clients` page + wire into project creation).
5. Catalogue + suppliers to Postgres.
6. Settings (company profile, users) to Postgres; split into `/settings/appearance` and `/settings/users` only if needed for the users/roles UI — otherwise keep the current single settings page and add sections, since rule 18 forbids decorative placeholder pages.
7. File upload foundation + structured (CSV/XLSX) extraction MVP.
8. Document generation (CSV/XLSX first — no new binary deps; PDF/DOCX after).
9. Email templates + dev-mode delivery (console-logged).
10. Client proposal portal (depends on auth for token issuance being audit-logged against a real user).
11. Dashboard real aggregate metrics (depends on auth for per-company scoping to mean anything).
12. Reset Demo Data dev action.

Theme system (execution plan Section 2) is already functioning per its own requirements and is being left as-is — no migration needed, verification only (see below).
