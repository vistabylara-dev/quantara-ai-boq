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

## Complete registry — CATALOGUE-ACTIVATE-2, 2026-08-05

All 15 datasets are now registered in `src/lib/services/catalogue-dataset-registry.ts`
(`quantara-master-{folder}-v1`), verified `READY` by both the fast
metadata-only readiness check and (for a sampled subset — see
`docs/catalogue-registry-evidence.md`) the full file-verifying deep check.
**No import has been executed. No MasterItem/MasterItemVersion rows have
been created. No packages exist yet.** This table only proves the registry
itself is complete and internally consistent.

| Dataset ID | Folder | Files | Rows | Discipline | Alias | Package | Fingerprint | Status |
|---|---|---:|---:|---|---|---|---|---|
| `quantara-master-hvac-v1` | `data-imports/hvac` | 2 | 891 | `mechanical` | hvac→mechanical | `hvac-library` | `0ba5d8f701c97cbc…` | MANUAL |
| `quantara-master-plumbing-v1` | `data-imports/plumbing` | 13 | 13,111 | `plumbing` | — | `plumbing-library` | `886f3d56118b5eb6…` | MANUAL |
| `quantara-master-architectural-finishes-v1` | `data-imports/architectural-finishes` | 15 | 80,176 | `interior-fit-out` | — | `architectural-finishes-library` | `7eca6b9bb0edf8bb…` | DISCOVERY_VERIFIED |
| `quantara-master-bim-digital-deliverables-v1` | `data-imports/bim-digital-deliverables` | 1 | 4,718 | `construction` | — | `bim-digital-deliverables-library` | `49b8db0f23bc0158…` | DISCOVERY_VERIFIED |
| `quantara-master-civil-works-v1` | `data-imports/civil-works` | 1 | 3,675 | `construction` | — | `civil-works-library` | `f701f22f2af9744f…` | DISCOVERY_VERIFIED |
| `quantara-master-closeout-v1` | `data-imports/closeout` | 2 | 9,452 | `construction` | — | `closeout-library` | `9b5d30b556b4f8b7…` | DISCOVERY_VERIFIED |
| `quantara-master-doors-and-windows-v1` | `data-imports/doors-and-windows` | 3 | 11,567 | `construction` | — | `doors-and-windows-library` | `6a181d9a3e333edf…` | DISCOVERY_VERIFIED |
| `quantara-master-facade-v1` | `data-imports/facade` | 5 | 15,786 | `construction` | — | `facade-library` | `0d455b78e7038815…` | DISCOVERY_VERIFIED |
| `quantara-master-general-requirements-v1` | `data-imports/general-requirements` | 1 | 4,065 | `construction` | — | `general-requirements-library` | `0896feb484edf791…` | DISCOVERY_VERIFIED |
| `quantara-master-landscaping-v1` | `data-imports/landscaping` | 1 | 2,867 | `landscaping` | — | `landscaping-library` | `14741838e95f135f…` | DISCOVERY_VERIFIED |
| `quantara-master-roofing-v1` | `data-imports/roofing` | 1 | 4,162 | `construction` | — | `roofing-library` | `28c824da3d1b3e62…` | DISCOVERY_VERIFIED |
| `quantara-master-site-infrastructure-v1` | `data-imports/site-infrastructure` | 1 | 4,345 | `construction` | — | `site-infrastructure-library` | `6994366dc5c54b51…` | DISCOVERY_VERIFIED |
| `quantara-master-structural-v1` | `data-imports/structural` | 2 | 9,047 | `construction` | — | `structural-library` | `622361695cfe8b0c…` | DISCOVERY_VERIFIED |
| `quantara-master-temporary-works-v1` | `data-imports/temporary-works` | 2 | 7,954 | `construction` | — | `temporary-works-library` | `7fb4472e473c8b7b…` | DISCOVERY_VERIFIED |
| `quantara-master-uae-authority-regulatory-v1` | `data-imports/uae-authority-regulatory` | 3 | 11,681 | `construction` | — | `uae-authority-regulatory-library` | `0e45a871ddd8de56…` | DISCOVERY_VERIFIED |

**Totals: 15 datasets, 53 files, 183,497 rows** — identical to the
Checkpoint 1 discovery baseline. Fingerprints are truncated sha256
(`computeDatasetFingerprint`, `catalogue-dataset-registry.ts`) — they fold
in dataset ID, version, discipline, package, schema profile, and every
file's checksum + expected row count, so any future edit to mapping or
source data changes the fingerprint.

See `docs/catalogue-registry-evidence.md` for the full reconciliation
detail, schema profile description, and readiness results.

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
