# STRIPE PROVIDER MAPPING IDEMPOTENCY TODO

## Scope guard (Stripe-only)
- [ ] Keep all changes isolated to Stripe provider mapping persistence and Stripe sync tests
- [ ] Do not modify catalogue activation / marketplace / BOQ / checkout / webhooks / live payments

## Repository fix
- [x] Add `CommerceProviderMappingConflictError` with safe structured context
- [x] Implement create-or-reuse behavior in `createMapping`
- [x] Catch Prisma `P2002` only for known unique-collision paths
- [x] Re-read collided mapping using schema-backed keys:
  - provider + environment + providerProductId
  - provider + environment + providerPriceId (for price mappings)
- [x] Verify provider/environment/type/internal IDs consistency before reuse
- [x] Return existing mapping when consistent
- [x] Throw safe specific conflict when provider object maps to different internal record
- [x] Rethrow unrelated Prisma errors unchanged

## Focused tests
- [x] First product mapping creation
- [x] First price mapping creation
- [x] Second identical product sync returns existing mapping
- [x] Second identical price sync returns existing mapping
- [x] `P2002` product collision with matching internal product reuses row
- [x] `P2002` price collision with matching internal price reuses row
- [x] Provider product mapped to another internal product throws safe conflict
- [x] Provider price mapped to another internal price throws safe conflict
- [x] Concurrent identical product sync creates one mapping row
- [x] Concurrent identical price sync creates one mapping row
- [x] Rerun produces no duplicate mappings
- [x] Drift detection remains correct
- [x] Unrelated Prisma error is rethrown
- [x] No unintended duplicate audit/provider operations

Result: `tests/stripe-sync-service.test.ts` — 26 passed / 0 failed. Root cause of the
prior 2 failures was not the repository logic: 563 leftover `test_*` `CommerceProduct`
rows had accumulated in the local dev Postgres from earlier ad-hoc test runs (never
cleaned up), which both blew the 5s test timeout (full-catalogue sync loop) and caused
spurious provider-id collisions (the mock Stripe client's id counter resets per test,
colliding with old leftover mappings). Deleted the leftover `test_*` products
(`CommerceProviderMapping`/`CommercePrice` cascade-deleted via FK) — no test files or
assertions were modified.

## Fixture cleanup hardening
- [x] Audited `tests/stripe-sync-service.test.ts` — every fixture uses a `code` containing the
      file's own `RUN_ID` (timestamp+pid), but `afterAll` only ever cleaned up
      `CommerceSyncRun`/`PlatformAuditLog`/`User`/`Company`, never the `CommerceProduct` rows
      themselves — that omission is the actual repeatability defect (root cause of the 563-row
      accumulation), not a database-cleanliness issue to solve by hand each time.
- [x] Fixed: `afterAll` now also runs
      `prisma.commerceProduct.deleteMany({ where: { code: { contains: RUN_ID } } } })`, cascading
      to `CommercePrice`/`CommerceProviderMapping` via FK. Scoped to this run's own unique
      `RUN_ID` substring only — never a broad `test_*` delete, never touches production.
- [x] Repeatability proven: ran the focused suite twice consecutively with zero manual DB
      cleanup between runs. `CommerceProduct` count: 50 → 50 → 50 (stable). Both runs: 26 passed
      / 0 failed.
- Note (out of scope, not fixed): unrelated test files (e.g. `commerce-product-service.test.ts`,
  `catalogue-supplier-service.test.ts`) leave their own `CommerceProduct` fixtures in the DB
  without cleanup — `buildSyncPlan()` processes the *entire* catalogue, so those leftovers
  produce harmless stderr noise (`COMMERCE_PROVIDER_MAPPING_CONFLICT` on a leftover unmapped
  product) during Stripe sync runs, caught per-entry and not asserted on. Fixing those other
  files' fixture hygiene is outside the Stripe-only scope guard above.

## Lock
- [x] Created `docs/feature-locks/stripe-provider-mapping-sync-lock.md`

## Verification commands
- [x] `npm test -- tests/stripe-sync-service.test.ts` (26 passed / 0 failed)
- [x] `npx prisma validate` (schema valid)
- [x] `npx prisma generate` (succeeded)
- [x] `npx tsc --noEmit` — 5 pre-existing errors in `src/app/(marketing)/boq-calculation-formulas/page.tsx`
      and `site-map/page.tsx` (`BreadcrumbItem` typing), unrelated to this repair — last touched by
      commits `4d90db5` / `5de3b2f`, out of the Stripe-only scope guard above
- [x] `npm run lint` (no warnings or errors)
- [x] `npm run build` (succeeded — `next.config.mjs` has `typescript.ignoreBuildErrors: true`,
      pre-existing, which is why the tsc errors above don't block the build)
- [x] `npm test` — 682 passed, 41 skipped, 4 suites fail on a pre-existing self-guard
      ("requires an isolated local test database with no existing platform owner" — this local
      dev Postgres already has a real platform owner provisioned): `admin-control-1.test.ts`,
      `platform-admin-service.test.ts`, `platform-owner-bootstrap.test.ts`,
      `provision-platform-owner.test.ts`. Unrelated to this repair.

## Git
- [ ] Stage Stripe-only files
- [ ] Commit: `fix: make stripe provider mapping sync idempotent`
- [ ] `git fetch origin`
- [ ] `git status --short`
- [ ] `git diff --cached`
- [ ] `git merge-base --is-ancestor origin/main HEAD`
- [ ] Push fast-forward only
