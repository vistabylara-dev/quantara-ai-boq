param(
    [string]$BaseSha = "ca1dea551fa2e4ddd79705f5c47b213fb70ac579",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Fail([string]$Message) {
    Write-Host ""
    Write-Host ("STOP: {0}" -f $Message) -ForegroundColor Red
    exit 1
}

function Read-Utf8([string]$Path) {
    if (-not (Test-Path $Path)) { Fail ("Missing file: {0}" -f $Path) }
    return [System.IO.File]::ReadAllText((Resolve-Path $Path))
}

function Write-Utf8([string]$Path, [string]$Content) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Resolve-Path $Path), $Content, $utf8NoBom)
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
        Fail ("{0}: expected source text was not found in {1}" -f $Description, $Path)
    }
    $second = $content.IndexOf($Old, $first + $Old.Length, [System.StringComparison]::Ordinal)
    if ($second -ge 0) {
        Fail ("{0}: source text appears more than once in {1}; refusing ambiguous edit" -f $Description, $Path)
    }
    $updated = $content.Substring(0, $first) + $New + $content.Substring($first + $Old.Length)
    Write-Utf8 $Path $updated
    Write-Host ("PASS: {0}" -f $Description) -ForegroundColor Green
}

function Replace-RegexOnce(
    [string]$Path,
    [string]$Pattern,
    [string]$Replacement,
    [string]$Description
) {
    $content = Read-Utf8 $Path
    $options = [System.Text.RegularExpressions.RegexOptions]::Multiline
    $matches = [regex]::Matches($content, $Pattern, $options)
    if ($matches.Count -ne 1) {
        Fail ("{0}: expected exactly 1 match in {1}, found {2}" -f $Description, $Path, $matches.Count)
    }
    $updated = [regex]::Replace($content, $Pattern, $Replacement, $options)
    Write-Utf8 $Path $updated
    Write-Host ("PASS: {0}" -f $Description) -ForegroundColor Green
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Quantara P0 Sales Readiness - Isolated Worktree Fix" -ForegroundColor Cyan
Write-Host "Autodesk OAuth + self-service auth + reset copy" -ForegroundColor Cyan
Write-Host "NO STRIPE. NO THEME." -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$mainRepo = Join-Path $env:USERPROFILE "Desktop\quantara-ai-boq"
$worktree = Join-Path $env:USERPROFILE "Desktop\quantara-ai-boq.p0-sales"
$branch = "fix/sales-readiness-p0-nonstripe"

if (-not (Test-Path (Join-Path $mainRepo ".git"))) {
    Fail ("Main Quantara repo not found at {0}" -f $mainRepo)
}

Set-Location $mainRepo

Write-Host ("Main repo: {0}" -f $mainRepo)
Write-Host "Your dirty main working tree is intentionally left untouched." -ForegroundColor Yellow

# Make sure the exact audited base commit exists locally. Fetching does not modify the dirty worktree.
git cat-file -e "$BaseSha^{commit}" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host ("Base SHA {0} is not local; fetching origin..." -f $BaseSha) -ForegroundColor Yellow
    git fetch origin --prune
    if ($LASTEXITCODE -ne 0) { Fail "git fetch origin failed." }
    git cat-file -e "$BaseSha^{commit}" 2>$null
    if ($LASTEXITCODE -ne 0) { Fail ("Base SHA {0} is still unavailable after fetch." -f $BaseSha) }
}

if (Test-Path $worktree) {
    Fail ("Isolated worktree path already exists: {0}" -f $worktree)
}

git show-ref --verify --quiet ("refs/heads/{0}" -f $branch)
if ($LASTEXITCODE -eq 0) {
    Fail ("Local branch already exists: {0}" -f $branch)
}

Write-Host ""
Write-Host ("Creating clean isolated worktree at {0}" -f $worktree) -ForegroundColor Cyan
git worktree add -b $branch $worktree $BaseSha
if ($LASTEXITCODE -ne 0) { Fail "git worktree add failed." }

Set-Location $worktree

$head = (git rev-parse HEAD).Trim()
if ($head -ne $BaseSha) {
    Fail ("Worktree HEAD mismatch. Expected {0}, got {1}" -f $BaseSha, $head)
}

$initialDirty = git status --porcelain
if ($initialDirty) {
    Fail "New isolated worktree is unexpectedly dirty."
}

Write-Host ("Isolated branch: {0}" -f $branch) -ForegroundColor Green
Write-Host ("Starting SHA:    {0}" -f $head) -ForegroundColor Green

# ---------------------------------------------------------------------
# P0-1 AUTODESK: OAuth success must not depend on accessible hubs.
# ---------------------------------------------------------------------
$service = "src/lib/services/autodesk-integration-service.ts"

Replace-RegexOnce `
    $service `
    '(?m)^\s*verifyAutodeskAccess,\r?\n' `
    '' `
    "Remove hub-probe import from Autodesk OAuth completion"

Replace-LiteralOnce `
    $service `
    '  await verifyAutodeskAccess(token.access_token);' `
    '  // Token exchange + introspection above prove OAuth authorization. Hub access is a separate Autodesk account-provisioning boundary and must not invalidate a valid connection.' `
    "Preserve valid Autodesk OAuth even when hub access is unavailable"

Replace-LiteralOnce `
    $service `
    '    await verifyAutodeskAccess(accessToken);' `
    '    await getVerifiedAutodeskReadScope(accessToken);' `
    "Use token introspection instead of hub listing for CONNECTED runtime status"

# ---------------------------------------------------------------------
# P0-1b AUTODESK: surface a specific provisioning/access error for hubs.
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

$clientContent = Read-Utf8 $client
$clientNorm = $clientContent -replace "`r`n", "`n"
$old403Norm = $old403 -replace "`r`n", "`n"
$new403Norm = $new403 -replace "`r`n", "`n"
$count403 = ([regex]::Matches($clientNorm, [regex]::Escape($old403Norm))).Count
if ($count403 -ne 1) {
    Fail ("Autodesk 403 block expected once in {0}, found {1}" -f $client, $count403)
}
$clientNorm = $clientNorm.Replace($old403Norm, $new403Norm)
if ($clientContent.Contains("`r`n")) { $clientNorm = $clientNorm -replace "`n", "`r`n" }
Write-Utf8 $client $clientNorm
Write-Host "PASS: Distinguish Autodesk hub provisioning from OAuth authorization" -ForegroundColor Green

# ---------------------------------------------------------------------
# P0-1c AUTODESK: retain safe callback code in the UI for diagnosis.
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
    Fail ("Autodesk connectError UI block expected once in {0}, found {1}" -f $connectPage, $countQuery)
}
$pageNorm = $pageNorm.Replace($oldQueryNorm, $newQueryNorm)
if ($pageContent.Contains("`r`n")) { $pageNorm = $pageNorm -replace "`n", "`r`n" }
Write-Utf8 $connectPage $pageNorm
Write-Host "PASS: Show safe Autodesk callback error code in UI" -ForegroundColor Green

# ---------------------------------------------------------------------
# P0-2 SELF-SERVICE ACCOUNT ACTIVATION:
# active account immediately, but login remains blocked until emailVerifiedAt.
# ---------------------------------------------------------------------
$auth = "src/lib/services/auth-service.ts"

Replace-LiteralOnce `
    $auth `
    'buildPasswordResetEmail, buildVerificationEmail, buildAdminApprovalRequestEmail, buildAccountApprovedEmail' `
    'buildPasswordResetEmail, buildVerificationEmail, buildAccountApprovedEmail' `
    "Remove obsolete registration admin-approval email template import"

Replace-LiteralOnce `
    $auth `
    '  const { user, company } = await prisma.$transaction(async (tx) => {' `
    '  const { user } = await prisma.$transaction(async (tx) => {' `
    "Remove outer dependency on manual company approval"

Replace-LiteralOnce `
    $auth `
    '        isActive: false, // Wait for admin approval' `
    '        isActive: true, // Self-service SaaS; login still requires emailVerifiedAt.' `
    "Enable self-service registration while preserving mandatory email verification"

Replace-LiteralOnce `
    $auth `
    '    return { company, user: createdUser };' `
    '    return { user: createdUser };' `
    "Return only created user from registration transaction"

$authContent = Read-Utf8 $auth
$authNorm = $authContent -replace "`r`n", "`n"
$approvalBlock = @'
  const adminEmail = process.env.DEV_OWNER_EMAIL || "admin@quantara.ai";
  const adminUrl = `${appBaseUrl()}/admin/users/${user.id}`;
  const approvalEmail = buildAdminApprovalRequestEmail(adminUrl, company.legalName, user.fullName);
  await sendAuthEmail({ to: adminEmail, subject: approvalEmail.subject, html: approvalEmail.html, text: approvalEmail.text });

'@
$approvalNorm = $approvalBlock -replace "`r`n", "`n"
$countApproval = ([regex]::Matches($authNorm, [regex]::Escape($approvalNorm))).Count
if ($countApproval -ne 1) {
    Fail ("Manual registration approval-email block expected once in {0}, found {1}" -f $auth, $countApproval)
}
$authNorm = $authNorm.Replace($approvalNorm, "")
if ($authContent.Contains("`r`n")) { $authNorm = $authNorm -replace "`n", "`r`n" }
Write-Utf8 $auth $authNorm
Write-Host "PASS: Remove manual admin-approval step from new-customer registration" -ForegroundColor Green

# ---------------------------------------------------------------------
# P1 PASSWORD RESET: remove development-console wording.
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
    Fail ("Forgot-password development copy expected once in {0}, found {1}" -f $forgot, $countForgot)
}
$forgotNorm = $forgotNorm.Replace($oldForgotNorm, $newForgotNorm)
if ($forgotContent.Contains("`r`n")) { $forgotNorm = $forgotNorm -replace "`n", "`r`n" }
Write-Utf8 $forgot $forgotNorm
Write-Host "PASS: Replace development-only password-reset copy" -ForegroundColor Green

# ---------------------------------------------------------------------
# Scope guard
# ---------------------------------------------------------------------
$allowed = @(
    "src/lib/services/autodesk-integration-service.ts",
    "src/lib/integrations/connectors/autodesk-client.ts",
    "src/app/integrations/autodesk/connect/page.tsx",
    "src/lib/services/auth-service.ts",
    "src/app/forgot-password/page.tsx"
)
$changed = @(git diff --name-only)
$unexpected = @($changed | Where-Object { $_ -notin $allowed })
if ($unexpected.Count -gt 0) {
    Write-Host ($unexpected -join "`n") -ForegroundColor Red
    Fail "Unexpected files changed; refusing to continue."
}

Write-Host ""
Write-Host "Changed files:" -ForegroundColor Cyan
git status --short

Write-Host ""
Write-Host "Running focused tests..." -ForegroundColor Cyan
npx vitest run tests/autodesk-integration.test.ts tests/auth-email.test.ts
if ($LASTEXITCODE -ne 0) { Fail "Focused tests failed. The isolated worktree has been preserved for inspection." }

Write-Host ""
Write-Host "Running TypeScript..." -ForegroundColor Cyan
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { Fail "TypeScript failed. The isolated worktree has been preserved for inspection." }

if (-not $SkipBuild) {
    Write-Host ""
    Write-Host "Running production build..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) { Fail "Production build failed. The isolated worktree has been preserved for inspection." }
}

git diff --check
if ($LASTEXITCODE -ne 0) { Fail "git diff --check failed." }

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host "P0 NON-STRIPE SALES PATCH VALIDATED" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ("Worktree: {0}" -f $worktree)
Write-Host ("Branch:   {0}" -f $branch)
Write-Host ("Base SHA: {0}" -f $BaseSha)
Write-Host ""
Write-Host "Nothing in your original dirty Quantara folder was modified." -ForegroundColor Green
Write-Host ""
Write-Host "NEXT COMMANDS:" -ForegroundColor Yellow
Write-Host ("  cd `"{0}`"" -f $worktree)
Write-Host '  git diff'
Write-Host '  git add src/lib/services/autodesk-integration-service.ts src/lib/integrations/connectors/autodesk-client.ts src/app/integrations/autodesk/connect/page.tsx src/lib/services/auth-service.ts src/app/forgot-password/page.tsx'
Write-Host '  git commit -m "fix: close non-stripe sales readiness blockers"'
Write-Host '  git push -u origin fix/sales-readiness-p0-nonstripe'
Write-Host ""
Write-Host "Do NOT merge/deploy over Claude Stripe or theme work yet." -ForegroundColor Yellow
Write-Host "After those lanes finish, cherry-pick this one small commit into the final integrated release."
