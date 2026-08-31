# Stripe billing incident — read-only evidence report

Date: 2026-08-31

Candidate baseline: `2aabd3efb3b30cc0d9959dba607e085ba5481c8b`

Rescue baseline searched: `30a56f159709a1854c305f6346eddad86e38157a`

## Scope and evidence boundary

This report records the already-established, sanitized billing evidence. This source-only pass
made no Stripe request, database query, browser request, webhook replay, or provider/application
write. It did not inspect or reproduce secret values.

## Safe mapping result

| Subject | Established evidence | Result |
|---|---|---|
| Connected provider context | `acct_…m43P`, Live mode. | This proves only the sanitized account/context that was inspected. |
| Active subscriptions in that connected live context | None found. | There is no provider-side active subscription in the inspected account to map. |
| Only relevant subscription observed | Starter, quantity `1`, canceled. Its existing billing-customer mapping resolves to the current authenticated company. | This is canceled historical state, not the expected entitlement. |
| Expected subscription | Active, quantity `20`. | Not found and not proven in the connected account. |
| Current Quantara company | `2c32ffc3-69bd-430f-a54b-625a0827cb25` (`Quantara Platform Administration`). | This is the company mapped by the canceled Starter evidence, not proof of the expected 20-seat holder. |
| Company holding the expected subscription | No active 20-seat provider record was available. | Unknown; no company switch can be prescribed safely. |
| Application subscription identity/status | The established evidence proves canceled Starter, quantity `1`; its application-row UUID was not retained in the sanitized evidence bundle. | The row must not be guessed or rewritten. |
| Sanitized Stripe customer/subscription references | The exact sanitized customer and subscription suffixes were not retained in the established evidence bundle. | Re-querying or inventing them is outside this report-only pass; they remain required before any correction. |
| Stale application data overriding active provider data | No active provider record was found in the inspected account. | Not demonstrated. The canceled Starter row must not be rewritten into an active 20-seat entitlement. |
| Latest relevant webhook outcome | `customer.subscription.deleted`. | Provider and application both reflect cancellation; do not replay the event. |

The application’s normal reconciliation design supports this conservative conclusion. The
webhook path obtains tenant identity by cross-referencing the subscription’s Stripe customer
against `StripeBillingCustomer`; it does not trust browser/session metadata
(`src/lib/services/stripe-webhook-service.ts`, lines 257–270). It updates or creates the
company subscription only after resolving the current provider price and company mapping
(lines 272–338). The idempotency ledger is written in the same transaction as provider-driven
state application (`src/lib/repositories/stripe-billing-repository.ts`, lines 70–88).

## Expected Stripe account identity search

The documentation at both the candidate and rescue baselines was searched for exact Stripe
account identifiers using an identifier-only pattern. Neither tree contains an `acct_…` value.
The rescue documentation therefore does not prove the expected account ID. Historical prose
about Stripe account access or configuration is not account-identity evidence.

Consequently, the following possibilities cannot yet be distinguished:

1. the connected live account is not the account that holds the expected subscription;
2. the expected subscription never existed or is no longer active; or
3. the expected subscription exists elsewhere but its exact account/customer mapping has not
   been supplied.

This is an ambiguous subscription correction, one of the release brief’s explicit stop
conditions. No customer, subscription, price, quantity, company membership, entitlement,
webhook, or application mapping should be changed until read-only evidence identifies the exact
provider account and active subscription.

## Correction-path limitation

No dedicated manual “subscription rescue” service with its own correction audit event was found
in this baseline. The established `processStripeWebhookEvent()` path is provider-driven: it
fetches current Stripe state, applies tenant-safe subscription state, and records a webhook
idempotency row. That path is not authorization to replay a webhook or manufacture provider
state. A future manual repair must first identify an existing authorized correction service, or
receive explicit scope to add the smallest audited repair path and tenant-isolation tests.

## Required validation command inventory

These commands are inventory for a future authorized correction. They were not run during this
read-only report because the test harness resets a dedicated test database and build/typegen
commands generate local artifacts.

```powershell
# Prisma validation only — never migrate, reset, or db push for this correction.
npm.cmd run db:validate

# Type safety.
npm.cmd run typecheck

# Canonical billing regression group.
npm.cmd test -- tests/commerce-checkout-availability-service.test.ts tests/commerce-checkout-service.test.ts tests/commerce-plan-mapping.test.ts tests/stripe-webhook-service.test.ts

# Mandatory tenant-isolation coverage for any mapping correction.
npm.cmd test -- tests/tenant-scope.test.ts tests/stripe-webhook-service.test.ts

# Full safe suite through the repository harness, after verifying its target is a disposable
# local/test database. Do not invoke raw Vitest against an arbitrary DATABASE_URL.
npm.cmd test

# Repository lint and production build.
npm.cmd run lint
npm.cmd run build

# Whitespace and complete diff review.
git diff --check 2aabd3efb3b30cc0d9959dba607e085ba5481c8b --
git diff --stat 2aabd3efb3b30cc0d9959dba607e085ba5481c8b --
git diff --name-status 2aabd3efb3b30cc0d9959dba607e085ba5481c8b --
```

If the locked provider-mapping repository is touched, its feature lock additionally requires
the following focused suite twice consecutively, with a stable fixture count:

```powershell
npm.cmd test -- tests/stripe-sync-service.test.ts
npm.cmd test -- tests/stripe-sync-service.test.ts
```

The project has no dedicated touched-file lint script. `npm.cmd run lint` is the exact,
conservative project command; a narrower lint may use the repository’s ESLint configuration only
after the authorized changed-file list is known.

## Protected-file and scope guards

`prisma/schema.prisma` and every existing `prisma/migrations/**` file are protected. A billing
mapping defect or missing test table is not permission to modify either surface.

```powershell
# Must exit zero and print no diff.
git diff --exit-code 2aabd3efb3b30cc0d9959dba607e085ba5481c8b -- prisma/schema.prisma prisma/migrations

# For this report-only task, this must print nothing: the report is the sole allowed path.
git diff --name-only 2aabd3efb3b30cc0d9959dba607e085ba5481c8b -- . ':(exclude)docs/stripe-billing-incident-read-only-report-2026-08-31.md'
```

The broader correction contract also prohibits upload/extraction, generic dimensions,
calculation, BOQ, and Stripe/subscription architecture redesign. Any future diff outside the
smallest proven mapping repair, its audit event, and focused regression tests requires renewed
authorization.

## Resolution gate

Resume only after a secret-safe read-only evidence bundle proves all of the following in one
provider environment: exact Stripe account ID, active subscription ID, customer ID, quantity
`20`, product/price identity, mapped Quantara company ID and safe label, active user membership,
and latest relevant webhook outcome. Until then, status is **BLOCKED — EXPECTED STRIPE ACCOUNT
AND ACTIVE 20-SEAT SUBSCRIPTION UNPROVEN**.
