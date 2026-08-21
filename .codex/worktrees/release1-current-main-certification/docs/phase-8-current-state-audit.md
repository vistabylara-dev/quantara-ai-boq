# Phase 8 — Pre-Implementation Current-State Audit

Required by `docs/PHASE-8-DRAWING-INSPECTION-AI-MASTER-INSTRUCTION.md` section 3, to be
completed before any Phase 8 schema, service, route, or UI work begins. This document
does not change behavior — it is a read-only inventory of what exists today, what is
missing, what is reusable, and the exact order implementation will follow.

## 1. Existing infrastructure relevant to Phase 8

### 1.1 File / document infrastructure (Phase 5–7)

- **`GeneratedDocument` model** (`prisma/schema.prisma`, ~line 1269) — this is an
  *output* document (a rendered CSV/XLSX/PDF/DOCX/HTML export of a BOQ or proposal),
  produced deterministically from `CanonicalDocumentData`. It has no concept of an
  *uploaded source file*, no classification, no page/table/entity extraction, and is
  not the right model to extend for Phase 8. Phase 8 needs a new `ProjectFile` model
  for user-uploaded source material (drawings, schedules, photos, spreadsheets).
- **Storage abstraction** — `src/lib/storage/document-storage-adapter.ts` defines
  `DocumentStorageAdapter` (`putObject`/`getObject`/`deleteObject`/`objectExists`/
  `getMetadata`/`createAuthorizedDownload`) plus `assertSafeStorageKey` (rejects null
  bytes, backslashes, absolute paths, `.`/`..` segments) and `StorageKeyError`.
  `src/lib/storage/local-document-storage-adapter.ts` implements it against
  `.storage/generated-documents/` (private, outside `public/`, path-escape-checked via
  `path.resolve` + prefix check). **This adapter is generic over `key`/`body`/
  `contentType` and has no coupling to `GeneratedDocument` — it is directly reusable
  for `ProjectFile` storage.** Per spec section 5, Phase 8 will reuse this adapter
  rather than building a parallel one, pointing a new root
  (`.storage/project-files/`) so generated-document and uploaded-source storage stay
  physically separated, and will follow the same key-namespacing discipline the spec
  suggests: `companies/[companyId]/projects/[projectId]/{originals,previews,pages,
  extracted,annotations,reports}/...`.
  - Note: there is an unrelated, dead pair of files also named `storage-adapter.ts` /
    `local-storage-adapter.ts` in the same directory — legacy client-side
    `localStorage` adapters consumed only by the unused `src/store/*` Zustand stores.
    Do not confuse these with `document-storage-adapter.ts`; do not reuse or modify
    the dead pair.
- **Document generation** — `src/lib/documents/build-document-data.ts` +
  `src/lib/documents/generators/{csv,xlsx,pdf,docx,html}.ts` build a
  `CanonicalDocumentData` object and render it. Phase 7 added `meta.watermarkText`.
  Phase 8 section 52 extends this same pattern for Technical Reports rather than
  building a new generation system — the report will assemble its own canonical
  section data (findings, root causes, risk register, compliance, photos, etc.) and
  reuse the existing generator functions where the target format already has one
  (DOCX/PDF/XLSX/HTML), adding report-specific layout only where the existing
  generators don't already support the required sections.
  Route precedent: `src/app/api/documents/[documentId]/download/route.ts` performs
  tenant + RBAC checks before calling `getObject` — this is the pattern Phase 8 file
  download routes will follow.
- **No existing upload route of any kind.** `src/app/api/projects/[projectId]/`
  currently only has `boqs`, `documents` (list of *generated* documents), and
  `proposals` subroutes. There is no multipart/file-upload handling anywhere in the
  codebase yet — this is new for Phase 8.

### 1.2 Job/background-processing infrastructure

**None exists.** No queue, no worker, no async job model. All current "heavy" work
(document generation, imports) runs synchronously inside request handlers because
none of it is large enough to need otherwise (CSV/XLSX imports are capped and
row-processed; document generation is fast). Phase 8 explicitly forbids synchronous
processing of large files in request handlers (anti-drift rule set, section 1), so
`src/lib/jobs/{job-queue.ts,local-job-queue.ts,extraction-worker.ts}` and an
`ExtractionJob` model are new, ground-up infrastructure — sub-phase 2 in the
implementation order below.

The closest existing precedent for a multi-row, resumable, status-tracked background
operation is Phase 7's `ImportJob`/`ImportRow` (`src/lib/services/import-service.ts`),
which is still synchronous end-to-end but does establish the
per-row-status/audit-trail/error-capture pattern that `ExtractionJob` will extend
into an actually-queued, cancellable, resumable model.

### 1.3 Verification / human-confirmation infrastructure

The closest architectural precedent for Phase 8's `AI_SUGGESTED → NEEDS_REVIEW →
CONFIRMED/CORRECTED/REJECTED` entity lifecycle is the existing BOQ verification
module (`src/app/api/verification/*`, `tests/run-verification.test.ts`,
`VerificationException` model) — it already has the shape of "system flags an issue,
a human resolves it, resolution is recorded with actor + timestamp." Phase 8's
`ExtractedEntity`/`InspectionFinding` workflows will follow the same
confirm/correct/reject-with-reason discipline but are new models, since verification
exceptions are BOQ-commercial-integrity checks, not AI-extraction-confidence checks.

### 1.4 Entitlements

`src/lib/entitlements/entitlement-service.ts` (software-plan/trial layer) and
`package-entitlement-service.ts` (industry-package layer) are both directly reusable.
Per spec section 58, Phase 8 adds a new `AiProcessingUsage` model and new
non-throwing `CheckResult` query functions (mirroring `canCreateProject`/
`canUsePremiumItem`) for AI-page/credit/report/BOQ limits, plumbed through the same
`assertFeatureAccess`-style throwing wrapper used elsewhere. No changes to the
existing trial-limit or package-subscription logic are needed — Phase 8 is additive.

### 1.5 RBAC

`src/lib/auth/rbac.ts` already defines a `"files:manage"` capability (granted to
`COMPANY_OWNER`, `ADMINISTRATOR`, and `DESIGNER`) that is **currently unused by any
route** — it was added in an earlier phase in anticipation of exactly this kind of
work. Phase 8 file upload/management routes will consume this existing capability
rather than inventing a new one. New capabilities will only be added where spec
section 57's suggested grants don't map onto an existing capability (e.g. inspection
management, findings confirmation, quantity-calculation override) — added
incrementally, sub-phase by sub-phase, never all at once, per section 57's explicit
"do not add new roles without migration and tests" instruction (capabilities on
existing roles are lower-risk than new roles and will be extended as each sub-phase
needs them).

### 1.6 Route/validation conventions

- Route param validation: `src/lib/validation/route-params.ts` (also
  `boq-route-schemas.ts` for some) — `z.object({...}).strict()` schemas per resource,
  parsed from `context.params`. Phase 8 will add `projectFileIdParamsSchema`,
  `extractionJobIdParamsSchema`, `extractedEntityIdParamsSchema`,
  `inspectionIdParamsSchema`, `findingIdParamsSchema`, etc. as each sub-phase
  introduces the corresponding route.
- Actor resolution: every route handler calls `getCurrentActor()` then
  `setActorContext(actor)` directly in its own body (AsyncLocalStorage does not
  propagate through an awaited helper — this bit twice in earlier phases and is now
  a fixed convention, see `src/lib/auth/current-actor.ts` doc comment).
- Response/error handling: `apiSuccess`/`handleApiError` from
  `src/lib/http/api-response.ts`, `AppError`/`NotFoundError`/`PermissionDeniedError`/
  `UnauthorizedError` from `src/lib/errors/app-error.ts`.
- Audit logging: `createAuditLog(companyId, {entityType, entityId, action, payload},
  tx?)` from `src/lib/repositories/audit-repository.ts`, auto-attributes actor via
  AsyncLocalStorage context.

### 1.7 Testing conventions

`tests/*.test.ts`, Vitest, `fileParallelism: false` (must remain — fixes a real
cross-file Postgres deadlock found in Phase 7, do not revert). Integration-style
tests hit a real Postgres test database directly via Prisma, not mocks. New Phase 8
test files will follow the naming precedent of `phase7-entitlements-and-library.test.ts`
— e.g. `phase8-file-storage.test.ts`, `phase8-classification.test.ts`, etc., one per
sub-phase group, added as each sub-phase completes (not held back to the end).

## 2. What is missing (net-new for Phase 8)

Everything listed in the spec's sections 4–58 is net-new: `ProjectFile`,
`DrawingPage`/`DrawingLayer`, `ExtractionJob`, job queue, `ExtractedTable`/`Row`/
`Cell`, OCR abstraction, AI provider policy abstraction, `DrawingScaleCalibration`,
drawing viewer UI, `ExtractedEntity`, `DetectedRoom`, furniture/MEP detection,
`SymbolDefinition`/`CompanySymbolMapping`, CAD/BIM parser interfaces,
`QuantityCalculation`, extraction-to-BOQ import service, `Inspection`/
`InspectionTemplate`/`InspectionResponse`, `InspectionFinding`,
`RootCauseAnalysis`/`RiskAssessment`/`CorrectiveAction`, `FindingBoqLink` +
finding-to-BOQ service, `InspectionPhoto`/`InspectionAnnotation`,
`TestMeasurement`, `ComplianceReference`/`FindingComplianceAssessment`,
`RepairReplacementAnalysis`, `AssetConditionAssessment`, `FindingCommercialImpact`,
scope/method-statement/safety-plan/maintenance-plan generation, technical report
generation, `AiProcessingUsage`, inspection workspace UI, and all associated API
routes, tests, and docs (`phase-8-security-model.md`, `ai-processing-policy.md`,
`file-retention-policy.md`, `phase-8-status.md`).

## 3. Migration risk notes

- All new models are additive (new tables, new FKs to existing `Company`/`Project`/
  `BOQ`/`BOQItem`/`User`). No existing column is altered or dropped by any sub-phase
  in the order below. This keeps every migration low-risk and independently
  reversible.
- Windows Prisma workflow (recorded here since it recurs every phase): non-interactive
  migration via `prisma migrate diff --from-url <url> --to-schema-datamodel
  prisma/schema.prisma --script > file.sql` (stdout only — never merge `2>&1` into the
  same redirect, it contaminates the SQL with a stderr banner line and breaks
  `migrate deploy`), placed into a timestamped `prisma/migrations/<ts>_<name>/`
  folder, then `prisma migrate deploy`. Dev server must be stopped
  (`taskkill //F //IM node.exe`) before `npx prisma generate` (Windows file-lock on
  the generated client), then restarted.
- Each sub-phase below gets its own migration rather than one giant Phase 8 migration
  — smaller, independently verifiable, matches the spec's "do not attempt all
  sub-phases in one uncontrolled code change" instruction.

## 4. Reusable services (confirmed, not assumed)

| Need | Reuse |
|---|---|
| File bytes storage | `document-storage-adapter.ts` + `local-document-storage-adapter.ts` (new root path) |
| Tenant scoping / actor | `getCurrentActor()` + `setActorContext()` |
| RBAC | `requireCapability()`, existing `files:manage` capability |
| Audit trail | `createAuditLog()` |
| Entitlement gating | `entitlement-service.ts` pattern (`CheckResult`, `assertFeatureAccess`) extended with new AI-usage checks |
| Source-provenance pattern | `BOQItem.sourceType`/`sourceMasterItemId`/... fields + `boq-item-source-service.ts` (direct precedent for `FindingBoqLink` / extraction-import provenance) |
| Document generation | `build-document-data.ts` + generators (extend for Technical Reports) |
| Multi-source matching ranking | Company Library → Recently Used → Variants → Purchased Packages → Supplier Catalogue → Previous BOQ Items → Locked Preview (Phase 7 pattern, reused for extracted-entity matching per section 27) |

## 5. Exact implementation order

Per explicit user instruction, superseding the spec's own 8A–8R lettering (the
content of each numbered spec sub-phase is preserved; this is the sequencing only):

1. File security and storage
2. Background processing
3. Classification
4. CSV/XLSX/PDF table extraction
5. Drawing viewer
6. Scale calibration
7. Verification workbench
8. Room detection
9. Furniture detection
10. MEP symbols
11. Quantity formulas
12. BOQ import
13. Inspection forms
14. Findings and risks
15. BOQ from corrective actions
16. Technical reports

Rationale (user's own words): this order prevents the common failure where an AI
system produces impressive visual demos but cannot preserve source evidence,
revisions, audit history, or reliable quantities — i.e. storage, background
processing, classification, extraction, and human verification are all load-bearing
infrastructure that every later sub-phase depends on, so they come first.

Items from the spec not covered by the user's 16-step list (OCR abstraction, AI
provider policy, CAD/BIM parsers, photo evidence, drawing annotations, test/
measurement module, compliance knowledge base, repair-vs-replacement, asset
condition index, commercial impact, scope/method-statement/safety/maintenance
generation, RBAC extensions, `AiProcessingUsage`, verification-warning rules, audit
log expansion, security/policy docs, full test suite, 54-step manual E2E, status doc,
final report) will be slotted into the sub-phase they most directly support as that
sub-phase is reached (e.g. OCR lands inside sub-phase 3/4, AI provider policy inside
sub-phase 3, `AiProcessingUsage` inside sub-phase 2 or 3, compliance knowledge base
inside sub-phase 14, etc.) rather than deferred to the end, so each sub-phase ships
in a genuinely working, testable state.

## 6. Validation discipline

After every sub-phase: `npm run lint`, `npm run build`, `npm test`, then a live
manual check against the running dev server before moving to the next sub-phase, per
the spec's own section 66 and the standing project convention. `docs/phase-8-status.md`
(created alongside this audit) is updated after each sub-phase with real status
(`NOT_STARTED`/`ACTIVE`/`BLOCKED`/`MVP_COMPLETE`/`VERIFIED`), not aspirational status.
