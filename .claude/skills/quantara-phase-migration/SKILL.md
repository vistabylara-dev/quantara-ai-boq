---
name: quantara-phase-migration
description: Guide migrating quantara-ai-boq's remaining LocalStorage/Zustand demo modules (catalogue, industries admin, settings, templates, document generation, client-preview) to real database-backed pages, following the same patterns already used for the connected pages (dashboard, projects, clients, BOQ). Use this skill whenever the user asks to connect, migrate, wire up, or "make real" any of these still-local modules, or asks to move a demo/mock feature onto the database in this project. Also use when planning what the "next phase" of backend work should look like for this SaaS. Do not use this for the already-connected pages (dashboard, projects, clients, BOQ, auth) — those are done; this is specifically about the remaining local-only modules.
---

# Quantara AI BOQ — migrating a local-only module to the database

## Why this exists
Roughly half this app's modules (/catalogue, /industries and /industries/[industryId],
/settings, /templates, document generation, client-preview) are intentionally still running on
LocalStorage and Zustand stores rather than the database — this is staged work, not an oversight.
The connected modules (dashboard, projects, clients, BOQ, auth) already establish a consistent
pattern for how a module should look once migrated. The main risk in doing this work fast is
reinventing that pattern slightly differently each time, which is how subtle multi-tenant bugs
creep in. Every migration should follow the same shape as the ones already done, not a new one.

## Before migrating a module, understand what "already connected" looks like
Read one of the already-migrated flows first — src/lib/repositories for the Project or Client
repository, the corresponding src/app/api/* route, and the page component that calls it — to see
the actual pattern in this codebase: repository owns Prisma access and requires companyId, the
API route enforces RBAC via src/lib/auth/rbac.ts before any write, and the page never touches
Prisma directly. A new migration should be structurally boring compared to these — not creative.

## Migration checklist, per module
1. Design the Prisma model(s) for the module's data, following the existing schema conventions:
   every tenant-owned table carries companyId, money/quantity fields are Decimal, and enums
   mirror the style already used (see the ProjectStatus, BOQStatus etc. enums in
   prisma/schema.prisma).
2. Write an additive migration. Don't edit or drop existing tables/columns speculatively while
   migrating an unrelated module — a migration should only add what this module needs. If a
   genuinely destructive change seems necessary, stop and confirm with the user before writing it;
   don't run anything destructive against a database that might have real data in it.
3. Build the repository module in src/lib/repositories, requiring companyId on every
   function, mirroring an existing repository's shape rather than inventing new conventions.
4. Build the API route(s) under src/app/api, calling the repository, enforcing RBAC, and
   returning the standard { "ok": true, "data": ... } / { "ok": false, "error": ... } shape.
5. Swap the page/component from its LocalStorage/Zustand adapter to calling the new API route,
   with loading, error, and empty states — matching what the already-connected pages do, since the
   README notes this was a deliberate requirement for those pages.
6. Leave the old LocalStorage adapter and Zustand store in place until the new path is verified
   working end to end — don't delete the fallback in the same change that introduces the
   replacement; that turns any bug in the new path into a total regression instead of a rollback-able
   one.
7. Run the quality gate (lint, build, full test suite with Docker running) before considering
   the migration done — see the quantara-quality-gate skill for the exact commands.

## A note on scope
Migrate one module at a time. These modules are listed together in the README, but treating them
as one big batch invites exactly the kind of copy-paste drift this skill exists to prevent — do
each one as its own complete pass through the checklist above, including its own test coverage,
before starting the next.