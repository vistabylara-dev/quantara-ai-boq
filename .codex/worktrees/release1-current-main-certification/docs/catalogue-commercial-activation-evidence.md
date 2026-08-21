# Catalogue Commercial Activation — Evidence Ledger

Concrete, timestamped evidence per checkpoint. No status is marked beyond
`DEPLOYED_AWAITING_OWNER_ACCEPTANCE` without an explicit owner PASS recorded
here with concrete values. See `docs/catalogue-dataset-inventory.md` for the
full dataset registry audit.

## Important context for every checkpoint below

Before starting this program, a substantial part of its scope was already
implemented in earlier phases of this codebase (visible in code comments as
"CATALOGUE-PROD-ACTIVATE", "MASTER-BOQ-1A", and "Phase 7: commercial
entitlements + industry data platform"). This ledger records what was
**audited and confirmed already correct** separately from what was **newly
built in this program**, per the task's own rule against creating duplicate
systems.

## Checkpoint 1 — Dataset Inventory and Registry

**Status:** `IMPLEMENTED_LOCALLY` (documentation; the underlying registry
system itself pre-dates this checkpoint and required no code change)

**Files changed:** `docs/catalogue-dataset-inventory.md` (new),
`docs/catalogue-commercial-activation-evidence.md` (new)

**Finding:** 2 of 15 `data-imports/*` folders are registered/approved
(HVAC, Plumbing) via `catalogue-dataset-registry.ts`. The other 13 exist as
raw files with no registry entry, checksum, or hierarchy mapping — not safe
to import without real per-discipline curation. Full detail in the
inventory doc.

## Checkpoints 2–4 — Normalization / Staging / Idempotent Import

**Status:** `AUDITED` — already implemented, not rebuilt.

Confirmed present and matching the spec's required shape:
- `src/lib/services/master-catalogue-import-job-service.ts` —
  `registerAndDryRun` (read-only, makes no mutations), `listRegisteredDatasetsSummary`.
- `src/lib/services/master-catalogue-bulk-import-service.ts`,
  `hvac-master-import-service.ts`, `plumbing-master-import-service.ts` —
  normalization, dedup, idempotent upsert keyed by stable item code (not
  display name).
- Routes: `GET /api/admin/master-catalogue/datasets`,
  `POST .../datasets/[datasetId]/dry-run`, `POST .../import`,
  `POST .../import/[batchId]/rollback` — all `PLATFORM_OWNER`-gated via
  `requirePlatformActor`.
- `tests/master-catalogue-bulk-import-service.test.ts`,
  `tests/hvac-master-import-service.test.ts` — existing coverage for
  idempotency, dedup, hierarchy mapping.

**Not re-verified in this program yet:** whether a second production
execution is provably idempotent against the *live* production database
specifically (only unit/integration-tested locally so far). Flagged for
Checkpoint 17.

## Checkpoints 5–6 — Industry Package Model / Item Assignment

**Status:** `AUDITED` — already implemented.

`IndustryDataPackage` and `IndustryDataPackageItem` models already exist
with the exact shape requested: unique `[packageId, masterItemId]`
constraint, indexed `packageId`, indexed `masterItemId`, `packageType`
enum, `status` (active/inactive), `isFeatured`. `CompanyPackageSubscription`
provides the entitlement-source link. No schema change made.

**Not yet true today:** only HVAC and Plumbing packages can have real
published items, since only those 2 datasets are registered (see
Checkpoint 1). Any other package name from the spec's suggested list
(Electrical, Fire Fighting, Civil Works, etc.) would currently have zero
real items — per the task's own stop condition ("packages contain zero
published items"), none of those should be created or advertised until
their source dataset is registered and imported.

## Checkpoints 8–9 — Effective Entitlements / Company Library

**Status:** `AUDITED` — already implemented.

`src/lib/entitlements/effective-entitlement-service.ts` (`assertMasterItemAccessEffective`,
`canUsePremiumItemEffective`), `package-entitlement-service.ts`
(`companyHasPackageAccessForItem`) already provide the single centralized
check the spec asks for — not scattered through routes/React.
`company-library-service.ts` (`createFromMaster`, `createFromCatalogue`,
`createManualLibraryItem`) already implements the company-library snapshot
pattern with `sourceMasterItemId`/`sourcePackageId` provenance.

## Checkpoint 10 — BOQ Autocomplete

**Status:** `AUDITED` — already implemented and already wired end-to-end.

This is the literal task-title objective ("connect package search to BOQ
autocomplete") and it already exists:
- `src/lib/services/item-search-service.ts` (`searchItems`) — ranked,
  multi-source search (company library → recent → favorite → entitled
  master package → locked preview for premium-without-entitlement →
  previous project → supplier catalogue), bounded to 15 results per source.
- `GET /api/items/search` — exposes it.
- `src/components/boq/add-item-from-source-modal.tsx` — debounced
  (250ms) live search already wired into the BOQ "Add item" flow, with
  locked/inaccessible premium items shown but disabled (never silently
  hidden, never silently unlocked), and a permanent "Create manually" tab.

No new UI was built for this checkpoint — it would have duplicated an
existing, already-correct implementation.

## Checkpoint 11 — Manual BOQ Fallback

**Status:** `AUDITED` — already implemented, confirmed always available
regardless of entitlement (the "Create manually" tab in
`add-item-from-source-modal.tsx` has no entitlement gate).

## Checkpoint 12 — Immutable Catalogue Snapshot

**Status:** `AUDITED` — already implemented.

`src/lib/services/boq-item-source-service.ts` (`addBoqItemFromSource` →
`resolveMasterItemDefaults`) already:
- calls `assertMasterItemAccessEffective` before resolving any master-item
  default (server-side enforcement, not client-trusted).
- records a premium-item unlock event when a premium item without package
  access is used (`recordPremiumItemUnlock`).
- snapshots the *published* `MasterItemVersion` (name, specification
  template, unit) plus classifications and regional applicability at
  add-time — editing the BOQ line afterward never touches
  `MasterItem`/`MasterItemVersion`, and a later catalogue edit never
  retroactively changes an already-created BOQ line.
- degrades gracefully (no snapshot, not a crash) if the snapshot-table
  migration hasn't landed yet in a given environment — a defensive
  detail worth confirming is no longer needed in production (see
  Checkpoint 17).

## Checkpoints 13–16 — Payment Readiness / Trial / Raw-Data Protection / Admin

**Status:** `NOT_STARTED` (this program) — not audited in depth yet. Given
the scale of what was already found built in Checkpoints 2–12, and that
none of these blocks the core "search → select → snapshot" or "manual
fallback" flows the product owner asked to verify, they were not rushed
into this same pass without dedicated review. Recorded honestly as open
rather than claimed complete.

## Checkpoint 17 — Production Import Execution

**Status:** `NOT_STARTED` (unconfirmed) — **this is the genuinely open,
load-bearing question or this program.**

I cannot determine from my environment whether the HVAC/Plumbing datasets
have actually been executed against production (not just dry-run, not just
code-deployed) — that requires an authenticated `PLATFORM_OWNER` session,
which only the product owner has. Two existing owner-gated endpoints
already provide this without any new code:

1. `GET https://quantara.vistabylara.com/api/admin/master-catalogue/datasets`
   — registered-dataset summary with current production import state per
   dataset.
2. `GET https://quantara.vistabylara.com/api/admin/master-catalogue/growth-snapshot`
   — real counts: `totalMasterItems`, `publishedVersions`,
   `itemsWithClassification`, `itemsWithHierarchy`, `manufacturers`,
   `verifiedProductModels`, `standardAuthorities`, `disciplines`,
   `hierarchyNodes`.

**Owner action needed:** while logged in as `PLATFORM_OWNER`, visit both
URLs and paste back the JSON. That tells us, with real numbers, whether
Checkpoint 17 is already done, partially done, or not started — and
whether a dry-run/execute cycle needs to be triggered next.

## Checkpoint 18 — BOQ Workflow Acceptance

**Status:** `DEPLOYED_AWAITING_OWNER_ACCEPTANCE` for the unentitled-company
and manual-entry paths (already-existing, already-deployed code, not newly
built here). Entitled-company and platform-owner-simulation paths depend on
Checkpoint 17's answer and have not been exercised with real production
data in this program.

## Unresolved blockers

1. Real production `MasterItem`/`IndustryDataPackage`/entitlement counts —
   awaiting owner-provided endpoint output (see Checkpoint 17).
2. 13 of 15 dataset folders remain unregistered — real curation work,
   explicitly deferred rather than rushed.
3. Checkpoints 13–16 (payment-readiness types, trial policy, raw-export
   protection, admin package management UI) not yet independently audited
   in this program.
