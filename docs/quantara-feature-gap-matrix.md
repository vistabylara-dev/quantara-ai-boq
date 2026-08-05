# Quantara Feature Gap Matrix

Audit-only. Every feature from `docs/quantara-full-feature-audit.md`,
condensed into one table. `✓`=present/passing, `✗`=absent/failing,
`~`=partial, `?`=unverified this turn.

| Area | Feature | UI | API | Service | Model | Prod data | Config | Tests | Owner accepted | Status | Severity | Exact gap | Next action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Registration/login/logout | ✓ | ✓ | ✓ | ✓ | — | — | ~ | ✗ | WORKING_NOT_OWNER_ACCEPTED | P1 | none functional | owner acceptance |
| 1 | Resend verification | ✗ | ✗ | ✗ | — | — | — | — | ✗ | NOT_IMPLEMENTED | P1 | no route exists | build |
| 1 | Invitation flow | ✗ | ✗ | ✗ | — | — | — | — | ✗ | NOT_IMPLEMENTED | P1 | no route exists | build |
| 1 | Email delivery | — | — | ✓ | — | ? | `EMAIL_PROVIDER`/SMTP | ~ | ✗ | CONFIGURATION_REQUIRED | P0 (for any real email) | prod SMTP creds unconfirmed | owner sets env vars |
| 2 | Platform admin core | ~ | ✓ | ✓ | ✓ | ? | — | ~ | ✗ | BACKEND_ONLY | P2 | UI not re-verified visually | screenshot/owner review |
| 2 | Customer simulation / owner override | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✗ | WORKING_NOT_OWNER_ACCEPTED | P1 | none functional | owner acceptance |
| 3 | Company dashboard | ✓ | ✓ | ✓ | — | ? | — | ✗ | ✗ | PARTIAL | P2 | visual/UX unconfirmed | screenshot/owner review |
| 4 | Industry selector / project creation | ✓ | ✓ | ✓ | ✓ | ✓ (fixed this session) | — | ~ | ✗ | WORKING_NOT_OWNER_ACCEPTED | **P0** | owner hasn't confirmed live UI | owner opens `/projects/new` |
| 5 | `ProjectSource` unified model | ✗ | ✗ | ✗ | ✗ | — | — | — | ✗ | NOT_IMPLEMENTED | P1 | model doesn't exist | design + build |
| 5 | Uploaded drawings | ✓ | ✓ | ✓ | ✓ | ? | `BLOB_READ_WRITE_TOKEN` | ✓ | ✗ | WORKING_NOT_OWNER_ACCEPTED | **P0** | no owner-confirmed real upload | owner uploads real files |
| 5 | Measurement import (dedicated) | ✗ | ✗ | ✗ | — | — | — | — | ✗ | NOT_IMPLEMENTED | P1 | no dedicated feature | build |
| 5 | BOQ item import (dedicated) | ✗ | ✗ | ✗ | — | — | — | — | ✗ | NOT_IMPLEMENTED | P1 | no dedicated feature | build |
| 5 | Source Centre UI | ✗ | ✗ | ✗ | ✗ | — | — | — | ✗ | NOT_IMPLEMENTED | P1 | no page exists | build after `ProjectSource` |
| 6 | File-purpose separation (drawing vs spreadsheet) | ✓ | ✓ | ✓ | — | — | — | ✓ | ✗ | WORKING_NOT_OWNER_ACCEPTED | P0 (incident fixed) | none functional | owner re-tests the exact reported bug |
| 7 | Large drawing upload (250MB, direct-to-Blob) | ✓ | ✓ | ✓ | ✓ | ? | `BLOB_READ_WRITE_TOKEN` | ✓ | ✗ | WORKING_NOT_OWNER_ACCEPTED | **P0** | no owner confirmation | owner uploads a real large PDF |
| 8 | Preview/download (Range, secure) | ✓ | ✓ | ✓ | — | ? | — | ✓ | ✗ | WORKING_NOT_OWNER_ACCEPTED | **P0** | no owner confirmation | owner previews/downloads |
| 9 | Generic CSV/XLSX import | ✓ | ✓ | ✓ | ✓ | ? | — | ✓ | ✗ | WORKING_NOT_OWNER_ACCEPTED | P1 | not purpose-labeled per mission | relabel/split (P1) |
| 10 | Google Drive connector | ✓ | ✓ | ✓ | ✓ | ✗ | `GOOGLE_DRIVE_CLIENT_ID/SECRET` | ✗ | ✗ | CONFIGURATION_REQUIRED | P2 | no real OAuth creds configured/tested | owner configures + tests |
| 10 | Other 26 connectors | ~ | ~ | ✗ | ~ | ✗ | ✗ | ✗ | ✗ | PLACEHOLDER | P3 | registry metadata only | build per-provider (large, later) |
| 11 | Master Catalogue registry (code) | — | ✓ | ✓ | ✓ | ✓ (this session) | — | ✓ | ✗ | WORKING_NOT_OWNER_ACCEPTED | — | none — registry itself complete | owner reviews `docs/catalogue-registry-evidence.md` |
| 11 | Master Catalogue production import | — | ✓ | ✓ | ✓ | ✗ (0 published) | — | ✓ (local) | ✗ | NOT_IMPORTED | **P1** | no dataset executed in production | CATALOGUE-ACTIVATE-3 (owner-gated) |
| 11 | HVAC 44-item anomaly | — | ✓ | ✓ | ✓ | ~ (unresolved origin) | — | — | ✗ | UNKNOWN | **P0 for catalogue trust** | owner hasn't run the inspection route | owner runs `/datasets/quantara-master-hvac-v1/items` |
| 12 | `IndustryDataPackage` model | — | ✓ | ✓ | ✓ | ✗ (0 real packages) | — | ✓ (local) | ✗ | DATA_REQUIRED | P1 | no packages have real published items | after Area 11's import |
| 12 | Marketplace / My Library UI | ✓ | ✓ | ✓ | — | ✗ | — | ? | ✗ | UI_ONLY | P1 | nothing real to show | same |
| 13 | Effective entitlement service | — | ✓ | ✓ | ✓ | ? | — | ✓ | ✗ | WORKING_NOT_OWNER_ACCEPTED | — | none — real, tested | nothing to gate yet (Area 11) |
| 14 | BOQ autocomplete (`item-search-service`) | ✓ | ✓ | ✓ | — | ✗ (0 published items) | — | ✓ | ✗ | PARTIAL | **P0/P1** | code correct, no data | Area 11's import |
| 15 | Manual BOQ entry | ✓ | ✓ | ✓ | ✓ | ? | — | ✓ | ✗ | WORKING_NOT_OWNER_ACCEPTED | — | none | owner confirms |
| 16 | BOQ create/calc/save | ✓ | ✓ | ✓ | ✓ | ? | — | ✓ | ✗ | WORKING_NOT_OWNER_ACCEPTED | **P0** | none functional | owner confirms |
| 17 | BOQ templates + governance | ✓ | ✓ | ✓ | ✓ | UNKNOWN | — | ? | ✗ | UNKNOWN (prod count) | P1 | production template count unverified | owner check |
| 18 | Technical reports (full lifecycle) | ✓ | ✓ | ✓ | ✓ | ? | — | ? | ✗ | WORKING_NOT_OWNER_ACCEPTED | P1 | none functional | owner confirms |
| 19 | Email templates + delivery | ✓ | ✓ | ✓ | ✓ | ? | SMTP creds | ? | ✗ | WORKING_NOT_OWNER_ACCEPTED / CONFIGURATION_REQUIRED | P1 | delivery needs real SMTP | owner sets creds |
| 20 | Voice/typed AI assistant | ✗ | ✗ | ✗ | ✗ | — | — | — | ✗ | NOT_IMPLEMENTED | P2 | entire feature unbuilt | full build |
| 21 | AI credit ledger | ✗ | ✗ | ✗ | ✗ | — | — | — | ✗ | NOT_IMPLEMENTED | P2 | entire feature unbuilt | full build |
| 22 | Document generation (PDF/DOCX/XLSX) | ✓ | ✓ | ✓ | ✓ | ? | — | ? | ✗ | WORKING_NOT_OWNER_ACCEPTED | **P0** | none functional | owner confirms |
| 23 | Commerce catalogue (products/prices) | ✓ | ✓ | ✓ | ✓ | ✓ (16/19 at seed time, stale) | — | ✗ (regressed) | ✗ | WORKING_NOT_OWNER_ACCEPTED / test regression found | P1 | 2 test files now fail post-seed lookup | investigate local DB state (not fixed this turn) |
| 24 | Stripe checkout/subscriptions/webhooks | ✗ | ✗ | ✗ | — | — | `STRIPE_SECRET_KEY` unset | — | ✗ | CONFIGURATION_REQUIRED (account access blocked) | P1 (blocked) | owner's Stripe account access is blocked | owner resolves account access first |
| 24 | Stripe test-mode sync architecture | — | ✓ | ✓ | ✓ | ✗ (never run live) | same | ✓ (mocked) | ✗ | BACKEND_ONLY | P1 (blocked) | never run against real Stripe | same |
| 25 | Trial limits | — | ✓ | ✓ | ✓ | ? | — | ✓ | ✗ | WORKING_NOT_OWNER_ACCEPTED | P1 | none functional | owner confirms |
| 26 | Tenant isolation / auth security | — | ✓ | ✓ | — | — | — | ✓ | ✗ | WORKING_NOT_OWNER_ACCEPTED | — | none found | continued vigilance |
| 26 | API rate limiting (general) | ✗ | ✗ | ~ (2 services only) | — | — | — | ~ | ✗ | PARTIAL | P1 | most public/list endpoints unprotected | add general limiter |
| 27 | Streaming/resumable catalogue processing | — | ✓ | ✓ | ✓ | — | — | ✓ | ✗ | WORKING_NOT_OWNER_ACCEPTED | — | none found | none |
| 27 | Full-text/trigram search | ✗ | — | ~ (basic `contains`) | — | — | — | ✓ | ✗ | PARTIAL | P2 | fine at current scale only | revisit at scale |
| 28 | Health/readiness/migration tooling | — | ✓ | ✓ | — | ✓ | — | ✓ | ✗ | WORKING_NOT_OWNER_ACCEPTED | — | none found | none |
| 29 | Website claims accuracy | ✓ (mechanism exists) | — | — | — | — | — | — | ✗ | PARTIAL | P1 | several claims outrun real state (voice AI, connectors, packages) | relabel per this audit, don't redesign |

**Legend for "Owner accepted" column:** every row is `✗` because no
feature in this system currently has an explicit, recorded
`OWNER_ACCEPTED` — this is the single most consistent finding across the
entire audit, not a per-feature defect.

---

## Prioritized Backlog

### P0 — First Working Customer Journey

Only items that actually block "Project → source → BOQ → report →
generate → download" for a real user, manual-entry-only:

| Item | Dependency | Code or config/data | Size | Risk | Order |
|---|---|---|---|---|---|
| Owner acceptance of `/projects/new` (industry selector fix) | none — already deployed | Config/data (verification only) | XS | LOW | 1st |
| Owner acceptance of drawing upload (small + large file) | `BLOB_READ_WRITE_TOKEN` already configured per earlier session evidence | Config/data (verification only) | XS | LOW | 2nd |
| Owner acceptance of preview/download | same upload | Config/data | XS | LOW | 2nd (parallel with above) |
| Owner acceptance of BOQ create/save/reopen | project must exist | Config/data | XS | LOW | 3rd |
| Owner acceptance of document generation (BOQ + report) | ≥1 published template in production (currently UNKNOWN) | Data — verify template exists, else Config | S | LOW | 4th |
| Resolve HVAC 44-item anomaly | owner must run the already-built inspection route | Data (no code needed) | XS | LOW | Can run in parallel with all of the above |

**None of these require new code.** The entire P0 list is verification and
one data investigation — this is the single most important finding of
this audit.

### P1 — Commercial Launch

| Item | Dependency | Code or config/data | Size | Risk | Order |
|---|---|---|---|---|---|
| Execute + publish ≥1 catalogue dataset in production (CATALOGUE-ACTIVATE-3) | registry complete (this session), owner approval | Code (already built dry-run/execute pipeline) + data | M | MEDIUM (real production writes) | 1st |
| Create real `IndustryDataPackage` rows + assign published items | above | Code (package-assignment workflow not yet built) + data | M | LOW | 2nd |
| Package marketplace / My Library going live with real data | above | Data only (UI already exists) | S | LOW | 3rd |
| Resend-verification + invitation-flow routes | none | Code | S | LOW | any time |
| General API rate limiting | none | Code | M | LOW | before public launch |
| Investigate commerce-product test regression | none | Investigation, likely code or local-env fix | S | LOW | soon — signal of a real, worsening state issue |
| SMTP production configuration | Stripe-independent | Config | XS | LOW | any time |
| Stripe: resume once account access restored | **blocked on the owner's Stripe account recovery**, not on Quantara | Config, then code resumes from STRIPE-1C | L | MEDIUM | blocked |
| Measurement Import / BOQ Item Import as distinct labeled workflows | none | Code (new pages + purpose-typed routes) | M | LOW | after catalogue activation |
| Website claim relabeling (voice AI, connectors, packages) | this audit | Config/content (landing-page team's scope, not this session's) | S | LOW | any time |

### P2 — Product Differentiation

| Item | Dependency | Code or config/data | Size | Risk | Order |
|---|---|---|---|---|---|
| Real connected-source ingestion beyond Google Drive | provider OAuth partnerships | Code, per-provider | XL | MEDIUM | after P1 |
| Google Drive: configure + test real OAuth | Google Cloud console credentials | Config, then verification | S | LOW | can start anytime |
| Voice assistant (recording, transcription, typed instruction) | transcription provider selection | Code (full new subsystem) | XL | MEDIUM | after P1 |
| Structured AI proposal review/approval pipeline | voice/typed assistant above | Code (full new subsystem) | XL | HIGH (touches BOQ/report mutation) | after voice assistant |
| `ProjectSource` unified model + Source Centre UI | none | Code (schema + service + UI) | L | MEDIUM | before deep connector work |
| Source versioning/snapshots | `ProjectSource` model above | Code | M | LOW | after `ProjectSource` |
| Advanced catalogue matching (fuzzy/trigram search) | catalogue at meaningful scale | Code | M | LOW | when search quality becomes a real complaint |

### P3 — Future

| Item | Dependency | Code or config/data | Size | Risk | Order |
|---|---|---|---|---|---|
| Automatic drawing quantity takeoff | AI/ML capability, explicitly out of scope for near-term phases | Code (major R&D) | XL | HIGH | far future |
| Deep Revit/Archicad extraction (beyond file import) | plugin/bridge development | Code | XL | HIGH | far future |
| External search engine (e.g. dedicated search infra) | catalogue scale that outgrows Postgres `contains` search | Code + infra | L | MEDIUM | only if scale demands it |
| Full multi-currency commerce | Stripe resumed + real customer demand | Code | M | LOW | after Stripe resumes |
| Additional enterprise connectors (Procore, Trimble, Bentley, etc.) | partnerships, OAuth apps | Code, per-provider | XL | MEDIUM | ongoing |
| AI credit ledger (real reservation/capture system) | voice/AI assistant real usage | Code (full new subsystem) | L | MEDIUM | after voice assistant proves real usage |

---

## Duplicate-Work Prevention

**This section exists because previous phases in this same session
repeatedly discovered that assumed-missing backend systems already
existed** (most dramatically in CATALOGUE-COMMERCIAL Checkpoint 1, where a
from-scratch "build a commercial catalogue" instruction turned out to
already be ~80% implemented). Do not rebuild any of the following:

| System | Exact location | What it already does | What's still missing | Gap type |
|---|---|---|---|---|
| Effective entitlement resolution | `src/lib/entitlements/effective-entitlement-service.ts` | Centralized subscription/trial/admin-grant/owner-override/simulation decision — never a frontend check | Nothing to gate yet (no published catalogue items) | Production activation, not code |
| BOQ item search/autocomplete | `src/lib/services/item-search-service.ts`, `GET /api/items/search`, `AddItemFromSourceModal` | Ranked, multi-source, entitlement-aware search already wired live into the BOQ editor | Nothing to search yet in production | Production activation, not code |
| Immutable BOQ catalogue snapshots | `src/lib/services/boq-item-source-service.ts` | Version/classification snapshot at add-time, server-enforced entitlement check before resolving defaults | Nothing — complete | None |
| Catalogue dataset registry + governed import pipeline | `src/lib/services/catalogue-dataset-registry.ts`, `master-catalogue-import-job-service.ts` | Checksum-verified, resumable, dry-run/execute, all 15 folders registered (this session) | Never executed in production | Production activation, not code |
| Company library (custom items, recent, favorites) | `src/lib/services/company-library-service.ts` | Full CRUD, snapshot provenance from master/catalogue sources | Nothing found missing | None |
| Direct-to-Blob large file upload | `src/lib/services/drawing-service.ts`, `blob-client-upload.ts` | 250MB, checksum-verified, idempotent finalize, Range-aware download | Owner has not confirmed a real upload in production | Owner acceptance, not code |
| Template governance (BOQ/email/technical-report) | `src/lib/services/email-template-service.ts` + 3 parallel BOQ/report equivalents | Full CRUD + versioning + starter defaults | Production template counts unverified | Verification, not code |
| Google Drive connector | `src/lib/integrations/connectors/google-drive-client.ts`, `google-drive-integration-service.ts`, `/api/integrations/google-drive/*` | Real OAuth authorization/token/refresh/file-listing/download code, real routes | No real OAuth credentials configured/tested | Configuration, not code |
| Commerce catalogue | `src/lib/services/commerce-product-repository.ts` + STRIPE-1B's full build | Products/prices/entitlement templates, admin Commerce Centre, public API | 2 test files now fail post-seed (new finding this audit) | Test/environment investigation, not a rebuild |
| Trial/paywall limits | Phase 7's `entitlement-service.ts` | Real trial creation, BOQ-lock limit, premium-item unlock cap, all tested | Watermark/export-quality specifics unverified this turn | Verification, not code |
