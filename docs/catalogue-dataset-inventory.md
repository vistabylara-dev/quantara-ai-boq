# Catalogue dataset inventory

Source of truth: `src/lib/services/catalogue-dataset-registry.ts`. This is
the **only** place a dataset becomes "approved" — a folder existing under
`data-imports/` does not make it approved. A dataset here has a stable ID,
a per-file checksum verified against the live file on every read (a changed
or missing file is rejected, not silently imported), an industry/discipline
mapping, and a specification-parsing profile.

## Automated discovery result — 2026-08-05

Produced by `discoverCatalogueDatasets()` (`src/lib/services/catalogue-discovery-service.ts`),
run via `GET /api/admin/master-catalogue/discovery`. This is a **strictly
read-only filesystem scan** — it streams and checksums every CSV under
`data-imports/**`, confirms folder/filename classification against each
file's own `discipline` column, and cross-checks against the
`MasterDiscipline` rows that actually exist. It makes zero database writes.

**Totals: 15 folders, 53 CSV files, 183,497 data rows, ~118MB.** All 53
files match the expected `company-library-import` header schema exactly;
zero blank/malformed rows found in any file.

| Dataset folder | Files | Rows | Bytes | Candidate discipline | Confidence | Notes |
|---|---:|---:|---:|---|---|---|
| `architectural-finishes` | 15 | 80,176 | 49.5MB | `interior-fit-out` | **AUTO_VALIDATED** | |
| `bim-digital-deliverables` | 1 | 4,718 | 2.5MB | `construction` | **AUTO_VALIDATED** | |
| `civil-works` | 1 | 3,675 | 1.8MB | `construction` | **AUTO_VALIDATED** | |
| `closeout` | 2 | 9,452 | 6.3MB | `construction` | **AUTO_VALIDATED** | |
| `doors-and-windows` | 3 | 11,567 | 8.5MB | `construction` | **AUTO_VALIDATED** | |
| `facade` | 5 | 15,786 | 13.9MB | `construction` | **AUTO_VALIDATED** | |
| `general-requirements` | 1 | 4,065 | 2.2MB | `construction` | **AUTO_VALIDATED** | |
| `hvac` | 2 | 891 | 0.34MB | *(none — see below)* | **NEEDS_OWNER_REVIEW** | already registered manually as `quantara-master-hvac-v1` mapping to `mechanical` |
| `landscaping` | 1 | 2,867 | 1.7MB | `landscaping` | **AUTO_VALIDATED** | |
| `plumbing` | 13 | 13,111 | 7.4MB | `plumbing` | **AUTO_VALIDATED** | already registered manually as `quantara-master-plumbing-v1` |
| `roofing` | 1 | 4,162 | 2.9MB | `construction` | **AUTO_VALIDATED** | |
| `site-infrastructure` | 1 | 4,345 | 2.7MB | `construction` | **AUTO_VALIDATED** | |
| `structural` | 2 | 9,047 | 5.1MB | `construction` | **AUTO_VALIDATED** | |
| `temporary-works` | 2 | 7,954 | 5.1MB | `construction` | **AUTO_VALIDATED** | |
| `uae-authority-regulatory` | 3 | 11,681 | 9.2MB | `construction` | **AUTO_VALIDATED** | |

**Why HVAC shows `NEEDS_OWNER_REVIEW`:** the classifier is deliberately
literal — it only accepts a folder's discipline if every file's own
`discipline` column value is an *exact string match* against an existing
`MasterDiscipline.key`. HVAC's files declare `discipline=hvac`, but the
existing `MasterDiscipline` row is keyed `mechanical` (a human decision
already encoded in the manually-curated registry's
`HVAC_PROFILE.disciplineKey`). This is the classifier correctly refusing to
silently assume a synonym rather than a bug — HVAC is not actually blocked,
since it already has an approved manual registry entry with the exact same
checksums this discovery scan independently recomputed (verified: first 16
hex chars of the recomputed HVAC file checksums match the registry's
recorded `approvedChecksum` values exactly). A future alias table
(`hvac` → `mechanical`) would let this resolve automatically; not added
yet since it would be guessing at a mapping policy rather than reading one
that already exists in code.

**13 of 15 folders map to the existing `construction` MasterDiscipline**,
not 13 new disciplines — the folder name (civil-works, structural, facade,
etc.) is the *package/category* distinction within construction, not a new
top-level discipline. This matches the existing HVAC pattern, where the
*industry* is always `construction` and the *discipline* (`mechanical`) is
one level below it.

## What "AUTO_VALIDATED" does and does not mean

`AUTO_VALIDATED` means: the folder/filename classification is confirmed by
real row content, the header schema is a known, already-handled shape, and
the target `MasterDiscipline` genuinely exists. It does **not** mean these
13 folders are registered, dry-run, or imported yet. Formal registration
(Checkpoint 4 below) still requires generating a manifest, a schema mapping
profile, and — per the existing HVAC/Plumbing pattern — a specification
parser appropriate to each dataset's content, none of which existed before
this discovery pass and none of which have been built yet. Rushing straight
to import without that would mean reusing the HVAC/Plumbing parsers on data
they were never built for, which risks silently corrupting hierarchy and
classification data. This inventory documents the discovery result as the
now-completed Checkpoint 1 and stops there pending owner review of this
report, per the task's own rule: *"Do not begin destructive import until
this report is produced."*

## What already exists (not being rebuilt)

The full governed pipeline this program's Checkpoints 2–4 ask for is already
implemented and was not re-built:

- `catalogue-dataset-registry.ts` — the registry itself.
- `master-catalogue-import-job-service.ts` — `registerAndDryRun`,
  `listRegisteredDatasetsSummary`, execute/rollback.
- `master-catalogue-bulk-import-service.ts`, `hvac-master-import-service.ts`,
  `plumbing-master-import-service.ts` — normalization, dedup, hierarchy
  mapping, idempotent upsert by stable item code.
- Routes: `GET /api/admin/master-catalogue/datasets`,
  `POST /api/admin/master-catalogue/datasets/[datasetId]/dry-run`,
  `POST /api/admin/master-catalogue/import`,
  `POST /api/admin/master-catalogue/import/[batchId]/rollback` — all
  `PLATFORM_OWNER`-gated.

## Production evidence — 2026-08-05, owner-provided

Real values from `GET /api/admin/master-catalogue/growth-snapshot` and
`GET /api/admin/master-catalogue/datasets`, run by the platform owner in a
live authenticated session. Not estimated, not sourced from any local
database.

```
growth-snapshot: totalMasterItems=44, publishedVersions=0,
  itemsWithClassification=0, itemsWithHierarchy=0, manufacturers=0,
  verifiedProductModels=0, standardAuthorities=0, disciplines=5,
  hierarchyNodes=0

datasets:
  quantara-master-hvac-v1     — currentProductionItemCount=44, latestJob=null
  quantara-master-plumbing-v1 — currentProductionItemCount=0,  latestJob=null
```

**HVAC — `IMPORTED_UNPUBLISHED`, unconfirmed origin.** 44 items exist in
production, but `latestJob: null` means the governed dataset-registry
pipeline (checksum-verified dry-run/execute, the one this file documents)
has never actually run for this dataset. Combined with
`publishedVersions: 0`, `itemsWithClassification: 0`, `itemsWithHierarchy: 0`
platform-wide, these 44 items have none of the enrichment the HVAC profile
(`parseHvacSpecification`, `hierarchyParentChain`) would produce, and 44
doesn't correspond to either source file's row count (707, 184) or their
sum. These items most likely predate this dataset's governed pipeline
entirely (leftover from an earlier/different import path) rather than being
a partial run of the approved 891-row dataset. Recommend inspecting their
`itemCode`/source metadata before running execute — execute is idempotent
by stable item code so it should be safe regardless, but the origin should
be understood first rather than assumed.

**Plumbing — `NOT_IMPORTED`.** 0 items, no job record. Clean, unambiguous —
ready to execute pending owner approval.

**Package/entitlement state — `UNKNOWN`.** Neither endpoint above reports
`IndustryDataPackage`, `IndustryDataPackageItem`, or
`CompanyPackageSubscription` counts. This needs a dedicated check (not yet
built) before Checkpoint 5/6/8 production state can be confirmed.

**Exact next action:** awaiting explicit owner approval to (a) inspect the
44 existing HVAC items' source/item-code metadata, then (b) execute the
governed import for Plumbing (and HVAC, once the anomaly is understood).
No dry-run or execute has been triggered yet.
