$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " QUANTARA - REAL PRODUCTION UI RECORDER" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path ".\package.json")) {
    Write-Host "Run this from your quantara-ai-boq repository root." -ForegroundColor Red
    Write-Host "Example:" -ForegroundColor Yellow
    Write-Host '  cd "$env:USERPROFILE\Desktop\quantara-ai-boq"' -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path ".\node_modules\@playwright\test")) {
    Write-Host "@playwright/test is not installed in this checkout." -ForegroundColor Red
    Write-Host "Run your normal project dependency install first (npm install / npm ci), then run this again." -ForegroundColor Yellow
    exit 1
}

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Recorder = Join-Path $Here "record-quantara-real.mjs"

Write-Host "The browser will open the REAL site:" -ForegroundColor Green
Write-Host "https://quantara.vistabylara.com" -ForegroundColor White
Write-Host ""
Write-Host "Login occurs BEFORE recording starts, so your password is not captured." -ForegroundColor Green
Write-Host "After login, Playwright records the actual production UI and performs the tutorial workflow." -ForegroundColor Green
Write-Host ""

node $Recorder
if ($LASTEXITCODE -ne 0) {
    throw "Recorder exited with code $LASTEXITCODE"
}

Write-Host ""
Write-Host "Finished. Check:" -ForegroundColor Cyan
Write-Host ".\tutorial-recording\final\" -ForegroundColor White
