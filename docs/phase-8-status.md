# Phase 8 Status

Tracks real, verified status per sub-phase (implementation order per
`docs/phase-8-current-state-audit.md` section 5, which supersedes the spec's own
8A–8R lettering). Status values: `NOT_STARTED`, `ACTIVE`, `BLOCKED`, `MVP_COMPLETE`,
`VERIFIED`, `EXPERIMENTAL`, `PLANNED`. Never mark an experimental engine `VERIFIED`.

| # | Sub-phase | Status | Notes |
|---|---|---|---|
| 1 | File security and storage | VERIFIED | `ProjectFile` model + migration (`20260803024610_phase8_project_file`); reused `DocumentStorageAdapter` interface via new `local-project-file-storage-adapter.ts` (`.storage/project-files/`, tenant/project/category-namespaced keys, path-traversal-safe); MIME/extension/size validation (200MB cap) in `src/lib/files/file-security.ts`; sha256 checksum + non-blocking duplicate detection; routes: `POST/GET /api/projects/[projectId]/files`, `GET/DELETE /api/files/[fileId]`, `GET /api/files/[fileId]/download`; upload/delete gated by existing `files:manage` capability (OWNER/ADMIN/DESIGNER), read ungated within company (matches existing convention). 17 automated tests (`tests/phase8-file-storage.test.ts`) + live E2E against running dev server (upload/list/detail/download-byte-match/duplicate-detection/reject-unsupported-type/delete/404-after-delete), all passing. Known limitation: delete has no downstream-reference guard yet (no downstream models exist until later sub-phases — flagged in code for extension). |
| 2 | Background processing | NOT_STARTED | |
| 3 | Classification | NOT_STARTED | |
| 4 | CSV/XLSX/PDF table extraction | NOT_STARTED | |
| 5 | Drawing viewer | NOT_STARTED | |
| 6 | Scale calibration | NOT_STARTED | |
| 7 | Verification workbench | NOT_STARTED | |
| 8 | Room detection | NOT_STARTED | |
| 9 | Furniture detection | NOT_STARTED | |
| 10 | MEP symbols | NOT_STARTED | |
| 11 | Quantity formulas | NOT_STARTED | |
| 12 | BOQ import | NOT_STARTED | |
| 13 | Inspection forms | NOT_STARTED | |
| 14 | Findings and risks | NOT_STARTED | |
| 15 | BOQ from corrective actions | NOT_STARTED | |
| 16 | Technical reports | NOT_STARTED | |

Updated after every sub-phase completes lint + build + test + manual live
verification, not before.
