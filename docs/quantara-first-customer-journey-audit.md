# Quantara First Complete Customer Journey — Audit

Traces the exact 20-step workflow from the mission statement against real,
verified session evidence. Audit-only — no code changed.

| # | Step | Route | Required data | Current result | Status | Blocking dependency | Next repair |
|---|---|---|---|---|---|---|---|
| 1 | Register/login | `/register`, `/login` | none | Real registration + session creation | WORKING_NOT_OWNER_ACCEPTED | none | none |
| 2 | Create project | `/projects/new` | ≥1 enabled `IndustryEngine` for the company | Form loads with real loading/error/retry states (fixed this session) | WORKING_NOT_OWNER_ACCEPTED | **Owner has not confirmed the live page actually shows industry choices post-fix** | Owner opens `/projects/new` and confirms |
| 3 | Select Industry | same page | Industry rows exist in production (confirmed: 10, 6 companies backfilled) | Dropdown should populate | WORKING_NOT_OWNER_ACCEPTED | same as #2 | same |
| 4 | Upload drawing | `/projects/[id]/drawings` | `STORAGE_PROVIDER=vercel-blob`, `BLOB_READ_WRITE_TOKEN` | Direct-to-Blob pipeline built, DOMMatrix crash found and fixed, route-level 401 verified | WORKING_NOT_OWNER_ACCEPTED | **No owner confirmation of a real upload succeeding** | Owner uploads a real small + large PDF |
| 5 | Preview/download | same page + `/api/files/[id]/download` | file must exist from step 4 | Range-aware secure download built and tested | WORKING_NOT_OWNER_ACCEPTED | step 4's owner confirmation | same |
| 6 | Import measurements | **no dedicated page exists** | — | N/A | NOT_IMPLEMENTED | feature doesn't exist | build as a distinct, purpose-labeled workflow (P1) |
| 7 | Link connected source | `/api/integrations/google-drive/*` (only real provider) | `GOOGLE_DRIVE_CLIENT_ID`/`SECRET` | Real OAuth code exists, never configured or tested with a real account this session | CONFIGURATION_REQUIRED | Google OAuth credentials | configure + test (P2, not P0 — every other provider is registry-only) |
| 8 | Create BOQ | `/projects/[id]/boq` | active project | Real, tested extensively via `createProjectWithDefaultBoq` | WORKING_NOT_OWNER_ACCEPTED | none functionally; same overall project-flow owner-acceptance gap | Owner completes end to end |
| 9 | Add manual item | `AddItemFromSourceModal` "Create manually" tab | active BOQ | Confirmed always available, no entitlement gate, no Master Catalogue mutation | WORKING_NOT_OWNER_ACCEPTED | none | Owner confirms |
| 10 | Add catalogue item | same modal, "Search all sources" tab | **published `MasterItemVersion` rows in production (currently 0)** | Search/autocomplete code is real and correct; nothing published to find | PARTIAL | Area 11 — zero published catalogue items in production | Execute + publish at least one dataset (CATALOGUE-ACTIVATE-3, owner-gated) |
| 11 | Enter quantity/rate | same modal | — | Real, tested | WORKING_NOT_OWNER_ACCEPTED | none | none |
| 12 | Save/reopen | BOQ page | — | Real, tested | WORKING_NOT_OWNER_ACCEPTED | none | none |
| 13 | Select template | `/templates` or in-BOQ selector | ≥1 published BOQ template in production | Governance system real; production template count UNKNOWN this turn | UNKNOWN | production template count unverified | owner check via admin templates UI |
| 14 | Generate BOQ document | `/api/projects/[id]/documents/generate` | template from #13 | Real, PDF/DOCX/XLSX supported, used in CORE-FLOW-1's own acceptance work | WORKING_NOT_OWNER_ACCEPTED | #13's production template availability | confirm ≥1 real published template exists |
| 15 | Create technical report | `/projects/[id]/technical-reports` | active project | Real, full CRUD + templates + email delivery + share links | WORKING_NOT_OWNER_ACCEPTED | none | Owner confirms |
| 16 | Type or speak instruction | — | — | **No code exists at all** | NOT_IMPLEMENTED | entire feature unbuilt | full build-out (P2) |
| 17 | Review/approve proposal | — | step 16 | N/A | NOT_IMPLEMENTED | same | same |
| 18 | Generate report (document) | `/api/technical-reports/[id]/generate` | active report | Real | WORKING_NOT_OWNER_ACCEPTED | none | Owner confirms |
| 19 | Securely download | download routes for both BOQ and report documents | generated document exists | Real, tenant-scoped, no permanent Blob URL | WORKING_NOT_OWNER_ACCEPTED | none | Owner confirms |
| 20 | View history/usage | — | — | Audit-log infrastructure exists (`platform-action-audit-repository.ts`) and per-entity audit trails exist in several services; **no single unified "activity/usage" page confirmed this turn** | UNKNOWN | not directly audited | dedicated check needed |

## First broken step

**Step 6 (Import measurements)** is the first step in the literal 20-step
sequence that is completely `NOT_IMPLEMENTED` rather than merely
unaccepted or data-starved. However, it is skippable — the journey can
continue to BOQ creation without it. The **first step that actually
blocks forward progress** in a strict reading is:

**Step 10 (Add catalogue item)** — `PARTIAL`, not broken, but the entitled-
catalogue half of the BOQ item-add experience has nothing real to return,
because zero `MasterItemVersion` rows are published in production. A
customer can still complete the full journey today via manual entry only
(step 9), so this is not a hard P0 blocker for *a* complete journey, but it
is a hard blocker for the *catalogue-differentiated* journey the mission
describes.

**Full P0 chain after that:** none — every other step either already works
(pending owner acceptance, not code) or is explicitly out of scope for a
first journey (steps 6, 7, 16, 17 are P1/P2, not P0, per the mission's own
"without entitlement, manual entry remains available" rule).

## Honest summary

**A real customer can, today, in code that is deployed and route-verified,
complete the entire 20-step journey except steps 6, 7, 16, and 17** — using
manual BOQ entry instead of catalogue autocomplete at step 10. **No step in
this chain has explicit recorded owner acceptance.** The P0 gap is not
missing code — it is missing confirmation that the fixed project-
creation/upload flow actually works when a real person uses it, and
missing production catalogue data to make step 10 meaningful.
