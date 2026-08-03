---
name: quantara-architecture-guard
description: Enforce the quantara-ai-boq codebase's core architecture rules whenever writing or editing API routes, repository modules, Prisma-touching code, or anything in src/lib/repositories, src/app/api, or src/lib/auth. Use this skill any time new backend functionality is added to the BOQ SaaS (new endpoint, new repository function, new mutation, new page that reads/writes company data) — even if the user doesn't mention "architecture" or "rules" explicitly, since violating these patterns is the main source of subtle multi-tenant data leaks and bugs in this project. Also use when reviewing a diff or PR against this repo, or when the user asks "does this look right" about new backend code here.
---

# Quantara AI BOQ — architecture guard

## Why this exists
This is a multi-tenant SaaS: every company's data must stay isolated from every other company's.
The codebase enforces this through a small number of consistent patterns rather than ad-hoc checks
scattered everywhere. The fastest way to introduce a cross-tenant data leak, a silent authorization
bypass, or a data-corrupting bug in this project is to write code that technically works but
skips one of these patterns. Check every new piece of backend code against this list before
considering it done.

## Non-negotiable rules

**1. React components never call Prisma directly.**
All database access goes through src/lib/repositories/*. If a component or page needs data, it
calls an API route, which calls a repository function — never prisma.xxx.findMany() inline in a
component or even directly in a route handler without going through the repository layer.

**2. Every repository function takes and filters by companyId.**
This is the actual multi-tenant boundary in this app — not middleware, not row-level security, this
field. A repository query that fetches a Project, BOQ, Client, or any tenant-owned record
without a companyId filter is a cross-tenant data leak waiting to happen. When adding a new
repository function, ask: could this return another company's data if called with a different
company's session? If the query doesn't scope by companyId, it's wrong.

**3. Every mutating API route calls src/lib/auth/rbac.ts first.**
Any route that creates, updates, or deletes data must run its RBAC capability check before doing
anything else. A route that performs a write without an RBAC check is a privilege-escalation bug,
not a style nitpick — treat it as a blocking issue, not a suggestion.

**4. API responses are always { "ok": true, "data": ... } or { "ok": false, "error": ... }.**
Don't invent a different response shape for a new route "because it's simpler here" — the frontend
and any future client code depends on this being consistent everywhere.

**5. Money and quantities are Prisma Decimal, never number/float.**
This is a financial app (Bill of Quantities = pricing and quantities). Floating point arithmetic on
money causes rounding bugs that compound across BOQ sections and revisions. If a new field holds a
price, rate, quantity, or total, it must be Decimal in the schema and handled with a
decimal-safe library in code, not plain JS number math.

**6. pdfkit, pdf-parse, and pdfjs-dist stay excluded from webpack bundling.**
next.config.mjs has these in serverComponentsExternalPackages deliberately — bundling them
breaks their runtime file/font access (pdfkit reads font metrics from disk relative to its own
package directory; bundling moves/mangles that path). Don't "clean up" this config without
re-testing PDF/document generation end to end afterward.

**7. Don't wire the still-local pages to Prisma unless explicitly asked.**
/catalogue, /industries (and /industries/[industryId]), /settings, /templates, document
generation, and client-preview pages intentionally still run on LocalStorage/Zustand demo data —
this is a staged migration, documented in the README as a later phase. Migrating one of these
without being asked can silently break a page's existing demo behavior that other work depends on.

## How to use this when reviewing code
Walk the diff against the seven rules above in order. For each violation found, name the specific
rule broken and the specific file/line, rather than a vague "this could be better" — the person
using this needs to fix it before the code ships, not treat it as optional polish.