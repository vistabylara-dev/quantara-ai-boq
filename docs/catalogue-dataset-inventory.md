# Catalogue dataset inventory

Source of truth: `src/lib/services/catalogue-dataset-registry.ts`. This is
the **only** place a dataset becomes "approved" — a folder existing under
`data-imports/` does not make it approved. A dataset here has a stable ID,
a per-file checksum verified against the live file on every read (a changed
or missing file is rejected, not silently imported), an industry/discipline
mapping, and a specification-parsing profile.

| Dataset | Folder | Files | Rows (registry manifest) | Industry | Discipline | Target package | Status | Import readiness | Blocker |
|---|---|---|---|---|---|---|---|---|---|
| HVAC Master Catalogue (`quantara-master-hvac-v1`) | `data-imports/hvac` | 2 | 891 (707 + 184) | Construction | Mechanical (HVAC) | HVAC | **Registered, approved, checksummed** | Ready — dry-run and execute routes exist and are wired to this exact dataset | `IMPORTED_UNPUBLISHED` (unconfirmed origin) — 44 production items exist but `latestJob: null` (no governed import batch ever ran), `publishedVersions: 0`, zero classification/hierarchy — the 44 items likely did not come from this pipeline; needs inspection before executing (see production evidence below) |
| Plumbing Master Catalogue (`quantara-master-plumbing-v1`) | `data-imports/plumbing` | 13 | ~13,111 (manifest total) | Construction | Plumbing | Plumbing | **Registered, approved, checksummed** | Ready — same pipeline | `NOT_IMPORTED` — 0 production items, `latestJob: null`; awaiting owner approval to execute |
| Architectural Finishes | `data-imports/architectural-finishes` | 15 | Unknown — not registered | — | — | — | **Not registered/approved** | Blocked | No registry entry, no checksum, no hierarchy/parser mapping |
| BIM Digital Deliverables | `data-imports/bim-digital-deliverables` | 1 | Unknown | — | — | — | Not registered | Blocked | Same |
| Civil Works | `data-imports/civil-works` | 1 | Unknown | — | — | — | Not registered | Blocked | Same |
| Closeout | `data-imports/closeout` | 2 | Unknown | — | — | — | Not registered | Blocked | Same |
| Doors and Windows | `data-imports/doors-and-windows` | 3 | Unknown | — | — | — | Not registered | Blocked | Same |
| Facade | `data-imports/facade` | 5 | Unknown | — | — | — | Not registered | Blocked | Same |
| General Requirements | `data-imports/general-requirements` | 1 | Unknown | — | — | — | Not registered | Blocked | Same |
| Landscaping | `data-imports/landscaping` | 1 | Unknown | — | — | — | Not registered | Blocked | Same |
| Roofing | `data-imports/roofing` | 1 | Unknown | — | — | — | Not registered | Blocked | Same |
| Site Infrastructure | `data-imports/site-infrastructure` | 1 | Unknown | — | — | — | Not registered | Blocked | Same |
| Structural | `data-imports/structural` | 2 | Unknown | — | — | — | Not registered | Blocked | Same |
| Temporary Works | `data-imports/temporary-works` | 2 | Unknown | — | — | — | Not registered | Blocked | Same |
| UAE Authority/Regulatory | `data-imports/uae-authority-regulatory` | 3 | Unknown | — | — | — | Not registered | Blocked | Same |

## Why only 2 of 15 are "approved"

The task's own rule is explicit: *"Do not assume all folders are approved... Do
not treat scratch scripts or unknown CSVs as approved datasets."* Registering
a new dataset is real curation work per discipline — it requires:

1. A specification parser for that discipline's row format (see
   `parseHvacSpecification` / `parsePlumbingSpecification` as the existing
   pattern — each is discipline-specific, not generic).
2. A hierarchy parent chain (industry → discipline → system) matching the
   existing `MasterHierarchyNode` tree.
3. A reviewed, approved checksum per file, computed from a validated source
   — not just whatever bytes currently sit in the repo.
4. Expected row counts confirmed against a real read.

None of the other 13 folders have had this done. Registering them is real,
separate work — rushing it to hit an "import everything" instruction would
mean either fabricating checksums/mappings without validation (exactly what
the task prohibits) or reusing the HVAC/Plumbing parsers on data they were
never built for, silently corrupting hierarchy/classification data. Neither
is safe. This inventory documents them as a known, explicit backlog rather
than silently ignoring them.

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
