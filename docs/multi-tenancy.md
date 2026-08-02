# Multi-tenancy

## Tenant identity

A "tenant" is a `Company`. Every business record — `Project`, `BOQ`, `BOQSection`, `BOQItem`,
`BOQItemOption`, `VerificationException`, `BOQRevisionSnapshot`, `RateCatalogueItem`, `AuditLog`,
`User` — carries a `companyId` column, matching Section 6 of the build plan.

## Where companyId comes from

Before authentication existed, `companyId` came from `getDevelopmentCompanyId()`, a hardcoded
constant. That bridge is now gone from every API route. `companyId` comes exclusively from
`getCurrentActor().companyId` — resolved server-side from the session cookie via a database
lookup (`src/lib/auth/current-actor.ts`). **It is never read from a route parameter, query
string, or request body.** A malicious client cannot request another company's `companyId`
because nothing in the request is trusted for that value.

## Enforcement layers

1. **Session → company binding.** A session belongs to a user; a user belongs to exactly one
   company (`User.companyId`, immutable after registration in this phase — no cross-company user
   moves are implemented). There is no way to "select" a different active company.
2. **Repository queries.** Every repository function takes `companyId` as an explicit first
   argument and includes it in the `where` clause (see `src/lib/repositories/*`). This predates
   authentication (Phase 1) and is unchanged — only the *source* of the `companyId` argument
   changed.
3. **RBAC.** Capability checks (`src/lib/auth/rbac.ts`) gate *what* an authenticated member of a
   company may do; they are a second, independent layer on top of tenant isolation, not a
   replacement for it.

## Tested

- `tests/tenant-scope.test.ts` — pure unit coverage of the `tenantScope` / `filterByTenant` /
  `assertTenantAccess` helpers that reject cross-company records.
- `tests/auth-service.test.ts` — end-to-end: two independently `registerCompanyOwner`-created
  companies resolve to distinct `companyId`s, and each user's session resolves only to their own
  company.

## Known gap

There is currently exactly one user per company created at registration (the owner). Inviting
additional users into an *existing* company (Section 12's user management) is not implemented
yet, so multi-user-per-company behavior is architecturally supported (the data model and RBAC
already handle it) but not yet reachable through any UI or API route.
