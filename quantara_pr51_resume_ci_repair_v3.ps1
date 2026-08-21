Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Quantara PR #51 CI repair — RESUME after v2 stopped safely.
# This script:
# - resumes the existing isolated worktree created by v2;
# - validates the two already-applied partial edits before doing anything else;
# - applies only the remaining three narrow repairs;
# - runs NO Prisma command, NO migration command, and NO database-backed test locally;
# - changes NO Stripe/refund business service, NO catalogue, NO SaaS, NO TAYQAN runtime/worker code;
# - pushes only to PR #51's existing source branch after static tests + lint + typecheck pass.

$root = "$env:USERPROFILE\Desktop\quantara-ai-boq"
$worktree = "$root\.worktrees\pr51-ci-gates-20260816"
$localBranch = "fix/pr51-ci-gates-20260816"
$remoteBranch = "fix/ai-draft-unresolved-measurements-20260816"
$expectedPrHead = "36641a2c2b3edb1cab49ab8c5ae145a48cc9bfbc"

$partialPaths = @(
    "src/app/projects/[projectId]/extractions/page.tsx",
    "src/middleware.ts"
) | Sort-Object

$finalAllowedPaths = @(
    "src/app/api/admin/commerce/refunds/apply-refund-workflow-migration/route.ts",
    "src/app/api/commerce/refunds/eligibility/route.ts",
    "src/app/projects/[projectId]/extractions/page.tsx",
    "src/middleware.ts",
    "tests/worker-tayqan.test.ts"
) | Sort-Object

function Fail([string]$Message) {
    throw "STOP: $Message"
}

function GitCapture([string]$Directory, [string[]]$Arguments) {
    $output = & git -C $Directory @Arguments
    if ($LASTEXITCODE -ne 0) {
        Fail "git command failed in ${Directory}: git $($Arguments -join ' ')"
    }
    return (($output | Out-String).Trim())
}

function GitRun([string]$Directory, [string[]]$Arguments) {
    & git -C $Directory @Arguments
    if ($LASTEXITCODE -ne 0) {
        Fail "git command failed in ${Directory}: git $($Arguments -join ' ')"
    }
}

function ReadNormalized([string]$Path) {
    return [IO.File]::ReadAllText($Path).Replace("`r`n", "`n")
}

function WriteUtf8NoBom([string]$Path, [string]$Content) {
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, $Content, $utf8)
}

function ReplaceExactlyOnce(
    [string]$Content,
    [string]$Old,
    [string]$New,
    [string]$Label
) {
    $first = $Content.IndexOf($Old, [StringComparison]::Ordinal)
    if ($first -lt 0) {
        Fail "expected anchor not found for $Label. Refusing to guess."
    }
    $second = $Content.IndexOf($Old, $first + $Old.Length, [StringComparison]::Ordinal)
    if ($second -ge 0) {
        Fail "anchor for $Label appears more than once. Refusing ambiguous edit."
    }
    return $Content.Substring(0, $first) + $New + $Content.Substring($first + $Old.Length)
}

function AssertPathSet([string[]]$Expected, [string[]]$Actual, [string]$Label) {
    $expectedSorted = @($Expected | Sort-Object)
    $actualSorted = @($Actual | Where-Object { $_ -and $_.Trim() } | ForEach-Object { $_.Trim() } | Sort-Object)
    $comparison = Compare-Object -ReferenceObject $expectedSorted -DifferenceObject $actualSorted
    if ($comparison) {
        Write-Host "`nExpected paths:" -ForegroundColor Yellow
        $expectedSorted | ForEach-Object { Write-Host "  $_" }
        Write-Host "Actual paths:" -ForegroundColor Yellow
        $actualSorted | ForEach-Object { Write-Host "  $_" }
        Fail "$Label path scope mismatch."
    }
}

function AssertProtectedRoot(
    [string]$ExpectedBranch,
    [string]$ExpectedHead,
    [string]$ExpectedStatus
) {
    $branchNow = GitCapture $root @("branch", "--show-current")
    $headNow = GitCapture $root @("rev-parse", "HEAD")
    $statusNow = GitCapture $root @("status", "--porcelain=v1", "--untracked-files=all")
    if ($branchNow -ne $ExpectedBranch -or $headNow -ne $ExpectedHead -or $statusNow -ne $ExpectedStatus) {
        Fail "protected root worktree changed during this run. Nothing will be pushed."
    }
}

function RunChecked([string]$Label, [scriptblock]$Command) {
    Write-Host "`n=== $Label ===" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        Fail "$Label failed with exit code $LASTEXITCODE. Nothing will be pushed."
    }
}

Write-Host "`n=== 1. RECORD + PROTECT DIRTY ROOT ===" -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $root)) {
    Fail "repository root not found: $root"
}

$rootBranch = GitCapture $root @("branch", "--show-current")
$rootHead = GitCapture $root @("rev-parse", "HEAD")
$rootStatus = GitCapture $root @("status", "--porcelain=v1", "--untracked-files=all")

if ($rootBranch -ne "fix/saas-arabic-final") {
    Fail "protected root is on '$rootBranch', expected 'fix/saas-arabic-final'."
}
Write-Host "Protected root: $rootBranch @ $rootHead" -ForegroundColor Green
Write-Host "The root's existing dirty files are recorded and will not be touched." -ForegroundColor Green


Write-Host "`n=== 2. VERIFY PR #51 REMOTE HEAD HAS NOT MOVED ===" -ForegroundColor Cyan
GitRun $root @("fetch", "origin", "+refs/heads/${remoteBranch}:refs/remotes/origin/${remoteBranch}")
$remoteHead = GitCapture $root @("rev-parse", "refs/remotes/origin/$remoteBranch")
if ($remoteHead -ne $expectedPrHead) {
    Fail "PR #51 moved. Expected $expectedPrHead, found $remoteHead. Re-review required."
}
AssertProtectedRoot $rootBranch $rootHead $rootStatus
Write-Host "PASS: PR #51 is still at $expectedPrHead" -ForegroundColor Green


Write-Host "`n=== 3. VERIFY EXISTING RESUME WORKTREE ===" -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $worktree)) {
    Fail "v2 resume worktree not found: $worktree"
}

$wtBranch = GitCapture $worktree @("branch", "--show-current")
$wtHead = GitCapture $worktree @("rev-parse", "HEAD")
if ($wtBranch -ne $localBranch) {
    Fail "resume worktree is on '$wtBranch', expected '$localBranch'."
}
if ($wtHead -ne $expectedPrHead) {
    Fail "resume worktree HEAD is $wtHead, expected $expectedPrHead."
}

$stagedBefore = @(& git -C $worktree diff --cached --name-only)
if ($LASTEXITCODE -ne 0) { Fail "could not inspect staged files." }
if (@($stagedBefore | Where-Object { $_ }).Count -ne 0) {
    Fail "resume worktree already has staged changes. Refusing to continue."
}

$partialChanged = @(& git -C $worktree diff --name-only)
if ($LASTEXITCODE -ne 0) { Fail "could not inspect partial v2 diff." }
AssertPathSet $partialPaths $partialChanged "partial v2"
Write-Host "PASS: v2 stopped with exactly the expected 2 uncommitted files." -ForegroundColor Green


Write-Host "`n=== 4. VERIFY THE TWO PARTIAL EDITS ARE THE INTENDED ONES ===" -ForegroundColor Cyan
$extractionPath = "$worktree\src\app\projects\[projectId]\extractions\page.tsx"
$middlewarePath = "$worktree\src\middleware.ts"

$extraction = ReadNormalized $extractionPath
$middleware = ReadNormalized $middlewarePath

$requiredExtractionMarkers = @(
    'reviewSummary.complete',
    '/boq?action=import-reviewed',
    'importableEntityCount.toLocaleString()',
    'Generate Draft BOQ Now',
    'Review Exceptions First',
    'Review Everything First'
)
foreach ($marker in $requiredExtractionMarkers) {
    if (-not $extraction.Contains($marker)) {
        Fail "partial extraction edit is missing expected marker: $marker"
    }
}

$requiredMiddlewareMarkers = @(
    'if (pathname === "/login" && hasSessionCookie)',
    'NextResponse.redirect(new URL("/dashboard", request.url))'
)
foreach ($marker in $requiredMiddlewareMarkers) {
    if (-not $middleware.Contains($marker)) {
        Fail "partial middleware edit is missing expected marker: $marker"
    }
}

# Ensure the AI Draft fast path itself was not removed while restoring the governed reviewed path.
if (-not $extraction.Contains('disabled={isGeneratingDraft || draftSummary.eligibleCount === 0}')) {
    Fail "AI Draft button logic is unexpectedly missing from the partial extraction file."
}
Write-Host "PASS: reviewed-import path restored alongside the AI Draft choices." -ForegroundColor Green
Write-Host "PASS: login redirect is the only intended middleware behavior addition." -ForegroundColor Green


Write-Host "`n=== 5. FIX REFUND ELIGIBILITY REQUEST CONTEXT ONLY ===" -ForegroundColor Cyan
$refundEligibilityPath = "$worktree\src\app\api\commerce\refunds\eligibility\route.ts"
$refund = ReadNormalized $refundEligibilityPath

# Fail closed on the business-call identity: we are allowed to wrap it, not alter it.
if (-not $refund.Contains('return apiSuccess(await getRefundEligibility(actor));')) {
    Fail "refund eligibility business call is not the reviewed getRefundEligibility(actor) call."
}
if (-not $refund.Contains('setActorContext(actor);')) {
    Fail "refund eligibility route no longer contains the reviewed actor assignment."
}
if ($refund.Contains("withActorRequestContext")) {
    Fail "refund eligibility route already appears wrapped; branch state changed."
}

$refund = ReplaceExactlyOnce `
    $refund `
    'import { setActorContext } from "@/lib/auth/request-context";' `
    'import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";' `
    "refund request-context import"

$refund = ReplaceExactlyOnce `
    $refund `
    'export async function GET() {' `
    'async function GETHandler() {' `
    "refund GET handler declaration"

$refundTailOld = @'
  } catch (error) {
    return handleApiError(error);
  }
}
'@.Replace("`r`n", "`n")

$refundTailNew = @'
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
'@.Replace("`r`n", "`n")

$refund = ReplaceExactlyOnce $refund $refundTailOld $refundTailNew "refund GET wrapper export"
WriteUtf8NoBom $refundEligibilityPath $refund

Write-Host "PASS: only the read-only eligibility route wrapper changed." -ForegroundColor Green
Write-Host "Stripe/refund service logic: UNTOUCHED" -ForegroundColor Green


Write-Host "`n=== 6. RETIRE ONLY THE ONE-TIME REFUND MIGRATION HTTP WRITER ===" -ForegroundColor Cyan
$migrationRoute = "$worktree\src\app\api\admin\commerce\refunds\apply-refund-workflow-migration\route.ts"
if (-not (Test-Path -LiteralPath $migrationRoute)) {
    Fail "expected one-time refund migration HTTP route is already absent."
}

$migrationSource = ReadNormalized $migrationRoute
$requiredMigrationMarkers = @(
    'const MIGRATION_NAME = "20260814105935_refund_workflow";',
    'CREATE TABLE IF NOT EXISTS "RefundRequest"',
    'INSERT INTO "_prisma_migrations"'
)
foreach ($marker in $requiredMigrationMarkers) {
    if (-not $migrationSource.Contains($marker)) {
        Fail "one-time refund migration route does not match the reviewed retired writer: missing $marker"
    }
}

Remove-Item -LiteralPath $migrationRoute -Force
Write-Host "PASS: retired the application HTTP DDL writer only." -ForegroundColor Green
Write-Host "prisma/migrations/20260814105935_refund_workflow: UNTOUCHED" -ForegroundColor Green
Write-Host "Prisma schema: UNTOUCHED" -ForegroundColor Green
Write-Host "No migration command was run." -ForegroundColor Green


Write-Host "`n=== 7. FIX ONLY THE TAYQAN ARABIC TEST ALLOW-LIST ===" -ForegroundColor Cyan
$tayqanTestPath = "$worktree\tests\worker-tayqan.test.ts"
$tayqan = ReadNormalized $tayqanTestPath

$tayqan = ReplaceExactlyOnce `
    $tayqan `
    '    const LATIN_PROSE = /[A-Za-z]{2,}/;' `
@'
    const LATIN_PROSE = /[A-Za-z]{2,}/;
    const ALLOWED_LATIN_IDENTIFIERS = [
      "TAYQAN",
      "Quantara",
      "Stripe",
      "MEP",
      "HVAC",
      "ELV",
      "Hardscape",
      "Softscape",
    ] as const;
'@.Replace("`r`n", "`n") `
    "TAYQAN technical identifier allow-list"

$tayqanOld = @'
        // Strip the brand name and {vars} interpolation placeholders (e.g.
        // "{count}", "{number}") before checking for stray English prose —
        // those are template syntax, not untranslated presentation text.
        const withoutBrandAndVars = node.replace(/TAYQAN/g, "").replace(/\{\w+\}/g, "");
        if (LATIN_PROSE.test(withoutBrandAndVars)) offenders.push(`${path} = ${JSON.stringify(node)}`);
'@.Replace("`r`n", "`n")

$tayqanNew = @'
        // Strip approved brand/technical identifiers and {vars} interpolation
        // placeholders before checking for stray English prose. The allow-list
        // is intentionally narrow so genuine untranslated English still fails.
        const withoutVars = node.replace(/\{\w+\}/g, "");
        const withoutAllowedIdentifiers = ALLOWED_LATIN_IDENTIFIERS.reduce(
          (value, identifier) => value.split(identifier).join(""),
          withoutVars,
        );
        if (LATIN_PROSE.test(withoutAllowedIdentifiers)) offenders.push(`${path} = ${JSON.stringify(node)}`);
'@.Replace("`r`n", "`n")

$tayqan = ReplaceExactlyOnce $tayqan $tayqanOld $tayqanNew "TAYQAN Arabic prose gate"
WriteUtf8NoBom $tayqanTestPath $tayqan

Write-Host "PASS: only tests/worker-tayqan.test.ts changed." -ForegroundColor Green
Write-Host "TAYQAN runtime/worker/services/dictionaries: UNTOUCHED" -ForegroundColor Green


Write-Host "`n=== 8. HARD FIVE-PATH SCOPE CHECK ===" -ForegroundColor Cyan
$changedNow = @(& git -C $worktree diff --name-only)
if ($LASTEXITCODE -ne 0) { Fail "could not inspect final repair diff." }
AssertPathSet $finalAllowedPaths $changedNow "final repair"

# Explicit protected-path guard.
$protectedPrefixes = @(
    "prisma/",
    "src/lib/services/stripe",
    "src/lib/services/refund",
    "src/lib/services/commerce",
    "src/lib/stripe/",
    "src/lib/entitlements/",
    "src/lib/services/industry-package",
    "src/lib/services/master-catalogue",
    "src/lib/worker/",
    "src/app/projects/[projectId]/tayqan/"
)
foreach ($path in $changedNow) {
    foreach ($prefix in $protectedPrefixes) {
        if ($path.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
            Fail "protected path changed: $path"
        }
    }
}

GitRun $worktree @("diff", "--check")
AssertProtectedRoot $rootBranch $rootHead $rootStatus

Write-Host "PASS: exactly 5 intended repair paths." -ForegroundColor Green
Write-Host "DATABASE/PRISMA/SCHEMA/MIGRATIONS: NO CHANGE" -ForegroundColor Green
Write-Host "STRIPE/COMMERCE/REFUND BUSINESS SERVICES: NO CHANGE" -ForegroundColor Green
Write-Host "CATALOGUE/ENTITLEMENTS: NO CHANGE" -ForegroundColor Green
Write-Host "TAYQAN RUNTIME/WORKER: NO CHANGE" -ForegroundColor Green


Write-Host "`n=== 9. STATIC FOCUSED REGRESSION TESTS — NO DATABASE RESET ===" -ForegroundColor Cyan
Push-Location $worktree
try {
    if (-not (Test-Path -LiteralPath "$worktree\node_modules")) {
        Fail "node_modules is unavailable in the isolated worktree. Refusing npm install/postinstall."
    }

    RunChecked "Five CI regression gates + AI Draft regression" {
        & npx.cmd vitest run `
            tests/extraction-boq-ui-bridge.test.ts `
            tests/middleware.test.ts `
            tests/release-route-integrity.test.ts `
            tests/request-context-cloudflare-compat.test.ts `
            tests/ai-draft-boq-workflow.test.ts
    }

    RunChecked "TAYQAN Arabic presentation gate only" {
        & npx.cmd vitest run `
            tests/worker-tayqan.test.ts `
            -t "the Arabic TAYQAN screen introduces no English-only presentation strings beyond the TAYQAN brand/technical identifiers"
    }

    RunChecked "Full ESLint" {
        & npm.cmd run lint --silent
    }

    RunChecked "Full TypeScript typecheck" {
        & npm.cmd run typecheck --silent
    }
}
finally {
    Pop-Location
}

# NO npm test here: GitHub CI owns the full isolated-PostgreSQL reset.
Write-Host "`nLOCAL DATABASE COMMANDS RUN: NONE" -ForegroundColor Green
Write-Host "Full isolated PostgreSQL suite will run in GitHub Actions after push." -ForegroundColor Green


Write-Host "`n=== 10. RE-CHECK SCOPE + REMOTE HEAD BEFORE COMMIT ===" -ForegroundColor Cyan
$changedAfterTests = @(& git -C $worktree diff --name-only)
if ($LASTEXITCODE -ne 0) { Fail "could not inspect diff after tests." }
AssertPathSet $finalAllowedPaths $changedAfterTests "post-test repair"
GitRun $worktree @("diff", "--check")
AssertProtectedRoot $rootBranch $rootHead $rootStatus

GitRun $root @("fetch", "origin", "+refs/heads/${remoteBranch}:refs/remotes/origin/${remoteBranch}")
$remoteHeadAfterTests = GitCapture $root @("rev-parse", "refs/remotes/origin/$remoteBranch")
if ($remoteHeadAfterTests -ne $expectedPrHead) {
    Fail "PR #51 moved while validating. Nothing will be committed or pushed."
}


Write-Host "`n=== 11. STAGE EXACTLY FIVE PATHS + COMMIT ===" -ForegroundColor Cyan
foreach ($path in $finalAllowedPaths) {
    & git -C $worktree add -A -- $path
    if ($LASTEXITCODE -ne 0) {
        Fail "failed to stage approved path: $path"
    }
}

$staged = @(& git -C $worktree diff --cached --name-only)
if ($LASTEXITCODE -ne 0) { Fail "could not inspect staged diff." }
AssertPathSet $finalAllowedPaths $staged "staged repair"
GitRun $worktree @("diff", "--cached", "--check")

GitRun $worktree @("commit", "-m", "fix: restore release integrity gates")
$newCommit = GitCapture $worktree @("rev-parse", "HEAD")
Write-Host "Created local repair commit: $newCommit" -ForegroundColor Green


Write-Host "`n=== 12. FINAL REMOTE GUARD + PUSH ONLY TO PR #51 BRANCH ===" -ForegroundColor Cyan
GitRun $root @("fetch", "origin", "+refs/heads/${remoteBranch}:refs/remotes/origin/${remoteBranch}")
$remoteImmediatelyBeforePush = GitCapture $root @("rev-parse", "refs/remotes/origin/$remoteBranch")
if ($remoteImmediatelyBeforePush -ne $expectedPrHead) {
    Fail "PR #51 moved immediately before push. Local commit is preserved, but nothing was pushed."
}
AssertProtectedRoot $rootBranch $rootHead $rootStatus

GitRun $worktree @("push", "origin", "HEAD:refs/heads/$remoteBranch")
AssertProtectedRoot $rootBranch $rootHead $rootStatus


Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "PR #51 SAFE CI REPAIR PUSHED" -ForegroundColor Green
Write-Host "NEW HEAD: $newCommit"
Write-Host "REPAIR PATHS: 5"
Write-Host "STATIC REGRESSION TESTS: PASS"
Write-Host "TAYQAN ARABIC GATE: PASS"
Write-Host "FULL ESLINT: PASS"
Write-Host "FULL TYPECHECK: PASS"
Write-Host "LOCAL DATABASE COMMANDS: NONE"
Write-Host "PROTECTED ROOT: UNTOUCHED"
Write-Host "STRIPE BUSINESS LOGIC: UNTOUCHED"
Write-Host "REFUND BUSINESS LOGIC: UNTOUCHED"
Write-Host "PRISMA/SCHEMA/MIGRATIONS: UNTOUCHED"
Write-Host "CATALOGUE/ENTITLEMENTS: UNTOUCHED"
Write-Host "TAYQAN RUNTIME/WORKER: UNTOUCHED"
Write-Host "AI DRAFT FAST PATH: PRESERVED"
Write-Host "REVIEWED BOQ PATH: RESTORED"
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "STOP HERE. Do not merge. GitHub CI must turn green first."
