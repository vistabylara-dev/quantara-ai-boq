# Upload workflow contract

Every file upload in Quantara serves exactly one purpose. The **page/action the
user clicked determines the purpose first** — the file's extension is only
used afterward, to check whether the selected file is *allowed* for that
purpose. Purpose must never be inferred solely from a file extension after the
fact, and a route built for one purpose must never hand a file to another
purpose's parser.

This document is the source of truth for which route serves which purpose. It
reflects the **routes that actually exist in this codebase today** — it does
not invent new endpoints for capabilities that don't exist yet. Where a
described category is not yet a dedicated feature, that is stated explicitly
rather than implied.

Background: a production PDF upload was misrouted through the CSV/XLSX
importer and returned "This XLSX file couldn't be read" — a spreadsheet error
for a file that was never a spreadsheet. Root cause and the fix are below.

## 1. PROJECT_DRAWING

**User location:** Project → Drawings → "Upload a drawing"
(`/projects/{projectId}/drawings`)

| | |
|---|---|
| Accepted formats | pdf, png, jpg, jpeg, tif, tiff, dwg, dxf, ifc, rvt, zip (`DRAWING_EXTENSIONS`, `src/lib/validation/drawing-schema.ts`) |
| Max size | `DRAWING_UPLOAD_MAX_BYTES_DEFAULT` (250MB default, `src/lib/validation/drawing-schema.ts`), server-overridable via `DRAWING_UPLOAD_MAX_BYTES` |
| Authorization | `getCurrentActor()` + `requireCapability` inside `authorizeDrawingUpload`, tenant-scoped to the project's company |
| Storage target | Private Vercel Blob (direct browser-to-Blob `put()`, never buffered through a server route) |
| Parser | **NONE at upload time.** Byte-signature check only (`verifyPdfSignature`) for PDFs; no XLSX/CSV/table parser is ever on this path |
| Finalization | `finalizeDrawingUpload` verifies the uploaded object (size, checksum, signature) against the authorized session before writing the `ProjectFile` row |
| DB record | `ProjectFile` (via `ProjectFileUploadSession`) |
| Success destination | Drawing list on the same page; preview/download via `/api/files/{fileId}/download` |

Routes:
- `POST /api/projects/{projectId}/drawings/upload-authorization`
- `POST /api/projects/{projectId}/drawings/upload-authorization/{sessionId}/finalize`
- `GET /api/projects/{projectId}/drawings`
- `GET /api/files/{fileId}/download` (Range-aware, private, tenant-scoped)
- `POST /api/projects/{projectId}/drawings` — legacy server-buffered fallback, only reachable when `STORAGE_PROVIDER !== "vercel-blob"` (local dev without a Blob token); never used in production

Error codes: see `src/lib/services/drawing-service.ts` — `DRAWING_TYPE_UNSUPPORTED`-equivalent is the extension check in `validateDrawingUpload`, plus `DIRECT_UPLOAD_NOT_SUPPORTED` (409), `FILE_TOO_LARGE`/`FILE_TYPE_NOT_SUPPORTED`/`FILE_MIME_MISMATCH` (400), `UPLOAD_SESSION_EXPIRED` (410), `BLOB_OBJECT_MISSING` (404), `UNSAFE_FILE_CONTENT` (400).

## 2. PROJECT_ATTACHMENT / DOCUMENT_EXTRACTION (legacy, internal)

**User location:** direct URL only — `/projects/{projectId}/files`. **Not
linked from any navigation as of this phase** (see "Fixed in this phase"
below); this page predates the CORE-FLOW-1 drawing uploader and exists today
as the manual test surface for the file-classification/table-extraction
pipeline (`src/lib/files/preprocessing-handler.ts`,
`table-extraction-handler.ts`, `classification-handler.ts`).

| | |
|---|---|
| Accepted formats | Not validated client-side (bare `<input type="file">`, no `accept` filter) |
| Storage target | `ProjectFile` metadata + configured storage adapter, buffered through the server route (not direct-to-Blob) |
| Parser | Triggered explicitly by the "Classify" / "Render Pages" / "Extract Tables" buttons after upload — never automatically. This is the real `DOCUMENT_EXTRACTION` workflow described in the product spec, scoped to this internal page today |
| DB record | `ProjectFile`, `DrawingPage`, `ExtractedTable`/`ExtractedTableRow` |

Routes:
- `POST /api/projects/{projectId}/files` (upload), `GET` (list)
- `POST /api/files/{fileId}/classify`, `/preprocess`, `/extract` (explicit, user-triggered)
- `GET /api/files/{fileId}/pages`, `/tables`

This page is intentionally left out of scope for a redesign in this phase —
it is not the source of the reported bug (it never touches the XLSX/CSV
parser) and CORE-FLOW-2/UPLOAD-WORKFLOW-CONTRACT-1 both exclude UI redesign.
It remains reachable only by direct URL.

## 3 & 4. MEASUREMENT_IMPORT and BOQ_ITEM_IMPORT

**No dedicated pages exist for these today.** Both are currently served by
the single shared spreadsheet importer described below, distinguished only by
its `destinationType` field (`DRAFT_BOQ` is the closest existing match for
"BOQ item import"; there is no `destinationType` specific to measurement
schedules — `STAGING_REVIEW`/`COMPANY_LIBRARY`/`RATE_CATALOGUE` are the other
options). Building separate `Import Measurements` and `Import BOQ Items`
pages/components is a real feature addition, not a bug fix, and is out of
scope for this recovery phase — it is called out here as known remaining
scope, not silently implied to exist.

**User location:** `/imports`

| | |
|---|---|
| Accepted formats | csv, xlsx only — enforced client-side (`accept=".csv,.xlsx"` + extension filter on both the file-picker and drag-drop paths) and now also server-side (see fix below) |
| Max size | Platform request-body limit (multipart form, buffered) |
| Authorization | `requireCapability(actor, "imports:manage")`, company-scoped |
| Storage target | `ImportJob` + `ImportRow` (staged only — nothing lands in `CompanyLibraryItem`/`RateCatalogueItem`/BOQ until an explicit `execute` call after mapping and row approval) |
| Parser | `parseCsv` or `parseXlsx` (`src/lib/imports/`), selected by client-declared `sourceType` |
| DB record | `ImportJob`, `ImportRow` |
| Success destination | `/imports/{importJobId}` for column mapping → validation → approval → execute |

Routes:
- `POST /api/imports` (upload), `GET /api/imports` (list)
- `POST /api/imports/{importJobId}/mapping`, `/validate`, `/rows/{rowId}`, `/execute`
- `DELETE /api/imports/{importJobId}`

## 5. CATALOGUE_DATASET_IMPORT

**User location:** Platform Admin → Master Catalogue (owner-only; normal
company users have no route to this UI or its APIs — enforced by
platform-role checks, not just navigation hiding).

| | |
|---|---|
| Accepted formats | Approved, registered CSV datasets only (`data-imports/hvac/*.csv`, `data-imports/plumbing/*.csv`), resolved via `catalogue-dataset-registry.ts` — not arbitrary user-uploaded files |
| Parser | `master-catalogue-bulk-import-service.ts`, `hvac-master-import-service.ts`, `plumbing-master-import-service.ts` |
| Authorization | Platform-owner/master-data role only |
| Flow | dry-run → review → confirm → resumable job → publish |

Routes: `POST /api/admin/master-catalogue/datasets/{datasetId}/dry-run`,
`/jobs`, `/jobs/{jobId}/continue|confirm|cancel`, plus the older single-shot
`POST /api/admin/master-catalogue/import` / `/import/{batchId}/rollback`.

This system is entirely separate from the customer-facing `/imports`
spreadsheet importer and shares no code path with it.

## The exact PDF → XLSX misrouting bug (fixed in this phase)

Root cause was **navigation, not the parser itself**:

1. The dashboard header's **"Upload Drawing"** button — the single most
   prominent upload action in the app, shown to every user on every visit to
   `/dashboard` — computed
   `currentProject ? \`/projects/${currentProject.id}/files\` : "/imports"`
   (`src/components/dashboard/workspace-header.tsx`). A user with no active
   project yet (e.g. one who couldn't finish project creation) clicking this
   button landed directly on the CSV/XLSX importer. This is the most likely
   exact path the reported production PDF took.
2. The dashboard "Quick start workspace" widget's step 2, labeled the same
   way, had the identical `href` logic
   (`src/components/dashboard/quick-start-workspace.tsx`).
3. Separately, **no navigation anywhere in the app linked to the real drawing
   uploader** (`/projects/{projectId}/drawings`) at all — the project page's
   own top nav tab was labeled "Files & Drawings" but pointed at the legacy
   `/files` extraction-preview page (`src/app/projects/[projectId]/layout.tsx`).
   So even a user who *did* have an active project and clicked "Upload
   Drawing"/"Files & Drawings" never reached the real drawing uploader either
   — they landed on the legacy `/files` page instead.
4. On `/imports`, the file-picker's hidden `<input accept=".csv,.xlsx">`
   `onChange` handler called `uploadFiles()` directly, bypassing the
   extension-filtering `acceptFileList()` that the drag-and-drop path used —
   `accept` is only a UI hint, not an enforced filter, so a PDF selected via
   "choose file → all files" reached the upload call unfiltered
   (`src/app/imports/page.tsx`).
5. `sourceType` sent to `POST /api/imports` is derived purely from the
   filename client-side (`.csv` → `"CSV"`, everything else → `"XLSX"`) and
   trusted as-is server-side (`src/app/api/imports/route.ts`,
   `src/lib/services/import-service.ts`). A PDF therefore reached
   `parseXlsx()`, which threw, and the existing catch block returned the
   generic, spreadsheet-specific message: *"This XLSX file couldn't be
   read..."*

Fixes applied:
- `workspace-header.tsx`: the dashboard's "Upload Drawing" button now always
  resolves to `/projects/{id}/drawings` (or `/projects/new` with no project
  yet) — never `/imports`, never the legacy `/files` page.
- `quick-start-workspace.tsx`: "Upload Drawings" now always resolves to
  `/projects/{id}/drawings` (or `/projects/new` with no project yet) — never
  `/imports`, never the legacy `/files` page.
- `layout.tsx` project nav tab renamed "Drawings", now points at
  `/projects/{id}/drawings`.
- `imports/page.tsx`: the file-picker `onChange` now runs through the same
  `acceptFileList()` extension filter as drag-and-drop.
- `import-service.ts`: `createImportJob` now checks the real byte signature
  before parsing (`src/lib/validation/file-signatures.ts`) — a PDF signature
  is rejected immediately with `IMPORT_FILE_NOT_SPREADSHEET` and a message
  that names the actual problem and points at Upload Drawing, regardless of
  what `sourceType` the client claimed. This is defense in depth: even if a
  future UI bug reintroduces a bad link, the server itself can no longer be
  tricked into running a PDF through the XLSX parser.

## Known remaining scope (not implemented in this phase)

- No dedicated `Import Measurements` or `Import BOQ Items` pages/components
  exist — both would currently use the shared `/imports` flow. Building them
  as first-class, separately labeled workflows (per the product spec) is a
  real feature addition, intentionally out of scope for this recovery phase.
- The legacy `/projects/{projectId}/files` extraction-preview page still has
  no client-side extension filter on its own upload input. It is no longer
  linked from any navigation, which removes it from the reported bug's path,
  but it was not otherwise hardened in this phase since it isn't part of the
  reported failure and touching it further risks the "no redesign" boundary.
