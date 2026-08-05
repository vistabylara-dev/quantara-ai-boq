# Catalogue Registry Evidence — CATALOGUE-ACTIVATE-2

Concrete evidence for the completed dataset registry. **This phase stops
before any import.** No MasterItem, MasterItemVersion, IndustryDataPackage,
or entitlement row has been created or modified by this work. See
`docs/catalogue-dataset-inventory.md` for the full registry table.

## 1. Existing manual registry entries

Two entries pre-date this phase and were **not regenerated** — only
extended with the new metadata fields (`industryCode`, `targetPackageCode`,
`schemaProfileId`, `active`, `approved`, `registrationSource`,
`validationStatus`), all other values byte-identical to before:

- `quantara-master-hvac-v1` — 2 files, 891 rows, checksums unchanged.
- `quantara-master-plumbing-v1` — 13 files, 13,111 rows, checksums
  unchanged.

## 2. Generated registry entries

13 entries produced by `generateDatasetDefinitions()`
(`src/lib/services/catalogue-registry-generator.ts`), run once against a
real discovery pass, hand-reviewed, and committed as static code in
`catalogue-dataset-registry.ts` — the same checksum-pinned model as the
manual entries, not a runtime dependency. See the full table in
`docs/catalogue-dataset-inventory.md`.

## 3. HVAC reconciliation

**No conflict.** HVAC's `disciplineKey` field was already `"mechanical"` in
the existing manual entry (the CSV's own `discipline` column says `"hvac"`,
but the registry's `disciplineKey` was already the correct, resolved
value — this is why the automated discovery classifier flags it as
`NEEDS_OWNER_REVIEW` when working from raw CSV content alone, while the
manual registry entry itself was never actually broken). Added
`disciplineAliases: { hvac: "mechanical" }` to the HVAC entry purely as
documentation, so a future person reading the registry doesn't have to
rediscover this by hand. The generator's `DISCIPLINE_ALIASES` constant
records the same mapping for any future automated re-classification.

Independent verification: this phase's discovery pass recomputed HVAC's
file checksums from scratch and confirmed both match the registry's
`approvedChecksum` values exactly (first 16 hex chars:
`3f53af3f2617227b` and `5637cd11dc85f13d`).

## 4. Plumbing reconciliation

**No conflict, no changes to file data.** Plumbing's discipline (`plumbing`)
already matches an existing `MasterDiscipline.key` with no alias needed.
Only the new metadata fields were added.

## 5. Schema profile

**`company-library-catalogue-v1`** — shared by all 13 generated datasets.
All 53 files across the whole registry (including HVAC/Plumbing) use the
identical column header:

```
itemCode,discipline,category,description,specification,quantity,unit,supplier,cost,margin,sellingRate,manufacturer,brand,model
```

`itemCode`/`discipline`/`category`/`description`/`unit` map directly.
`specification` is parsed by a per-dataset `parseSpecification`
implementation — HVAC and Plumbing keep their own bespoke parsers
(`hvac-specification-parser.ts`, `plumbing-specification-parser.ts`); the
13 generated datasets share one new parser
(`generic-code-ref-specification-parser.ts`) after sampling one row from
each of the 13 folders and confirming they all follow the same
`{description} | Code Ref: {code} [/ {code2 or OmniClass ref}] | Spec: {fields}` shape —
distinct from Plumbing's format (which has a leading `Subcategory:`
segment the other 13 don't).

**`cost`, `margin`, and `sellingRate` are classified as protected source
commercial metadata** — the registry's admin-listing DTO
(`listRegisteredDatasetsSummary`) never includes them, and they are not
read by the specification parsers at all. No route added in this phase
exposes them.

This has only been spot-checked (one sample row per folder), not verified
against the full ~170,000 rows those 13 folders contain — the real
per-row dry-run (the next phase) will surface any row that doesn't match
via a warning, exactly as the existing engine already does for HVAC and
Plumbing rows that don't parse cleanly.

## 6. Discipline aliases

```
DISCIPLINE_ALIASES = { hvac: "mechanical" }
```

(`catalogue-registry-generator.ts`). No other alias was needed — every
other folder's discipline column value already matches an existing
`MasterDiscipline.key` verbatim (`plumbing`, `interior-fit-out`,
`landscaping`, `construction`).

## 7. Package mappings

One package code per folder, `{folder}-library` — 15 total (including
`hvac-library`/`plumbing-library`, newly added to those two manual
entries). **No `IndustryDataPackage` database rows were created** — this
phase only records the *intended* target package code on each dataset
definition; actual package creation is a later, separate phase
(CATALOGUE-ACTIVATE-2's own spec explicitly excludes it: "Do not create
public package records in this phase").

## 8. File-ownership validation

`validateFileOwnership(listDatasetDefinitions())` → **0 violations**. Every
one of the 53 active CSV files belongs to exactly one active dataset —
verified programmatically, not just by construction.

## 9. Combined fingerprints

`computeDatasetFingerprint()` folds in dataset ID, version, discipline,
package code, schema profile ID, and every file's `fileName:checksum:rowCount`
(sorted, so filesystem order never matters). Full values recorded in
`docs/catalogue-dataset-inventory.md`'s registry table (truncated to 16
hex chars there for readability).

## 10. Readiness result

Two-tier readiness check, both **read-only, no import job/batch created**:

- **Fast check** (`checkDatasetReadinessFast`) — registry metadata + a live
  `MasterDiscipline` existence lookup, no file I/O. This is what
  `GET /api/admin/master-catalogue/datasets` actually calls for every
  dataset in the list — kept intentionally cheap.
- **Deep check** (`checkDatasetReadiness`, exposed at
  `GET /api/admin/master-catalogue/datasets/[datasetId]/readiness`) —
  additionally re-reads every file off disk to verify existence, checksum,
  and row count. Real I/O; called per-dataset on demand, never
  automatically for the whole registry in one request (an earlier version
  of this change did exactly that and caused a real 5-second+ timeout in
  `tests/catalogue-prod-activate.test.ts` — fixed by this split).

**Fast-check result: all 15 datasets → `READY`, zero block reasons, zero
warnings** (verified both by an automated test and by direct execution
against the real repository files during this phase).

**Deep-check result:** verified directly (not just via automated tests) for
`quantara-master-civil-works-v1` (smallest generated dataset) → `READY`. The
same check ran successfully as part of the pre-existing
`catalogue-prod-activate.test.ts` suite for the real HVAC dataset (18/18
tests passed, including full dry-run/execute/idempotency coverage — that
suite exercises real import execution against a test database, not
production, and was not run against production in this phase).

## 11. Exact import order recommendation

Per the task's own Checkpoint 10 (next phase) guidance and the discovery
report's findings:

1. **HVAC** (`quantara-master-hvac-v1`) — already has a resolved production
   anomaly investigation in progress (see `docs/catalogue-dataset-inventory.md`'s
   production evidence section from CATALOGUE-COMMERCIAL Checkpoint 1A);
   confirm that investigation's outcome before executing.
2. **Plumbing** (`quantara-master-plumbing-v1`) — clean `NOT_IMPORTED` state,
   no ambiguity, ready to execute pending owner approval.
3. **Smallest generated datasets first** (to prove the generic parser end
   to end on a small blast radius before larger runs): `civil-works` (1
   file, 3,675 rows), `bim-digital-deliverables` (1 file, 4,718 rows),
   `general-requirements` (1 file, 4,065 rows), `landscaping` (1 file,
   2,867 rows), `roofing` (1 file, 4,162 rows), `site-infrastructure` (1
   file, 4,345 rows).
4. **Remaining multi-file generated datasets**, smallest to largest:
   `closeout` (2 files, 9,452 rows), `structural` (2 files, 9,047 rows),
   `temporary-works` (2 files, 7,954 rows), `doors-and-windows` (3 files,
   11,567 rows), `uae-authority-regulatory` (3 files, 11,681 rows),
   `facade` (5 files, 15,786 rows).
5. **Architectural Finishes last** (15 files, 80,176 rows — by far the
   largest single dataset, ~44% of all rows outside HVAC/Plumbing).

Each should go through its own dry-run → review → execute → verify cycle,
never all at once, per the next phase's own explicit requirement.
