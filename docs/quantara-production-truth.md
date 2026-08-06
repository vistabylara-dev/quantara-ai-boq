# Quantara Production Truth Table

Audit-only document. No code was changed, no migration created, no data
seeded, nothing pushed or deployed to produce this file. Values are
classified by evidence source; `UNKNOWN` means no safe, already-existing
read-only endpoint was available this session to establish the real
production number — it is never guessed.

| Metric | Production value | Evidence source | Expected | Status | Action |
|---|---|---|---|---|---|
| Active `IndustryEngine` count | 10 | VERIFIED_BY_PRODUCTION_ENDPOINT (`/api/admin/system-health/bootstrap-industries`, owner-run 2026-08-05) | 10 | VERIFIED | none |
| Companies backfilled with industry links | 6 | VERIFIED_BY_PRODUCTION_ENDPOINT (same run) | ≥1 | VERIFIED | confirm `/projects/new` shows real choices |
| Companies (total) | UNKNOWN | — | — | UNKNOWN | no safe count endpoint exposes this yet |
| Projects (total) | UNKNOWN | — | — | UNKNOWN | same |
| BOQs (total) | UNKNOWN | — | — | UNKNOWN | same |
| Project files | UNKNOWN | — | — | UNKNOWN | same |
| Generated documents | UNKNOWN | — | — | UNKNOWN | same |
| Technical reports | UNKNOWN | — | — | UNKNOWN | same |
| Published BOQ templates | UNKNOWN | VERIFIED_BY_CODE_ONLY (governance routes exist: `/api/admin/templates/boq/*`) | — | UNKNOWN | owner check via admin templates UI |
| Published technical-report templates | UNKNOWN | VERIFIED_BY_CODE_ONLY (`/api/admin/templates/technical-reports/*`) | — | UNKNOWN | same |
| Total MasterItems | **44** | VERIFIED_BY_PRODUCTION_ENDPOINT (`/api/admin/master-catalogue/growth-snapshot`, owner-run 2026-08-05) | 891 (HVAC) + up to 13,111 (Plumbing) if executed | PARTIAL / anomalous origin (see below) | inspect via `/api/admin/master-catalogue/datasets/quantara-master-hvac-v1/items` — requested, owner output not yet received |
| Published `MasterItemVersion` count | **0** | VERIFIED_BY_PRODUCTION_ENDPOINT (same) | >0 once published | MISSING | none published yet — expected, no import executed |
| `MasterHierarchyNode` count | **0** | VERIFIED_BY_PRODUCTION_ENDPOINT (same) | >0 once imported through the governed pipeline | MISSING | same |
| Items with classification | **0** | VERIFIED_BY_PRODUCTION_ENDPOINT (same) | >0 | MISSING | same |
| `MasterDiscipline` count | 5 | VERIFIED_BY_PRODUCTION_ENDPOINT (same) | 9 (per `prisma/seed-data/master-data.ts`) | PARTIAL | 4 disciplines not yet present in production (electrical, fire-fighting, furniture, joinery — construction/plumbing/mechanical/interior-fit-out/landscaping are confirmed used by the registry) |
| Registered datasets (code registry) | 15 | VERIFIED_BY_CODE_ONLY (`catalogue-dataset-registry.ts`, this session's own CATALOGUE-ACTIVATE-2 work) | 15 | VERIFIED (code) | production registry listing not re-fetched this turn — owner check recommended |
| HVAC production item count | 44 (see anomaly) | VERIFIED_BY_PRODUCTION_ENDPOINT (`/api/admin/master-catalogue/datasets`) | up to 891 | BLOCKED pending origin investigation | awaiting owner-run inspection route output |
| Plumbing production item count | 0 | VERIFIED_BY_PRODUCTION_ENDPOINT (same) | up to 13,111 | NOT_IMPORTED | awaiting owner approval to execute |
| Completed governed import batches (any dataset) | 0 (`latestJob: null` for both HVAC and Plumbing) | VERIFIED_BY_PRODUCTION_ENDPOINT | — | NOT_IMPORTED | none run this session |
| `IndustryDataPackage` count | UNKNOWN | — | — | UNKNOWN | not exposed by any endpoint hit this session; models exist in schema |
| `IndustryDataPackageItem` (assignment) count | UNKNOWN | — | — | UNKNOWN | same |
| Company package entitlements (`CompanyPackageSubscription`) | UNKNOWN | — | — | UNKNOWN | same |
| `CommerceProduct` count | 16 (as of STRIPE-1B seed, earlier this session) | VERIFIED_BY_TEST_ONLY / OWNER_REPORTED at time of seeding — **not re-verified this turn** | 16 | UNKNOWN (stale) | re-check `/api/commerce/products` live |
| `CommercePrice` count | 19 (same caveat) | OWNER_REPORTED (stale) | 19 | UNKNOWN (stale) | same |
| `EntitlementTemplate` count | UNKNOWN | — | — | UNKNOWN | not checked this session |
| Integration providers registered | 27 | VERIFIED_BY_CODE_ONLY (`provider-registry.ts`) | — | VERIFIED (code) | all but 2 are `COMING_SOON`/`REQUIRES_PLUGIN`/`FILE_IMPORT_ONLY` — see feature audit |
| Connected accounts (real `IntegrationConnection` rows) | UNKNOWN | — | — | UNKNOWN | Google Drive is the only provider with real OAuth code + routes; whether any account is actually connected in production is unverified |
| `ProjectSource` rows | N/A — **model does not exist** | VERIFIED_BY_CODE_ONLY (schema search, this session's P0-REAL-PRODUCT audit) | — | NOT_IMPLEMENTED | no unified source model exists yet |
| AI-credit ledger entries | N/A — **no ledger model exists** | VERIFIED_BY_CODE_ONLY (schema search, zero matches for `AiCreditLedgerEntry`) | — | NOT_IMPLEMENTED | none |

## Anomaly on the record: the 44 HVAC MasterItems

Documented in detail in `docs/catalogue-dataset-inventory.md` and
`docs/catalogue-commercial-activation-evidence.md` from earlier this
session. Summary: 44 `MasterItem` rows exist under the `mechanical`
discipline, but `latestJob: null` means they did not come through the
governed, checksum-verified HVAC dataset pipeline this registry uses. An
inspection route (`GET /api/admin/master-catalogue/datasets/quantara-master-hvac-v1/items`)
was built and deployed specifically to resolve this, but the owner has not
yet run it and returned the result. **This is the single most important
open unknown blocking any claim about catalogue production state.**

## What was and was not checked this turn

Checked live against production this turn: `/api/health`, `/api/ready`,
current deployment ID/commit match. Everything else above dated
"2026-08-05" was carried over from earlier phases of this same session
(genuine production evidence, not fabricated, but not re-verified in this
specific audit pass) — reused rather than re-fetched, since re-fetching
every owner-gated endpoint again would have required the same manual
owner action already pending from this session and would not have changed
any value. Metrics with no session history at all are `UNKNOWN`.
