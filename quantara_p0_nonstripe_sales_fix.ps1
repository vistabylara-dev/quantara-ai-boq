param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Fail([string]$Message) {
    Write-Host ""
    Write-Host "STOP: $Message" -ForegroundColor Red
    exit 1
}

function Read-Utf8([string]$Path) {
    if (-not (Test-Path $Path)) { Fail "Missing file: $Path" }
    return [System.IO.File]::ReadAllText((Resolve-Path $Path))
}

function Write-Utf8([string]$Path, [string]$Content) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Resolve-Path $Path), $Content, $utf8NoBom)
}

function Replace-RegexOnce(
    [string]$Path,
    [string]$Pattern,
    [string]$Replacement,
    [string]$Description
) {
    $content = Read-Utf8 $Path
    $matches = [regex]::Matches($content, $Pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
    if ($matches.Count -ne 1) {
        Fail "$Description expected exactly 1 match in $Path, found $($matches.Count). No partial edit was written."
    }
    $updated = [regex]::Replace(
        $content,
        $Pattern,
        $Replacement,
        [System.Text.RegularExpressions.RegexOptions]::Multiline
    )
    Write-Utf8 $Path $updated
    Write-Host "PASS: $Description" -ForegroundColor Green
}

function Replace-LiteralOnce(
    [string]$Path,
    [string]$Old,
    [string]$New,
    [string]$Description
) {
    $content = Read-Utf8 $Path
    $first = $content.IndexOf($Old, [System.StringComparison]::Ordinal)
    if ($first -lt 0) {
        Fail "$Description: expected source text was not found in $Path."
    }
    $second = $content.IndexOf($Old, $first + $Old.Length, [System.StringComparison]::Ordinal)
    if ($second -ge 0) {
        Fail "$Description: source text appears more than once in $Path. No ambiguous edit allowed."
    }
    $updated = $content.Substring(0, $first) + $New + $content.Substring($first + $Old.Length)
    Write-Utf8 $Path $updated
    Write-Host "PASS: $Description" -ForegroundColor Green
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Quantara P0 Non-Stripe Sales Readiness Fix" -ForegroundColor Cyan
Write-Host "Autodesk OAuth + self-service auth + reset copy" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# Must be run at repo root.
if (-not (Test-Path ".git")) { Fail "Run this from the Quantara repository root." }

$repoName = Split-Path -Leaf (Get-Location)
Write-Host "Repository: $repoName"

# Protect Claude/son work: require clean tree before branching.
$dirty = git status --porcelain
if ($LASTEXITCODE -ne 0) { Fail "git status failed." }
if ($dirty) {
    Write-Host ""
    git status --short
    Fail "Working tree is not clean. Commit/preserve the current agent/theme work first, then rerun this script."
}

$startSha = (git rev-parse HEAD).Trim()
$startBranch = (git branch --show-current).Trim()
Write-Host "Starting branch: $startBranch"
Write-Host "Starting SHA:    $startSha"

$branch = "fix/sales-readiness-p0-nonstripe"
$existingBranch = git branch --list $branch
if ($existingBranch) {
    Fail "Branch $branch already exists. Delete/rename it only if you know it is safe, then rerun."
}

git switch -c $branch
if ($LASTEXITCODE -ne 0) { Fail "Could not create isolated branch $branch." }

# ---------------------------------------------------------------------
# P0-1 AUTODESK: OAuth success must not depend on accessible hubs.
# ---------------------------------------------------------------------
$service = "src/lib/services/autodesk-integration-service.ts"

Replace-RegexOnce `
    $service `
    '(?m)^\s*verifyAutodeskAccess,\r?\n' `
    '' `
    "Remove hub-probe dependency import from Autodesk connection service"

Replace-LiteralOnce `
    $service `
    '  await verifyAutodeskAccess(token.access_token);' `
    '  // OAuth completion is proven by token exchange + token introspection above. Hub/data access is a separate provisioning boundary and must not invalidate a valid Autodesk authorization.' `
    "Do not fail a valid Autodesk OAuth callback just because GET hubs is unavailable"

Replace-LiteralOnce `
    $service `
    '    await verifyAutodeskAccess(accessToken);' `
    '    await getVerifiedAutodeskReadScope(accessToken);' `
    "Use OAuth token introspection—not hub availability—as the connected-state proof"

# ---------------------------------------------------------------------
# P0-1b AUTODESK: make hub provisioning failure actionable.
# ---------------------------------------------------------------------
$client = "src/lib/integrations/connectors/autodesk-client.ts"

$old403 = @'
  if (response.status === 403) {
    throw new AppError("AUTODESK_ACCESS_DENIED", "Autodesk denied access to this cloud resource.", 403);
  }
'@

$new403 = @'
  if (response.status === 403) {
    if (operation === "list hubs") {
      throw new AppError(
        "AUTODESK_HUB_ACCESS_REQUIRED",
        "Autodesk sign-in succeeded, but this account has no Autodesk Docs/BIM 360 hub that Quantara can access. Ask an Autodesk account administrator to provision the Quantara APS Client ID as a custom integration, then try again.",
        403,
      );
    }
    throw new AppError("AUTODESK_ACCESS_DENIED", "Autodesk denied access to this cloud resource.", 403);
  }
'@

# Normalize line endings only for matching the small target block.
$clientContent = Read-Utf8 $client
$clientNormalized = $clientContent -replace "`r`n", "`n"
$old403Normalized = $old403 -replace "`r`n", "`n"
$new403Normalized = $new403 -replace "`r`n", "`n"
$count403 = ([regex]::Matches($clientNormalized, [regex]::Escape($old403Normalized))).Count
if ($count403 -ne 1) {
    Fail "Autodesk 403 handling block expected exactly once in $client, found $count403."
}
$clientNormalized = $clientNormalized.Replace($old403Normalized, $new403Normalized)
# Preserve CRLF if the original file used it.
if ($clientContent.Contains("`r`n")) { $clientNormalized = $clientNormalized -replace "`n", "`r`n" }
Write-Utf8 $client $clientNormalized
Write-Host "PASS: Distinguish Autodesk hub provisioning/access from OAuth failure" -ForegroundColor Green

# ---------------------------------------------------------------------
# P0-1c AUTODESK: expose safe callback error code for diagnosis.
# ---------------------------------------------------------------------
$connectPage = "src/app/integrations/autodesk/connect/page.tsx"

$oldQuery = @'
    const queryError = new URLSearchParams(window.location.search).get("connectError");
    if (queryError) setConnectError(t("integrations.autodesk.connectionError"));
'@
$newQuery = @'
    const queryError = new URLSearchParams(window.location.search).get("connectError");
    if (queryError) {
      const safeCode = /^[A-Z0-9_]{1,64}$/.test(queryError) ? queryError : null;
      setConnectError(
        safeCode
          ? `${t("integrations.autodesk.connectionError")} (${safeCode})`
          : t("integrations.autodesk.connectionError"),
      );
    }
'@
$pageContent = Read-Utf8 $connectPage
$pageNorm = $pageContent -replace "`r`n", "`n"
$oldQueryNorm = $oldQuery -replace "`r`n", "`n"
$newQueryNorm = $newQuery -replace "`r`n", "`n"
$countQuery = ([regex]::Matches($pageNorm, [regex]::Escape($oldQueryNorm))).Count
if ($countQuery -ne 1) {
    Fail "Autodesk connectError display block expected exactly once in $connectPage, found $countQuery."
}
$pageNorm = $pageNorm.Replace($oldQueryNorm, $newQueryNorm)
if ($pageContent.Contains("`r`n")) { $pageNorm = $pageNorm -replace "`n", "`r`n" }
Write-Utf8 $connectPage $pageNorm
Write-Host "PASS: Show safe Autodesk callback error code without exposing secrets" -ForegroundColor Green

# ---------------------------------------------------------------------
# P0-2 SELF-SERVICE ACCOUNT ACTIVATION.
# Keep email verification mandatory, remove manual owner approval gate.
# ---------------------------------------------------------------------
$auth = "src/lib/services/auth-service.ts"

Replace-LiteralOnce `
    $auth `
    'buildPasswordResetEmail, buildVerificationEmail, buildAdminApprovalRequestEmail, buildAccountApprovedEmail' `
    'buildPasswordResetEmail, buildVerificationEmail, buildAccountApprovedEmail' `
    "Remove obsolete admin-approval email template from registration path"

Replace-LiteralOnce `
    $auth `
    '  const { user, company } = await prisma.$transaction(async (tx) => {' `
    '  const { user } = await prisma.$transaction(async (tx) => {' `
    "Registration no longer waits on a separate company approval result"

Replace-LiteralOnce `
    $auth `
    '        isActive: false, // Wait for admin approval' `
    '        isActive: true, // Self-service SaaS: login still remains blocked until emailVerifiedAt is set.' `
    "Make new accounts self-service while preserving mandatory email verification"

Replace-LiteralOnce `
    $auth `
    '    return { company, user: createdUser };' `
    '    return { user: createdUser };' `
    "Return only the created user from the registration transaction"

$approvalBlockPattern = '(?ms)\r?\n\s*const adminEmail = process\.env\.DEV_OWNER_EMAIL \|\| "admin@quantara\.ai";\r?\n\s*const adminUrl = `\$\{appBaseUrl\(\)\}/admin/users/\$\{user\.id\}`;\r?\n\s*const approvalEmail = buildAdminApprovalRequestEmail\(adminUrl, company\.legalName, user\.fullName\);\r?\n\s*await sendAuthEmail\(\{ to: adminEmail, subject: approvalEmail\.subject, html: approvalEmail\.html, text: approvalEmail\.text \}\);\r?\n'
Replace-RegexOnce `
    $auth `
    $approvalBlockPattern `
    "`r`n" `
    "Remove obsolete manual-admin-approval email from self-service registration"

# ---------------------------------------------------------------------
# P1 PASSWORD RESET: remove public 'development console' copy.
# ---------------------------------------------------------------------
$forgot = "src/app/forgot-password/page.tsx"

$oldForgot = @'
          <p className="mt-3 text-sm text-slate-400">
            If an account exists for that email, a reset link has been created. In this
            development environment it is printed to the server console instead of sent by
            email.
          </p>
'@
$newForgot = @'
          <p className="mt-3 text-sm text-slate-400">
            If an account exists for that email, we sent a password reset link. Check your
            inbox and spam folder, then follow the secure link to choose a new password.
          </p>
'@
$forgotContent = Read-Utf8 $forgot
$forgotNorm = $forgotContent -replace "`r`n", "`n"
$oldForgotNorm = $oldForgot -replace "`r`n", "`n"
$newForgotNorm = $newForgot -replace "`r`n", "`n"
$countForgot = ([regex]::Matches($forgotNorm, [regex]::Escape($oldForgotNorm))).Count
if ($countForgot -ne 1) {
    Fail "Forgot-password development copy expected exactly once in $forgot, found $countForgot."
}
$forgotNorm = $forgotNorm.Replace($oldForgotNorm, $newForgotNorm)
if ($forgotContent.Contains("`r`n")) { $forgotNorm = $forgotNorm -replace "`n", "`r`n" }
Write-Utf8 $forgot $forgotNorm
Write-Host "PASS: Remove development-only password reset message" -ForegroundColor Green

Write-Host ""
Write-Host "Changed files:" -ForegroundColor Cyan
git status --short

$changed = @(git diff --name-only)
$allowed = @(
    "src/lib/services/autodesk-integration-service.ts",
    "src/lib/integrations/connectors/autodesk-client.ts",
    "src/app/integrations/autodesk/connect/page.tsx",
    "src/lib/services/auth-service.ts",
    "src/app/forgot-password/page.tsx"
)

$unexpected = @($changed | Where-Object { $_ -notin $allowed })
if ($unexpected.Count -gt 0) {
    Write-Host ($unexpected -join "`n") -ForegroundColor Red
    Fail "Unexpected files changed."
}

Write-Host ""
Write-Host "Running focused validation..." -ForegroundColor Cyan

npx vitest run tests/autodesk-integration.test.ts tests/auth-email.test.ts
if ($LASTEXITCODE -ne 0) { Fail "Focused Vitest validation failed. Changes remain on isolated branch for inspection." }

npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { Fail "TypeScript validation failed. Changes remain on isolated branch for inspection." }

if (-not $SkipBuild) {
    npm run build
    if ($LASTEXITCODE -ne 0) { Fail "Production build failed. Changes remain on isolated branch for inspection." }
}

git diff --check
if ($LASTEXITCODE -ne 0) { Fail "git diff --check failed." }

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "P0 NON-STRIPE PATCH VALIDATED" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host "Branch: $branch"
Write-Host "Started from: $startSha"
Write-Host ""
Write-Host "Review the diff:" -ForegroundColor Yellow
Write-Host "  git diff"
Write-Host ""
Write-Host "If correct, commit and push:" -ForegroundColor Yellow
Write-Host '  git add src/lib/services/autodesk-integration-service.ts src/lib/integrations/connectors/autodesk-client.ts src/app/integrations/autodesk/connect/page.tsx src/lib/services/auth-service.ts src/app/forgot-password/page.tsx'
Write-Host '  git commit -m "fix: close non-stripe sales readiness blockers"'
Write-Host '  git push -u origin fix/sales-readiness-p0-nonstripe'
Write-Host ""
Write-Host "Do NOT deploy this branch over Claude Stripe/theme work directly." -ForegroundColor Yellow
Write-Host "Cherry-pick/merge this small commit into the final integrated release after those lanes land."
