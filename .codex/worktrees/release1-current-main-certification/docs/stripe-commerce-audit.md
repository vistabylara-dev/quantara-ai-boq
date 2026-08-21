# Quantara — STRIPE-1A: Commerce & Stripe Architecture Audit

Date: 2026-08-05. **Audit only — no application code was written, no migrations were created,
nothing was committed except this document, nothing was deployed.** Built by direct repository
inspection (Prisma schema, services, routes, tests) plus a dedicated read-only research pass —
not from trusting prior phase-completion reports, several of which describe commerce features
this audit found do not exist.

## Context: working-tree state at audit time

The repository is a **shared working directory with a second, actively-committing agent
process** (already documented in `docs/quantara-production-recovery-status.md`). At audit time
the working tree had substantial *uncommitted* changes from that process: `prisma/schema.prisma`,
`middleware.ts`, `page.tsx`, `register/page.tsx`, `auth-service.ts`/`auth-schemas.ts`, plus
untracked `src/app/contact-sales/`, `src/app/api/contact/`, a `SalesInquiry` migration folder,
and a set of legal pages. None of this was touched, reviewed in depth, or committed by this
audit. Where a finding depends on whether something is committed vs. only on-disk, both states
are reported explicitly.

## 1. Stripe package and configuration — **NOT_IMPLEMENTED**

- `package.json`: no `stripe`, no `@stripe/stripe-js`, no payment SDK of any kind.
- `.env.example`: zero `STRIPE_*` variables anywhere.
- No Stripe server client, Checkout session creation, Billing/subscription API call, Customer
  Portal integration, or webhook handler exists anywhere in the codebase (`grep -ri stripe`
  across the whole tree matches only prose in `docs/` design documents, never code).
- `docs/PHASE-9-PRODUCTION-ENTERPRISE-MASTER-INSTRUCTION.md` describes a *planned*
  `BillingProvider`/`SubscriptionProvider`/`WebhookProvider` abstraction and explicitly says "do
  not hardcode Stripe" — this is design prose only; zero code exists from it.

**Every single item in the task's "Stripe Package and Configuration Audit" checklist (Stripe
Checkout, Billing, Customer Portal, webhook handler, signature verification, customer ID,
subscription ID, price ID, product ID, invoice ID, payment intent, refund, dispute, test mode)
is NOT_IMPLEMENTED.** There is nothing partial or placeholder-shaped — it is a clean absence.

## 2. Commercial Prisma models

No Stripe-linked models exist. The commerce-adjacent models that do exist:

| Model | Purpose | Money fields | Tenant scope | Status field | Gaps |
|---|---|---|---|---|---|
| `SoftwarePlan` | Subscription plan catalogue | `monthlyPrice`/`annualPrice` `Decimal(12,2)` ✓ | Global (not company-scoped — it's the catalogue) | `isActive` | Currency defaults `USD`; no Stripe price ID field |
| `CompanySoftwareSubscription` | A company's active plan | — | `companyId` | `SubscriptionStatus` enum (TRIAL/ACTIVE/PAST_DUE/CANCELLED/EXPIRED/SUSPENDED) | `externalSubscriptionId String?` exists but is **never written to** by any code path — a dangling placeholder, not real provider integration; `source` field defaults `"development"`, self-documenting as non-production |
| `CompanyTrialUsage` | Trial usage counters | — | `companyId` | — | Counter-only, fine for its purpose |
| `TrialPremiumItemUnlock` | Per-item trial unlock ledger | — | `companyId` | — | Trial-only, no paid equivalent |
| `IndustryDataPackage` | Add-on data package catalogue | `Decimal(12,2)` ✓ | Global | `status` | Same USD-default inconsistency as `SoftwarePlan` |
| `CompanyPackageSubscription` | A company's package purchase | — | `companyId` | same pattern as above | Same dangling `externalSubscriptionId` |
| `SalesInquiry` (uncommitted) | Contact-sales form capture | — | none | `deliveryStatus String @default("stored")` (not an enum) | Write-only — nothing reads or transitions it |

**Missing entirely, no equivalent of any kind:** `Product`, `Price` (as a Stripe-shaped concept),
`BillingCustomer`, a Stripe-linked `Subscription`, `Order`, `OrderItem`, `Entitlement` (as a
first-class model — entitlement is currently *computed*, not stored), `UsageRecord` (beyond
trial counters), `CreditLedgerEntry`, `DownloadRecord`, `Invoice`, `Refund`, `Coupon`,
`EnterpriseQuote`, `WebhookEvent`, `CommercialAuditLog`.

## 3. Product/price catalogue

**All 21 requested product codes** (`starter_monthly_aed_149` through
`enterprise_installation_from_aed_15000`) were searched for across code, seed data, and the
schema. **Zero matches, anywhere.** The actual seeded catalogue
(`prisma/seed-data/commercial.ts`) uses entirely different keys (`free`, `trial-pro`, `pro`,
`business`, `enterprise`), **USD** pricing ($0/$0/$49/$149/$0/mo), and bears no resemblance to
the requested AED SKU list. `IndustryDataPackage` seed data is one row
(`mechanical-hvac-professional`, $199/mo, $1999/yr, USD).

The marketing pricing section in `src/app/page.tsx` — last committed at `a11b6ac` with static
JSX cards for Starter AED149/Professional AED399/Business AED899/mo — is **pure hardcoded
marketing copy**, never sourced from `SoftwarePlan` or `IndustryDataPackage`. The `/register`
route does not consume the `?plan=` query parameter the pricing card links carry. As of this
audit, that page is mid-edit in the other agent's uncommitted working tree (partially reduced,
not fully removed — 8 plan-name mentions remain vs. 35 in the committed version). **Whichever
version of this page ends up committed, it is disconnected from the backend either way.**

**Conclusion: there is no authoritative server-side product catalogue matching the commercial
requirements document at all.** What exists (`SoftwarePlan`, `IndustryDataPackage`) is a
different, smaller, USD-denominated, dev-only-activatable catalogue built for an earlier phase.

## 4. Money storage — clean

`grep -n "Float" prisma/schema.prisma` returns zero hits. Every money field found
(`SoftwarePlan`/`IndustryDataPackage` prices, `Company.vatRate`, BOQ/project totals) uses
`Decimal`. Client-side DTOs convert `Decimal` → `number` at the API boundary for JSON transport
(standard practice, not a storage-safety issue). **No unsafe float-based authoritative money
field was found anywhere in the codebase.**

## 5. Entitlement engine

Centralized in `src/lib/entitlements/effective-entitlement-service.ts` (the single place
`platformRole`/simulation changes behavior — confirmed as a deliberate architectural rule, see
its own header comment), backed by `entitlement-service.ts` and `package-entitlement-service.ts`.

| Decision | Exists? | Function |
|---|---|---|
| Can create project | ✅ | `canCreateProjectEffective` |
| Can invite user | ❌ NOT_IMPLEMENTED | no invite system exists at all; `SoftwarePlan.maxUsers` is stored but never read anywhere in `src/` |
| Can add workspace/company | ❌ NOT_IMPLEMENTED | no multi-workspace concept |
| Can generate BOQ | ✅ | `canCreateBoqEffective` |
| Can generate technical report | ⚠️ PARTIAL | shares the generic document gate; no report-specific limit despite reports being a distinct model |
| Can remove watermark / clean export | ✅ | `canGenerateDocumentEffective` |
| Can export PDF/Word/Excel | ⚠️ PARTIAL | same gate for every format — no per-format entitlement |
| Can access industry library | ✅ | `hasIndustryPackage` / `companyHasPackageAccessForItem` |
| Can use branding | ❌ NOT_IMPLEMENTED | `CompanyBranding` model has zero entitlement-service references |
| Can use API | ❌ dead code | `assertFeatureAccess("api-access")` is defined but has **zero call sites** anywhere |
| Can download purchased resource | ❌ NOT_IMPLEMENTED | no purchase-then-download model exists to check against |
| Has remaining monthly allowance | ⚠️ PARTIAL | trial-only (`getTrialUsageSummary`); `SoftwarePlan.maxDocumentsPerMonth` is stored but **never enforced for a paid plan** |
| Has enough AI credits | ❌ NOT_IMPLEMENTED | the concept doesn't exist in code at all |
| Subscription active | ✅ | `getCompanyEntitlements().isExpiredOrNone` |
| Trial active | ✅ | `getCompanyEntitlements().isTrial` |
| Entitlement expired | ✅ | `syncSubscriptionStatus` (lazy, on-read) |
| Purchase refunded | ❌ NOT_IMPLEMENTED | no purchase/refund model |
| Entitlement revoked | ⚠️ PARTIAL | only via manual dev-only `expireDevelopmentSoftwarePlan`/`expireDevelopmentPackage` — no refund-triggered or admin-triggered revoke |

All server-side (route-level `requireCapability`/entitlement checks precede business logic — no
frontend-only enforcement found for anything above). Owner override and customer simulation both
correctly flow through the same centralized function (confirmed in the prior ADMIN-DATA-ACCESS-1
audit). No duplicated/scattered plan checks were found outside this service layer — the
centralization discipline is real and consistently followed, which is a genuine strength.

## 6. Watermark and download workflow

Traced `document-generation-service.ts` → `build-document-data.ts` (watermark decision) →
format generators (PDF/DOCX/XLSX/CSV/HTML, all consume `watermarkText`) →
`localDocumentStorageAdapter` → `/api/documents/[documentId]/download`.

| Stage | Status |
|---|---|
| Free/trial watermark | **COMPLETE** |
| Clean-export entitlement (trial vs. paid) | **COMPLETE** |
| One-resource unlock for a *real paying customer* | **NOT_IMPLEMENTED** — `SINGLE_BOQ_UNLOCKED` exists only as a platform-owner simulation mode; there is no real purchase record that grants this to an actual company |
| Resource ownership check | **COMPLETE** (tenant/RBAC-scoped before storage read) |
| Secure URLs | **PARTIAL** — authenticated direct GET, no separate signed/expiring URL layer |
| Download expiry | **NOT_IMPLEMENTED** — `GeneratedDocument` has no `expiresAt` |
| Download count | **NOT_IMPLEMENTED** — no `downloadCount` field |
| Cross-tenant denial | **COMPLETE** |
| Refund/revocation handling | **NOT_IMPLEMENTED** — nothing to revoke, no purchase record exists |

**Full workflow classification: PARTIAL.** The generation/watermark/tenant-safety half is
genuinely complete and tested; the purchase/unlock/expiry/revocation half does not exist.

## 7. Checkout/billing routes

No `/api/checkout`, `/api/billing`, `/api/webhooks`, or `/api/downloads` directory exists at all.

| Requested | Closest real equivalent | Gap |
|---|---|---|
| `POST /api/checkout/subscription` | `POST /api/entitlements/activate-development-plan` | Flips DB status directly; zero payment-provider call; self-service by the acting company, not a real checkout |
| `POST /api/checkout/one-time` | none | NOT_IMPLEMENTED |
| `POST /api/checkout/add-on` | none | NOT_IMPLEMENTED |
| `POST /api/billing/portal` | none | NOT_IMPLEMENTED |
| `POST /api/billing/change-plan` | same dev-activation endpoint, reused | not a real change-plan flow |
| `POST /api/billing/cancel` | `POST /api/entitlements/expire-development-plan` | manual DB flip only |
| `POST /api/billing/reactivate` | none | NOT_IMPLEMENTED |
| `POST /api/webhooks/stripe` | none | NOT_IMPLEMENTED |
| `GET /api/billing/subscription` | `GET /api/entitlements` | real DB read, works |
| `GET /api/billing/usage` | `GET /api/entitlements` (`trialUsage`) | trial-only, no paid-plan usage |
| `GET /api/billing/orders` | none | NOT_IMPLEMENTED |
| `GET /api/billing/invoices` | none | NOT_IMPLEMENTED |
| `GET /api/billing/downloads` | none | NOT_IMPLEMENTED |
| `GET /api/entitlements` | **exists**, real | — |
| `POST /api/downloads/[id]` | `GET /api/documents/[documentId]/download` | not purchase-gated, GET not POST |
| `POST /api/enterprise/enquiry` | `POST /api/contact` (uncommitted) | writes `SalesInquiry`, has a real integration test |
| `POST /api/admin/enterprise/quotes` | none | NOT_IMPLEMENTED — `SalesInquiry` is write-only, no admin read/action path |
| `POST /api/admin/entitlements/grant\|revoke` | none (admin-initiated) | `/api/admin/subscriptions` is **read-only**; existing activate/expire endpoints are company self-service, not owner-initiated grants to arbitrary companies |
| `POST /api/admin/credits/adjust` | none | NOT_IMPLEMENTED — credits don't exist |

No fake-success routes and no UI-button-with-no-route were found — what exists is honestly
built and honestly labeled (see §8). The gap is entirely coverage, not deception.

## 8. Pricing and billing UI

| Surface | Classification |
|---|---|
| `/settings/subscription` | **Real data**, reads `GET /api/entitlements` + `GET /api/software-plans`. Explicitly self-labeled in its own UI copy: *"Billing is not connected in this build. All activation below is a development control, not a real payment."* Honest, not deceptive. |
| Marketing pricing section (`src/app/page.tsx`) | **Static display** — hardcoded JSX, not sourced from any model; currently mid-edit/uncommitted |
| Billing dashboard (usage/purchases/downloads/invoices) | **Missing** — no such page exists. Note: `dashboard/commercial-summary` sounds like it might be this but is actually rate-catalogue/supplier statistics, unrelated to billing |
| Upgrade/downgrade/cancel/reactivate | **Disconnected action** — buttons exist on `/settings/subscription` but call dev-only DB-flip endpoints |
| Payment method / billing portal | **Missing** |
| Enterprise enquiry | **Complete workflow** (form → validated API → DB row → real test), but admin-side is missing (write-only) |

## 9. Trial system

`startTrial` (`entitlement-service.ts`): duration hardcoded at **3 days**
(`TRIAL_LIMITS.durationDays`), limits are `maxProjects:1, maxCompletedBoqs:1,
maxUniquePremiumItems:5, maxFinalExports:1, maxProposals:1` — all hardcoded constants, not
configurable per plan/company. Catalogue access: non-premium items unrestricted, premium items
capped at 5 unique unlocks. Watermark applied on all non-draft exports. Expiry is lazy
(computed on read, no cron). **Trial data is never deleted** — no cleanup job exists; trial
companies/projects persist indefinitely. Upgrade path is manual dev-activation only, not a real
paid-upgrade flow. Gated correctly (one trial per company ever, requires verified email +
complete profile + accepted terms). **Test coverage is real** —
`tests/phase7-entitlements-and-library.test.ts` is a genuine integration test against local
Postgres covering the full trial lifecycle, not a shallow smoke test.

## 10. AI credit audit

**Does not exist.** `grep -i credit` across the entire schema and `src/` tree returns zero
matches in either. No balance, ledger, reservation, capture, release, reversal, expiration,
idempotency, or concurrency-protection logic exists — there is nothing to evaluate here beyond
confirming the absence. This is purely a documented future concept in the Phase 9 design doc.

## 11. Enterprise audit

A real, working, tested **enquiry** capture exists (uncommitted): `src/app/contact-sales/page.tsx`
(form) → `POST /api/contact` (Zod-validated) → `SalesInquiry` row, with a genuine integration
test (`tests/integration/contact.test.ts`) asserting real persistence, not just a 200 status.
**Everything past that point is missing**: no admin quote-management UI or API reads
`SalesInquiry`; no AED 15,000 minimum logic exists anywhere; no quote generation, approval,
acceptance, order conversion, deposit payment, or implementation-activation workflow exists.
`PlanType.ENTERPRISE` and a `SoftwarePlan` row keyed `enterprise` ($0/mo, "Custom / contact
sales") exist as catalogue placeholders only, carrying no pricing or quoting logic.

## 12. VAT and currency audit

`Company.vatRate` is a `Decimal(7,4)` defaulting to 5, genuinely **configurable per company**
(editable via `PATCH /api/company`, validated server-side) — not a hardcoded global. Currency
defaults are **inconsistent across models**: `Project`/`RateCatalogueItem` default to `"AED"`,
while `SoftwarePlan`/`IndustryDataPackage` default to `"USD"` — all are plain editable strings,
not enums, and nothing enforces consistency. **No multi-currency conversion exists anywhere** —
no exchange-rate provider, no cache, no conversion logic (`grep -i "exchangeRate"` across `src/`:
zero hits). Whatever currency a row is created with is just a static label.

## 13. Test quality audit

Two genuine commerce-adjacent integration tests exist and were verified to be real (hit an
actual service/route + real local Postgres, assert on real persisted data — not file-existence
or text-presence checks): `tests/phase7-entitlements-and-library.test.ts` (trial lifecycle) and
`tests/integration/contact.test.ts` (enterprise enquiry capture). **No test exists for**:
checkout, billing, webhooks, credits, refunds, or watermark-actually-burned-into-output-bytes
(the watermark *text* is set and passed through, but no test asserts it appears in the generated
PDF/DOCX binary). Coverage is narrow but what exists is not shallow — there is no test in this
codebase that merely proves "a route/button/file exists."

## Production status matrix

| Feature | UI | API | Service | Model | Stripe dependency | Tests | Prod evidence | Status | Missing work |
|---|---|---|---|---|---|---|---|---|---|
| Subscriptions (Starter/Pro/Business) | Static marketing copy | dev-activation only | `entitlement-service.ts` | `SoftwarePlan` (different catalogue) | None | Trial-adjacent only | Seed data is USD, not the AED SKUs | **NOT_IMPLEMENTED** (as specified) | New Product/Price catalogue, real checkout |
| Annual billing | None | None | None | None | None | None | None | **NOT_IMPLEMENTED** | Everything |
| One-time BOQ purchase | None | None | None | None | None | None | None | **NOT_IMPLEMENTED** | Everything |
| Premium BOQ purchase | None | None | None | None | None | None | None | **NOT_IMPLEMENTED** | Everything |
| Technical report purchase | None | None | None | None | None | None | None | **NOT_IMPLEMENTED** | Everything |
| Bundle | None | None | None | None | None | None | None | **NOT_IMPLEMENTED** | Everything |
| Tender package | None | None | None | None | None | None | None | **NOT_IMPLEMENTED** | Everything |
| Industry packs | Partial (`/marketplace`) | `IndustryDataPackage` routes | `package-entitlement-service.ts` | `IndustryDataPackage`, `CompanyPackageSubscription` | None | Indirect | 1 seeded package | **PARTIAL** | Real checkout, AED alignment |
| AI credits | None | None | None | None | None | None | None | **NOT_IMPLEMENTED** | Everything, from zero |
| Add-ons | None | None | None | None | None | None | None | **NOT_IMPLEMENTED** | Everything |
| Enterprise enquiry | Real form | Real route | Inline in route | `SalesInquiry` (uncommitted) | None | Real test | Untested in prod | **WORKING** (enquiry only) | Admin-side quoting entirely |
| Checkout | None | Dev-activation only | `entitlement-service.ts` | `CompanySoftwareSubscription` | None | Trial tests only | Self-labeled non-production | **NOT_IMPLEMENTED** | Everything |
| Webhook | None | None | None | None | None | None | None | **NOT_IMPLEMENTED** | Everything |
| Entitlement engine | N/A | Route-enforced | `effective-entitlement-service.ts` | Computed, not stored | None | Real tests | Working | **WORKING** (for what it covers) | Invites, workspaces, branding, API access, per-plan monthly allowance, credits |
| Watermark | N/A | Generation route | `build-document-data.ts` | `GeneratedDocument` | None | Indirect | Working | **WORKING** | Real single-resource unlock, download count/expiry |
| Downloads | N/A | Auth-gated GET | `document-generation-service.ts` | `GeneratedDocument` | None | Real tests | Working | **PARTIAL** | Purchase-gating, expiry, revocation |
| Billing dashboard | Missing | Missing | Missing | Missing | None | None | None | **NOT_IMPLEMENTED** | Everything |
| Admin commerce | Read-only list | `/api/admin/subscriptions` (GET only) | — | — | None | None | None | **PARTIAL** | Grant/revoke, quote management, credit adjustment |
| VAT | Working, configurable | `PATCH /api/company` | `company-repository.ts` | `Company.vatRate` `Decimal` | None | Indirect | Working | **WORKING** | — |
| Currency | Inconsistent defaults, no conversion | — | — | Plain string fields | None | None | — | **PARTIAL** | Standardize AED, decide if conversion is ever needed |
| Invoices | None | None | None | None | None | None | None | **NOT_IMPLEMENTED** | Everything |
| Refunds | None | None | None | None | None | None | None | **NOT_IMPLEMENTED** | Everything |
| Disputes | None | None | None | None | None | None | None | **NOT_IMPLEMENTED** | Everything |
| Commerce emails | None specific | — | — | — | None | None | None | **NOT_IMPLEMENTED** | Everything (real SMTP exists for other flows, per prior audit) |

## STRIPE-1B scope (design only — nothing here is implemented)

STRIPE-1B, per the task's own explicit boundary, must add an **internal product/price catalogue
and entitlement-template structure with no live checkout and no Stripe webhook** — a pure
data-modeling and admin-tooling phase.

**Models to create (new, additive migration):**
- `CommerceProduct` — `code` (unique, matches the 21 SKU codes), `type` enum
  (`SUBSCRIPTION`/`ONE_TIME`/`AI_CREDIT_PACK`/`ADD_ON`/`ENTERPRISE`), `name`, `description`,
  `isActive`, `isPublic`.
- `CommercePrice` — belongs to `CommerceProduct`, `amount Decimal(12,2)`, `currency` (default
  `AED`, enum-constrained not free string — closes the currency-inconsistency gap found in §12),
  `billingInterval` enum (`MONTH`/`YEAR`/`ONE_TIME`), `isActive`. One product can have multiple
  prices (monthly + annual) — mirrors Stripe's own Product/Price separation intentionally, so a
  future real Stripe integration maps onto this cleanly instead of needing a redesign.
- `EntitlementTemplate` — belongs to `CommerceProduct`, structured grants this product confers
  (e.g. `maxProjects`, `maxDocumentsPerMonth`, `removesWatermark: boolean`,
  `industryPackageKeys: string[]`, `aiCreditsGranted: int`) — a typed successor to the ad hoc
  fields currently scattered across `SoftwarePlan`.
- Extend `CompanySoftwareSubscription` (or introduce a parallel `CompanyCommercePurchase` for
  one-time products) with a real, typed `provider` field (`"development"` | future
  `"stripe"`) replacing the dangling untyped `externalSubscriptionId` string.

**Migration:** required, additive-only (new tables + new nullable/defaulted columns only, per
this project's established migration-safety pattern — no existing table altered destructively).

**Seed strategy:** a new `prisma/seed-data/commerce-products.ts`, idempotent
(`upsert` on `code`), seeding exactly the 21 requested SKUs as `CommerceProduct`+`CommercePrice`
rows with AED pricing — mirrors the existing `seed-industry-packages.ts` idempotency pattern
already established in this codebase.

**Idempotency strategy:** `upsert` keyed on `CommerceProduct.code` for both the seed script and
any future admin "create/update product" route — never insert-only.

**Routes (server-controlled pricing API, read-only, no checkout):**
- `GET /api/commerce/products` — public, returns active+public products with their current
  prices (replaces the hardcoded marketing-page JSX with real data).
- `GET /api/admin/commerce/products` — owner-only, full list including inactive/private.
- `POST /api/admin/commerce/products` / `PUT /api/admin/commerce/products/[id]` — owner-only
  create/update (governance-lite; full DRAFT/PUBLISHED versioning like the template system is
  probably over-engineering for STRIPE-1B specifically, but worth deciding explicitly rather
  than defaulting).

**Services:** `commerce-product-service.ts` (CRUD + the public read-model projection),
`entitlement-template-service.ts` (resolves a product code to its entitlement grant shape —
this is what STRIPE-1C's real checkout fulfillment would eventually call).

**Admin UI impact:** a new `/admin/commerce` section (list/create/edit products and prices),
following the exact pattern already established by the Template Centre
(`/admin/templates`) built in TEMPLATE-LINK-1 — same owner-only gating, same list+detail
layout convention.

**Tests:** model/service tests for `CommerceProduct`/`CommercePrice`/`EntitlementTemplate` CRUD
and the seed script's idempotency (re-running seed twice must not duplicate rows), plus a route
test for the public `GET /api/commerce/products` read model — mirroring the real-integration-test
standard this codebase already holds itself to (§13), not a shallow existence check.

**Rollback plan:** the migration is purely additive (new tables only); rollback is
`git revert` of the code + a manual `DROP TABLE` of the 3 new tables if ever needed — no existing
table or column is touched, so no other feature can regress from this migration alone.

**Files proposed (STRIPE-1B, not created in this audit):**
- `prisma/migrations/<timestamp>_stripe_1b_commerce_catalogue/migration.sql`
- `prisma/seed-data/commerce-products.ts`
- `src/lib/services/commerce-product-service.ts`
- `src/lib/services/entitlement-template-service.ts`
- `src/lib/repositories/commerce-product-repository.ts`
- `src/app/api/commerce/products/route.ts`
- `src/app/api/admin/commerce/products/route.ts`
- `src/app/api/admin/commerce/products/[productId]/route.ts`
- `src/app/admin/(protected)/commerce/page.tsx` + a client component (naming to mirror
  `admin-template-centre.tsx`)
- `tests/commerce-product-service.test.ts`

STRIPE-1B explicitly does **not** include: live Stripe checkout, a Stripe webhook, any
`STRIPE_*` secret, wiring the marketing page to the new read API (a reasonable follow-up, but a
UI change outside this phase's stated scope), or touching the existing `SoftwarePlan`/
`IndustryDataPackage` models (they can coexist during a migration period rather than being
deleted in the same phase that introduces their replacement).
