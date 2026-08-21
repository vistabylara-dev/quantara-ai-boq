Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Quantara PR #51 CI-gate repair — v2 (PowerShell interpolation parser fix).
# SAFETY: never edits main, never edits the dirty root worktree, never runs a production DB migration,
# never changes Stripe/refund business logic, Prisma/schema, catalogue, SaaS, or TAYQAN worker code.

$root = "C:\Users\PC\Desktop\quantara-ai-boq"
$protectedRootBranch = "fix/saas-arabic-final"
$remoteBranch = "fix/ai-draft-unresolved-measurements-20260816"
$expectedRemoteHead = "36641a2c2b3edb1cab49ab8c5ae145a48cc9bfbc"
$localBranch = "fix/pr51-ci-gates-20260816"
$worktree = Join-Path $root ".worktrees\pr51-ci-gates-20260816"
$prUrl = "https://github.com/vistabylara-dev/quantara-ai-boq/pull/51"

$allowedPaths = @(
  "src/app/api/admin/commerce/refunds/apply-refund-workflow-migration/route.ts",
  "src/app/api/commerce/refunds/eligibility/route.ts",
  "src/app/projects/[projectId]/extractions/page.tsx",
  "src/middleware.ts",
  "tests/worker-tayqan.test.ts"
)

function Invoke-Git {
  param(
    [Parameter(Mandatory=$true)][string]$Directory,
    [Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments
  )
  & git -C $Directory @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "git failed in ${Directory}: git $($Arguments -join ' ')"
  }
}

function Git-Capture {
  param(
    [Parameter(Mandatory=$true)][string]$Directory,
    [Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments
  )
  $output = & git -C $Directory @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "git failed in ${Directory}: git $($Arguments -join ' ')"
  }
  return (($output | Out-String).Trim())
}

function Read-NormalizedText {
  param([Parameter(Mandatory=$true)][string]$Path)
  return [IO.File]::ReadAllText($Path).Replace("`r`n", "`n")
}

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Content
  )
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Replace-ExactlyOnce {
  param(
    [Parameter(Mandatory=$true)][string]$Content,
    [Parameter(Mandatory=$true)][string]$Old,
    [Parameter(Mandatory=$true)][string]$New,
    [Parameter(Mandatory=$true)][string]$Label
  )
  $first = $Content.IndexOf($Old, [StringComparison]::Ordinal)
  if ($first -lt 0) { throw "STOP: expected anchor not found for $Label. Branch content moved; no guess was applied." }
  $second = $Content.IndexOf($Old, $first + $Old.Length, [StringComparison]::Ordinal)
  if ($second -ge 0) { throw "STOP: anchor for $Label occurs more than once; refusing ambiguous edit." }
  return $Content.Substring(0, $first) + $New + $Content.Substring($first + $Old.Length)
}

function Assert-RootProtected {
  param(
    [string]$ExpectedBranch,
    [string]$ExpectedHead,
    [string]$ExpectedTrackedStatus
  )
  $branchNow = Git-Capture $root branch --show-current
  $headNow = Git-Capture $root rev-parse HEAD
  $statusNow = Git-Capture $root status --porcelain=v1 --untracked-files=no
  if ($branchNow -ne $ExpectedBranch -or $headNow -ne $ExpectedHead -or $statusNow -ne $ExpectedTrackedStatus) {
    throw "STOP: protected dirty root changed. No push will occur."
  }
}

function Assert-AllowedDiff {
  $changed = @(& git -C $worktree diff --name-only)
  if ($LASTEXITCODE -ne 0) { throw "STOP: could not inspect worktree diff." }
  $changed = @($changed | Where-Object { $_ -and $_.Trim() } | ForEach-Object { $_.Trim() })

  $unexpected = @($changed | Where-Object { $allowedPaths -notcontains $_ })
  $missing = @($allowedPaths | Where-Object { $changed -notcontains $_ })
  if ($unexpected.Count -gt 0 -or $missing.Count -gt 0) {
    throw "STOP: diff scope mismatch.`nUnexpected: $($unexpected -join ', ')`nMissing: $($missing -join ', ')"
  }
}

function Invoke-Checked {
  param(
    [Parameter(Mandatory=$true)][string]$Label,
    [Parameter(Mandatory=$true)][scriptblock]$Command
  )
  Write-Host "`n=== $Label ===" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "STOP: $Label failed with exit code $LASTEXITCODE. Nothing will be pushed." }
}

if (-not (Test-Path -LiteralPath $root)) { throw "STOP: repo root not found: $root" }

$rootBranchBefore = Git-Capture $root branch --show-current
$rootHeadBefore = Git-Capture $root rev-parse HEAD
$rootTrackedStatusBefore = Git-Capture $root status --porcelain=v1 --untracked-files=no
if ($rootBranchBefore -ne $protectedRootBranch) {
  throw "STOP: expected protected root branch '$protectedRootBranch', found '$rootBranchBefore'. Root will not be touched."
}

Write-Host "Protected root recorded: $rootBranchBefore @ $rootHeadBefore" -ForegroundColor Green
Write-Host "Fetching ONLY PR #51 source branch..." -ForegroundColor Cyan
Invoke-Git $root fetch origin "+refs/heads/$remoteBranch`:refs/remotes/origin/$remoteBranch"

$remoteHead = Git-Capture $root rev-parse "refs/remotes/origin/$remoteBranch"
if ($remoteHead -ne $expectedRemoteHead) {
  throw "STOP: PR #51 moved. Expected $expectedRemoteHead but remote is $remoteHead. Re-review required before editing."
}
Assert-RootProtected $rootBranchBefore $rootHeadBefore $rootTrackedStatusBefore

if (Test-Path -LiteralPath $worktree) {
  throw "STOP: isolated worktree already exists: $worktree. Refusing to overwrite it."
}
& git -C $root show-ref --verify --quiet "refs/heads/$localBranch"
if ($LASTEXITCODE -eq 0) {
  throw "STOP: local repair branch already exists: $localBranch. Refusing to reuse it."
}

Write-Host "Creating isolated repair worktree from exact PR #51 head..." -ForegroundColor Cyan
Invoke-Git $root worktree add -b $localBranch $worktree "refs/remotes/origin/$remoteBranch"
Assert-RootProtected $rootBranchBefore $rootHeadBefore $rootTrackedStatusBefore

# Reuse the existing dependency installation without npm install/postinstall.
$rootNodeModules = Join-Path $root "node_modules"
$worktreeNodeModules = Join-Path $worktree "node_modules"
if (-not (Test-Path -LiteralPath $rootNodeModules)) {
  throw "STOP: existing root node_modules is missing. Refusing npm install/postinstall because that could regenerate Prisma artifacts."
}
if (-not (Test-Path -LiteralPath $worktreeNodeModules)) {
  New-Item -ItemType Junction -Path $worktreeNodeModules -Target $rootNodeModules | Out-Null
}

# -----------------------------------------------------------------------------
# FIX 1: Restore the governed reviewed-extraction -> BOQ path alongside AI Draft.
# This restores the old successful CTA; it does not replace any Phase 2B option.
# -----------------------------------------------------------------------------
$extractionPath = Join-Path $worktree "src\app\projects\[projectId]\extractions\page.tsx"
$extraction = Read-NormalizedText $extractionPath
$extractionOld = @'
            </div>

            <p className="mt-4 text-xs leading-5 text-[#7B879C] dark:text-[#7F8DA6]">
              AI Draft quantities remain professionally unconfirmed until you explicitly confirm them from the BOQ. Rates remain unselected until you use your purchased package, catalogue, company library, or manual pricing workflow.
            </p>
'@
$extractionNew = @'
            </div>

            {reviewSummary.complete && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/5">
                <div>
                  <div className="text-sm font-black text-emerald-900 dark:text-emerald-200">Review complete</div>
                  <div className="mt-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    {importableEntityCount.toLocaleString()} reviewed items are ready for the governed BOQ import path.
                  </div>
                </div>
                <Link
                  href={
                    importableEntityCount > 0
                      ? `/projects/${encodedProjectId}/boq?action=import-reviewed`
                      : `/projects/${encodedProjectId}/boq`
                  }
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800"
                >
                  Continue to BOQ
                </Link>
              </div>
            )}

            <p className="mt-4 text-xs leading-5 text-[#7B879C] dark:text-[#7F8DA6]">
              AI Draft quantities remain professionally unconfirmed until you explicitly confirm them from the BOQ. Rates remain unselected until you use your purchased package, catalogue, company library, or manual pricing workflow.
            </p>
'@
$extraction = Replace-ExactlyOnce $extraction $extractionOld $extractionNew "reviewed extraction BOQ CTA"
Write-Utf8NoBom $extractionPath $extraction

# -----------------------------------------------------------------------------
# FIX 2: Restore documented signed-in /login -> /dashboard middleware behavior.
# No auth/session verification boundary is changed.
# -----------------------------------------------------------------------------
$middlewarePath = Join-Path $worktree "src\middleware.ts"
$middleware = Read-NormalizedText $middlewarePath
$middlewareOld = '  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);'
$middlewareNew = @'
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (pathname === "/login" && hasSessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
'@
$middleware = Replace-ExactlyOnce $middleware $middlewareOld $middlewareNew "signed-in login redirect"
Write-Utf8NoBom $middlewarePath $middleware

# -----------------------------------------------------------------------------
# FIX 3: Wrap ONLY the read-only refund eligibility handler in request context.
# getRefundEligibility() and all Stripe/refund business logic remain untouched.
# -----------------------------------------------------------------------------
$refundEligibilityPath = Join-Path $worktree "src\app\api\commerce\refunds\eligibility\route.ts"
$refundEligibilityExpected = @'
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getRefundEligibility } from "@/lib/services/refund-request-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** REFUND-20 — read-only. Lets the customer UI show the exact refund deadline (or why it's unavailable) before ever attempting a submission. Same capability posture as GET /api/commerce/refunds: every authenticated company member may view it. */
export async function GET() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    return apiSuccess(await getRefundEligibility(actor));
  } catch (error) {
    return handleApiError(error);
  }
}
'@
$refundEligibilityNew = @'
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getRefundEligibility } from "@/lib/services/refund-request-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** REFUND-20 — read-only. Lets the customer UI show the exact refund deadline (or why it's unavailable) before ever attempting a submission. Same capability posture as GET /api/commerce/refunds: every authenticated company member may view it. */
const getRefundEligibilityHandler = async () => {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    return apiSuccess(await getRefundEligibility(actor));
  } catch (error) {
    return handleApiError(error);
  }
};

export const GET = withActorRequestContext(getRefundEligibilityHandler);
'@
$refundEligibilityCurrent = Read-NormalizedText $refundEligibilityPath
if ($refundEligibilityCurrent -ne $refundEligibilityExpected) {
  throw "STOP: refund eligibility route differs from reviewed PR #51 content. No refund edit was applied."
}
Write-Utf8NoBom $refundEligibilityPath $refundEligibilityNew

# -----------------------------------------------------------------------------
# FIX 4: Retire ONLY the one-time refund migration HTTP writer.
# Production history already records this migration as separately applied.
# NO Prisma migration is run and NO schema file is changed.
# -----------------------------------------------------------------------------
$oneTimeMigrationRoute = Join-Path $worktree "src\app\api\admin\commerce\refunds\apply-refund-workflow-migration\route.ts"
if (-not (Test-Path -LiteralPath $oneTimeMigrationRoute)) {
  throw "STOP: expected one-time refund migration route is already absent; branch moved."
}
Remove-Item -LiteralPath $oneTimeMigrationRoute -Force

# -----------------------------------------------------------------------------
# FIX 5: Correct ONLY the Arabic test allow-list for legitimate technical names.
# No Arabic dictionary and no TAYQAN worker/runtime file is changed.
# -----------------------------------------------------------------------------
$tayqanTestPath = Join-Path $worktree "tests\worker-tayqan.test.ts"
$tayqan = Read-NormalizedText $tayqanTestPath
$tayqanOld1 = '    const LATIN_PROSE = /[A-Za-z]{2,}/;'
$tayqanNew1 = @'
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
'@
$tayqan = Replace-ExactlyOnce $tayqan $tayqanOld1 $tayqanNew1 "TAYQAN technical identifier allow-list"

$tayqanOld2 = @'
        // Strip the brand name and {vars} interpolation placeholders (e.g.
        // "{count}", "{number}") before checking for stray English prose —
        // those are template syntax, not untranslated presentation text.
        const withoutBrandAndVars = node.replace(/TAYQAN/g, "").replace(/\{\w+\}/g, "");
        if (LATIN_PROSE.test(withoutBrandAndVars)) offenders.push(`${path} = ${JSON.stringify(node)}`);
'@
$tayqanNew2 = @'
        // Strip approved brand/technical identifiers and {vars} interpolation
        // placeholders before checking for stray English prose. The allow-list
        // is intentionally narrow so genuine untranslated English still fails.
        const withoutVars = node.replace(/\{\w+\}/g, "");
        const withoutAllowedIdentifiers = ALLOWED_LATIN_IDENTIFIERS.reduce(
          (value, identifier) => value.split(identifier).join(""),
          withoutVars,
        );
        if (LATIN_PROSE.test(withoutAllowedIdentifiers)) offenders.push(`${path} = ${JSON.stringify(node)}`);
'@
$tayqan = Replace-ExactlyOnce $tayqan $tayqanOld2 $tayqanNew2 "TAYQAN Arabic prose gate"
Write-Utf8NoBom $tayqanTestPath $tayqan

# HARD SCOPE GATE: exactly five paths, nothing else.
Assert-AllowedDiff
Assert-RootProtected $rootBranchBefore $rootHeadBefore $rootTrackedStatusBefore

Write-Host "`nExact repair diff:" -ForegroundColor Green
Invoke-Git $worktree diff --stat
Invoke-Git $worktree diff --check

# Strong DB safety: force the suite to the repository's known local disposable test DB.
# This overrides any DATABASE_URL inherited from Vercel/production shells.
$env:TEST_DATABASE_URL = "postgresql://quantara:quantara_local_password@localhost:5432/quantara_ai_boq_test?schema=public"
Write-Host "TEST_DATABASE_URL forced to localhost disposable test DB." -ForegroundColor Green

Push-Location $worktree
try {
  $npm = (Get-Command npm.cmd -ErrorAction Stop).Source

  # Focused gates: the four known failing test areas + AI Draft regression suite.
  $focusedTests = @(
    "tests/extraction-boq-ui-bridge.test.ts",
    "tests/middleware.test.ts",
    "tests/release-route-integrity.test.ts",
    "tests/worker-tayqan.test.ts",
    "tests/ai-draft-boq-workflow.test.ts"
  )

  # Include any refund/request-context audit tests automatically, without guessing filenames.
  $auditCandidates = Get-ChildItem -LiteralPath (Join-Path $worktree "tests") -Filter "*.test.ts" -File | Where-Object {
    $text = [IO.File]::ReadAllText($_.FullName)
    $text.Contains("setActorContext") -or $text.Contains("withActorRequestContext") -or $text.Contains("refund") -or $text.Contains("Refund")
  } | ForEach-Object { "tests/$($_.Name)" }
  $focusedTests = @($focusedTests + $auditCandidates | Sort-Object -Unique)

  Invoke-Checked "Focused regression tests (LOCAL TEST DB ONLY)" {
    & node "scripts/run-test-suite.mjs" @focusedTests
  }

  Invoke-Checked "Full ESLint" {
    & $npm run lint --silent
  }

  Invoke-Checked "Full TypeScript typecheck" {
    & $npm run typecheck --silent
  }

  # Full release gate: this is the same guarded test runner that refuses non-test DB names.
  Invoke-Checked "Full Vitest suite (LOCAL TEST DB ONLY)" {
    & $npm test --silent
  }
}
finally {
  Pop-Location
}

# Tests/build tools must not have changed tracked source outside the reviewed five paths.
Assert-AllowedDiff
Assert-RootProtected $rootBranchBefore $rootHeadBefore $rootTrackedStatusBefore

# Before commit/push, prove PR #51 did not move while tests were running.
Invoke-Git $root fetch origin "+refs/heads/$remoteBranch`:refs/remotes/origin/$remoteBranch"
$remoteHeadAfterTests = Git-Capture $root rev-parse "refs/remotes/origin/$remoteBranch"
if ($remoteHeadAfterTests -ne $expectedRemoteHead) {
  throw "STOP: PR #51 moved during validation. Tests passed, but nothing will be pushed until re-reviewed."
}
Assert-RootProtected $rootBranchBefore $rootHeadBefore $rootTrackedStatusBefore

# Stage ONLY the five approved paths.
foreach ($path in $allowedPaths) {
  & git -C $worktree add -- $path
  if ($LASTEXITCODE -ne 0) { throw "STOP: failed to stage approved path: $path" }
}

$staged = @(& git -C $worktree diff --cached --name-only)
if ($LASTEXITCODE -ne 0) { throw "STOP: could not inspect staged diff." }
$staged = @($staged | Where-Object { $_ -and $_.Trim() } | ForEach-Object { $_.Trim() })
$stagedUnexpected = @($staged | Where-Object { $allowedPaths -notcontains $_ })
$stagedMissing = @($allowedPaths | Where-Object { $staged -notcontains $_ })
if ($stagedUnexpected.Count -gt 0 -or $stagedMissing.Count -gt 0) {
  throw "STOP: staged scope mismatch. Nothing will be committed."
}

Write-Host "`n=== STAGED FILES (must be exactly five) ===" -ForegroundColor Cyan
$staged | ForEach-Object { Write-Host $_ }
Invoke-Git $worktree diff --cached --check

Invoke-Git $worktree commit -m "fix: restore release integrity gates"
$newCommit = Git-Capture $worktree rev-parse HEAD

# One final remote-head guard immediately before push.
Invoke-Git $root fetch origin "+refs/heads/$remoteBranch`:refs/remotes/origin/$remoteBranch"
$remoteHeadImmediatelyBeforePush = Git-Capture $root rev-parse "refs/remotes/origin/$remoteBranch"
if ($remoteHeadImmediatelyBeforePush -ne $expectedRemoteHead) {
  throw "STOP: PR #51 moved immediately before push. Local commit $newCommit is safe, but nothing was pushed."
}
Assert-RootProtected $rootBranchBefore $rootHeadBefore $rootTrackedStatusBefore

Write-Host "`nPushing ONLY to PR #51 source branch — never main..." -ForegroundColor Yellow
Invoke-Git $worktree push origin "HEAD:refs/heads/$remoteBranch"

Assert-RootProtected $rootBranchBefore $rootHeadBefore $rootTrackedStatusBefore

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "PR #51 CI REPAIR PUSHED SAFELY" -ForegroundColor Green
Write-Host "Commit: $newCommit" -ForegroundColor Green
Write-Host "PR: $prUrl" -ForegroundColor Green
Write-Host "Protected root unchanged: YES" -ForegroundColor Green
Write-Host "Prisma/schema/migrations changed: NO" -ForegroundColor Green
Write-Host "Production DB touched: NO" -ForegroundColor Green
Write-Host "Stripe/refund business logic changed: NO" -ForegroundColor Green
Write-Host "TAYQAN worker/runtime changed: NO" -ForegroundColor Green
Write-Host "Existing reviewed BOQ path restored: YES" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
