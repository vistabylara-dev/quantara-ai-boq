---
name: quantara-deploy-triage
description: Triage build and deploy failures specifically for the quantara-ai-boq repo (Next.js 14 App Router + Prisma/PostgreSQL, no deploy config committed yet). Use this skill whenever the user reports a build failure, deploy failure, "it failed again", Vercel/host error, or asks to deploy/redeploy this project — even if they don't say "quantara" by name, as long as the repo in context is quantara-ai-boq or matches its structure (Next.js + Prisma + no Dockerfile/vercel.json). Also trigger if Claude has already attempted a fix for this repo's build/deploy and it failed more than once, since repeated blind retries on this project are usually the same root cause repeating, not new bugs. Do not use this skill for unrelated projects or for local dev issues that aren't about building/deploying.
---

# Quantara AI BOQ — deploy/build failure triage

## Why this exists
On this project specifically, most reported "build failures" have turned out to be the same
underlying gap: the repo has no deployment configuration and no live database, so any attempt to
build/deploy fails the same way regardless of what code gets changed. Repeatedly editing code in
response to that failure burns time and tokens without fixing anything. This skill exists to catch
that pattern early and stop it, rather than retrying blindly.

Run through this triage in order, every time, before touching application code.

## Step 1 — Confirm deploy infrastructure actually exists
Check for these files at the repo root:
Dockerfile, vercel.json, render.yaml, railway.json, netlify.toml, fly.toml, Procfile, .github/workflows/*

As of the last audit, none of these exist — the repo only has docker-compose.yml, which stands
up local Postgres for development, not the app itself, and is not a deploy target.

If none of these exist and the user hasn't said which host they're using and confirmed it's
already set up (hosting account created, database provisioned), stop here. Do not guess at
deploy config or attempt to push to a host. Tell the user directly: this repo has no deploy
config, ask which host they intend to use (Vercel is the natural fit for this stack) and whether
they've provisioned a Postgres database and have a connection string ready. This is not something
Claude can create or work around — it requires the user's own hosting account and credentials.

## Step 2 — If deploy config now exists, check env vars before assuming a code bug
Compare vars referenced in src/ against what's actually set on the host:
grep -rohE "process\.env\.[A-Z0-9_]+" src | sort -u

Known gaps as of the last audit (present in code, absent from .env.example):
- PROPOSAL_ACCESS_SECRET — falls back to a hardcoded insecure string if unset
  (src/lib/proposals/access-cookie.ts). Must be set to a real secret in production.
- EMAIL_PROVIDER, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD,
  SMTP_FROM_EMAIL, SMTP_FROM_NAME — only required if EMAIL_PROVIDER=smtp; otherwise the app
  safely falls back to a development email provider.
- DATABASE_URL must point at the production Postgres instance, never the local Docker one.

A build failing because one of these is unset looks like an app crash but is a config gap, not a
bug — fix it by setting the variable on the host, not by editing source.

## Step 3 — If it's a Prisma error, check which command ran
- npm install triggers @prisma/client's own postinstall, which runs prisma generate
  automatically. No manual postinstall script is needed or should be added.
- Local dev migrations use npm run db:migrate (prisma migrate dev) — dev only.
- Production migrations must use npx prisma migrate deploy against the production
  DATABASE_URL. Using migrate dev or db:reset against a production database is destructive
  (db:reset deletes all data) — never run either outside local development.
- A build error citing a missing Prisma-generated type (e.g. ProjectStatus not exported from
  @prisma/client) means prisma generate didn't run or didn't complete — re-run it, don't treat
  it as an application bug.

## Step 4 — Only now consider it a real code bug
If deploy config exists, all required env vars are set on the host with correct production values,
and Prisma commands are the right ones for the environment, and the build still fails — now it's
worth reading the actual stack trace and editing application code. At that point, standard
debugging applies: read the real error message, don't guess-and-retry, and don't touch the
LocalStorage-backed pages (/catalogue, /industries, /settings, /templates, document
generation, client-preview) — the README documents these as intentionally not yet migrated to the
database, so errors there may be by design rather than bugs.

## What "success" looks like here
The goal is not to make every failure disappear silently. When the blocker is infrastructure or
credentials only the user can provide, the correct outcome is telling them clearly what's missing
and stopping — not another round of source-code edits that can't possibly fix an infrastructure
gap.