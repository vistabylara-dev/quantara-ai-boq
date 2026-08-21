# Authentication

Real email/password authentication with server-side, database-backed sessions. Replaces the
Phase 1 `getDevelopmentCompanyId()` bridge — every API route now resolves its acting company,
user, and role from a validated session, not a hardcoded constant.

## Flows implemented

- Register a company (creates `Company` + a `COMPANY_OWNER` user) — `POST /api/auth/register`
- Verify email — `POST /api/auth/verify-email`
- Login — `POST /api/auth/login`
- Logout — `POST /api/auth/logout`
- Current session — `GET /api/auth/session`
- Request password reset — `POST /api/auth/forgot-password`
- Complete password reset — `POST /api/auth/reset-password`

Pages: `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`.

## Passwords

Hashed with bcrypt (`src/lib/auth/password.ts`, 12 salt rounds). Plaintext passwords are never
stored or logged. Login always calls `bcrypt.compare` against a real or dummy hash so response
timing does not reveal whether an email is registered.

## Sessions

- Session tokens are high-entropy random values (`crypto.randomBytes(32)`), never JWTs.
- Only the SHA-256 hash of the token is stored in the `Session` table (`src/lib/auth/session.ts`,
  `src/lib/auth/tokens.ts`). The raw token lives only in an `httpOnly`, `SameSite=Lax` cookie
  (`Secure` in production), so a database read alone can never impersonate a user.
- Sessions expire 30 days after creation and are deleted server-side on logout and on password
  reset (every existing session for the user is revoked when their password changes).
- `src/lib/auth/current-actor.ts` (`getCurrentActor`) is the single place that turns a request's
  cookie into `{ userId, companyId, role, fullName, email }`. Every mutating and read API route
  calls it and throws `UnauthorizedError` (401) if the session is missing, expired, or belongs to
  a deactivated user.

## Why not JWTs

`jose` was intentionally **not** added as a dependency even though the original brief listed it.
Section 7 of the build plan requires "session invalidation on logout" and "hashed session tokens
in database" — a stateless JWT can't be invalidated without a separate revocation list, which
just reinvents the database-backed session table this project already needed. Opaque, hashed,
DB-stored tokens satisfy the explicit requirement directly and keep the dependency count down.

## Middleware vs. route-level checks (defense in depth, not duplication)

`src/middleware.ts` is a **cheap, edge-safe cookie-presence check only**. It cannot query
Postgres (Prisma doesn't run on the Edge runtime), so it cannot tell a valid session from a
stolen or expired cookie — it only redirects browsers with no cookie at all away from protected
pages, and bounces cookie-holders away from `/login` and `/register`. It intentionally skips
every `/api/*` path.

The actual authorization boundary is `getCurrentActor()`, called inside every API route handler,
which does the real, DB-backed validation. Every page in this app (`/dashboard`, `/projects`,
the BOQ workspace, etc.) is a client component that fetches its data from `/api/*` — so even if
someone bypassed the middleware entirely, no protected data would ever be served without a valid
session. Middleware exists for UX (avoid flashing a protected page's empty shell at a signed-out
visitor), not security.

## Role-based access control

`src/lib/auth/rbac.ts` defines a small capability set (`company:manage`, `projects:create`,
`projects:update`, `projects:archive`, `boq:edit`, `boq:lock`, `verification:manage`,
`catalogue:manage`, `clients:manage`, `templates:manage`, `proposals:manage`, `files:manage`,
`review:comment`) and maps each of the seven roles from the build plan onto it. **Read access
within a company is not capability-gated — any authenticated member of a company can view its
projects, BOQs, catalogue, etc.** Only mutating routes call `requireCapability(actor, "...")`,
throwing `PermissionDeniedError` (403). This is a pragmatic reading of the plan's coarse-grained
role descriptions mapped onto this codebase's actual mutating endpoints; see the comment at the
top of `rbac.ts` for the full rationale. `proposals:manage`, `files:manage`, and
`templates:manage` are defined now for roles that will need them, even though the routes they'd
gate (client proposals, file uploads, templates) don't exist yet. Projects intentionally split
into three capabilities (rather than one `projects:manage`) because the Phase 3 role matrix gives
`SALES_USER` create-only access, `QUANTITY_SURVEYOR`/`ESTIMATOR` create+update, and archive to
`COMPANY_OWNER`/`ADMINISTRATOR` only.

## Audit attribution

`src/lib/auth/request-context.ts` uses `AsyncLocalStorage` to make the authenticated actor
available to repository code for the remainder of a request, without threading a `userId`
parameter through every `createAuditLog` call site in `boq-repository.ts`,
`verification-repository.ts`, `client-repository.ts`, and `project-repository.ts`.
`createAuditLog` reads it via `getActorFromContext()` and falls back to it only when a caller
hasn't passed an explicit `actorName` (the BOQ lock/revision routes still pass `actor.fullName`
explicitly, taking priority).

**Every route handler must call `setActorContext(actor)` itself, immediately after `const actor
= await getCurrentActor();`, in its own function body.** This was originally implemented with
`getCurrentActor()` calling `enterWith` internally, which looked correct (audit rows recorded
`companyId` fine) but silently produced `actorName: "System"` and `userId: null` on every audit
row in production traffic — confirmed by direct database inspection during Phase 3 end-to-end
testing, not by inspection alone. The root cause: `AsyncLocalStorage.enterWith()` called from
inside an awaited helper function does not propagate back out through the *caller's own* await
boundary — the caller's continuation is already linked to the pre-call context by the time the
helper's internals run. `enterWith` only reliably affects code in the same function frame that
calls it, plus that frame's own subsequent awaits. All 22 route files (31 call sites) were fixed
to call `setActorContext(actor)` directly; see the warning comment on `getCurrentActor()` in
`current-actor.ts`. `AuditLog.userId` is nullable with `onDelete: SetNull`, so a deleted user
never breaks the audit trail — `actorName` remains as a point-in-time display label.

## Development-mode email

No SMTP is configured yet. Verification and password-reset links are printed to the server
console via `src/lib/auth/dev-mailer.ts`, clearly labeled `[DEV EMAIL - NOT SENT]`. This must not
be mistaken for delivery and will be replaced when Section 22 (email templates and delivery) is
implemented.

## Seeded development owner

`prisma/seed.ts` creates one `COMPANY_OWNER` user for the seeded development company, using
`DEV_OWNER_EMAIL` / `DEV_OWNER_PASSWORD` / `DEV_OWNER_NAME` from the environment (falls back to
insecure defaults with a console warning if unset — see `.env.example`).

## What is not implemented yet

- User management UI (invite/list/change-role/deactivate) — the `User` model and
  `user-repository.ts` support it, but there is no `/settings/users` page or `/api/users` route.
- Rate limiting on `/api/auth/*` (listed as a Section 28 requirement, not yet built).
- CSRF token-based mutation protection — the app currently relies on `SameSite=Lax` cookies plus
  same-origin `fetch` from `src/lib/api/client.ts`; a dedicated CSRF token has not been added.
- Enterprise SSO — explicitly out of scope per the plan's "must remain clearly planned" list.

## Tests

- `tests/password.test.ts` — hash/verify round trip, wrong password rejected, unique salts.
- `tests/tokens.test.ts` — raw token uniqueness/entropy, deterministic hashing.
- `tests/rbac.test.ts` — capability matrix per role, `requireCapability` throws/passes correctly.
- `tests/auth-service.test.ts` — integration tests against the real local Postgres instance:
  registration + duplicate-email rejection, login blocked before verification, wrong-password
  rejection, session creation, `getCurrentActor` resolving a valid session and rejecting an
  expired one, password reset invalidating existing sessions, and two independently registered
  companies resolving to distinct, non-overlapping `companyId`s.
