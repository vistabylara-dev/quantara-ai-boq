# HVAC Legacy Item Reconciliation

**Date:** 2026-08-06
**Scope:** Checkpoint 3 of CATALOGUE CREATION AND COMMERCIAL ACTIVATION — reconcile the 44
pre-existing production `MasterItem` rows (discipline: Mechanical) before running the governed
HVAC dataset import.

## What's confirmed without a live production query

- `quantara-production-truth.md` (2026-08-05): 44 `MasterItem` rows exist in the `mechanical`
  discipline, 0 published `MasterItemVersion`, `latestJob: null` for `datasetId:
  "quantara-master-hvac-v1"` — meaning **none of the 44 were created through the governed
  `MasterCatalogueImportJob` pipeline** (`master-catalogue-import-job-service.ts`). If they had
  been, `MasterItem.sourceBatchId` would point at a `MasterCatalogueImportBatch` linked to a job
  for this dataset, and that job would show up in `listJobsForDataset`.
- `hvac-catalogue-import-handoff.md` (2026-08-04) independently describes a *separate*,
  not-yet-executed pipeline: two CSVs (707 + 184 = 891 rows, item codes `HVAC-0001`–`HVAC-0707`
  and `HVAC-AD-0001`–`HVAC-AD-0184`) staged for the `/imports` → `CompanyLibraryItem` path (a
  per-company staging table, not `MasterItem`). As of that doc's writing they had **not** been
  imported anywhere. This is not the source of the 44 either.
- Conclusion: the 44 production `MasterItem` rows predate both of the above and most likely trace
  to an early manual/ad-hoc seed (e.g. `prisma/seed-industry-packages.ts`'s own comment notes "as
  of 2026-08-05 ... only Mechanical has real items (44)" without explaining their origin, and no
  `MasterCatalogueImportBatch` row exists to attribute them to).

## Classification

Without a live `inspectDatasetProductionItems(owner, "quantara-master-hvac-v1")` call against
production (owner-authenticated only — this agent cannot run it), the 44 items are provisionally
classified **UNKNOWN, most likely LEGACY_SEED_ONLY** — created outside any governed import, item
codes unverified against the 891-row governed dataset.

**To get a definitive classification**, the owner (or a future authenticated run) should call:

```
POST /api/admin/master-catalogue/datasets/quantara-master-hvac-v1/items
```
(`GET`-equivalent via `inspectDatasetProductionItems` — lists all 44 with `sourceBatchId`,
`sourceBatchFileName`, `sourceBatchStatus`) and compare their `itemCode`s against the 891 codes in
`data-imports/hvac/*.csv`.

## Why it's safe to import HVAC regardless of the outcome

`master-catalogue-bulk-import-service.ts`'s `evaluate()` matches existing items by
**`{disciplineId, itemCode}`** (bulk pre-fetch, line ~182) before deciding insert vs. update vs.
unchanged — never by row order or file position. This means running the governed HVAC import
against production is safe under every possible classification of the 44:

- **If an existing item's `itemCode` matches a governed-dataset row**: it is upserted in place
  (same `MasterItem.id` preserved, a new `MasterItemVersion` is created) — exactly the "upsert
  matched identities" requirement, no duplication.
- **If an existing item's `itemCode` does not appear in the governed dataset**: it is left
  completely untouched — no deletion, no mutation, no BOQ-snapshot impact (checkpoint 3's
  "preserve historical rows" and "avoid deletion unless separately reviewed" requirements).

## Recommended action

1. Run the governed HVAC activation (`POST /api/admin/master-catalogue/datasets/quantara-master-hvac-v1/activate`,
   built in this phase — see `industry-package-activation-service.ts`). This is safe per the above
   regardless of the 44's origin.
2. After activation, diff the 44 original item codes against the (now larger) set of `mechanical`
   `MasterItem` rows to see how many were upserted vs. left as orphans.
3. If any orphans remain and don't belong to any registered dataset, they need a separate,
   explicitly-reviewed decision (retire vs. keep) — out of scope for this phase per the
   instruction's "avoid deletion unless separately reviewed."

**Status: reconciliation strategy determined and proven safe; exact per-item classification of
the 44 requires one authenticated production read the owner needs to trigger.**
