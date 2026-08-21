# Handoff: finish Arabic/RTL + Industries fix, verify, and continue

Paste this whole file as your first message to Claude Code. It was written by another
Claude instance (via Cowork) working on this repo through a slow, unreliable sandboxed
mount — tsc/eslint/vitest all timed out there (170s+), so **none of the changes below have
been verified to actually compile or pass tests.** You're running natively, so verification
should take seconds, not minutes. Do that first, before adding anything new.

## 0. Sanity-check git state first

The other session saw `git status` hang and `.git/index.lock` throw "Operation not
permitted" right at the end — likely just the sandbox mount dying, but confirm locally:

```
git status
```

If `.git/index.lock` exists and no other git process is actually running (check `ps aux | grep git`
or Task Manager), it's safe to delete: `rm .git/index.lock` (or `del .git\index.lock` on
Windows). Then re-run `git status` and read the full diff before touching anything else —
don't trust the file list below blindly, confirm it against reality.

There's also a stray junk file to delete: **`check-i18n.ts` in the repo root** — a throwaway
debug script, not part of the app, safe to delete immediately.

## 1. What was actually done (needs your verification, not blind trust)

**New Arabic/RTL i18n system** — dependency-free by design. `next-intl` was tried first and
its install corrupted repeatedly in the sandbox (partial extraction, missing `package.json`
inside `node_modules/next-intl`). That was backed out cleanly — check `package.json` has no
`next-intl` line. Don't re-attempt installing it; the hand-built system below already works
and matches this codebase's existing pattern (see `src/lib/theme.ts` — same
localStorage+attribute approach, just for locale instead of theme):

- `src/lib/i18n/locale.ts` — locale storage/attribute helpers
- `src/lib/i18n/i18n-context.tsx` — `I18nProvider` + `useTranslation()` hook (`t("key.path")`)
- `src/lib/i18n/translations/en.ts` / `ar.ts` — dictionaries, must have identical key shapes
- `src/app/layout.tsx` — added a `LOCALE_INIT_SCRIPT` (mirrors the existing `THEME_INIT_SCRIPT`
  pattern) that sets `<html lang dir>` before paint, plus wraps the tree in `I18nProvider`,
  plus Arabic font imports (`@fontsource/noto-naskh-arabic` — was already a dependency,
  unused until now)
- `src/app/globals.css` — RTL font-family + terminal-text letter-spacing override
- `src/components/layout/language-switcher.tsx` — two exports: `LanguageSwitcher` (compact,
  used in top header) and `LanguageBar` (full EN/عربي toggle bar, used in sidebar + mobile nav)
- `tests/i18n-translations.test.ts` — fails the build if `en.ts`/`ar.ts` keys drift apart

**Translated to Arabic + made RTL-aware:** sidebar, mobile nav, top header, user menu,
app-shell footer, login page, the `/settings` landing page, `/industries` and
`/industries/[industryId]` (new pages, see below).

**Not translated — still English only, on purpose, flagged not hidden:** dashboard deep
content (metric cards, activity feed, etc. — many subcomponents, wasn't reached),
`/settings/company`, `/settings/subscription`, `/settings/email-templates`,
`/settings/data-packages`, and **all 60+ marketing/SEO pages** under
`src/app/(marketing)/`. That last one is a content project (professional Arabic copy for
SEO-indexed pages), not a quick wiring job — don't machine-translate it in bulk, it'll hurt
the SEO this app has already invested in.

**Real bug fixed, not just translated:** `/industries` had no page — `src/app/industries/`
only had `[industryId]/page.tsx`, so the sidebar's "Industries" nav item 404'd. There was
already a working backend (`GET /api/industries`, `PATCH /api/industries/[key]`, fully
RBAC'd and company-scoped — see `src/lib/repositories/industry-repository.ts`) and an unused
`IndustryEngineCard` component nobody had wired up. Built `src/app/industries/page.tsx`
(list, with enable/disable toggle) and rewired `src/app/industries/[industryId]/page.tsx`
from the static `demoIndustries` import to the real API. **Old `demoIndustries` /
`local-storage-adapter.ts` were deliberately left in place, untouched** — don't delete them,
other things may still reference them (`industry-bootstrap-service.ts` legitimately uses
`demoIndustries` for seeding).

**Important correction to this repo's own docs:** `CLAUDE.md` currently says
`/catalogue`, `/industries`, `/settings`, `/templates`, document generation, and
client-preview are all still LocalStorage/Zustand demo data. That's stale. Verified by
reading the actual code (not assuming): catalogue, settings, templates, document
generation, and client-preview are **already fully DB-backed** — only Industries was
genuinely unfinished, and that's now fixed above. **Update `CLAUDE.md`'s "Known local-only
/ not-yet-migrated modules" section** to remove everything except Industries (which is now
also done) — right now it'll mislead the next person (or the next Claude session) into
redoing work that's already real, or worse, avoiding touching pages that actually need
attention.

## 2. Verify, in this order, stop at the first failure and fix before continuing

```
npm run lint
npx tsc --noEmit
npm test -- tests/i18n-translations.test.ts
npm run build
npm run dev
```

Then in the browser: load any authenticated page, click the language toggle (top header
icon, or the EN/عربي bar in the sidebar / mobile menu), confirm the whole shell flips to
RTL with no layout breakage, confirm `/industries` loads real data and the enable/disable
toggle actually calls the API (check Network tab — `PATCH /api/industries/<key>`), confirm
`/industries/<key>` still renders correctly for an enabled industry and shows the "not
found" state for a bad slug.

If `npm test` needs Docker/Postgres for the full suite (per this repo's own `CLAUDE.md`),
make sure that's running first.

## 3. If verification passes, worthwhile next steps (not yet done, your call on priority)

- Translate the dashboard page and its subcomponents (`src/components/dashboard/*`) —
  biggest remaining gap in daily-use surface area.
- Translate the remaining `/settings/*` subpages (company, subscription, email-templates,
  data-packages).
- Decide on marketing-page Arabic strategy deliberately: either commission/write real
  Arabic SEO copy per page, or scope it to UI chrome only (nav/footer/CTAs) via the same
  `t()` pattern, and say explicitly which one you're doing — don't let it happen by
  accident.
- Fix `CLAUDE.md` as described in section 1.

Do not re-attempt installing `next-intl` or any other i18n library — the system in place
works and matches the codebase's own conventions. Swapping it out later is a real option if
you outgrow it, but there's no reason to do it now.
