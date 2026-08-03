---
name: quantara-premium-design-v2
description: Execute the owner-approved "Quantara Claude B / UI-3" premium design system brief — a full visual overhaul (design tokens, component library, dashboard, BOQ template gallery, document experience) that consciously supersedes parts of the older UI-GOVERNANCE lock. Use this skill whenever the user asks to build the premium/2026/Apple-Linear-Stripe-style redesign, a design token system, the premium component library, or references "Claude B," "UI-3," or the premium design brief by name. Do not use quantara-ui-dashboard's stricter no-glassmorphism reading once this skill is active for a given file — this skill's scope explicitly overrides it for the areas listed below, per the owner's explicit decision.
---

# Quantara AI BOQ — premium design system v2 (owner-approved scope)

## Why this skill exists, and what it overrides
`quantara-ui-dashboard` enforces `docs/UI-GOVERNANCE-MASTER-INSTRUCTION.md`, which bans
glassmorphism, bans full redesigns, and locks the current dashboard/theme/card visual language.
The product owner has explicitly and consciously decided to override that for a new premium
design direction, briefed in full below. This is not an accidental conflict — it's a deliberate
decision, made after the conflict was directly explained. Treat the brief below as current intent,
not as something to second-guess against the old lock on every file. Do still preserve the parts
of the old rules that were never really about aesthetics: accessibility (rule 19, "no invisible
focus states"), no color-only status communication (rule 20), and never faking data that doesn't
exist (render real empty states, not fabricated metrics) — those aren't style opinions, they're
correctness requirements that apply under any visual direction.

## Scope boundary — read this before touching any file
Per the brief, ownership is split:
- **This skill / whoever executes it owns:** `src/components/**`, `src/styles/**`, and the
  *presentation* layer of dashboard, theme, BOQ template gallery, and document preview screens.
- **Never touch:** authentication, repositories, Prisma/schema/migrations, storage/blob, API route
  business logic, calculations, RBAC, audit, email. If a screen needs data that isn't exposed by an
  existing API route yet, build against a typed placeholder/interface for that data and consume the
  real endpoint once it exists — do not implement repository or route logic to unblock yourself.

## Execution order — do not batch everything into one pass
Given the size of this brief, work in the exact phase order below, and treat each as its own
complete, tested, committed unit before starting the next. Attempting all of it in one sweep is how
a big visual initiative turns into a half-finished, broken intermediate state:
1. Design tokens (spacing, radius, elevation, glass, typography, status colors, animation curves,
   container widths, grid) — defined once, consumed everywhere after.
2. Core component library (cards, tables, forms, nav, modals, command palette, toasts, etc.) built
   against those tokens.
3. Executive/premium dashboard presentation, consuming existing data endpoints only.
4. Company dashboard presentation.
5. BOQ template gallery (visual cards, hover/large previews, selection state).
6. Document preview experience (cover, tables, section headers, branding, watermark, signature,
   revision panel).

## Non-negotiables that still apply regardless of visual direction
- Every new component must work correctly in Light, Dark, and System mode — this brief asks for a
  new aesthetic, not fewer working theme states.
- Every screen must work at desktop, tablet, and mobile widths — no horizontal overflow, no broken
  layout at any breakpoint.
- Keyboard navigation, visible focus states, WCAG contrast, and `prefers-reduced-motion` support are
  required on every new interactive component, not optional polish.
- If a KPI, metric, or activity feed has no real backend data behind it yet, render an honest empty
  state — never a plausible-looking fake number. This matches the project's existing discipline
  everywhere else (see quantara-drawing-inspection's "no fake AI" section) and applies to fake UI
  data just as much as fake extraction results.
- Performance: no heavy animation libraries, prefer CSS transitions/animations, avoid unnecessary
  client-side rendering, lazy-load where it genuinely helps — a premium feel comes from restraint
  and polish, not from bundle-weight-heavy effects.

## Git discipline
Stage explicitly, one phase per commit, never `git add -A`, never `git restore .`, never
`git reset`, never force push. Suggested commit sequence: `feat: premium design tokens` →
`feat: premium component library` → `feat: executive dashboard ui` → `feat: company dashboard ui`
→ `feat: boq template gallery` → `feat: premium document experience`. Never mix unrelated work
into one of these commits.

## Before calling any phase done
Run the project's quality gate (lint, build, test — see quantara-quality-gate) for that phase
specifically, verify Light/Dark/System and all three breakpoints, then commit. Don't move to the
next phase with the current one unverified — a broken phase 2 makes phase 3 much harder to debug
correctly.
