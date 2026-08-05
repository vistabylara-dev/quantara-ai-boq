# Quantara Full SaaS Feature Audit

Audit-only. No application code, migration, seed, push, or deploy resulted
from this document. Findings combine fresh inspection this turn with
direct, hands-on knowledge from earlier phases of this same session
(CORE-FLOW-1/2, UPLOAD-WORKFLOW-CONTRACT-1, P0-REAL-PRODUCT, CATALOGUE-
COMMERCIAL, CATALOGUE-ACTIVATE-2) — each finding is marked with how it was
established.

Status vocabulary used throughout: `COMPLETE_AND_OWNER_ACCEPTED`,
`WORKING_NOT_OWNER_ACCEPTED`, `PARTIAL`, `BACKEND_ONLY`, `UI_ONLY`,
`PLACEHOLDER`, `CONFIGURATION_REQUIRED`, `DATA_REQUIRED`, `BROKEN`,
`NOT_IMPLEMENTED`, `UNKNOWN`.

---

## AREA 1 — Authentication and Accounts

| Feature | Evidence | Status |
|---|---|---|
| Registration | `POST /api/auth/register`, `auth-service.ts` — real, creates company + user + auto-links all existing `IndustryEngine` rows | WORKING_NOT_OWNER_ACCEPTED |
| Email verification | `POST /api/auth/verify-email`, token-based | WORKING_NOT_OWNER_ACCEPTED |
| Resend verification | **No dedicated route found** (`grep` for resend/invite returned nothing) | NOT_IMPLEMENTED |
| Login / logout | `POST /api/auth/login`, `/api/auth/logout`, `/api/auth/session` | WORKING_NOT_OWNER_ACCEPTED |
| Password reset | `POST /api/auth/forgot-password`, `/api/auth/reset-password` | WORKING_NOT_OWNER_ACCEPTED |
| Admin login | `POST /api/auth/admin-login`, separate `/admin/login` page | WORKING_NOT_OWNER_ACCEPTED |
| Invitation flow (inviting a teammate into an existing company) | **No route found** | NOT_IMPLEMENTED |
| Account suspension | `platform-admin-service.ts` has suspend/activate logic (code-verified) | BACKEND_ONLY — no confirmed admin UI action wired this turn |
| Route protection / anonymous redirect | `src/middleware.ts` — public-route allowlist, redirects to `/login` with `next` param | WORKING_NOT_OWNER_ACCEPTED — confirmed earlier this session that `/site-map` was missing from the allowlist (other agent's work, not fixed by this session) |
| Email delivery | `smtp-email-provider.ts` + `development-email-provider.ts`, selected via `EMAIL_PROVIDER` env var | CONFIGURATION_REQUIRED — real SMTP credentials must be set in production; falls back to console-logging otherwise |
| Session model | DB-backed sessions, no JWT/localStorage (per project CLAUDE.md) | WORKING_NOT_OWNER_ACCEPTED |

**Severity of gaps:** Resend-verification and invitation-flow absence are
P1 (needed before real multi-user companies onboard smoothly) but not P0
(a single owner can still register/verify/log in today).

---

## AREA 2 — Platform Administration

Admin surface is large: 84 routes under `src/app/api/admin/**`. Confirmed
real (not stub) sub-systems, each with its own service layer: commerce
(`admin-commerce-centre.tsx`), master-boq/catalogue governance
(`master-boq-admin.tsx`), template governance (BOQ/email/technical-report,
each with versioning), integrations registry admin, system-health/migration
endpoints (`apply-pending-migrations`, `apply-core-flow-1-migration`,
`apply-sales-inquiry-migration`, `bootstrap-industries`).

| Feature | Status |
|---|---|
| Platform dashboard, company list/detail | BACKEND_ONLY confirmed via routes; UI existence not re-verified visually this turn |
| Activate/suspend company | BACKEND_ONLY (service exists; UI action not re-verified) |
| Customer simulation | WORKING_NOT_OWNER_ACCEPTED — `effective-entitlement-service.ts` branches on simulation mode; used throughout Phase 7 tests |
| Owner override | WORKING_NOT_OWNER_ACCEPTED — same service, `source: "owner-override"` |
| Audit logs | WORKING_NOT_OWNER_ACCEPTED — `platform-action-audit-repository.ts`, used by every admin mutation built this session |
| System health / readiness | WORKING_NOT_OWNER_ACCEPTED — `/api/health`, `/api/ready` return 200 in production as of this audit |
| Catalogue governance | WORKING_NOT_OWNER_ACCEPTED — extensively built and tested this session (CATALOGUE-COMMERCIAL, CATALOGUE-ACTIVATE-2) |
| Integration registry admin | BACKEND_ONLY — `/api/admin/integrations/*` routes exist; real connected-account state unverified |
| Template governance | WORKING_NOT_OWNER_ACCEPTED — full CRUD + versioning routes for BOQ/email/technical-report templates |

---

## AREA 3 — Company Workspace

`src/app/dashboard/page.tsx` exists as one file (not a route tree) —
confirmed this session to contain both a `WorkspaceHeader` (real active-
project metrics) and a `QuickStartWorkspace` widget (both had real
navigation bugs found and fixed in UPLOAD-WORKFLOW-CONTRACT-1: two
separate "Upload Drawing" actions were silently routing to the CSV/XLSX
importer). Light/Dark/mobile behavior, empty states: **not visually
verified this session** — no screenshot or owner confirmation exists.

**Status: PARTIAL.** Core metrics/navigation wired to real data; visual/UX
acceptance unconfirmed.

---

## AREA 4 — Project Creation and Management

This was CORE-FLOW-2 / P0-REAL-PRODUCT Checkpoint 1's exact subject.

| Feature | Status | Evidence |
|---|---|---|
| `IndustryEngine` reference data | **Fixed this session** — was empty in production (root cause: never seeded), bootstrap built and run by the owner (6 companies backfilled, 10 industries confirmed) | WORKING_NOT_OWNER_ACCEPTED — owner ran the bootstrap and got the right JSON, but never explicitly confirmed the `/projects/new` UI itself now works |
| Project Industry selector | Same fix — loading/error/retry states added to `projects/new/page.tsx` | WORKING_NOT_OWNER_ACCEPTED |
| Project creation, edit, detail | `project-service.ts`, `createProjectWithDefaultBoq` — extensively used across dozens of this session's own tests | WORKING_NOT_OWNER_ACCEPTED |
| Client association, currency, VAT, status | Same service — fields present and tested | WORKING_NOT_OWNER_ACCEPTED |
| Redirect after creation, onboarding actions | Fixed this session (workspace-header.tsx / quick-start-workspace.tsx no longer route "Upload Drawing" to `/imports`) | WORKING_NOT_OWNER_ACCEPTED |
| Cross-tenant denial | Tested extensively (every service function requires `companyId`) | WORKING_NOT_OWNER_ACCEPTED |

**Owner acceptance: not yet given.** The owner confirmed the bootstrap
endpoint's JSON output but has not confirmed the actual `/projects/new`
page renders choices and completes a real project creation end to end.
This is the single most important **P0** acceptance step outstanding.

---

## AREA 5 — Project Data Sources

The product vision (one project, multiple sources, Source Centre,
versioning) is **largely NOT_IMPLEMENTED as a unified system**, confirmed
directly in P0-REAL-PRODUCT's audit this session: no `ProjectSource` model
exists in `prisma/schema.prisma`. What exists instead are independent,
unconnected mechanisms:

| Capability | Status |
|---|---|
| Uploaded drawings | WORKING_NOT_OWNER_ACCEPTED — real direct-to-Blob pipeline (CORE-FLOW-1), `ProjectFile` + `ProjectFileUploadSession` |
| Project attachments (legacy) | PARTIAL — `/projects/[id]/files` page exists but is a Phase-8 extraction-preview tool, not a governed attachment workflow, and is now unlinked from navigation |
| Measurement imports | NOT_IMPLEMENTED as a dedicated feature — no page/route exists; would currently reuse the generic `/imports` spreadsheet importer |
| BOQ imports | NOT_IMPLEMENTED as a dedicated feature — same |
| Connected external sources | PARTIAL — see Area 10; Google Drive has real code, everything else is registry-only |
| Source versions/snapshots/status/sync-status | NOT_IMPLEMENTED — no model exists to hold this |
| Source Centre UI | NOT_IMPLEMENTED — no page exists |
| Source-to-BOQ traceability | PARTIAL — `BOQItem.sourceMasterItemId`/`sourceMasterItemVersionId`/`masterItemSnapshotJson` exist for catalogue-sourced items (real, tested), but there is no equivalent link from a BOQ item back to "which uploaded drawing/import produced this line," because no automated extraction-to-BOQ pipeline exists |

**Severity: P0/P1 split.** A single-source project (drawings only) already
works end to end. The *multi-source, unified* vision described in the
mission statement is real future work, not a small gap.

---

## AREA 6 — File Workflow Separation

**This was the exact subject of UPLOAD-WORKFLOW-CONTRACT-1 this session.**
Confirmed fixed and deployed:

- PDF drawing can no longer reach the XLSX parser — root cause was
  navigation (two separate "Upload Drawing" buttons routing to `/imports`
  when no project was active), fixed at `workspace-header.tsx` and
  `quick-start-workspace.tsx`, plus a server-side signature guard added to
  `import-service.ts` (`IMPORT_FILE_NOT_SPREADSHEET`) as defense in depth.
- XLSX selected under "Upload Drawing" is rejected by the drawing
  extension allowlist (pre-existing, confirmed correct).
- PDF under "Import Measurements" — **N/A, no dedicated Measurement Import
  page exists** (see Area 5); the generic `/imports` importer now rejects
  a PDF signature regardless of declared type.
- A residual ambiguous surface remains: the legacy `/projects/[id]/files`
  page still has zero client-side extension filtering — no longer linked
  from navigation, but reachable by direct URL.

**Status: WORKING_NOT_OWNER_ACCEPTED** for the reported incident
specifically. **PARTIAL** for the full purpose-typed contract described in
the mission (Measurement/BOQ import as distinct, labeled workflows still
don't exist).

---

## AREA 7 — Large Drawing Upload

Built in CORE-FLOW-1, confirmed this session:

- Direct browser-to-Blob via `@vercel/blob/client`'s `put()`, token scoped
  to one exact pathname/size/content-type/expiry
  (`generateClientTokenFromReadWriteToken`).
- `ProjectFileUploadSession` model tracks authorize → finalize lifecycle,
  idempotent finalize (replaying an already-finalized session returns the
  existing row, doesn't duplicate).
- 250MB limit via `DRAWING_UPLOAD_MAX_BYTES_DEFAULT`, server-enforced.
- No `await file.arrayBuffer()` on the full file in the direct-upload path
  (confirmed by original code review) — checksum computed via streamed
  hashing.
- **A real production bug was found and fixed** after deployment: a
  `DOMMatrix` ReferenceError crashed every route in the extraction-pipeline
  import chain (including this one) due to a `@vercel/nft` file-tracing
  gap for `@napi-rs/canvas` — fixed via `outputFileTracingIncludes`.
- `BLOB_READ_WRITE_TOKEN` — CONFIGURATION_REQUIRED in whichever
  environment doesn't already have it; `storage-factory.ts` throws loudly
  if `STORAGE_PROVIDER=vercel-blob` is declared without it.

**Status: WORKING_NOT_OWNER_ACCEPTED.** The owner reported the original
failure, the fix was deployed and route-level-verified (401 for
unauthenticated, not 500), but **no owner confirmation of a real large-file
upload succeeding end to end exists in this session's record.**

---

## AREA 8 — Preview and Download

Built in CORE-FLOW-1: `GET /api/files/[fileId]/download` reads size from
`ProjectFile.fileSize` (zero storage calls) before ever opening a stream,
supports `Range`/206/416, `Accept-Ranges: bytes` always set, tenant-scoped
lookup before any Blob access (cross-tenant → safe 404, not a storage
error), inline-vs-attachment `Content-Disposition` via a query param, no
permanent Blob URL ever placed in a page (routes proxy the stream).

**Status: WORKING_NOT_OWNER_ACCEPTED** — same caveat as Area 7, real code
and passing tests, no recorded owner confirmation of an actual browser
preview/download.

---

## AREA 9 — Measurement and BOQ Imports

Already covered under Areas 5/6: **NOT_IMPLEMENTED as dedicated features.**
The only real, working import pipeline is the generic `/imports` CSV/XLSX
importer (`import-service.ts`), which supports: parse → column mapping →
per-row validation/duplicate detection → row-level approve/reject →
execute (creates `CompanyLibraryItem`/`RateCatalogueItem`/BOQ draft rows
depending on `destinationType`). This is real and tested
(`phase7-entitlements-and-library.test.ts`), but it is **one generic
importer with a destination-type dropdown**, not the purpose-labeled
"Import Measurements" / "Import BOQ Items" actions the mission describes.

**Status: PARTIAL.**

---

## AREA 10 — Connected Applications

**27 providers registered** in `provider-registry.ts`. Confirmed by direct
reading of the file's own header comment plus a `status:` field audit:

| Status value | Count | Meaning |
|---|---|---|
| `COMING_SOON` | 25 | No live connection capability — registry metadata only |
| `REQUIRES_PLUGIN` | 1 (Archicad) | Desktop bridge, not built |
| `FILE_IMPORT_ONLY` | 1 | No live API, file-based only |

**Google Drive is the one genuine exception**: real OAuth code
(`google-drive-client.ts` — authorization URL, token exchange, refresh,
file listing, metadata, download, all real `fetch()` calls to Google's
real endpoints) **and** real product routes (`connect`, `callback`,
`files`, `disconnect` under `/api/integrations/google-drive/*`) **and** a
service layer (`google-drive-integration-service.ts`) that actually calls
the client. `GOOGLE_DRIVE_CLIENT_ID`/`GOOGLE_DRIVE_CLIENT_SECRET` are
documented in `.env.example` as required, currently placeholder values.

Despite this, `provider-registry.ts`'s own entry for Google Drive still
declares `status: "COMING_SOON"` — **the registry hasn't been updated to
reflect that real code exists**, which is itself a truthfulness gap in the
other direction (the honest UI-facing status is *more conservative* than
what's actually built, which is safe but means Google Drive's real
progress isn't visible anywhere a customer or the owner would see it).

**Status: Google Drive — CONFIGURATION_REQUIRED** (real code, needs real
OAuth credentials + a genuine test with a real Google account, never
confirmed this session). **Every other provider — PLACEHOLDER/NOT_IMPLEMENTED.**

This directly matches the P2 (not P0) classification in the CATALOGUE-
COMMERCIAL evidence's own connector guidance — real connectors are launch
differentiation, not launch blockers.

---

## AREA 11 — Master Catalogue Data

Extensively audited this session (CATALOGUE-COMMERCIAL Checkpoints 1/1A,
CATALOGUE-ACTIVATE-2). Current real state:

- **15 datasets registered** in code (`catalogue-dataset-registry.ts`),
  covering all 15 discovered `data-imports/*` folders, 53 files, 183,497
  rows, 0 file-ownership violations, all 15 `READY` per the fast readiness
  check (verified this session).
- **Production: 44 `MasterItem` rows exist (HVAC discipline), of unclear
  origin** (`latestJob: null` — did not come through this registry's
  governed pipeline). Plumbing: 0 items. **0 published versions, 0
  hierarchy nodes, 0 classifications anywhere in production.**
- No dataset has been imported through the governed pipeline in
  production. Classify every one of the 15 as: **REGISTERED** (code-level
  only) → next state would be **DRY_RUN_ONLY** or **IMPORTED**, neither of
  which has happened.

**HVAC specifically:** anomalous, unresolved — see
`docs/quantara-production-truth.md`.

**Status: BACKEND_ONLY / REGISTERED.** The registry itself is genuinely
complete and correct (this session's own verified work). Production
activation has not started.

---

## AREA 12 — Industry Packages

`IndustryDataPackage` and `IndustryDataPackageItem` models exist in the
schema with the exact shape a real commercial package system needs
(unique `[packageId, masterItemId]`, `packageType`, `status`,
`isFeatured`). A marketplace page (`/marketplace/[packageKey]`) and a "My
Library"-style settings page (`/settings/data-packages`) both exist in the
UI. **However: zero packages can exist with real published items yet**,
since zero items are published (Area 11). Any package shown today would
necessarily be empty or fake.

**Status: BACKEND_ONLY / DATA_REQUIRED.** Models and UI shells exist; real
package rows with real published items do not.

---

## AREA 13 — Entitlements and Company Library

This is genuinely mature, real, tested code (confirmed multiple times this
session): `effective-entitlement-service.ts` centralizes the "is this
company/actor allowed to use this premium item" decision across
subscription/trial/admin-grant/owner-override/simulation sources — never a
frontend decision. `company-library-service.ts` implements custom items,
recent items, favorites. Cross-tenant denial, trial unlock caps (5 unique
premium items, tested), and revocation are all covered by
`tests/phase7-entitlements-and-library.test.ts` (17/17 passing this
session).

**Status: WORKING_NOT_OWNER_ACCEPTED.** The mechanism is real and well-
tested; it has nothing to actually gate yet in production since no
packages/published items exist (Areas 11-12).

---

## AREA 14 — BOQ Autocomplete

Also genuinely mature — confirmed this session by direct code reading
(not assumption): `item-search-service.ts`'s `searchItems()` → ranked,
multi-source (company library → recent → favorite → entitled master
package → locked preview for premium-without-entitlement → previous
project → supplier catalogue), exposed at `GET /api/items/search`, wired
into `AddItemFromSourceModal` with a 250ms debounce. Locked items show but
are disabled and only expose `id/itemCode/name/categoryId/shortDescription/
defaultUnit` (no protected specification). Manual-entry tab has no
entitlement gate.

**Status: PARTIAL — correctly described by the mission's own rule: "A
working search service with zero published production items is PARTIAL,
not complete."** The code is production-grade; there is nothing real for
it to find yet.

---

## AREA 15 — Manual BOQ Entry

`BoqItemSourceType.MANUAL` in `boq-item-source-service.ts` requires no
`sourceId`, no entitlement check, writes only to `BOQItem` (never
`MasterItem`/`MasterItemVersion`). Confirmed always available regardless
of entitlement state.

**Status: WORKING_NOT_OWNER_ACCEPTED.**

---

## AREA 16 — BOQ Creation and Calculation

Pre-dates this session's major phases; used as test infrastructure
throughout (`createProjectWithDefaultBoq`, `boq-calculator.ts` — 5 tests
passing every run this session). Sections, items, quantities, rates,
subtotal/VAT/grand-total, save/reopen, and cross-tenant denial are all
real and exercised by dozens of this session's own integration tests.
Revision/lock/approval-level governance beyond basic status: not
independently re-verified this turn.

**Status: WORKING_NOT_OWNER_ACCEPTED** for the core create → item → total
→ save/reopen chain. **UNKNOWN** for formal revision/approval workflow
maturity — not audited this turn.

---

## AREA 17 — BOQ Templates

Real, with full admin governance: `/api/admin/templates/boq/*` (list,
detail, versions), `/app/templates/page.tsx` for the customer-facing
gallery. Selection/persistence into BOQ generation: used successfully in
CORE-FLOW-1's own acceptance chain.

**Status: WORKING_NOT_OWNER_ACCEPTED.**

---

## AREA 18 — Technical Reports

Also more complete than expected: creation, per-project listing, generation
(`/api/technical-reports/[reportId]/generate`), download, and a full email
delivery subsystem (`preview`/`send`/`test-send`), plus a public share-link
flow (`/technical-report/[token]`, `share`/`share/revoke`).

**Status: WORKING_NOT_OWNER_ACCEPTED.**

---

## AREA 19 — Email Templates and Delivery

Full CRUD + versioning + "starter" defaults for BOQ and technical-report
categories (`email-template-service.ts`, admin routes with
active/default/duplicate actions). Actual delivery depends on
`EMAIL_PROVIDER=smtp` + real SMTP credentials — same CONFIGURATION_REQUIRED
caveat as Area 1.

**Status: WORKING_NOT_OWNER_ACCEPTED** for the template system.
**CONFIGURATION_REQUIRED** for actually sending mail in production.

---

## AREA 20 — Voice and Typed AI Assistant

**Confirmed, by direct repository-wide search, zero matches** for
`VoiceRecorder`, `TranscriptionJob`, `DocumentChangeProposal`, or any
related construct in `src/` or `prisma/schema.prisma`.

**Status: NOT_IMPLEMENTED.** This is not a UI placeholder with backend
gaps — there is no code at all. The landing page's "governed AI workflow"
section (added by the other concurrent agent's Phase 8/9 work) describes
this as a product capability; it must be labeled honestly (see Area 29).

---

## AREA 21 — AI Credits

**Confirmed, by direct search, zero matches** for `AiCreditLedgerEntry` or
equivalent in schema or code. What exists instead is Phase 7's
*commercial-plan entitlement* system (`entitlement-service.ts`,
trial/package/premium-item-unlock tracking) — a related but genuinely
different concept (feature gating, not a consumable, reservable AI-usage
currency).

**Status: NOT_IMPLEMENTED.** Any CommerceProduct with an "AI credits" SKU
name is a commercial listing only — it has no fulfillment mechanism behind
it yet.

---

## AREA 22 — Document Generation

`document-generation-service.ts` — real, supports `PDF`, `DOCX`, `XLSX`
(`GeneratedDocumentType` enum, real MIME-type/extension maps, per-format
generation branches). Used successfully in CORE-FLOW-1's acceptance work.
Watermarking, generated-document metadata (template version, checksum,
generatedBy) present per the model design from earlier session work.

**Status: WORKING_NOT_OWNER_ACCEPTED.**

---

## AREA 23 — Commerce Catalogue

Built in STRIPE-1B (earlier this session): `CommerceProduct`,
`CommercePrice`, `EntitlementTemplate` models; seed script creating 16
products / 19 prices in AED with VAT; admin Commerce Centre UI; public
product API. **A regression was found during this audit's own validation
run**: `tests/commerce-product-routes.test.ts` and
`tests/commerce-product-service.test.ts` both now fail with "product not
found after seeding" — the same class of pre-existing local-database-state
issue documented earlier this session (not caused by any change in this or
the immediately preceding phase; confirmed via `git log` showing zero
recent commerce-file commits), but now affecting a second file, which is
new information this audit surfaced.

**Status: WORKING_NOT_OWNER_ACCEPTED** for the commerce catalogue itself
(real, deployed, previously verified in production). **Test-suite health
for this area has degraded and should be investigated** — flagged as a P1
item, not fixed in this audit-only phase.

---

## AREA 24 — Stripe

Built through STRIPE-1C, then **explicitly paused mid-flow** by the user
because Stripe account email access was blocked. Current state, precisely:

| Component | Status |
|---|---|
| Stripe SDK integration (`stripe-client.ts`) | BACKEND_ONLY — key classification, live-key refusal, DI for tests, zero network calls on construction |
| Environment variables | CONFIGURATION_REQUIRED — `STRIPE_SECRET_KEY` never configured by the owner |
| Test-mode sync service | BACKEND_ONLY — `stripe-sync-service.ts`, dry-run/execute, deterministic idempotency keys, drift detection — all built and unit-tested (mocked Stripe client), **never run against a real Stripe test account** |
| Checkout, customers, subscriptions, one-time payments, webhooks, portal, invoices, refunds, disputes | NOT_IMPLEMENTED — explicitly out of scope per every Stripe-phase instruction this session |

**This is a CONFIGURATION_REQUIRED blocker, not a missing-code blocker** —
the sync architecture is real and ready; it cannot proceed until the owner
regains Stripe account access.

---

## AREA 25 — Trial and Paywall

Phase 7 (pre-dates this session's active phases, exercised heavily by this
session's own tests): trial creation, one-BOQ-lock limit, 5-unique-premium-
item unlock cap, simulation-mode restriction branching. Watermarking on
trial exports: not independently re-verified this turn. Clean-export-on-
upgrade: not independently re-verified this turn.

**Status: WORKING_NOT_OWNER_ACCEPTED** for the core trial-limit mechanism.
**UNKNOWN** for watermark/export-quality specifics.

---

## AREA 26 — Security

Confirmed this session, concretely:

- Tenant isolation: every repository function requires `companyId`
  (architectural rule, enforced throughout, tested extensively).
- Prisma error leakage: fixed earlier this session
  (`api-response.ts` — unconditional safe fallback for every
  `PrismaClientKnownRequestError` code beyond the 4 explicitly handled).
- Upload-path tampering: server-generated pathnames only, never client-
  supplied (CORE-FLOW-1 architecture).
- Private Blob access: confirmed, no permanent signed URLs in any page.
- Cross-tenant BOQ/catalogue access: denied and tested throughout.
- Rate limiting: **only 2 services have it** (`public-proposal-service.ts`,
  `stripe-sync-service.ts`) — the BOQ autocomplete search endpoint and most
  other public/authenticated list endpoints have **no rate limiting**,
  confirmed by direct grep.

**Status: PARTIAL.** Core tenant/auth security is strong and tested.
General API rate limiting is a real, currently-unaddressed gap — P1 for
commercial launch, not P0 for a single-tenant internal test.

---

## AREA 27 — Data, Search, and Performance

- Streaming CSV / bounded memory: confirmed this session
  (`catalogue-discovery-service.ts` — quote-parity streaming, never loads
  a full file for row-counting beyond what's needed).
- Resumable imports: confirmed (`master-catalogue-import-job-service.ts`
  — checkpointed batch processing, tested for concurrency-safety and
  cancel/resume in `catalogue-prod-activate.test.ts`).
- N+1 avoidance / bounded pagination in catalogue admin listing: a real
  performance bug was found and fixed *during this session* (the first
  version of the dataset-readiness check re-read and parsed all 53 files
  synchronously on every list call — caught via a real test timeout, split
  into fast/deep checks).
- Full-text/trigram search: not used — `item-search-service.ts` uses
  Prisma `contains`/`insensitive` filters, bounded to 15 results per
  source. Fine at current scale (183K rows discovered, 44 items live);
  would need real indexing work before catalogue scale grows much further.

**Status: PARTIAL.** Good discipline where it's been tested; genuine open
question at larger scale (P2).

---

## AREA 28 — Observability and Operations

`/api/health`, `/api/ready` — real, DB-connectivity-checked, verified 200
in production as of this audit. A family of owner-gated,
idempotent migration-apply endpoints exists
(`apply-pending-migrations`, `apply-core-flow-1-migration`,
`apply-sales-inquiry-migration`, `bootstrap-industries`) — this session's
own established, repeatedly-used pattern for applying production
migrations without direct database access. **A real stray-Vercel-project
incident occurred this session** (a worktree missing its `.vercel` link
auto-created a new project on first deploy) — caught and corrected
immediately, documented as a known operational risk for future
multi-worktree work.

**Status: WORKING_NOT_OWNER_ACCEPTED** for health/readiness/migration
tooling. Failed-job monitoring / sync-history dashboards: not verified
this turn.

---

## AREA 29 — Website Claims vs Product Reality

`src/lib/config/features.ts` already has an honest status vocabulary
(`live`/`development`/`planned`) — a real, working mechanism, not
something this audit needs to build. The claims that need re-checking
against this audit's findings (not edited — landing-page content is out of
scope for this session):

| Claim area | Real state | Action needed |
|---|---|---|
| "Governed AI workflow" (voice/typed instructions, structured proposals) | NOT_IMPLEMENTED (Area 20) | Must not be labeled `live`; earlier this session's own guidance already required "In Development" labeling for this exact claim |
| Connected external sources (Autodesk, Revit, etc.) | Registry-only for 25/27 providers (Area 10) | Should read "Coming Soon" per provider, not implied as generally available |
| Industry package marketplace | Zero real published items exist (Area 12) | Should not display live package cards with real item counts yet |
| Catalogue coverage (any specific "X items available" claim) | 44 items exist, of unclear origin, 0 published (Area 11) | Any specific count claim on the site should be verified against real, published, current numbers — not repository row totals |

---

## AREA 30 — First Complete Customer Journey

See `docs/quantara-first-customer-journey-audit.md` for the full 20-step
trace with per-step status and blocking dependency.
