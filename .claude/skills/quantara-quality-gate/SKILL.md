---
name: quantara-quality-gate
description: Enforce the quantara-ai-boq repo's own validation gate — lint, build, and test must all pass, with Docker/Postgres running for the integration suites — before any change to this project is considered done. Use this skill whenever finishing a feature, fix, or refactor in this repo, before telling the user something is "done," "ready," "working," or "complete," and before committing or pushing code. Also use if the user asks "is this ready" or "can I ship this" about a change in this project. Do not skip this just because the change looks small — small changes are exactly where an unrun test suite lets a regression slip through unnoticed.
---

# Quantara AI BOQ — quality gate before calling anything done

## Why this exists
The project's own README defines the bar for "done" explicitly, under Validation:
npm run lint
npm run build
npm test

npm test includes integration suites (tests/auth-service.test.ts,
tests/client-project-service.test.ts) that talk to a real local Postgres — Docker must be running
for the full suite to pass. It's easy to change code, see the specific thing you touched work in
the browser, and call it done — but that's a much weaker bar than the one this repo has already
set for itself. The gap between "looks done" and "passes the gate" is exactly where regressions
hide, especially in a multi-tenant app where a change in one repository function or RBAC check can
silently break an unrelated flow.

## What to actually run, every time, before saying something is finished

1. Confirm Docker is running (docker compose up -d if not, then wait for the Postgres healthcheck
   to pass — the compose file has one built in, don't just assume it's ready immediately after
   starting).
2. npm run lint — fix any errors it reports. Don't suppress a lint rule to make it pass unless the
   rule itself is genuinely wrong for the case, and say so explicitly if that's what happened.
3. npm run build — a clean build is not optional. A build that fails or that only "mostly" works
   (e.g., warnings about missing types) is not done.
4. npm test — run the full suite, not just the file you think is related to your change. The
   integration tests exist specifically to catch cross-cutting breakage (auth, tenant isolation,
   project/client service behavior) that a narrower manual check would miss.

## If something fails
Report exactly what failed and why — the specific test name, the specific lint rule, the specific
build error — rather than a vague "some tests failed." If a failure is pre-existing and unrelated
to the current change (this does happen), say so explicitly and confirm it also fails on main
before dismissing it, rather than assuming it's not your concern.

## What "done" means in a status update to the user
Don't report a feature or fix as finished, ready, or working unless lint, build, and test all
passed in this same session, with Docker running. If any of them weren't run — for example because
Docker wasn't available — say that plainly ("build passed, but I couldn't run the test suite
because Docker wasn't running") instead of letting "done" imply more confidence than is warranted.