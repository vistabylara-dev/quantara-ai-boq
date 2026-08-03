---
name: quantara-ui-dashboard
description: Enforce quantara-ai-boq's locked visual design system whenever touching the dashboard, application shell, navigation, BOQ workspace, verification page, revision history UI, theme/appearance system, or any styling in src/app/globals.css, src/lib/theme.ts, or Tailwind classes across the app. Use this skill for ANY UI/design work on this project — new pages, restyling, "make it look better," adding a component library, or applying a design theme — even if the user doesn't mention "UI governance" by name. This project has its own permanent, numbered visual constitution (docs/UI-GOVERNANCE-MASTER-INSTRUCTION.md, docs/UI-LOCK-SHORT.md) that overrides generic design/aesthetic skills — always defer to it over general design-taste guidance for this specific project.
---

# Quantara AI BOQ — UI governance (read before any visual change)

## This project has already decided its visual direction — don't re-decide it
`docs/UI-GOVERNANCE-MASTER-INSTRUCTION.md` (the full spec) and `docs/UI-LOCK-SHORT.md` (the
enforcement summary) are explicit: the dashboard, application shell, navigation, BOQ workspace,
verification page, revision history interface, and the Light/Dark/System theme system are **locked**
unless a verified defect requires a targeted fix. This instruction "overrides casual visual changes
made during backend development" — meaning even a change that's purely about wiring up new data must
not incidentally restyle the screen it appears on.

**If you also have a general-purpose design/aesthetic skill available (glassmorphism, cinematic
luxury UI, gradient-heavy layouts, futuristic motion design, or similar), do not apply it to this
project's dashboard, app shell, or any locked screen.** The project's own non-negotiable rules
explicitly ban several of the things those generic skills push toward — see the list below. Generic
design taste is the wrong source of truth here; this document is.

## The 24 non-negotiable visual rules (docs/UI-GOVERNANCE-MASTER-INSTRUCTION.md section 3)
No gradients. No neon glow. No animated backgrounds. No glassmorphism-heavy design. No oversized
marketing headings. No unnecessary illustrations. No decorative AI graphics inside working screens.
No random accent colours. No excessive rounded cards. No playful visual language. No unnecessary
motion. No large empty areas. No low-density dashboard design. No hidden critical data. No oversized
buttons. No full-page horizontal overflow. No dark-only hardcoded components. No light-only
hardcoded components. No invisible focus states. No colour-only status communication (pair color
with an icon/label/text so colorblind users and screenshots-in-grayscale still convey status). No UI
rewrite during backend tasks. No visual claim that a planned/unfinished module is complete. No
replacing working components unless necessary. No silent visual regression.

If a task seems to call for one of these (e.g., "add some visual flair," "make the dashboard feel
more premium/luxurious"), flag the conflict with this list explicitly rather than quietly
implementing it — this is a case where the project's own stated constitution should win by default,
and the user should consciously override it if they really want to, not have it happen as a side
effect of an unrelated request.

## Theme architecture — do not add a second system
Theme mode (`light` / `dark` / `system`) is controlled entirely by `src/lib/theme.ts`: a single
`localStorage` key (`quantara-theme-mode`) and a `data-theme` attribute set on `document.documentElement`
(absent entirely for `"system"`, letting OS/browser preference apply; explicitly `"light"` or
`"dark"` otherwise). All theme-aware styling reads from CSS custom properties defined in
`src/app/globals.css`, scoped by that `data-theme` attribute — the semantic token list is in
`UI-GOVERNANCE-MASTER-INSTRUCTION.md` section 9. Use those existing tokens for any new UI rather than
hardcoding a hex value or introducing a second theming mechanism (a new CSS-in-JS theme provider, a
component library with its own theme context, etc.) — two theme systems running in parallel is
exactly the kind of drift this governance document exists to prevent.

## The required test matrix for every UI change
Per `UI-LOCK-SHORT.md`, every UI change must be checked in: Light mode, Dark mode, System mode,
desktop width, tablet width, and mobile width — then lint and build must pass, and the affected
routes must be reported. A change that's only visually checked in one theme mode or one breakpoint
is not fully verified here, since this project has already had a working state across all of these
and a regression in any one of them is a real regression, not an edge case.

## Backend work is allowed to change more than it might seem
The governance doc explicitly permits backend work to change data, loading states, permissions,
status values, and available actions on a locked screen — what it must not do is change the
established visual design (layout, spacing, color usage, component style) while doing so. Adding a
new field to a table or a new state to a status badge is fine; restyling the table or badge system
while you're in there is not, unless that was the actual ask.

## Before calling a UI change done
Confirm it was checked against the test matrix above, confirm no rule from the non-negotiable list
was violated, and if a generic design-improvement instinct was suppressed in favor of this document,
say so explicitly rather than silently picking one — the user should know their own project rules
took precedence over a general aesthetic preference.