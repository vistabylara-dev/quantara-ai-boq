$ErrorActionPreference = "Stop"

Write-Host "Starting Phase 8 Validation..." -ForegroundColor Cyan

Write-Host "`n1. Running Next.js Lint..." -ForegroundColor Yellow
npm run lint

Write-Host "`n2. Running TypeScript Compiler Check..." -ForegroundColor Yellow
npx tsc --noEmit

Write-Host "`n3. Running Production Build..." -ForegroundColor Yellow
npm run build

Write-Host "`nAll validation checks passed successfully." -ForegroundColor Green
