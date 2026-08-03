  ---
name: quantara-drawing-inspection
description: Guide any work on quantara-ai-boq's floor plan / drawing reading feature — internally called "Phase 8, Drawing Inspection AI" (uploaded drawings, PDF page rasterization, scale calibration, room/object/symbol detection, quantity takeoff from drawings, inspection findings). Use this skill whenever the user asks to read floor plans, extract quantities from drawings, detect rooms/objects/symbols, build takeoff/inspection features, or touches anything under src/app/api/drawing-pages, src/app/api/extractions, src/app/api/projects/[projectId]/extractions, src/app/api/inspections, src/lib/services/{drawing-page,scale-calibration,extraction-job,extraction-to-boq,inspection,finding,finding-to-boq}-service.ts, or the ExtractionJob/DrawingPage/ExtractedEntity/Inspection*/Finding* Prisma models. This is large, partially-built, spec-governed work — always check docs/phase-8-status.md before assuming any sub-feature exists.
---

# Quantara AI BOQ — floor plan / drawing inspection (Phase 8)

## Read this first, every time
This feature area has three governing documents. Read them in this order before writing any code:
1. `docs/phase-8-status.md` — the single source of truth for what is actually built today, per
   sub-phase, with an honest status (`NOT_STARTED`, `ACTIVE`, `BLOCKED`, `MVP_COMPLETE`, `VERIFIED`,
   `EXPERIMENTAL`, `PLANNED`). This is the file to check before saying a capability exists.
2. `docs/phase-8-current-state-audit.md` — the pre-implementation inventory of what infrastructure
   already existed before Phase 8 started and what's reusable vs. genuinely new.
3. `docs/PHASE-8-DRAWING-INSPECTION-AI-MASTER-INSTRUCTION.md` — the full spec (thousands of lines,
   numbered sections). Look up the specific section referenced in `phase-8-status.md`'s notes for
   any sub-phase you're touching rather than re-reading the whole document.

The implementation order in `phase-8-status.md`/the audit's section 5 **supersedes** the spec's own
original 8A–8R lettering — follow the numbered order, not the letters, if they ever disagree.

## The one discipline that overrides everything else: no fake AI
This codebase has maintained, sub-phase after sub-phase, a strict rule: never fabricate a detection
result to make a feature look more capable than it is. Concretely, this means:
- If no real detection engine exists yet for something (room boundaries, objects, MEP symbols, OCR
  text extraction as an engine, AI-drafted findings — check `phase-8-status.md`, several of these
  are schema-only with zero engine behind them as of the last audit), the correct UI/API behavior is
  manual human entry, not a mocked or randomized "AI result." Do not write a stub that returns
  plausible-looking fake detections — every prior sub-phase explicitly avoided this even under time
  pressure, and it's the single most important convention to preserve.
- Every extracted/detected thing carries a status lifecycle: `AI_SUGGESTED → NEEDS_REVIEW →
  CONFIRMED/CORRECTED/REJECTED`. Nothing downstream (a quantity calculation, a BOQ import, a report)
  may consume an entity that hasn't reached `CONFIRMED` or `CORRECTED` — see
  `extraction-to-boq-service.ts`'s import gate as the reference implementation of this rule.
- Once something is `CONFIRMED`/`IMPORTED`, it cannot be silently re-corrected — a correction always
  preserves original + corrected value + reason (see `extracted-entity-service.ts`), never
  overwrites silently.
- Spatial quantity calculations are blocked until a page's scale is human-verified
  (`assertPageScaleVerified()` in `scale-calibration-service.ts`) — manual scale entry is
  `isVerified: true` immediately (a human typed it in), but any future auto-detected scale type is a
  suggestion only until a human confirms it. Never let a quantity calculation run against an
  unverified scale.
- Quantity formulas always return their inputs, deductions, wastage, and allowances alongside the
  result (`src/lib/calculations/quantity-formulas.ts`) — never collapse this into a single opaque
  number. Anyone reviewing a takeoff needs to see how a number was derived.
- Commercial values (unit prices, rates) are always supplied by a human caller, never invented from
  a drawing — a drawing can tell you a quantity, never a price.

## What's actually real vs. schema-only as of the last audit — check phase-8-status.md for current state
As of the last recorded audit, real and working: file upload/storage, the background job queue,
filename-keyword document classification (a heuristic, not AI), CSV/XLSX/PDF table extraction (real
parsing — PDF via `pdf-parse`'s vector-grid table detection, honestly reports "no tabular structure
found" rather than guessing on non-bordered PDF tables), PDF page rasterization for the drawing
viewer, manual scale calibration, manual entity entry (no detection engine), a tested deterministic
quantity-formula library (not yet wired to any route), BOQ-from-confirmed-entity import, basic
inspection forms, and findings/risk scoring (a real likelihood × severity calculation, not a
placeholder). Schema-defined but with **no engine behind them yet**: OCR text extraction as an
actual engine, room boundary detection, object detection, MEP symbol matching, AI findings-drafting,
technical report generation. Don't assume any of these work just because the Prisma enum
(`ExtractionEngineType`, `ExtractedEntityType`) has a value for it — an enum entry is a planned slot,
not a shipped capability. Re-check `phase-8-status.md` before relying on this summary, since it gets
updated after every sub-phase.

## Conventions to reuse, not reinvent
- File storage: `DocumentStorageAdapter` interface, implemented for project files by
  `local-project-file-storage-adapter.ts` against `.storage/project-files/` — do not build a
  parallel storage mechanism. (There's a dead, unrelated `local-storage-adapter.ts` pair used only
  by legacy client-side Zustand stores — don't confuse it with this one or reuse it.)
  Key namespacing follows `companies/[companyId]/projects/[projectId]/{originals,previews,pages,
  extracted,annotations,reports}/...`.
- Background work: any processing large enough to matter goes through
  `extractionJobQueue` (`src/lib/jobs/extraction-worker.ts`), never synchronously inside a route
  handler. New engines register a handler via `extractionJobQueue.registerHandler(engineType, fn)`
  at module load, then import that module from `src/lib/jobs/register-handlers.ts` as a side effect
  so it's guaranteed registered before any job dispatch.
- RBAC: the `"files:manage"` capability (OWNER/ADMIN/DESIGNER) already covers file
  upload/classify/preprocess/scale actions — reuse it rather than inventing a new capability. Only
  add a new capability when nothing existing maps cleanly, and add it incrementally per sub-phase,
  never speculatively for future sub-phases.
- Route/validation conventions: `z.object({...}).strict()` param schemas in
  `src/lib/validation/route-params.ts`; call `getCurrentActor()` then `setActorContext(actor)`
  directly inside every route handler body (AsyncLocalStorage does not propagate through an awaited
  helper — this caused real bugs earlier in the project and is now a fixed convention, don't
  refactor it into a shared helper that awaits before setting context); responses via
  `apiSuccess`/`handleApiError` from `src/lib/http/api-response.ts`.
- The BOQ verification module's confirm/correct/reject pattern (`src/app/api/verification/*`,
  `VerificationException` model) is the architectural precedent for `ExtractedEntity`'s lifecycle —
  follow its shape rather than designing a new confirmation pattern from scratch.

## Before calling any Phase 8 work done
Run the quality gate (lint, build, test — see quantara-quality-gate skill). Then update
`docs/phase-8-status.md` honestly for the sub-phase you touched: real automated test coverage and a
live smoke test earns `VERIFIED`; schema-plus-minimal-service-with-lower-coverage earns
`MVP_COMPLETE`, not `VERIFIED` — never upgrade a status past what was actually verified just because
the code compiles. This table is what the next session (yours or anyone else's) will trust instead
of re-auditing the whole codebase, so an inflated status here directly causes future wasted work.