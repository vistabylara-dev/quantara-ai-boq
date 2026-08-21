# Deploy handoff: Technical Report Templates (Phase 8 sub-phase 16)

**Audience:** any agent or developer picking this up fresh, with no memory of how it was built.
**Repo:** `quantara-ai-boq` (Next.js 14 App Router + Prisma/PostgreSQL, multi-tenant BOQ SaaS).
**Branch:** `main`. **Host:** Vercel, already linked (`.vercel/project.json` present — do not
recreate this link, do not commit `.vercel/`).

## What this is

A new feature: reusable, section-based report templates (e.g. an FM/technical condition-report
standard) that a project can instantiate, fill in, and generate as a Word document. It is
**standalone** from the existing BOQ document-generation system (`DocumentTemplate` /
`GeneratedDocument`) on purpose — those require a non-nullable `boqId`, which doesn't fit a report
that isn't generated from a priced BOQ. New models: `TechnicalReportTemplate` (company-scoped
library) and `GeneratedTechnicalReport` (project-scoped instance). Full design rationale and file
list: `docs/phase-8-status.md`, row 16.

**This code has never run against a live database, a real `npm run build`, ESLint, or `tsc`.** The
sandbox it was written in could not reach Prisma's engine-binary CDN (network-restricted) and
ESLint/tsc both timed out before completing even a single file. Every cross-file import and every
Prisma relation was checked by hand against the codebase's existing patterns, but that is not a
substitute for actually running the tools. Treat step 2 below as the first real test of this code.

## Step 0 — Look at what else is sitting uncommitted first

`git status` on this repo currently shows files that were **not** part of this technical-report
work: a `master-hierarchy` migration (`prisma/migrations/20260803235813_master_boq_1a_hierarchy_foundation/`)
and `prisma/add-new-templates.ts`, `prisma/backfill-all-templates.ts`,
`src/lib/repositories/master-hierarchy-repository.ts`, `src/lib/services/master-hierarchy-service.ts`.
That migration alters `BOQItem` and `MasterItem`. Do not include it in this deploy by accident (no
blanket `git add -A`) — confirm with the project owner what it is and whether it's ready, since
`prisma migrate deploy` applies every pending migration in the folder, not just the one you intend.

## Step 1 — Commit and push only the technical-report-template files

```powershell
cd C:\Users\PC\Desktop\quantara-ai-boq

git add prisma/schema.prisma `
  "prisma/migrations/20260804040000_phase8_technical_report_templates" `
  src/lib/auth/rbac.ts `
  src/lib/validation/route-params.ts `
  src/lib/validation/report-template-schema.ts `
  src/lib/documents/report-template-sections.ts `
  src/lib/documents/generators/technical-report-docx-generator.ts `
  src/lib/repositories/report-template-repository.ts `
  src/lib/repositories/generated-technical-report-repository.ts `
  src/lib/services/report-template-service.ts `
  src/lib/services/technical-report-service.ts `
  src/app/api/report-templates `
  src/app/api/projects/[projectId]/technical-reports `
  src/app/api/technical-reports `
  src/app/templates/page.tsx `
  src/app/projects/[projectId]/technical-reports `
  src/app/projects/[projectId]/layout.tsx `
  docs/phase-8-status.md `
  docs/technical-report-templates-deploy-handoff.md `
  report-templates data-imports

git status   # confirm only the files above are staged before committing
git commit -m "feat: technical report templates (Phase 8 sub-phase 16)"
git push origin main
```

## Step 2 — Verify locally before touching production

Run these against local Docker Postgres first. If any of them fail, stop and fix before proceeding
— do not push forward to production on a failing build.

```powershell
docker compose up -d
npm install
npm run db:migrate      # applies the new migration via `prisma migrate dev` against local Docker
npm run lint
npm run build
npm test                 # Docker must be running for tests/auth-service.test.ts and
                          # tests/client-project-service.test.ts
```

If `npm run db:migrate` reports drift or a conflict with the `master-hierarchy` migration from
Step 0, resolve that first — it likely means both migrations need to be present and applied
together, or the other migration needs to be reviewed/discarded. Do not force-reset
(`db:reset` deletes all data).

## Step 3 — Apply the migration to production

Vercel's build only runs `prisma generate` (client types) via the `postinstall` script — it never
runs `prisma migrate deploy`. Skipping this step means the new pages 500 immediately since the
tables don't exist in production yet.

```powershell
$envText = Get-Content .env.production.local -Raw
if ($envText -match 'DATABASE_URL\s*=\s*"?([^"\r\n]+)"?') {
    $env:DATABASE_URL = $matches[1].Trim()
    Write-Host "DATABASE_URL set, starts with: $($env:DATABASE_URL.Substring(0, 20))"
} else {
    Write-Host "DATABASE_URL not found in .env.production.local" -ForegroundColor Red
}
```

Confirm the printed prefix is actually `postgresql://` or `postgres://` before continuing (a
previous attempt at extracting this value with `Select-String | .ToString()` produced a malformed
URL and failed validation harmlessly — no migration ran). Then:

```powershell
npx prisma migrate deploy
```

Never run `prisma migrate dev` or `prisma migrate reset` against this URL — `db:reset` deletes all
data. `migrate deploy` is the only production-safe command.

## Step 4 — Deploy

`.env.production.local` contains `VERCEL_GIT_*` variables (only present after `vercel env pull`),
which means Vercel's Git integration is already connected to this repo on `main`. Pushing in Step 1
should have already triggered an automatic deployment — check the Vercel dashboard's Deployments
tab. If nothing fired, either the integration is disconnected (check Project Settings → Git in the
Vercel dashboard) or trigger one manually: `vercel --prod` from a machine with the Vercel CLI
authenticated to this project (`orgId: team_IhqAZso6v9WAHmszlRzD8NGz`,
`projectId: prj_i3LahrynL0ZN9QdVUnYMBt3KQdk3`).

## Step 5 — Post-deploy smoke test

No automated E2E exists for this feature yet. Do this manually against the live URL:

1. Open `/templates` — confirm the "Technical report templates" section loads (not stuck on
   "Loading…" or erroring) and shows zero templates with an "Import template (JSON)" button.
2. Import a template: click the button, select a `*-technical-report-template.json` file (the FM
   one converted earlier in this project is at
   `report-templates/fm-integrated-technical-report/fm-integrated-technical-report-template.json`).
   Confirm it appears in the list as Active.
3. Open any project → "Technical Reports" tab in the project nav → confirm the template appears in
   the "New report" picker, create one.
4. On the report detail page, confirm the placeholder fields list renders (should include things
   like `[Client Name]`, `[Insert project or property name]`), fill a couple in, "Save fields".
5. Click "Generate DOCX" — confirm it completes (status flips to COMPLETED) and the file downloads
   and opens correctly in Word, with the saved values substituted in and everything else unchanged.
6. Confirm a non-owner role without `technical-reports:generate` (e.g. DESIGNER) cannot create/
   generate a report (should get a 403), and that switching companies/logging in as a different
   tenant does not show the first company's templates or reports.

If any of these fail, check the browser console + `/api/report-templates` and
`/api/projects/[id]/technical-reports` responses directly before assuming it's a deeper bug — most
likely causes are the migration not having actually been applied (Step 3) or a stale Vercel
deployment (Step 4).

## Known limitations, not bugs

- Only DOCX generation is implemented. `GeneratedDocumentType.CSV/XLSX/PDF/HTML` are accepted by
  the request schema but rejected with a clear `UNSUPPORTED_REPORT_DOCUMENT_TYPE` error at
  generation time.
- Placeholder substitution is a literal find/replace over `[bracketed]` text — there is no field
  typing, validation, or reuse of company/project data (e.g. it will not auto-fill the project name
  even though the app already has it) in this first version.
- No template editing UI — templates can only be imported (via JSON) or activated/deactivated, not
  edited in place. To change one, re-import a corrected file under a new `code`.
