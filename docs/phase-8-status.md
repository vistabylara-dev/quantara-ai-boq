# Phase 8 Status

Tracks real, verified status per sub-phase (implementation order per
`docs/phase-8-current-state-audit.md` section 5, which supersedes the spec's own
8A–8R lettering). Status values: `NOT_STARTED`, `ACTIVE`, `BLOCKED`, `MVP_COMPLETE`,
`VERIFIED`, `EXPERIMENTAL`, `PLANNED`. Never mark an experimental engine `VERIFIED`.

| # | Sub-phase | Status | Notes |
|---|---|---|---|
| 1 | File security and storage | VERIFIED | `ProjectFile` model + migration (`20260803024610_phase8_project_file`); reused `DocumentStorageAdapter` interface via new `local-project-file-storage-adapter.ts` (`.storage/project-files/`, tenant/project/category-namespaced keys, path-traversal-safe); MIME/extension/size validation (200MB cap) in `src/lib/files/file-security.ts`; sha256 checksum + non-blocking duplicate detection; routes: `POST/GET /api/projects/[projectId]/files`, `GET/DELETE /api/files/[fileId]`, `GET /api/files/[fileId]/download`; upload/delete gated by existing `files:manage` capability (OWNER/ADMIN/DESIGNER), read ungated within company (matches existing convention). 17 automated tests (`tests/phase8-file-storage.test.ts`) + live E2E against running dev server (upload/list/detail/download-byte-match/duplicate-detection/reject-unsupported-type/delete/404-after-delete), all passing. Known limitation: delete has no downstream-reference guard yet (no downstream models exist until later sub-phases — flagged in code for extension). |
| 2 | Background processing | VERIFIED | `ExtractionJob` model + migration (`20260803030709_phase8_extraction_job`, 17 engine types, 7 statuses); in-process `LocalJobQueue` (`src/lib/jobs/{job-queue,local-job-queue,extraction-worker}.ts`) with HMR-safe globalThis singleton (mirrors `prisma.ts`); idempotent enqueue (dedupes against an existing non-terminal job for the same file+engine), retry-with-attempts-cap, cancellation (checked both before dispatch and after a handler resolves, so a late-resolving cancelled job can't overwrite its own cancellation), stale-RUNNING recovery on startup (crash resume — re-runs from scratch, handlers must be idempotent, not step-resumable), no synchronous processing in route handlers (`setImmediate` dispatch). Routes: `GET /api/files/[fileId]/jobs`, `POST /api/jobs/[jobId]/cancel`. 12 automated tests (`tests/phase8-job-queue.test.ts`) + live E2E. Found and fixed a real pre-existing bug while doing the live E2E pass: `handleApiError`'s generic domain-error fallback in `src/lib/http/api-response.ts` read `.statusCode` only, silently defaulting to HTTP 400 for any `AppError`-family error whose `instanceof` check missed (observed for `NotFoundError`/`AppError` thrown from the new job-queue module in Next dev mode) — fixed to check `.status` first, `.statusCode` second, so both the AppError family and the pre-existing standalone `LockedBOQError`/`TenantAccessError`-style domain errors resolve correctly regardless of which check path is hit. |
| 3 | Classification | VERIFIED | Filename-keyword heuristic classifier (`src/lib/files/file-classifier.ts`, 31 rule sets covering all non-UNKNOWN classifications) — honestly scoped: only filename/extension signals exist until a later sub-phase adds PDF text/title-block extraction, so confidence is capped at 90 and unmatched files return UNKNOWN at 0 confidence rather than guessing. Registered as the real `DOCUMENT_CLASSIFICATION` job handler (`classification-handler.ts`) proving sub-phase 2's queue against a genuine feature. Human confirm-or-change action (`PUT /api/files/[fileId]/classification`) never lets an automatic re-run overwrite a human-confirmed classification (only the metadata suggestion snapshot refreshes); reclassification sets confidence to 100 and is always distinguished from confirm-as-is in the audit log. Routes: `POST /api/files/[fileId]/classify` (trigger, 202), `PUT /api/files/[fileId]/classification` (confirm/change). 15 automated tests (`tests/phase8-classification.test.ts`) + live E2E (upload → auto-classify → confirm → reclassify → re-trigger-does-not-clobber). While live-testing sub-phase 2's cancel route, found and fixed a real pre-existing bug in `handleApiError`'s fallback status-code resolution (see sub-phase 2 row). Also found and fixed two latent Prisma JSON-typing errors in `local-job-queue.ts` via `tsc --noEmit` (silently missed by `next build`'s looser type-check) — added as a routine check for future sub-phases. |
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
