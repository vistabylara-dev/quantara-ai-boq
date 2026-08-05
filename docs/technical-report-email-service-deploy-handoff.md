                                                                                                                                # Deploy handoff: Technical Report Email Service (Email Service 1B)

**Audience:** any agent or developer picking this up fresh, with no memory of how it was built.
**Repo:** `quantara-ai-boq` (Next.js 14 App Router + Prisma/PostgreSQL, multi-tenant BOQ SaaS).
**Branch:** `main`. **Host:** Vercel (`quantara.vistabylara.com`), Git-connected — pushing to `main`
triggers a Production deployment automatically.
**Confirmed production database (this session):** Neon database **`quantara_staging`** (misleading
name — it is the real production DB; `neondb` on the same Neon project is an empty, unused
leftover — do not migrate against `neondb`). Host:
`ep-ancient-smoke-avlx0a5t.c-11.us-east-1.aws.neon.tech`.

## What this is

Two ready-made client-facing email templates for technical reports (an "attach the document"
style and an "automated secure link" style, both using Lara's provided wording), plus the real
backend to send them: a secure, revocable client link for a generated technical report (mirrors
`ClientProposal`'s token pattern, but simpler — single opaque link, no passcode portal, no
approve/reject workflow), and an email-send flow that logs through the existing `EmailDispatch`
table.

**This code has not run against a live database, `npm run build`, ESLint, or `tsc`.** Same sandbox
network restriction as the previous technical-report-templates handoff (no route to Prisma's
engine-binary CDN; ESLint/tsc time out). Every cross-file import, Prisma relation, and
companyId/RBAC scoping was checked by hand against this codebase's existing patterns — treat Step
2 as the first real test.

## What's new / changed

Schema + migration (additive only — no column altered or dropped):
- `prisma/schema.prisma` — `GeneratedTechnicalReport` gains `shareTokenHash` (unique, nullable),
  `shareExpiresAt`, `shareRevokedAt`, and an `emailDispatches` back-relation. `EmailDispatch` gains
  a nullable `generatedTechnicalReportId` FK + relation + index.
- `prisma/migrations/20260804090000_technical_report_email_share_1b/migration.sql` — hand-written,
  matches the schema change above.

RBAC:
- `src/lib/auth/rbac.ts` — new capability `technical-reports:send`, granted to COMPANY_OWNER (via
  `ALL_CAPABILITIES`), ADMINISTRATOR, QUANTITY_SURVEYOR, ESTIMATOR (same roles that already have
  `technical-reports:generate`).

Public route access:
- `src/middleware.ts` — added `/technical-report` to `PUBLIC_PAGE_PREFIXES` (the client-facing
  share page needs to load without a session cookie, same as `/proposal`). **This one is easy to
  miss** — without it, the public link silently redirects to `/login`, exactly like the
  `/integrations` page did earlier this session before its own fix.

New library code:
- `src/lib/documents/technical-report-share.ts` — token generate/hash/validate (reuses
  `generateRawToken`/`hashToken` from `auth/tokens.ts`, same scheme as sessions and proposals).
- `src/lib/email/render-technical-report-email-template.ts` — `{{token}}` renderer with its own
  variable set (no `grandTotal`/`currency` requirement unlike the BOQ proposal renderer;
  `secureReportUrl` is optional since an attach-only send needs no link).
- `src/lib/email/starter-technical-report-email-templates.ts` — the two template bodies (HTML +
  text), adapted from Lara's provided copy into `{{token}}` syntax.
- `src/lib/services/technical-report-email-service.ts` — share-link create/revoke,
  preview/test-send/send. Real data only: `reportReference` is derived from the project reference
  + report id, `sectionList` is the report's actual section titles, `issueDate` falls back to now
  only if `completedAt` is unset. `revision` has no source of truth in this schema yet, so it's an
  optional field the sender types in at send time rather than a fabricated default.
- `src/lib/services/public-technical-report-service.ts` — token-gated (no session) view + download,
  mirrors `public-proposal-service.ts`'s document download.
- `src/lib/validation/technical-report-email-schema.ts` — request body schemas.

Modified library code:
- `src/lib/repositories/generated-technical-report-repository.ts` — added
  `createReportShareLink`/`revokeReportShareLink` (both companyId-scoped, including inside
  `$transaction`), and `hasActiveShareLink`/`shareExpiresAt` on the DTO (the token hash itself is
  never returned to any API response).
- `src/lib/services/email-template-service.ts` — added
  `installTechnicalReportStarterTemplatesForCompany` (idempotent by `code` — safe to call more than
  once).
- `src/lib/validation/route-params.ts` — added `technicalReportTokenParamsSchema`.

New API routes:
- `POST /api/email-templates/starter/technical-report` — installs the two starter templates.
- `POST /api/technical-reports/[reportId]/share` — create/rotate the secure link (no request
  body — mirrors `POST /api/proposals/[proposalId]/regenerate-link`).
- `POST /api/technical-reports/[reportId]/share/revoke`
- `GET /api/technical-reports/[reportId]/email` — dispatch history for a report.
- `POST /api/technical-reports/[reportId]/email/send`
- `POST /api/technical-reports/[reportId]/email/preview`
- `POST /api/technical-reports/[reportId]/email/test-send`
- `GET /api/public/technical-reports/[token]` — metadata, no session required.
- `GET /api/public/technical-reports/[token]/download` — streams the file, no session required.

New page:
- `src/app/technical-report/[token]/page.tsx` — the public "here's your report" landing page a
  client lands on when they click the secure link.

Modified pages:
- `src/app/settings/email-templates/page.tsx` — "Add technical report templates" button.
- `src/app/projects/[projectId]/technical-reports/[reportId]/page.tsx` — "Secure client link" and
  "Send by email" sections (only shown once the report is generated).

## Step 1 — Commit and push only these files

Check `git status` first — as with the last handoff, confirm nothing unrelated is sitting
uncommitted before using any wildcard add.

```powershell
cd C:\Users\PC\Desktop\quantara-ai-boq

git add prisma/schema.prisma `
  "prisma/migrations/20260804090000_technical_report_email_share_1b" `
  src/lib/auth/rbac.ts `
  src/middleware.ts `
  src/lib/documents/technical-report-share.ts `
  src/lib/email/render-technical-report-email-template.ts `
  src/lib/email/starter-technical-report-email-templates.ts `
  src/lib/services/technical-report-email-service.ts `
  src/lib/services/public-technical-report-service.ts `
  src/lib/services/email-template-service.ts `
  src/lib/repositories/generated-technical-report-repository.ts `
  src/lib/validation/technical-report-email-schema.ts `
  src/lib/validation/route-params.ts `
  src/app/api/email-templates/starter `
  src/app/api/technical-reports/[reportId]/share `
  src/app/api/technical-reports/[reportId]/email `
  src/app/api/public/technical-reports `
  src/app/technical-report `
  src/app/settings/email-templates/page.tsx `
  "src/app/projects/[projectId]/technical-reports/[reportId]/page.tsx" `
  docs/technical-report-email-service-deploy-handoff.md

git status   # confirm only the files above are staged before committing
git commit -m "feat: technical report email service (Email Service 1B)"
git push origin main
```

## Step 2 — Verify locally before touching production

```powershell
docker compose up -d
npm install
npm run db:migrate      # applies the new migration via `prisma migrate dev` against local Docker
npm run lint
npm run build
npm test
```

Stop and fix here if anything fails — do not push forward to production on a failing build.

## Step 3 — Apply the migration to production

This session confirmed the real production database directly via the Neon console (project
`neon-camel-cloud`, org "Vercel: Vista by lara's projects", database **`quantara_staging`** — not
`neondb`). Get that connection string again from
[console.neon.tech](https://console.neon.tech) → the project → **Connect** → branch `main`,
database `quantara_staging`, role `quantara_hyperdrive` → copy the full connection string.

```powershell
$env:DATABASE_URL = "paste the full connection string here — no extra text, nothing duplicated"
Write-Host "Length: $($env:DATABASE_URL.Length)"
Write-Host "First 20 chars: $($env:DATABASE_URL.Substring(0,20))"
```

Confirm the printed prefix is `postgresql://` before continuing — if it says anything else
(a placeholder, a duplicated URL, etc.), stop and re-copy it. Then:

```powershell
npx prisma migrate status    # should show only 20260804090000_technical_report_email_share_1b as pending
npx prisma migrate deploy
```

Never run `prisma migrate dev` or `prisma migrate reset`/`db:reset` against this URL — those are
dev-only and `reset` deletes all data. `migrate deploy` is the only production-safe command.

**While you're in there:** this connection string (with password) has been pasted into chat
several times this session. Rotate the `quantara_hyperdrive` role's password in Neon (Settings →
Roles → reset password) once this deploy is confirmed working, then update `DATABASE_URL` in
Vercel's Production environment variables to match — otherwise the app loses its DB connection.

## Step 4 — Deploy

Pushing in Step 1 should trigger an automatic Vercel Production deployment (Git integration is
already connected — confirmed this session via the Vercel dashboard's Deployment page, which
showed `Environment: Production`, `Domains: quantara.vistabylara.com`). Check the Deployments tab;
if nothing fired, trigger one manually with `vercel --prod` from a machine with the Vercel CLI
authenticated to this project.

## Step 5 — Post-deploy smoke test

1. Log in, go to **Settings → Email templates**. Click **"Add technical report templates"** —
   confirm two new templates appear ("Technical Report — Attached" and "Technical Report — Secure
   Link (Ready)"). Click "Add" again — confirm it reports both already installed (idempotent).
2. Open any project with a **completed** technical report (generate one first if none exists: a
   project → Technical Reports → pick a template → fill fields → Generate DOCX).
3. On the report detail page, click **"Create link"** under "Secure client link" — confirm a URL
   appears (`https://quantara.vistabylara.com/technical-report/<token>`) with a working "Copy
   link" button.
4. Open that URL in a private/incognito window (no session) — confirm the report name/project
   name show and "Download Technical Report" actually downloads the file. This is the exact check
   that would have caught the `/integrations`-style middleware redirect bug if Step 0's
   `src/middleware.ts` change had been missed.
5. Back on the report page, under "Send by email": pick the "Secure Link" template, enter a real
   recipient (yourself is fine), check "Include the secure link", click **Send report email**.
   Confirm you receive it (if `EMAIL_PROVIDER` isn't `smtp` in production, it'll log to the
   server console instead of actually sending — check Vercel Runtime Logs for `[DEV EMAIL - NOT
   SENT]` in that case, and treat that as a pass since real delivery was never configured).
6. Click **Revoke** on the share link, then reload the public URL from step 4 in the incognito
   window again — confirm it now shows "This report link is no longer active."
7. Confirm a role without `technical-reports:send` (e.g. DESIGNER) gets a 403 on
   `POST /api/technical-reports/[id]/email/send`, and that a report/template from a different
   company is never reachable (404, not the wrong company's data).

If any of these fail, check the browser console and the relevant `/api/technical-reports/...`
response directly — most likely causes are Step 3's migration not actually applied, or a stale
Vercel deployment (Step 4).

## Known limitations, not bugs

- No passcode/approval portal like `ClientProposal` has — the share link itself is the only
  secret (same trust model as a typical Dropbox/Drive share link). Not built because nothing in
  the request asked for approve/reject/comment workflow on a technical report.
- `revision` is not tracked anywhere on `GeneratedTechnicalReport` — there's no source of truth to
  derive it from, so it's left blank unless the sender types one in at send time (never fabricated).
- The company-wide `EmailTemplate.isDefault` flag is BOQ/proposal-specific and untouched by this
  change — technical report sends always require an explicit `emailTemplateId`, there is no
  implicit "default" for this send type.
- Local disk storage (`localDocumentStorageAdapter`) is used for the underlying file, same as
  every other generated document in this app — not touched or changed by this feature.
