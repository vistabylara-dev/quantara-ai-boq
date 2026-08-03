---
name: quantara-entitlements
description: Enforce quantara-ai-boq's plan/trial/package entitlement rules whenever adding or changing a feature gated by subscription status — trial limits (projects, BOQs, premium items, exports, proposals), paid-plan limits, or industry-package access. Use this skill whenever touching src/lib/entitlements/entitlement-service.ts, package-entitlement-service.ts, any route that creates a project/BOQ/export/proposal, or when the user asks about pricing tiers, trial limits, upgrade prompts, or "why can/can't a user do X." This logic is directly tied to revenue — a bypassed or duplicated limit check is a business-impacting bug, not just a code-quality one.
---

# Quantara AI BOQ — entitlements (trial/plan/package limits)

## Why this exists
entitlement-service.ts states its own governing rule directly in a code comment: it is the
"canonical, single source of truth for software-plan/trial entitlement rules," per an explicit spec
instruction to "not duplicate entitlement rules across route handlers." This matters more here than
in most parts of the codebase because a bug in this area doesn't just misbehave — it either lets a
trial company use paid features for free (lost revenue) or wrongly blocks a paying company (broken
product, support burden). Both directions are costly, so this logic must live in exactly one place.

## The rule: never re-implement a limit check inline in a route
Trial limits are defined once, in TRIAL_LIMITS (durationDays, maxProjects,
maxCompletedBoqs, maxUniquePremiumItems, maxFinalExports, maxProposals) and FREE_LIMITS.
Every check returns a CheckResult ({ allowed: boolean; reason: string | null }) via the
allow()/deny(reason) helpers — non-throwing, so callers can decide how to surface a denial (UI
message vs. hard API error) rather than the service deciding for them. If a new feature needs a
limit check, add a new CheckResult-returning function here (mirroring the existing
canCreateProject/canUsePremiumItem-style functions), and call it from the route — do not write
if (company.plan === "TRIAL" && count >= 1)-style logic directly inside a route handler. That
duplication is exactly what the spec instruction exists to prevent, and it's how two routes end up
enforcing subtly different limits for the same thing.

## Two layers, and how they interact
- Software-plan/trial layer (entitlement-service.ts) — trial duration and per-resource caps.
- Industry-package layer (package-entitlement-service.ts, via companyHasPackageAccess /
  companyHasPackageAccessForItem) — a purchased industry package can let a company exceed the
  trial's premium-item cap for items that specific package actually covers.
entitlement-service.ts consults the package layer itself when relevant — don't check package
access separately in a route and then also call the trial check; let the entitlement service resolve
the combined answer so the two layers can't drift out of sync with each other.

## When extending this for a new gated feature (e.g., a future AI-image-generation credit system)
Follow the same shape: a limits constant, a non-throwing CheckResult function, consulted from
exactly one place. If the new feature costs real money per use (an external API call, generated
content, etc.), treat it exactly like maxFinalExports/maxProposals — a per-plan cap enforced
here, not a client-side toggle, since a client-side-only gate can be bypassed by calling the API
route directly.

## Before calling an entitlement change done
Test both directions explicitly: a company at its limit is denied with a clear reason, and a
company under its limit (or covered by a package) is allowed. A change that only tests the "allowed"
path is not sufficiently tested here, given that the denial path is the one protecting revenue. Then
run the project's quality gate (lint, build, test) as usual.