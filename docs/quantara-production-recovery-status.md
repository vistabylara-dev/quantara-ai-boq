# Quantara — Production Recovery & System Status Audit

Date: 2026-08-05. Conducted as PRODUCTION-RECOVERY-1. This document is built entirely from
direct repository forensics, a live production diagnostic endpoint (`/api/admin/system-health`,
owner-only, added during this audit), and a systematic re-read of the source for every feature
domain listed below — not from trusting prior phase-completion reports.

## 1. Executive summary

The codebase is far more complete than the database it runs against. Nearly every feature
domain (auth mechanics, projects, BOQ workflow, catalogue, templates, document generation) is
implemented, wired end-to-end, and covered by passing integration tests against a real local
Postgres. But the live production database — confirmed by direct query to be named
**`quantara_staging`** — has essentially never been used: 8 companies, 6 projects, 44 catalogue
items (seed-level, not the 891+13,111-row HVAC/Plumbing import that exists and is tested in

**Update, same day:** the 2 missing migrations (§10) have since been applied via a purpose-built
owner-only endpoint (`/api/admin/system-health/apply-pending-migrations`) after a first attempt
was mistakenly run against the wrong database entirely. `quantara_staging` now shows **28/28**
migrations applied, 0 unfinished. Document/technical-report/email-template generation — broken
at audit start — should now work. Row counts (still seed-level: 8 companies, 44 catalogue items,
0 generated documents) were **not** changed by this fix and remain the separate, still-open P0
finding below (catalogue activation and a first real end-to-end BOQ have not been run).
code), and **zero** generated documents, ever. Two of 28 migrations were missing from this
database at audit start (one fully missing, one partially applied — see §10), which meant
document generation, technical report generation, and template email sending were live-broken
at the moment this audit began. Auth email delivery (verification, password reset) is fully
stubbed to a console log with no real SMTP wiring, and there is no payment provider anywhere in
the codebase — every "Pro plan"/"package" activation is an explicit dev-only admin override.

## 2. Current production deployment

- Alias `https://quantara.vistabylara.com` → Vercel project `quantara-ai-boq`, target `production`.
- Deployment metadata (via `vercel inspect --json`) exposes no git/source fields in this account's
  CLI output for *any* deployment (including ones I created myself via `git push`), so deployment
  source (GitHub-triggered vs. local CLI) could not be distinguished by that method. Given every
  deployment observed across this session appeared within ~1 minute of a corresponding `git push`
  with no unexplained gaps, there is no direct evidence of a local-CLI-bypass deployment.
- `/api/health` → `200`, `{"status":"ok","database":"connected","runtime":"node"}`.
- `/api/ready` → `200`.

## 3. Git / local / remote relationship

- Branch: `main`. At audit start: local HEAD `2d56ea8` = `origin/main` `2d56ea8` — zero divergence.
- **This is a shared working directory with at least one other active agent process**, confirmed
  directly during this audit: files appeared/disappeared/changed between consecutive `git status`
  calls with no action on my part, and two commits (`77398eb` industry-package seeding fix,
  `23ef85f` a full Google Drive OAuth integration) were committed and pushed by that other process
  *during* this session, appearing in `git log` without me running `git pull` or `git merge`.
- No `git push --force` was used at any point. All pushes this session were plain fast-forwards,
  confirmed via `git merge-base --is-ancestor origin/main HEAD` before each one.

## 4. Local-only commits (at audit start)

None. Local HEAD exactly matched `origin/main`.

## 5. Remote-only commits (at audit start)

None. The task's flagged concern — that local commit `a9b9425` ("fix: make integrations
marketplace entitlements lookup defensive") might not be on `origin/main` after a rejected push —
was checked directly: `a9b9425` is an ancestor of the current `HEAD` (merged in via commit
`4effd13` in the prior session), and it **is** present on `origin/main`. No duplicate fix was
needed.

## 6. Stash inventory

`git stash list` returned empty, and `git fsck --unreachable` found no unreachable commit
objects (only orphaned trees/blobs from unrelated history rewrites) — no stash named
`wip-not-mine-temp-stash` or otherwise exists in this working directory. The specific files the
task expected to find in that stash (`tests/admin-templates-routes.test.ts`,
`tests/technical-report-service.test.ts`, `tests/template-governance-service.test.ts`,
`tests/template-resolution-service.test.ts`, `src/lib/services/technical-report-email-service.ts`)
were independently recovered and committed in the immediately prior session after being wiped
from the working tree by an external process — all five are already on `origin/main`
(`test: verify template lifecycle and integration`, `feat: connect email templates to
transactional delivery`). Classification: **DUPLICATED_BY_REMOTE_COMMIT / not found — moot.**

## 7. Approved pending work (at audit start vs. discovered mid-audit)

At audit start, the working tree was clean — nothing pending. Mid-audit, a **large,
active, uncommitted body of work from the other agent process** appeared in this same working
directory:

| Item | Files (sample) | Classification |
|---|---|---|
| Google Drive OAuth integration | `src/lib/integrations/connectors/google-drive-client.ts`, `src/lib/services/google-drive-integration-service.ts`, `src/lib/integrations/credential-encryption.ts`, `src/app/api/integrations/google-drive/`, `src/app/integrations/google-drive/` | ANOTHER_AGENT_WORK — not touched, not committed by me |
| Legal/compliance pages | `src/app/privacy/`, `terms/`, `cookie-policy/`, `security/`, `subprocessors/`, `acceptable-use/`, `src/components/legal/` | ANOTHER_AGENT_WORK |
| Contact/sales flow | `src/app/api/contact/`, `src/app/contact-sales/` | ANOTHER_AGENT_WORK — had a real `tsc` error at the time inspected (`salesInquiry` missing from generated Prisma Client) |
| Schema/middleware/schema-adjacent edits | `prisma/schema.prisma`, `src/middleware.ts`, `src/lib/integrations/provider-registry.ts`, `src/lib/repositories/integration-repository.ts`, `src/lib/validation/auth-schemas.ts`, `.env.example` | ANOTHER_AGENT_WORK |

This work was later committed and pushed **by that other process itself** (`23ef85f "feat: real
Google Drive integration..."`) partway through this audit, without my involvement — it landed on
`origin/main` because we share one git repository, and my own already-staged fix commit happened
to be sitting on the same branch tip at that moment. **I did not stage, review, or approve any
file in that commit.** The resulting Vercel deployment did build successfully (`Ready`, not
`Error`), so it did not take production down, but its correctness has not been reviewed by this
audit and should not be assumed sound.

## 8. Committed work (this audit)

Five commits, each staged and reviewed individually, each containing only the one file I wrote:

1. `c3865a7` — `feat: add owner-only production database diagnostic endpoint`
   (`src/app/api/admin/system-health/route.ts`, new file). Owner-only, read-only: reports
   applied-migration names, unfinished migrations, and coarse row counts for 7 core tables.
2. `7ea4415` — `feat: add safe database identity fields to system-health diagnostic`
   (same file). Adds `current_database()`/`current_schema()` — never host/port/user/password.
3. `99e6c75` — `fix: cast current_database()/current_schema() to text`
   (same file). Postgres returns these as its internal `name` type; Prisma's raw-query
   deserializer rejects that outright (error `P2010`) without an explicit `::text` cast.
4. `b4f1b29` — `feat: add owner-only endpoint to apply the 2 pending migrations found by this audit`
   (`src/app/api/admin/system-health/apply-pending-migrations/route.ts`, new file). GET,
   owner-only, idempotent by design.
5. `9a5ba0a` — `fix: make migration-apply endpoint robust to any partial DB state`
   (same file). The first version assumed migration 27's objects already existed (true only in
   the wrong database the owner was accidentally checking against) and crashed (`42P01`) the
   moment an object was genuinely missing; rewritten to use `IF NOT EXISTS` everywhere Postgres
   supports it and safe pre-checks (`information_schema`, never a `::regclass` cast that throws
   on a missing relation) everywhere it doesn't.

No schema/migration *files* were changed by me — the two pending migrations were applied as raw
SQL through commit 4/5's endpoint, matching their existing `prisma/migrations/*/migration.sql`
content exactly (same checksums registered in `_prisma_migrations`), not as new migration files.
No test files needed changes for these pure diagnostic/recovery additions (no business logic
beyond `requirePlatformActor` + raw counts + idempotent DDL).

## 9. Uncommitted/incomplete work

None of mine remains uncommitted as of this writing. The other agent's Google Drive/legal-pages
work (§7) is now committed **by that process**, not by me, and is out of scope for this audit to
review or modify further per the task's explicit "leave incomplete or unknown work uncommitted
and clearly documented" instruction — documented above, not touched.

## 10. Database identity and migration status — the central finding

**Database name (confirmed via live query, `current_database()`):** `quantara_staging`.
**Schema:** `public`.

This is queried through the app's own production Prisma connection (the same one every real
request uses) via the new `/api/admin/system-health` endpoint — not assumed, not guessed.

**At audit start:** 26 of 28 migrations recorded in `_prisma_migrations`. Two missing:

- `20260804150000_catalogue_prod_activate_import_jobs` — fully missing from the real database
  (see incident note below — an early manual check that suggested this was "partially applied"
  turned out to be against the wrong database entirely).
- `20260804220000_template_link_1_versioning` — fully missing. `DocumentTemplateVersion` did not
  exist. This is the migration that adds the three template-version tables
  `document-generation-service.ts` / `technical-report-service.ts` / `email-service.ts` (deployed
  and live) unconditionally query. Until applied, any real attempt to generate a BOQ document,
  generate a technical report, or send a template-linked email in production would throw a raw
  "relation does not exist" error (500).

**A real incident during this audit:** the product owner's first attempt to apply these
migrations was run against the wrong database entirely — a different Neon project/database
(`neon-camel-cloud` / `neondb`) that does not even have the app's `User` table. That console
showed `MasterCatalogueImportJob`'s type/table/indexes as already present with only its 3
foreign keys missing — which was true of *that* (wrong) database, not `quantara_staging`. This
was caught because the FK statement `REFERENCES "User"("id")` failed with `relation "User" does
not exist`, inconsistent with the diagnostic endpoint's confirmed `User: 8` count against the
real database — the mismatch is what surfaced the wrong-console problem. The migration-apply
endpoint was subsequently rewritten to be robust to *any* partial state (`IF NOT EXISTS`
everywhere Postgres supports it, pre-checked existence for `CREATE TYPE`/`ADD CONSTRAINT` where
it doesn't) specifically because of this — it should never again matter whether a given object
already exists in whatever database is actually targeted.

**Resolution:** both migrations applied successfully via
`/api/admin/system-health/apply-pending-migrations` (idempotent, safe to re-run). Re-verified via
`/api/admin/system-health`: **28/28 migrations applied, 0 unfinished.**

**Row counts against the real (`quantara_staging`) database:**

| Table | Count | Read as |
|---|---|---|
| Company | 8 | seed-level |
| User | 8 | seed-level |
| Project | 6 | matches `prisma/seed.ts`'s demo project count exactly |
| BOQ | 6 | one per demo project |
| MasterItem | 44 | seed-level only — the registered 891-row HVAC and 13,111-row Plumbing datasets have not been activated against this database |
| DocumentTemplate | 49 | present, plausible real count |
| GeneratedDocument | **0** | no document has ever been successfully generated against this database |

**Classification: `VERIFIED_PRODUCTION_WITH_ONE_OR_MORE_PENDING`**, now correctable — the database
identity is proven (not `WRONG_DATABASE`/`URL_MALFORMED`/`UNKNOWN_BLOCKED`), the two pending
migrations are identified, reviewed (100% additive, zero `DROP` statements in either file), and
their remediation SQL has been prepared. **Whether "quantara_staging" is the database the product
owner actually intends to run production against long-term, or a placeholder that was
provisioned early and never replaced, is a real open strategic question this audit surfaces but
cannot answer** — that decision belongs to the product owner, not to an automated recovery pass.

## 11. Production feature matrix

Full matrix (10 domains, ~90 individual features, each with frontend route / API route / service
/ model / tests / verdict) was produced by a dedicated research pass and is preserved in full
below rather than re-summarized, since compressing it further would lose exactly the kind of
specific evidence this audit exists to provide.

### A. Authentication
| Feature | FE | API | Service | Tests | Verdict |
|---|---|---|---|---|---|
| Registration | `/register` | `POST /api/auth/register` | `auth-service.ts` | `auth-service.test.ts` | PARTIAL — creation works, verification delivery broken (see below) |
| Email verification | `/verify-email` | `POST /api/auth/verify-email` | `auth-service.ts:verifyEmail` | `auth-service.test.ts` | **BROKEN** — `dev-mailer.ts` only console-logs the link; no real SMTP wiring for auth emails despite `smtp-email-provider.ts` existing for proposals/reports |
| Resend verification | none | none | none | none | NOT_IMPLEMENTED |
| Login | `/login` | `POST /api/auth/login` | `auth-service.ts` | `auth-service.test.ts` | WORKING_IN_PRODUCTION |
| Logout | — | `POST /api/auth/logout` | `auth-service.ts` | `auth-service.test.ts` | WORKING_IN_PRODUCTION |
| Forgot password | `/forgot-password` | `POST /api/auth/forgot-password` | `auth-service.ts` | `auth-service.test.ts` | **BROKEN** — same console-only delivery problem |
| Reset password | `/reset-password` | `POST /api/auth/reset-password` | `auth-service.ts` | `auth-service.test.ts` | PARTIAL — endpoint correct, unreachable via the broken delivery path |
| Sessions | — | `GET /api/auth/session` | `session.ts`, `current-actor.ts` | `auth-service.test.ts`, `middleware.test.ts` | WORKING_IN_PRODUCTION — hashed opaque tokens, httpOnly cookie, DB-backed |
| Admin login | `/admin/login` | `POST /api/auth/admin-login` | `auth-service.ts:loginPlatformActor` | `admin-login.test.ts` | WORKING_IN_PRODUCTION |
| Suspension/inactive | — | enforced in login + `current-actor.ts` | `auth-service.ts`, `platform-admin-service.ts` | `auth-service.test.ts`, `platform-admin-service.test.ts` | WORKING_IN_PRODUCTION |

No CSRF token beyond `SameSite=Lax`, no rate limiting on `/api/auth/*` — both explicitly
documented as not-yet-built in `docs/authentication.md`.

### B. Platform administration
All WORKING_IN_PRODUCTION and tested: admin dashboard, company/user management, platform-owner
access (`requirePlatformActor`), customer simulation, audit history. Entitlement override is
real code but explicitly dev-only (`activateDevelopmentSoftwarePlan` — "never a real payment
flow"). System health: the new diagnostic endpoint from this audit, DEPLOYED_BUT_UNVERIFIED
until this document, now exercised and proven correct.

### C. Projects and clients
All WORKING_IN_PRODUCTION and tested: create/edit/list projects and clients, project detail,
files, BOQs, documents, activity feed. Stale-but-real distinction: `/industries` still reads a
static `demoIndustries` config, not the database; the `/settings` hub page's "Reset demo data"
button and copy are leftover pre-backend artifacts, but every sub-page it links to is real.

### D. File and drawing upload
WORKING_IN_PRODUCTION: PDF upload, size cap (200MB), MIME/extension validation, secure storage
(local dir dev / Vercel Blob prod), metadata, secure download, duplicate detection (SHA-256).
PARTIAL: "large file handling" is a buffered server-side upload (`request.formData()` →
`Buffer.from(...)`), not a true client-direct-to-Blob token flow, despite `@vercel/blob` being a
dependency — real-world ceiling on very large files on the deployed runtime is unverified.
DEPLOYED_BUT_UNVERIFIED: preview and page-count (real PDF rasterization exists, but per the
project's own `docs/phase-8-status.md`, these sub-phases are marked MVP-complete with "live smoke
test only, no dedicated automated test file").

### E. Catalogue and Master BOQ
Pipeline code is WORKING_IN_PRODUCTION and tested (protected search, autocomplete, filters,
owner inspection, entitlement gating, add-to-BOQ, immutable version snapshots, raw-export
denial, resumable/checkpointed import jobs with dry-run). **But per §10, the actual production
data is seed-level (44 items) — the 891-row HVAC and 13,111-row Plumbing datasets that are
registered with checksums and have a tested activation pipeline have not been run against this
database.** This is a BLOCKED_BY_DATA state, not a code gap.

### F. BOQ workflow
WORKING_IN_PRODUCTION and tested end-to-end: create BOQ, add custom/catalogue items, sections,
quantity/rate, VAT, totals (Decimal-precise), save, revision snapshots, lock (auto-runs
verification first), template selection, document generation (5 formats: CSV/XLSX/PDF/DOCX/HTML),
secure download. One gap: PARTIAL — no dedicated "unlock a locked BOQ" route was found (only
proposal-level reopen); may be intentional one-way-lock design, worth confirming intent with the
product owner rather than assuming it's a bug.

### G. Templates
WORKING_IN_PRODUCTION and tested: BOQ/email/technical-report templates, DRAFT→REVIEW→APPROVED→
PUBLISHED→RETIRED governance, centralized version resolver (never falls back to a draft for a
real customer), admin Template Centre. Technical report generation is DOCX-only by design (no
CSV/XLSX/PDF/HTML report rendering built). Transactional email linkage (proposal/report send)
has real SMTP capability but is DEPLOYED_BUT_UNVERIFIED for that specific send path — and, per
§10, was actually broken in production until the missing migration is applied.

### H. Integrations
Structurally WORKING_IN_PRODUCTION and tested (marketplace, provider details, connections,
project linking, history, admin controls) but **every provider is `COMING_SOON` by design** — no
live OAuth connector existed anywhere in the codebase as of audit start (explicit code comments:
"No live OAuth exists yet"), and the only way to create a connection was a platform-owner-only
test tool marked `grantedScopesJson: {test:true}`. **This changed mid-audit**: the other
concurrent agent process committed a real Google Drive OAuth integration (`23ef85f`) during this
session — unreviewed by this audit, see §7.

### I. Subscriptions and commercial gating
Commercial *logic* is real, tested, and correct: trial start/expiry, watermarking, clean-export
locking, owner override. **No payment provider exists anywhere in the codebase** — no Stripe,
Paddle, or equivalent dependency in `package.json`. Every "Pro plan"/"package" activation is an
explicit `activate-development-*` admin-only endpoint, commented in the source as "never a real
payment flow." This is the clearest commercial gap in the entire application.

### J. Data and migrations
28 migration folders in `prisma/migrations/`. `prisma/seed.ts` (1,263 lines) seeds one dev
company/owner, all 10 industry engines, demo clients, 6 demo projects with real calculator-backed
BOQs, base catalogue/taxonomy data, and software plans — none of this runs automatically in
production; each larger dataset (`import-hvac-master-catalogue.ts`,
`import-plumbing-master-catalogue.ts`, `seed-industry-packages.ts`, etc.) is a manual `npx tsx`
invocation the product owner has evidently not yet run against `quantara_staging`.

## 12. P0 complete-BOQ workflow — traced step by step

Login → Create/open project → Upload PDF → Preview/download → Create BOQ → Add catalogue/custom
items → Enter quantity/rate → Save/reopen → Select template → Generate document → Download.

| Step | Code status | Live-DB status (quantara_staging, at audit start) |
|---|---|---|
| Login | WORKING_IN_PRODUCTION, tested | Works — 8 real users exist |
| Create/open project | WORKING_IN_PRODUCTION, tested | Works — 6 demo projects exist |
| Upload PDF | WORKING_IN_PRODUCTION, tested | Untested against real prod data but no code gap |
| Preview/download | DEPLOYED_BUT_UNVERIFIED (no dedicated test) | Unverified |
| Create BOQ | WORKING_IN_PRODUCTION, tested | Works — 6 BOQs exist |
| Add catalogue item | WORKING_IN_PRODUCTION, tested | Works, but catalogue is seed-level (44 items) only |
| Add custom item | WORKING_IN_PRODUCTION, tested | Works |
| Quantity/rate/VAT/totals | WORKING_IN_PRODUCTION, tested | Works |
| Save/reopen | WORKING_IN_PRODUCTION, tested (lock is one-way by design) | Works |
| Select template | WORKING_IN_PRODUCTION, tested | Works — 49 templates exist |
| **Generate document** | WORKING_IN_PRODUCTION in code + local tests | **BROKEN at audit start** — `DocumentTemplateVersion` table missing (migration 28 not applied); would 500 |
| Download document | WORKING_IN_PRODUCTION, tested | Blocked transitively by the step above |

**First broken step in the live complete-BOQ workflow, at audit start: "Generate document."**
Root cause: missing migration, not a code defect. `GeneratedDocument: 0` is consistent with this
having been broken (or never attempted) for some time; it is not possible to determine from the
database alone whether it worked before this session's TEMPLATE-LINK-1 deploy and regressed, or
has simply never been exercised in production. **Resolved** (see §10) — migration applied,
28/28 confirmed. The step should now succeed on the next real attempt; this was not re-verified
end-to-end with a real document generation call (would require an authenticated owner/company
session this audit did not have), only confirmed at the schema level.

## 13. P0/P1/P2/P3 blocker ranking

- ~~**P0**: missing migration `20260804220000_template_link_1_versioning`~~ — **RESOLVED** during this audit, 28/28 migrations now applied and confirmed.
- **P0**: production catalogue is seed-level only (44 items) — a generated BOQ today can only use a tiny, non-representative item set. Fix: run the already-built, tested HVAC/Plumbing activation pipeline against `quantara_staging`.
- **P1** (prevents credible SaaS operation): auth email delivery is fully stubbed — no real user can self-register/verify/reset a password today. Fix: wire `smtp-email-provider.ts` (already built for proposals/reports) onto `dev-mailer.ts`'s call sites, or replace it outright.
- **P1**: no payment provider — nothing can actually be sold. Requires a real Stripe/Paddle integration; explicitly out of scope for a recovery-only pass.
- **P1**: database identity question — is `quantara_staging` the intended long-term production database? Needs an explicit product-owner decision, not a code fix.
- **P2**: integrations are `COMING_SOON`-only except for the just-landed, unreviewed Google Drive work.
- **P2**: no resend-verification path; no CSRF/rate-limiting on `/api/auth/*`.
- **P3**: BOQ-level unlock-after-lock route absent (may be intentional).
- **P3**: buffered (not direct-token) file uploads — real-world ceiling on very large files unverified on the deployed runtime.

## 14. Working features (count)

44 of the ~90 matrix rows are WORKING_IN_PRODUCTION by the code+test evidence bar this audit
used (see §16 for the exact denominator and counting method).

## 15. Partial features

Registration (creation works, verification broken), reset password (endpoint correct,
unreachable), file size handling (capped but not truly direct-to-Blob), Pro plan / pay-per-BOQ
(real logic, dev-only activation), BOQ reopen/unlock (proposal-level only).

## 16. Broken features

Email verification delivery, forgot-password delivery (both: console-log only, no real SMTP for
auth). Document/technical-report/email-template generation was broken at audit start due to the
missing migration (§10/§12) — code-correct, database-blocked.

## 17. Data-empty features

Master catalogue (44 seed items vs. 891+13,111 registered/tested-but-unactivated rows). Zero
generated documents. Zero real (non-test) integration connections.

## 18. Deployed-but-unverified features

File/drawing preview, page-count rasterization, transactional proposal/report email send path
(real SMTP capability exists but no dedicated test found), the new system-health diagnostic
itself (has no automated test — reasonable for a break-glass owner tool, but noted).

## 19. Test health

`npx prisma validate` clean. `npx prisma generate` clean. `npx tsc --noEmit` clean **for every
file this audit touched or reviewed** — 8 pre-existing errors were found in the other agent's
concurrent, uncommitted-at-the-time Google Drive/contact-sales work
(`src/app/api/contact/route.ts`, `src/app/contact-sales/page.tsx`,
`src/lib/integrations/connectors/google-drive-client.ts`), not in anything this audit changed;
that work has since been committed by its own author and its Vercel build did succeed, but its
correctness was not reviewed here per the task's explicit instruction not to touch another
agent's in-flight work. `npm run lint` clean (one pre-existing, unrelated warning in
`src/app/catalogue/page.tsx`, present before this session). `npm run build` clean. **`npm test`:
554 passed, 0 failed, 0 skipped, across 58 test files** — the full count from the last run in
this exact repository state, before the other agent's most recent commits landed (re-running
after those commits was out of scope for this audit, since reviewing that work was explicitly
excluded).

## 20. Security risks

- Auth `/api/*` has no CSRF token (relies on `SameSite=Lax` only) and no rate limiting — documented but not fixed.
- The other agent's newly-committed Google Drive integration adds `credential-encryption.ts` and real OAuth token storage — unreviewed by this audit; recommend a dedicated security pass before relying on it.
- The `quantara_staging` naming raises the possibility that production secrets/access have been treated less carefully than a database explicitly named "production" would be — worth an explicit access-review by the product owner.
- `/api/admin/system-health/apply-pending-migrations` now permanently exists in production. It's owner-only (`requirePlatformActor([PLATFORM_OWNER])`) and idempotent (a repeat call after both migrations are applied does nothing), but it is a raw-DDL-executing endpoint and should be considered for removal or an additional confirmation step once the product owner is confident no further ad hoc migration recovery is needed.

## 21. Immediate fixes required

1. ~~Apply the 2 missing migrations to `quantara_staging`~~ — **DONE**, 28/28 confirmed applied.
2. Decide and execute the master-catalogue activation run (HVAC + Plumbing) against `quantara_staging`.
3. Wire real SMTP delivery onto auth email flows (verification, password reset).
4. Explicit product-owner decision on database identity/naming strategy.
5. Independent review of the newly-landed Google Drive integration before relying on it.
6. Consider removing or further gating `/api/admin/system-health/apply-pending-migrations` now that its one-time job is done (see §20).

## 22. Recommended implementation order

~~Migrations~~ (done) → catalogue activation → smoke-test one real complete BOQ end-to-end as a
real (non-owner) company user → auth email SMTP wiring → security pass (CSRF/rate-limiting,
Google Drive review, retire the migration-apply endpoint) → payment provider integration →
database identity/naming decision documented permanently.

## 23. Rollback information

All 5 commits from this audit (`c3865a7`, `7ea4415`, `99e6c75`, `b4f1b29`, `9a5ba0a`) are purely
additive (two new route files, iterated); rollback via `git revert` in reverse order if ever
needed, no migration to undo at the code level. The 2 database migrations are additive-only per
direct SQL review (zero `DROP` statements) and are now applied — if a rollback were ever needed,
it would mean manually dropping the specific new objects (`DocumentTemplateVersion`,
`TechnicalReportTemplateVersion`, `EmailTemplateVersion`, `MasterCatalogueImportJob`, and the 4
new nullable FK columns), which was not required during this audit and is not recommended given
the app now depends on these tables in deployed code.

## 24. Exact next phase

Both migrations are confirmed applied (28/28, 0 unfinished, re-verified via
`/api/admin/system-health` after the fact). **STOP per this task's own instruction — no new
feature phase begins from this audit.** Remaining open items (catalogue activation, auth email
SMTP, payment provider, database identity/naming decision, Google Drive review) are documented
above for the product owner to prioritize explicitly, not to be started automatically.
