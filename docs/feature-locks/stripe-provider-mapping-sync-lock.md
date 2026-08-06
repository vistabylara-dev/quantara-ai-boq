# Feature Lock: Stripe Provider Mapping Synchronization

Status: **LOCKED**

## Feature

Stripe Provider Mapping Synchronization — the repository-level create-or-reuse logic that
records which internal `CommerceProduct`/`CommercePrice` has been synchronized to which
Stripe product/price object, per `(provider, environment)`.

## Accepted behavior

1. Mapping creation is idempotent.
2. Identical product reruns reuse the same mapping.
3. Identical price reruns reuse the same mapping.
4. Concurrent identical requests produce one logical mapping.
5. Provider identifiers cannot be silently reassigned to another internal record.
6. Genuine cross-record collisions return a safe conflict (`CommerceProviderMappingConflictError`).
7. Drift detection remains active.
8. Unknown Prisma errors are not swallowed.
9. No Stripe secrets or raw provider payloads appear in errors.
10. Catalogue, BOQ, integrations, and other product domains do not implement their own Stripe
    mapping logic — this repository is the single source of truth for provider-object identity.

## How the invariants are implemented

`createMapping()` in the locked file below resolves in two stages:

1. **Fast path — internal-identity lookup first.** Before ever calling `create`, it looks up
   an existing mapping by the internal identity:
   - Product: `provider` + `environment` + `commerceProductId` + `providerObjectType = PRODUCT`
   - Price: `provider` + `environment` + `commercePriceId` + `providerObjectType = PRICE`

   If found and consistent (`isConsistentMapping`), the existing row is returned — `create` is
   never called, so no duplicate is possible on a normal rerun.

2. **Collision path — only on a real `P2002`.** If `create` throws a known Prisma unique-constraint
   violation, the function re-reads by the provider-side identifier (`providerProductId` /
   `providerPriceId`). If that row is consistent with the requested internal record, it is reused
   (covers the race where two callers create the same mapping concurrently). If it points to a
   *different* internal record, `CommerceProviderMappingConflictError` is thrown with a safe,
   structured `safeConflictCode` — never the raw Prisma error, never Stripe payload data. Any
   error that is not a known `P2002` is rethrown unchanged.

## Locked files / source of truth

- `src/lib/repositories/commerce-provider-mapping-repository.ts`
- The existing `CommerceProviderMapping` Prisma model and its unique constraints (`prisma/schema.prisma`)
- `tests/stripe-sync-service.test.ts`

## Future-change rule

Any future modification to this behavior must:

- Preserve all locked invariants above.
- Add or update focused tests in `tests/stripe-sync-service.test.ts`.
- Run the focused suite (`npm test -- tests/stripe-sync-service.test.ts`) **twice** consecutively
  and confirm the fixture count is stable between runs (no manual DB cleanup required).
- Pass TypeScript, lint, and build.
- Document why the lock is being changed, in this file.
- Never replace create-or-reuse behavior with create-only behavior.

## Configuration boundary

This lock proves **repository synchronization correctness only**. It does not prove:

- Stripe account connected
- Stripe API keys configured
- Checkout active
- Webhook active
- Subscriptions active
- Payments working

Remaining state: **`STRIPE_ACCOUNT_CONFIGURATION_BLOCKED`** — pending the product owner regaining
access to the Stripe account. No checkout, webhook, subscription, invoice, customer portal,
refund, or live payment code has been started under this lock.
