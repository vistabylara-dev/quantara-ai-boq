# P0 Real Product — Evidence Ledger

Concrete, timestamped evidence per checkpoint. No status is marked beyond
`DEPLOYED_AWAITING_OWNER_ACCEPTANCE` without an explicit owner PASS recorded
here with concrete values.

## Checkpoint 1 — Project Industry + Project Creation

**Status:** `DEPLOYED_AWAITING_OWNER_ACCEPTANCE`

**Root cause:** Production's `IndustryEngine` reference table was never
seeded. `auth-service.ts` registration already auto-links a new company to
every `IndustryEngine` row that exists *at signup time*
(`if (industries.length > 0) { ... createMany ... }`), but since the table
was empty, that condition never ran — every company, new or existing, ended
up with zero `CompanyIndustryEngine` rows. `GET /api/industries`
(`industry-repository.ts:listIndustryEngines`) queries exactly that join
table, so it returned `[]` for every company, and `projects/new/page.tsx`
disables submission when `industries.length === 0`.

**Files changed:**
- `src/lib/services/industry-bootstrap-service.ts` (new) — idempotent upsert
  of the 10 `IndustryEngine` rows from the existing authoritative taxonomy
  (`src/config/industries`), plus backfill of `CompanyIndustryEngine` links
  for companies with zero existing links only.
- `src/app/api/admin/system-health/bootstrap-industries/route.ts` (new) —
  `PLATFORM_OWNER`-gated `GET`, matching this project's established
  production-bootstrap pattern.
- `src/app/projects/new/page.tsx` — separate loading/error/empty states, a
  retry action (`loadIndustries` extracted from the effect), and the
  "default to first industry" behavior now fires only once on first
  successful load, never on retry (so it can never clobber a value the user
  already picked or typed around).

**Routes:** `GET /api/admin/system-health/bootstrap-industries` (owner-only),
`GET /api/industries` (unchanged), `POST /api/projects` (unchanged).

**Models:** `IndustryEngine`, `CompanyIndustryEngine` — both pre-existing,
no schema change.

**Migration:** none — this is a data bootstrap of already-existing tables,
not a schema change.

**Focused tests:** `tests/industry-bootstrap-service.test.ts` — 5/5 passed
(real local Postgres): creates all 10 rows with unique keys; second run
creates zero duplicate `IndustryEngine` rows; backfills a zero-link company;
never touches a company with an existing link (even if disabled); repeated
backfill for the same company creates no duplicate links.

**Full validation:**
- `npx prisma validate`: passed, schema valid.
- `npx prisma generate`: passed.
- `npx tsc --noEmit`: clean, zero errors.
- `npm run lint`: `✔ No ESLint warnings or errors`.
- `npm run build`: succeeded.
- `npm test`: **638 passed**, 41 skipped, 4 failed — the same 4
  pre-existing, unrelated `PlatformOwner`-fixture failures present since the
  start of this multi-phase session (`admin-control-1.test.ts`,
  `platform-admin-service.test.ts`, `platform-owner-bootstrap.test.ts`,
  `provision-platform-owner.test.ts` — all fail with "requires an isolated
  local test database with no existing platform owner", traced to a
  pre-session local fixture, not caused by this change).

**Commit:** `188515b` — "fix: restore production project creation and
industries"

**Push:** fast-forward `61d949f..188515b` on `main`, confirmed via
`git merge-base --is-ancestor origin/main HEAD` before push.

**Deployment ID:** `dpl_5XcmEouZs2D2EPiu6pZb7n5VpmL5`, aliased to
`https://quantara.vistabylara.com`, `readyState: READY`.

**Production route evidence (unauthenticated, authorization-only proof — not
feature proof):**
- `GET /api/health` → `200 {"status":"ok","database":"connected"}`
- `GET /api/ready` → `200 {"status":"ready"}`
- `GET /api/admin/system-health/bootstrap-industries` → `401 UNAUTHENTICATED`
- `GET /api/industries` → `401 UNAUTHENTICATED`

**Owner action required (cannot be completed by the agent — needs the
platform owner's real browser session):**

1. While logged in as `PLATFORM_OWNER`, visit:
   `https://quantara.vistabylara.com/api/admin/system-health/bootstrap-industries`
2. Paste back the JSON response (expected shape:
   `{"ok":true,"data":{"industriesCreated":10,"industriesUpdated":0,"companiesBackfilled":N,"totalIndustryEngines":10}}`).
3. Then run the manual acceptance test below and report PASS/FAIL.

**Owner manual test:**
1. Go to `/projects/new`.
2. Confirm the Industry dropdown shows real options (not empty).
3. Select an industry, fill the rest of the form, submit.
4. Confirm redirect to the new project's page.

**Owner PASS/FAIL:** *(pending — not yet run)*

**Unresolved blocker:** none identified yet — awaiting the owner's bootstrap
trigger and manual test before Checkpoint 2 (upload-purpose enforcement —
already substantially covered by the prior UPLOAD-WORKFLOW-CONTRACT-1 phase)
can be marked verified end-to-end with a real project to test against.
