---
name: quantara-security-review
description: Run a pre-launch security review for the quantara-ai-boq SaaS covering secrets, session/RBAC integrity, tenant isolation, CSRF, and rate limiting. Use this skill whenever the user says they're about to launch, go live, ship to production, onboard real customers, or asks "is this secure" / "is this ready for production" about this project — and proactively before any deploy to a real (non-local) environment. Also trigger if new auth, session, password-reset, email-verification, or payment-adjacent code is added, since those are the highest-blast-radius areas in this codebase.
---

# Quantara AI BOQ — pre-launch security review

## Why this exists
This app handles real company data, real user credentials, and financial figures (BOQ pricing).
The codebase already documents several known gaps in its own README under "Known limitations" —
this skill turns those into an active checklist to clear before real customers touch the app,
instead of a paragraph that gets forgotten.

## Checklist — go through all of these before any production launch

**1. No fallback secrets left in place.**
src/lib/proposals/access-cookie.ts falls back to the hardcoded string
"dev-only-proposal-access-secret-not-for-production" if PROPOSAL_ACCESS_SECRET is unset.
Grep for other fallback defaults on anything named secret/key/password before
launch — any of them left on the default value in production is a real vulnerability, not a
placeholder to worry about later. Confirm the actual production environment variable is set on
the host, not just present in .env.example.

**2. Session model stays hashed, database-backed — resist adding JWTs or LocalStorage tokens.**
The README explains this was a deliberate choice (see docs/authentication.md). If asked to "make
auth faster" or "add JWT for the API," push back and explain the tradeoff rather than silently
replacing the session mechanism — that document exists because this was already decided against.

**3. RBAC and tenant isolation are enforced server-side, not just hidden in the UI.**
Confirm that hiding a button or route in the frontend is never the only protection — the
corresponding API route must independently re-check role and companyId even if the UI already
prevents a user from getting there through normal navigation.

**4. CSRF protection is SameSite=Lax cookies + same-origin fetches only — no dedicated token yet.**
This is a documented, known-accepted gap, not a bug to silently "fix" by adding a CSRF token
scheme without discussing it — but before launch, confirm this tradeoff is still acceptable given
actual expected usage (e.g., is the app ever embedded in an iframe or called cross-origin? If so,
this gap needs to be closed before launch, not after).

**5. No rate limiting on /api/auth/* yet.**
The README flags this explicitly. Before real users sign up, confirm whether login/register/
password-reset endpoints can be hit at unlimited speed — this is a brute-force and abuse risk on a
real internet-facing SaaS. Flag this clearly if launch is imminent and it's still unaddressed;
don't let "we'll add it later" happen silently on a production auth endpoint.

**6. Client duplicate-email detection is app-level, not a DB constraint.**
The README notes a real (if low-risk) race condition here. Worth a second look if the business
starts depending on email uniqueness for anything security-sensitive (e.g., using email as an
implicit identity check anywhere beyond simple duplicate prevention).

**7. Env var audit — production values, not dev defaults.**
Confirm on the actual host: DATABASE_URL points at production Postgres (not local Docker),
APP_BASE_URL is the real production domain (this gets embedded in auth emails — wrong value here
sends users broken verification/reset links), and EMAIL_PROVIDER=smtp with real SMTP credentials
is set if real email delivery is expected (otherwise verification/reset links only get logged to
the server console, which is fine for internal testing but not for real customers).

## How to report findings
For each item, state clearly whether it's resolved, still open, or accepted-as-is-for-now — don't
bury a genuinely open security gap in vague "looks mostly fine" language. This is the last check
before real customer data is at stake.