# Catalogue Feature Lock — Platform-Owner Access Contract

Status: pre-lock reference document (ADMIN-DATA-ACCESS-1). This documents the access
contract the Catalogue feature must preserve before it can be formally locked, and gives
future agents a single place to check before changing anything in this authorization chain.

## The rule

`src/lib/entitlements/effective-entitlement-service.ts` is the **only** place `platformRole`
or an active `PlatformSimulationSession` is allowed to change product behavior anywhere in
this codebase. No route, page, service, or repository outside that file may branch on
`actor.platformRole === "PLATFORM_OWNER"` directly — every call site resolves access through
`getEffectiveEntitlements()` (or a wrapper built on it, e.g. `getMasterItemViewAccessEffective`).

### What a real, non-simulating PLATFORM_OWNER gets

- Unconditional `allowed: true` on every master-catalogue item, regardless of premium/free
  status, publication status, or company entitlement.
- `isOwnerView: true` — the signal every route uses to attach admin-only fields (version
  history including DRAFT/REVIEW/RETIRED versions, full classification set, source import
  batch, completeness inputs) on top of the customer-safe detail payload.
- Cross-tenant read access to any company's `CompanyLibraryItem` (`getLibraryItemForOwner`),
  audited, never mutating, never exposing another company's full `Company` record (only
  `id`/`tradeName`/`legalName`).
- No commercial/paywall lock is ever shown to a real owner.

### What Customer Simulation changes

Starting a simulation (`POST /api/admin/simulation`) creates a `PlatformSimulationSession`
row keyed on the owner's `userId`. While that row exists, `getEffectiveEntitlements()` returns
`source: "simulation"` instead of `"owner-override"` for **every** request from that owner,
on every device, until the row is deleted — there is no automatic expiry. This is by design
(it lets an owner test paywalls/trial limits realistically) but it is also the exact
production incident this document exists to prevent from recurring silently:

- `TRIAL_ACTIVE` / `TRIAL_EXPIRED` / `FREE` — real trial/free restrictions apply; premium items
  lock exactly as they would for a real customer in that state.
- `PRO` — premium items unlock, but `isOwnerView` stays `false` (never gets admin fields).
- `SINGLE_BOQ_UNLOCKED` — clean export only for the one selected BOQ.
- `Exit Simulation` (`DELETE /api/admin/simulation`) always restores full owner access
  immediately and never touches the real `platformRole` column.

**Regression fixed 2026-08-05:** the simulation-active banner used to render on exactly one
page (`/data-library/items/[itemId]`). An owner who started a simulation there and then
navigated away with a stale/forgotten session had no indication anywhere else in the app that
they were still restricted — indistinguishable from a real authorization bug. A persistent,
global indicator now renders in `AppShell` (`src/components/layout/simulation-status-banner.tsx`)
on every authenticated page for as long as the session exists, with a one-click Exit.

### Publication status (DRAFT / ACTIVE / DEPRECATED / ARCHIVED)

Added 2026-08-05, closing a real gap: a real or simulated (non-owner) actor could previously
reach a `DRAFT`/`DEPRECATED`/`ARCHIVED` master item's full detail directly by ID, even though
it was excluded from every list/search endpoint. `getMasterItemViewAccessEffective` now checks
`MasterItem.status !== "ACTIVE"` **before** the premium/entitlement check, for every non-owner
actor, and reports `notFound: true` so the route responds with a plain not-found — never a
"purchase a package to unlock" preview, which would be actively misleading for content that
was never published for sale. A genuine platform-owner view bypasses this entirely (owner
inspection of not-yet-published or retired content is a required capability, not a bug).

## Never do this

- Never hardcode an owner's email anywhere in an authorization check. Owner detection is
  always `user.platformRole === "PLATFORM_OWNER"` re-read fresh from the database
  (`isOwnerActor()`), never from a cached actor object, cookie, or request body.
- Never trust a client-submitted role, a `?admin=true` query flag, or `localStorage` for
  authorization. Every check in this chain re-verifies against the database.
- Never make `canUsePremiumItemEffective` / `getMasterItemViewAccessEffective` /
  `assertMasterItemAccessEffective` unconditionally return `allowed: true` — the
  owner-override path is a distinct, explicit branch (`effective.source === "owner-override"`),
  not a global bypass baked into the underlying real/simulated check.
- Never weaken `getLibraryItemForCompany` (real customer path — stays hard company-scoped) to
  make `getLibraryItemForOwner` (owner-only cross-tenant path) simpler. They are, and must
  remain, two separate functions.
- Never let a raw mass/bulk export of the master catalogue exist, for anyone, including the
  owner in normal mode. Viewing is not exporting.

## Regression coverage

`tests/admin-data-access-1.test.ts` (28 tests) is the permanent regression suite for this
contract: owner normal-mode access (premium, free, DRAFT, ARCHIVED, cross-tenant library),
all five simulation modes plus Exit Simulation, real company-user tenant isolation and
entitlement enforcement, no-hardcoded-email verification, and HTTP-route-level tests against
the exact `/api/master-data/items/[itemId]` endpoint the original production bug report used
(401 anonymous, 200 owner-with-admin-block, 200 locked-preview for an unentitled company user,
404 for a nonexistent item, 404 — not a locked preview — for a DRAFT item requested by a
non-owner). Any change to `effective-entitlement-service.ts`, `master-item-repository.ts`,
`company-library-service.ts`, or the `/api/master-data/items/[itemId]` /
`/api/admin/data-library/company-library-items/[itemId]` routes must keep this suite green.
