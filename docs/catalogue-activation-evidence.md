# Catalogue Activation Evidence — CATALOGUE-CREATE-1

**Date:** 2026-08-06
**Scope:** Real, verified evidence backing the CATALOGUE CREATION AND COMMERCIAL ACTIVATION
execution order. Everything below was run against a **real local Postgres instance with the
real, checksum-pinned HVAC source files** in `data-imports/hvac/` — no fixtures, no mocks.
Production execution is a separate, owner-triggered step (see "What still requires the owner").

## What the audit found (before any code was written)

Every stage of the pipeline already existed and was already tested, **except one link**: nothing
ever consumed `catalogue-dataset-registry.ts`'s `targetPackageCode` field to create an
`IndustryDataPackage` and assign a completed import job's `MasterItem`s to it. The registry's own
doc comment said as much: *"Commercial package this dataset's published items are assigned to
once imported — see industry-package-service (not built by this phase)."*

Confirmed already working, unchanged, reused as-is:
- Dataset registry (15 datasets, all `READY`) — `catalogue-dataset-registry.ts`
- Read-only dry run — `registerAndDryRun()`
- Resumable, checkpointed, optimistically-locked batch execution — `confirmExecution()` /
  `processNextBatch()`
- MasterItem/MasterItemVersion/MasterItemClassification/MasterHierarchyNode creation, with
  versions created already `PUBLISHED` — `master-catalogue-bulk-import-service.ts`'s `evaluate()`
- Company entitlement checks — `package-entitlement-service.ts`
- Customer Marketplace (`/marketplace`, `GET /api/data-packages`) — real, DB-backed, already
  showed `"No packages published yet."` truthfully rather than fake data
- My Library (`/company-library`) — real, DB-backed
- BOQ search/autocomplete (`item-search-service.ts`, `GET /api/items/search`,
  `AddItemFromSourceModal`) — real, ranked, already package-aware; just had nothing to find
- Manual BOQ entry fallback — real, fully independent of any package state
- Immutable BOQ snapshot on catalogue-item selection — real
  (`boq-item-source-service.ts`'s `resolveMasterItemDefaults()`)
- Platform-owner unrestricted access, separate from company entitlement — real

**Conclusion: no schema migration was needed anywhere in this phase.** Every model
(`IndustryDataPackage`, `IndustryDataPackageItem`, `MasterItem`, `MasterItemVersion`, etc.) already
existed and was correctly fielded.

## What was built

1. `src/lib/services/industry-package-activation-service.ts`
   - `publishJobToPackage(owner, jobId)` — the missing link: creates (or reuses) the dataset's
     package via the existing `createPackage()`, then assigns every `MasterItem` from that job's
     batch via the existing `addItemsToPackage()`. Idempotent (both underlying functions already
     were).
   - `activateDataset(owner, datasetId)` — a one-call convenience orchestrator: reuses or starts a
     dry run, confirms execution, drives up to 40 batches via the new `runJobBatches`, then
     publishes to package if the job completed. Resumable — call again if a large dataset isn't
     finished.
2. `runJobBatches()` added to `master-catalogue-import-job-service.ts` — a bounded loop around the
   existing, unmodified `processNextBatch()`. No import logic duplicated or changed.
3. Two new admin routes: `POST /api/admin/master-catalogue/datasets/jobs/[jobId]/publish-package`,
   `POST /api/admin/master-catalogue/datasets/[datasetId]/activate`.
4. A "Publish to package" button added to the existing, already-built
   `src/app/admin/(protected)/master-boq/dataset-activation-panel.tsx` — the admin UI at
   `/admin/master-boq` already handled dry-run/execute/resume/cancel with a polling loop; it was
   simply missing the step after a job completes.
5. `docs/hvac-legacy-item-reconciliation.md` — investigation of the 44 pre-existing production
   `MasterItem` rows; concludes they predate both this pipeline and the separate `/imports`
   company-library staging path, and proves the governed import is safe to run regardless (matches
   by `{disciplineId, itemCode}`, upserts on match, leaves non-matches untouched).

## Real local verification (HVAC dataset, 891 rows, `data-imports/hvac/*.csv`)

Run via `tests/industry-package-activation-service.test.ts` against local Postgres:

| Step | Result |
|---|---|
| Dry run | 891 valid rows, 0 rejected, `toInsert: 891` |
| Confirm + batch execution (`activateDataset`, single call) | Job reached `COMPLETED`/`COMPLETED_WITH_WARNINGS`, `processedRows: 891` |
| Package creation | `industryDataPackage` row created, `key: "hvac-library"`, `status: ACTIVE` |
| Item assignment | All inserted `MasterItem`s (itemCode prefix `HVAC-`) assigned; `itemCount` on the package matches the real `MasterItem` count exactly |
| Idempotency (second `activateDataset` call, same dataset) | Same item count, same assignment count — zero duplicates |
| Marketplace | `listPackages()` returns the `hvac-library` package with the real, non-zero `itemCount`; `listPackageItems()` returns exactly that many real items |
| Guard | `publishJobToPackage` on a `PAUSED` (incomplete) job correctly rejects with `JOB_NOT_COMPLETE` |

Test file also re-ran the pre-existing `tests/catalogue-prod-activate.test.ts` (18 tests, the
underlying engine's own suite — dry run, confirm, checksum-change rejection, concurrent-lock
prevention, cancel-then-block) in the same pass: **23/23 tests passed**, no interaction issues
between the new orchestration layer and the existing engine.

## What still requires the owner

This agent authenticates to production the same way it did for the earlier
PROPOSAL-SOURCE-TYPE-RECOVERY migration: **it cannot**. `requirePlatformActor()` resolves identity
only from a real authenticated session cookie — there is no service-token bypass, by design. Every
action below needs the owner's own browser session at `/admin/master-boq`:

1. Open `https://quantara.vistabylara.com/admin/master-boq`.
2. For **HVAC** (`quantara-master-hvac-v1`, 891 rows, smallest dataset): click **Run dry run** →
   **Execute import** → confirm in the modal. The panel polls `continue` automatically until the
   job completes (no further clicks needed). Once it shows `COMPLETED`, click the new **Publish to
   package** button.
3. Repeat per dataset in the order the instruction specifies (HVAC, Plumbing, Civil Works,
   Structural, Architectural Finishes, Doors and Windows, Facade, Roofing, Site Infrastructure,
   Landscaping, General Requirements, Temporary Works, Closeout, BIM and Digital Deliverables, UAE
   Authority and Regulatory). Plumbing (13,111 rows) and the larger construction datasets will take
   longer to process but use the same three clicks.
4. After each dataset, verify at `https://quantara.vistabylara.com/marketplace` that the
   corresponding library card now shows a real, non-zero item count.

**Not done in this phase:** actual execution of any dataset against the production database —
only proven, tested, deployed code that makes that execution a 2-click action per dataset instead
of a missing capability.
