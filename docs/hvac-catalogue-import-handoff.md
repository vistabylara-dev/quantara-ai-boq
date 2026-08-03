# HVAC Catalogue Import — Handoff Report

**Date:** 2026-08-04
**Scope:** Converting Lara's HVAC master item libraries into the app's import pipeline, plus three
small feature additions to `/imports` needed to make repeated batch imports usable.

## 1. What this is

Lara supplied spec-template item libraries (no pricing — item name, description template,
unit, MasterFormat code, OmniClass reference, and a blank specification placeholder for her team
to fill in later) for two HVAC sub-categories. These were converted into CSVs matching the app's
existing `/imports` field format and are staged for import as `CompanyLibraryItem` records — not
`RateCatalogueItem`, see §3 for why.

No technical specifications, pricing, supplier names, or manufacturer data were invented anywhere
in this pipeline. Every numeric/spec field either came from the source file or was left blank for
the company to populate from real supplier data.

## 2. Converted data files

| File | Rows | Item code range | Categories |
|---|---|---|---|
| `data-imports/hvac/hvac-company-library-import.csv` | 707 | `HVAC-0001`–`HVAC-0707` | 29 (General Requirements, Piping systems ×10, Valves, Instruments, Pumps, Water Treatment, Insulation, Ductwork, Dampers, Air Terminals, Fans, AHU/AC Equipment, Central Plant, Air Treatment, Controls/BMS, Testing & Commissioning, Specialist Systems, Ancillary) |
| `data-imports/hvac/hvac-air-distribution-company-library-import.csv` | 184 | `HVAC-AD-0001`–`HVAC-AD-0184` | 8 (Diffusers, Grilles & Registers, Louvers, Dampers, Air Terminal Units, Acoustic Devices, Plenums & Accessories, Specialist Applications) |

Both files use the same column schema, matching `IMPORT_FIELD_KEYS` in
`src/lib/services/import-service.ts`:

```
itemCode, discipline, category, description, specification, quantity, unit,
supplier, cost, margin, sellingRate, manufacturer, brand, model
```

- `itemCode`: generated, prefixed per source file to avoid collisions across batches (uniqueness
  is enforced per company on `CompanyLibraryItem.companyItemCode`).
- `discipline`: static `"hvac"` (currently unused by the import executor — see §5).
- `category` / `description` / `unit`: taken directly from the source columns
  (`System / Category`, `Item Name`, `Unit`).
- `specification`: composite of the source's Description Template + MasterFormat code +
  OmniClass reference + blank spec placeholder, pipe-delimited and labeled.
- `quantity`, `supplier`, `cost`, `margin`, `sellingRate`, `manufacturer`, `brand`, `model`: left
  blank intentionally. Not fabricated.

**Not yet imported.** These CSVs are staged in the repo, not yet run through `/imports` in the
live app (`https://quantara.vistabylara.com`). Nothing lands in the database until Lara (or
whoever has `imports:manage`) uploads them, maps columns, validates, approves, and executes.

## 3. Why `COMPANY_LIBRARY`, not `RATE_CATALOGUE`

`RateCatalogueItem.baseCost` is a non-nullable `Decimal(18,4)` column
(`prisma/schema.prisma`), and `RATE_CATALOGUE` import validation hard-requires a numeric `cost`
per row (`REQUIRED_FIELDS_BY_DESTINATION.RATE_CATALOGUE` in `import-service.ts`). Unpriced rows
can't be created there — they'd fail validation outright.

`COMPANY_LIBRARY` only requires `itemCode`, `description`, `unit`
(`REQUIRED_FIELDS_BY_DESTINATION.COMPANY_LIBRARY`), and its executor
(`executeCompanyLibraryRow`) defaults missing `cost`/`margin`/`sellingRate` to `0` rather than
rejecting the row. That's the correct home for an unpriced spec-template library today.

`CompanyLibraryItem` has a `defaultRateCatalogueItemId` FK field in the schema, implying an
intended "promote to rate catalogue once priced" relationship — **but no service/route currently
implements that promotion.** If the next phase is "let the company price these and push them into
the real rate catalogue," that promotion flow doesn't exist yet and needs to be built. Flagging
this as the most likely next backend task.

## 4. Code changes (already merged into the working tree)

All changes are scoped to the already-database-backed `/imports` module — no changes touched any
of the still-local/LocalStorage modules (`/catalogue`, `/industries`, `/settings`, `/templates`,
document generation, client-preview).

| File | Change |
|---|---|
| `src/app/imports/page.tsx` | File input now accepts `multiple`; uploads run sequentially per file (each file = its own import job, since each has its own headers/mapping) with per-file progress instead of redirecting away after the first upload. Added a **Delete** button per job row (confirm-gated). |
| `src/app/imports/[importJobId]/page.tsx` | Added "reuse a saved mapping" dropdown, sourced from the pre-existing (previously unused in the UI) `GET /api/import-mapping-templates` endpoint, filtered client-side to the job's `sourceType`/`destinationType`. Added "save this mapping as a template" checkbox + name field, wired to the existing `saveAsTemplateName` field on `PUT /api/imports/:id/mapping`. Added a **Delete this import** button. |
| `src/app/api/imports/[importJobId]/route.ts` | Added `DELETE` handler → `deleteImportJob` service call. |
| `src/lib/services/import-service.ts` | Added `deleteImportJob(actor, importJobId)`: RBAC-checked (`imports:manage`), company-scoped, deletes the `ImportJob` row. `ImportRow` cascades via the existing FK (`onDelete: Cascade` in schema). **Does not** delete any `CompanyLibraryItem`/`RateCatalogueItem` already created by a prior execute — those have no cascading relation back to `ImportJob`, only a plain `destinationEntityId` string reference. Deleting a completed job removes its audit trail, not the data it already created. |

Followed `quantara-architecture-guard` rules throughout: no direct Prisma access from components
(all through the existing repository/service layer), RBAC check on the new mutating route,
company-scoped queries, consistent `{ ok, data }` / `{ ok, error }` response shape, no
float/number used for money fields (none of this touched money fields).

## 5. Known gaps / open items for whoever picks this up

1. **Promotion flow (Company Library → Rate Catalogue) doesn't exist.** Needed once items get
   priced, if the intent is for them to become billable BOQ rate items.
2. **`discipline` column is currently inert.** It's accepted by the import mapping UI but
   `executeCompanyLibraryRow` doesn't use it to set `disciplineId` (that's a real FK to
   `MasterDiscipline`, not a free-text field, so a string-to-ID resolution step would be needed).
   Right now it's mapped but silently dropped.
3. **Production `DATABASE_URL` / `APP_BASE_URL` were empty** in `.env.production.local` on this
   machine as of this session — if imports fail on the live app, check Vercel's dashboard
   (Project → Settings → Environment Variables → Production) before assuming a code bug.
4. **Full `npm run build` was not completed** in this session (sandbox environment; `tsc --noEmit`
   ran >7 minutes without finishing). ESLint passed clean on all four changed files. Run
   `npm run lint && npm run build` (Docker/Postgres up for the integration test suite) before
   treating this as production-ready, per the repo's own `quantara-quality-gate`.
5. **More industry batches are expected.** Same conversion pattern (source columns → the 14
   `IMPORT_FIELD_KEYS`, `cost`/`margin`/`sellingRate`/`manufacturer`/`brand`/`model` left blank,
   prefixed item codes per batch to avoid collisions) will apply to each new industry Lara sends.

## 6. How to actually run the import (for reference)

1. `https://quantara.vistabylara.com/imports` → select **Destination: Company Library**.
2. Select one or both CSVs from `data-imports/hvac/` (multi-select now supported).
3. Open each created job → map the 14 fields to the matching source columns (or reuse a saved
   template after the first one) → **Save mapping** → **Validate rows**.
4. Select all valid/warning rows → **Approve selected** → **Execute import**.
5. Items land as `CompanyLibraryItem` rows scoped to the company, `sourceType: IMPORTED`, cost/margin/sellingRate = 0 pending real pricing.
