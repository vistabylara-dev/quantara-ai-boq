param(
    [ValidateSet("Apply", "Verify", "Rollback")]
    [string]$Mode = "Apply"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# V4 deliberately never patches the user's current working tree.
# It fetches origin/main, verifies the audited BOQ blobs, creates an isolated worktree,
# applies only the additive measurement layer there, and runs targeted verification before staging.
$BranchName = "fix/ai-measurement-inference-20260817-v4"

$ServicePath = "src/lib/services/ai-draft-boq-service.ts"
$BoqPagePath = "src/app/projects/[projectId]/boq/page.tsx"
$InferencePath = "src/lib/guidance/ai-measurement-inference.ts"
$TestPath = "tests/ai-measurement-inference.test.ts"

$ExpectedServiceBlob = "b7c37c7d57c034fddbb3b063f2258ee26fe21435"
$ExpectedBoqPageBlob = "abee86db8f74991bd23673680c1b1bd235231631"

$SourceRepoRoot = ""
$WorktreePath = ""

function Stop-IfLastExitCode {
    param([string]$Message)
    if ($LASTEXITCODE -ne 0) {
        throw $Message
    }
}

function Write-Utf8NoBomLf {
    param(
        [string]$Path,
        [string]$Content
    )
    $normalized = $Content.Replace("`r`n", "`n").Replace("`r", "`n")
    $utf8 = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) $Path), $normalized, $utf8)
}

function Replace-Exact {
    param(
        [string]$Path,
        [string]$Old,
        [string]$New,
        [string]$Label
    )

    $fullPath = Join-Path (Get-Location) $Path
    $content = [System.IO.File]::ReadAllText($fullPath).Replace("`r`n", "`n").Replace("`r", "`n")
    $oldNormalized = $Old.Replace("`r`n", "`n").Replace("`r", "`n")
    $newNormalized = $New.Replace("`r`n", "`n").Replace("`r", "`n")

    $first = $content.IndexOf($oldNormalized, [System.StringComparison]::Ordinal)
    if ($first -lt 0) {
        throw "PATCH GUARD FAILED [$Label]: expected source block was not found in $Path."
    }
    $second = $content.IndexOf($oldNormalized, $first + $oldNormalized.Length, [System.StringComparison]::Ordinal)
    if ($second -ge 0) {
        throw "PATCH GUARD FAILED [$Label]: source block appears more than once in $Path."
    }

    $updated = $content.Substring(0, $first) + $newNormalized + $content.Substring($first + $oldNormalized.Length)
    Write-Utf8NoBomLf -Path $Path -Content $updated
}

function Resolve-SourceRepo {
    $root = (& git rev-parse --show-toplevel 2>$null)
    Stop-IfLastExitCode "STOP: Run this while your PowerShell is inside the quantara-ai-boq repository."

    $script:SourceRepoRoot = $root.Trim()
    Set-Location $script:SourceRepoRoot

    $origin = (& git config --get remote.origin.url)
    if ($origin -notmatch "vistabylara-dev/quantara-ai-boq") {
        throw "STOP: Wrong repository. Expected vistabylara-dev/quantara-ai-boq, got: $origin"
    }

    $parent = Split-Path $script:SourceRepoRoot -Parent
    $script:WorktreePath = Join-Path $parent "quantara-ai-measurement-fix-v4"
}

function Get-CommitBlob {
    param(
        [string]$Ref,
        [string]$Path
    )
    $blob = (& git rev-parse "$Ref`:$Path" 2>$null)
    Stop-IfLastExitCode "STOP: $Path is not present at $Ref."
    if (-not $blob) {
        throw "STOP: Git returned no blob for $Path at $Ref."
    }
    return $blob.Trim()
}

function Assert-AuditedBlobsAtRef {
    param([string]$Ref)

    $serviceBlob = Get-CommitBlob -Ref $Ref -Path $ServicePath
    $boqBlob = Get-CommitBlob -Ref $Ref -Path $BoqPagePath

    if ($serviceBlob -ne $ExpectedServiceBlob) {
        throw "STOP: $ServicePath at $Ref changed since the audit. Expected $ExpectedServiceBlob, found $serviceBlob. Nothing will be patched."
    }
    if ($boqBlob -ne $ExpectedBoqPageBlob) {
        throw "STOP: $BoqPagePath at $Ref changed since the audit. Expected $ExpectedBoqPageBlob, found $boqBlob. Nothing will be patched."
    }
}

function Assert-NoTargetEdits {
    $dirty = (& git --literal-pathspecs status --porcelain -- $ServicePath $BoqPagePath)
    if ($dirty) {
        Write-Host $dirty -ForegroundColor Yellow
        throw "STOP: Isolated target files are unexpectedly modified before patching."
    }
    if (Test-Path $InferencePath) {
        throw "STOP: $InferencePath already exists in the isolated worktree."
    }
    if (Test-Path $TestPath) {
        throw "STOP: $TestPath already exists in the isolated worktree."
    }
}

function Connect-ExistingNodeModules {
    $sourceNodeModules = Join-Path $SourceRepoRoot "node_modules"
    $worktreeNodeModules = Join-Path $WorktreePath "node_modules"

    if (Test-Path $worktreeNodeModules) {
        return
    }

    if (-not (Test-Path $sourceNodeModules)) {
        throw "STOP: node_modules is missing from the original repository. This safe patch will not run npm install/postinstall or Prisma generation automatically."
    }

    Write-Host "Reusing existing node_modules through a worktree-only junction..." -ForegroundColor DarkGray
    New-Item -ItemType Junction -Path $worktreeNodeModules -Target $sourceNodeModules | Out-Null
}

function Invoke-Verification {
    Write-Host "`n=== 1. NO PRISMA / MIGRATION CHANGE ===" -ForegroundColor Cyan
    $prismaDiff = (& git --literal-pathspecs status --porcelain -- prisma)
    if ($prismaDiff) {
        Write-Host $prismaDiff -ForegroundColor Red
        throw "STOP: Prisma/migration content changed inside the isolated patch."
    }
    Write-Host "PASS: prisma/ untouched." -ForegroundColor Green

    Write-Host "`n=== 2. ONLY FOUR ALLOWED FILES MAY CHANGE ===" -ForegroundColor Cyan
    $changed = @(
        & git status --porcelain |
        ForEach-Object {
            if ($_.Length -ge 4) { $_.Substring(3).Trim() }
        } |
        Where-Object { $_ }
    )

    $allowed = @(
        $InferencePath,
        $ServicePath,
        $BoqPagePath,
        $TestPath
    )

    $unexpected = @($changed | Where-Object { $_ -notin $allowed -and $_ -notlike "node_modules*" })
    if ($unexpected.Count -gt 0) {
        Write-Host ($unexpected -join "`n") -ForegroundColor Red
        throw "STOP: Unexpected files changed in the isolated worktree."
    }
    Write-Host "PASS: changes are limited to the measurement module, AI Draft service, BOQ review copy, and tests." -ForegroundColor Green

    Write-Host "`n=== 3. TARGETED AI MEASUREMENT TESTS ===" -ForegroundColor Cyan
    & npx vitest run tests/ai-measurement-inference.test.ts tests/ai-draft-boq-workflow.test.ts
    Stop-IfLastExitCode "STOP: targeted Vitest suite failed."

    Write-Host "`n=== 4. TARGETED ESLINT ===" -ForegroundColor Cyan
    & npx eslint `
        $InferencePath `
        $ServicePath `
        $BoqPagePath `
        $TestPath `
        --max-warnings=0
    Stop-IfLastExitCode "STOP: targeted ESLint failed."

    Write-Host "`n=== 5. TARGET-ONLY TYPESCRIPT CHECK ===" -ForegroundColor Cyan
    $targetTsconfig = ".quantara-ai-measurement-tsconfig.json"
    $targetTsconfigContent = @'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "incremental": false
  },
  "files": [
    "src/lib/guidance/ai-measurement-inference.ts",
    "src/lib/services/ai-draft-boq-service.ts",
    "src/app/projects/[projectId]/boq/page.tsx",
    "tests/ai-measurement-inference.test.ts"
  ],
  "include": []
}
'@
    Write-Utf8NoBomLf -Path $targetTsconfig -Content $targetTsconfigContent
    try {
        & npx tsc -p $targetTsconfig --pretty false
        Stop-IfLastExitCode "STOP: target-only TypeScript check failed."
    }
    finally {
        if (Test-Path $targetTsconfig) {
            Remove-Item $targetTsconfig -Force
        }
    }
    Write-Host "PASS: target-only TypeScript check passed." -ForegroundColor Green
    Write-Host "NOTE: Full-repo typecheck is intentionally not used here because the current shared generated Prisma client produces unrelated refund/TAYQAN/worker baseline errors. No Prisma generate or DB action was run." -ForegroundColor Yellow

    Write-Host "`n=== 6. DIFF CHECK ===" -ForegroundColor Cyan
    & git --literal-pathspecs diff --check -- $InferencePath $ServicePath $BoqPagePath $TestPath
    Stop-IfLastExitCode "STOP: git diff --check failed."

    Write-Host "`n=== VERIFIED CHANGESET ===" -ForegroundColor Green
    & git --literal-pathspecs diff --stat -- $InferencePath $ServicePath $BoqPagePath $TestPath
    & git --literal-pathspecs status --short -- $InferencePath $ServicePath $BoqPagePath $TestPath
}

function Invoke-Rollback {
    Resolve-SourceRepo
    Set-Location $SourceRepoRoot

    $registered = @(
        & git worktree list --porcelain |
        Where-Object { $_ -eq "worktree $WorktreePath" }
    )

    if ($registered.Count -gt 0) {
        Write-Host "Removing registered isolated V4 worktree..." -ForegroundColor Yellow
        & git worktree remove --force $WorktreePath
        Stop-IfLastExitCode "STOP: Could not remove registered V4 worktree."
    }
    elseif (Test-Path -LiteralPath $WorktreePath) {
        Write-Host "Removing stale isolated V4 folder only..." -ForegroundColor Yellow
        $junction = Join-Path $WorktreePath "node_modules"
        if (Test-Path -LiteralPath $junction) {
            & cmd /c "rmdir `"$junction`"" | Out-Null
        }
        Remove-Item -LiteralPath $WorktreePath -Recurse -Force
    }

    & git worktree prune

    $branchExists = [string](& git branch --list $BranchName)
    if ($branchExists.Trim()) {
        & git branch -D $BranchName
        Stop-IfLastExitCode "STOP: Could not delete isolated branch $BranchName."
    }

    Write-Host "Rollback complete. Original quantara-ai-boq working tree was never modified by V4." -ForegroundColor Green
}

Resolve-SourceRepo

if ($Mode -eq "Rollback") {
    Invoke-Rollback
    exit 0
}

if ($Mode -eq "Verify") {
    if (-not (Test-Path $WorktreePath)) {
        throw "STOP: Isolated worktree does not exist: $WorktreePath"
    }
    Set-Location $WorktreePath
    Connect-ExistingNodeModules
    Invoke-Verification
    exit 0
}

Write-Host "`n=== ORIGINAL REPO PROTECTION ===" -ForegroundColor Cyan
Write-Host "Original repo: $SourceRepoRoot"
Write-Host "Its current branch and uncommitted files will NOT be patched or staged." -ForegroundColor Green
& git status --short

Write-Host "`n=== REFRESH ORIGIN/MAIN ===" -ForegroundColor Cyan
& git fetch origin main --prune
Stop-IfLastExitCode "STOP: Could not fetch origin/main."

$originMain = (& git rev-parse origin/main).Trim()
Write-Host "origin/main: $originMain"

Assert-AuditedBlobsAtRef -Ref "origin/main"
Write-Host "PASS: audited BOQ service/page blobs still match origin/main." -ForegroundColor Green

if (Test-Path $WorktreePath) {
    throw "STOP: Isolated worktree already exists: $WorktreePath. Run V4 with -Mode Rollback before retrying."
}

$branchExists = [string](& git branch --list $BranchName)
if ($branchExists) {
    throw "STOP: Isolated branch $BranchName already exists. Run V4 with -Mode Rollback before retrying."
}

Write-Host "`n=== CREATE ISOLATED WORKTREE ===" -ForegroundColor Cyan
& git worktree add -b $BranchName $WorktreePath origin/main
Stop-IfLastExitCode "STOP: Could not create isolated worktree."

Set-Location $WorktreePath
Assert-AuditedBlobsAtRef -Ref "HEAD"
Assert-NoTargetEdits
Connect-ExistingNodeModules

Write-Host "Isolated worktree: $WorktreePath" -ForegroundColor Green
Write-Host "Branch: $BranchName" -ForegroundColor Green
Write-Host "Base: $originMain" -ForegroundColor Green

$prismaBefore = (& git --literal-pathspecs diff --binary -- prisma | Out-String)

$newModuleContent = @'
export const AI_MEASUREMENT_SUGGESTION_MARKER = "AI_MEASUREMENT_SUGGESTION" as const;

export type AiMeasurementCandidate = {
  id: string;
  entityType: string;
  label: string;
  quantity: number | null;
  unit: string | null;
  confidence: number;
  sourceText?: string | null;
  status: string;
  technicalDataJson?: unknown;
};

export type AiMeasurementEvidencePage = {
  projectFileId: string;
  pageNumber: number;
  text: string | null;
  normalizedText?: string | null;
  drawingTitles?: readonly string[] | null;
};

export type NormalizedStructuralDimensions = {
  kind: "FOOTING" | "BEAM_SECTION";
  lengthM?: number;
  widthM?: number;
  depthM?: number;
  volumePerUnitM3?: number;
  totalVolumeM3?: number;
};

export type AiMeasurementSuggestion = {
  quantity: number;
  unit: string;
  method: "EXACT_LAYOUT_LABEL_COUNT" | "COUNTABLE_ENTITY_UNIT";
  confidence: number;
  pageNumbers: number[];
  evidenceSummary: string;
  scopeCaution: string | null;
  normalizedDimensions: NormalizedStructuralDimensions | null;
};

const COUNTABLE_ENTITY_TYPES = new Set(["DOOR", "WINDOW", "FURNITURE", "EQUIPMENT"]);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function rawData(candidate: AiMeasurementCandidate): Record<string, unknown> | null {
  return record(record(candidate.technicalDataJson)?.rawData);
}

function normalizeDimensions(candidate: AiMeasurementCandidate): NormalizedStructuralDimensions | null {
  const raw = rawData(candidate);
  if (!raw) return null;

  const lengthCm = finiteNumber(raw.r_c_c_dimensions_cm_l);
  const widthCm = finiteNumber(raw.r_c_c_dimensions_cm_b);
  const depthCm = finiteNumber(raw.r_c_c_dimensions_cm_d);
  if (lengthCm !== null && widthCm !== null && depthCm !== null) {
    const lengthM = round(lengthCm / 100);
    const widthM = round(widthCm / 100);
    const depthM = round(depthCm / 100);
    return {
      kind: "FOOTING",
      lengthM,
      widthM,
      depthM,
      volumePerUnitM3: round(lengthM * widthM * depthM),
    };
  }

  const section = typeof raw.dimensions_cm === "string" ? raw.dimensions_cm.trim() : "";
  const sectionMatch = section.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)$/);
  if (sectionMatch) {
    return {
      kind: "BEAM_SECTION",
      widthM: round(Number(sectionMatch[1]) / 100),
      depthM: round(Number(sectionMatch[2]) / 100),
    };
  }

  return null;
}

function structuralLayoutNeedles(labelInput: string): string[] | null {
  const label = labelInput.trim().toUpperCase();
  if (/^F\d+\*?$/.test(label) || /^STB\d+$/.test(label)) return ["LAYOUT OF FOOTING"];
  if (/^TB\d+$/.test(label)) return ["LAYOUT OF TIE BEAM"];
  if (/^(?:B\d+|CB)$/.test(label)) return ["LAYOUT OF FIRST FLOOR SLAB", "LAYOUT OF BEAM"];
  if (/^C\d+$/.test(label)) return ["LAYOUT OF COLUMN"];
  return null;
}

function pageSearchText(page: AiMeasurementEvidencePage): string {
  const titles = page.drawingTitles?.join("\n") ?? "";
  return `${titles}\n${page.normalizedText ?? page.text ?? ""}`.toUpperCase();
}

function matchingLayoutPages(
  label: string,
  pages: readonly AiMeasurementEvidencePage[],
): AiMeasurementEvidencePage[] {
  const needles = structuralLayoutNeedles(label);
  if (!needles) return [];
  return pages.filter((page) => {
    const haystack = pageSearchText(page);
    return needles.some((needle) => haystack.includes(needle));
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function countExactDrawingLabel(text: string, labelInput: string): number {
  const label = labelInput.trim().toUpperCase();
  if (!label) return 0;
  const expression = new RegExp(
    `(^|[^A-Z0-9._/-])${escapeRegExp(label)}(?=$|[^A-Z0-9*._/-])`,
    "gm",
  );
  const upper = text.toUpperCase();
  let count = 0;
  while (expression.exec(upper)) count += 1;
  return count;
}

function scopeCautionForPages(pages: readonly AiMeasurementEvidencePage[]): string | null {
  const text = pages.map(pageSearchText).join("\n");
  if (/\bMODIFICATION\b|\bEXISTING\b|\bPROPOSED\b|\bREMOVE\b|\bEX\.\b/.test(text)) {
    return "Modification/existing/proposed scope language is present on the source drawing; confirm that the counted occurrences belong to the BOQ scope.";
  }
  return null;
}

function dimensionEvidenceText(
  dimensions: NormalizedStructuralDimensions | null,
  count: number,
): string | null {
  if (!dimensions) return null;
  if (
    dimensions.kind === "FOOTING"
    && dimensions.lengthM !== undefined
    && dimensions.widthM !== undefined
    && dimensions.depthM !== undefined
    && dimensions.volumePerUnitM3 !== undefined
  ) {
    const total = round(dimensions.volumePerUnitM3 * count);
    dimensions.totalVolumeM3 = total;
    return `Schedule dimensions normalized from cm: ${dimensions.lengthM} × ${dimensions.widthM} × ${dimensions.depthM} m. Geometric volume reference: ${dimensions.volumePerUnitM3} m3 each / ${total} m3 for ${count} occurrence${count === 1 ? "" : "s"}.`;
  }
  if (
    dimensions.kind === "BEAM_SECTION"
    && dimensions.widthM !== undefined
    && dimensions.depthM !== undefined
  ) {
    return `Schedule section normalized from cm: ${dimensions.widthM} × ${dimensions.depthM} m. Segment length is not inferred by this safe path.`;
  }
  return null;
}

export function inferAiDraftMeasurement(
  candidate: AiMeasurementCandidate,
  pages: readonly AiMeasurementEvidencePage[],
): AiMeasurementSuggestion | null {
  const existingQuantity = candidate.quantity;
  const hasPositiveQuantity = existingQuantity !== null
    && Number.isFinite(existingQuantity)
    && existingQuantity > 0;
  const existingUnit = candidate.unit?.trim() ?? "";
  if (hasPositiveQuantity && existingUnit) return null;

  const entityType = candidate.entityType.trim().toUpperCase();
  const structuralNeedles = structuralLayoutNeedles(candidate.label);

  if (
    hasPositiveQuantity
    && !existingUnit
    && (COUNTABLE_ENTITY_TYPES.has(entityType) || structuralNeedles)
  ) {
    return {
      quantity: existingQuantity,
      unit: "nr",
      method: "COUNTABLE_ENTITY_UNIT",
      confidence: COUNTABLE_ENTITY_TYPES.has(entityType) ? 95 : 88,
      pageNumbers: [],
      evidenceSummary:
        `Suggested unit "nr" because ${candidate.label} is a countable `
        + `${COUNTABLE_ENTITY_TYPES.has(entityType) ? entityType.toLowerCase() : "drawing type"} `
        + "and an explicit positive quantity already exists.",
      scopeCaution: null,
      normalizedDimensions: normalizeDimensions(candidate),
    };
  }

  if (hasPositiveQuantity || !structuralNeedles) return null;

  const layoutPages = matchingLayoutPages(candidate.label, pages);
  if (layoutPages.length === 0) return null;

  const pageCounts = layoutPages
    .map((page) => ({
      pageNumber: page.pageNumber,
      count: countExactDrawingLabel(
        page.text ?? page.normalizedText ?? "",
        candidate.label,
      ),
    }))
    .filter((entry) => entry.count > 0);

  const count = pageCounts.reduce((sum, entry) => sum + entry.count, 0);
  if (count <= 0) return null;

  const scopeCaution = scopeCautionForPages(layoutPages);
  const normalizedDimensions = normalizeDimensions(candidate);
  const dimensionText = dimensionEvidenceText(normalizedDimensions, count);
  const pageNumbers = pageCounts.map((entry) => entry.pageNumber);

  const evidenceSummary = [
    `Suggested count ${count} nr from exact "${candidate.label}" type-label occurrences on layout page${pageNumbers.length === 1 ? "" : "s"} ${pageNumbers.join(", ")}.`,
    dimensionText,
    scopeCaution,
  ].filter((value): value is string => Boolean(value)).join(" ");

  return {
    quantity: count,
    unit: "nr",
    method: "EXACT_LAYOUT_LABEL_COUNT",
    confidence: scopeCaution ? 72 : 82,
    pageNumbers,
    evidenceSummary,
    scopeCaution,
    normalizedDimensions,
  };
}

export function applyAiMeasurementSuggestion<T extends AiMeasurementCandidate>(
  candidate: T,
  suggestion: AiMeasurementSuggestion | null,
): T {
  if (!suggestion) return candidate;
  const hasPositiveQuantity = candidate.quantity !== null
    && Number.isFinite(candidate.quantity)
    && candidate.quantity > 0;

  return {
    ...candidate,
    quantity: hasPositiveQuantity ? candidate.quantity : suggestion.quantity,
    unit: candidate.unit?.trim() ? candidate.unit : suggestion.unit,
  } as T;
}

export function formatAiMeasurementSuggestionMarker(
  suggestion: AiMeasurementSuggestion,
): string {
  const pagePart = suggestion.pageNumbers.length > 0
    ? `:P${suggestion.pageNumbers.join(",")}`
    : "";
  return `${AI_MEASUREMENT_SUGGESTION_MARKER}:${suggestion.method}:${suggestion.quantity}:${suggestion.unit}${pagePart}`;
}

export function hasAiMeasurementSuggestion(
  sourceReference: string | null | undefined,
): boolean {
  return Boolean(sourceReference?.includes(`${AI_MEASUREMENT_SUGGESTION_MARKER}:`));
}
'@

$newTestContent = @'
import { describe, expect, it } from "vitest";
import {
  applyAiMeasurementSuggestion,
  countExactDrawingLabel,
  formatAiMeasurementSuggestionMarker,
  hasAiMeasurementSuggestion,
  inferAiDraftMeasurement,
  type AiMeasurementCandidate,
  type AiMeasurementEvidencePage,
} from "../src/lib/guidance/ai-measurement-inference";

function candidate(
  label: string,
  rawData: Record<string, unknown> = {},
  overrides: Partial<AiMeasurementCandidate> = {},
): AiMeasurementCandidate {
  return {
    id: `entity-${label}`,
    entityType: "SCHEDULE_ROW",
    label,
    quantity: null,
    unit: null,
    confidence: 50,
    sourceText: null,
    status: "NEEDS_REVIEW",
    technicalDataJson: { rawData },
    ...overrides,
  };
}

const footingLayout: AiMeasurementEvidencePage = {
  projectFileId: "file-1",
  pageNumber: 4,
  drawingTitles: ["LAYOUT OF FOOTING"],
  text: [
    "MODIFICATION IN EXIST G+1 FLOOR VILLA",
    "LAYOUT OF FOOTING",
    "F1 94 766 844 284",
    "F1",
    "F3",
    "F2*",
    "F1",
    "F4",
    "F3",
    "F4 STB2",
    "531 F5",
    "F2*",
    "F6 F6 229 141",
    "F6 F6",
  ].join("\n"),
};

const slabLayout: AiMeasurementEvidencePage = {
  projectFileId: "file-1",
  pageNumber: 2,
  drawingTitles: ["LAYOUT OF FIRST FLOOR SLAB"],
  text: [
    "LAYOUT OF FIRST FLOOR SLAB",
    "CB CB B1",
    "B1 B1",
    "CB B1 CB",
    "PROPOSED PARAPET HEIGHT IS 0.50m INV.B1",
  ].join("\n"),
};

const tieBeamLayout: AiMeasurementEvidencePage = {
  projectFileId: "file-1",
  pageNumber: 3,
  drawingTitles: ["LAYOUT OF TIE BEAM"],
  text: [
    "LAYOUT OF TIE BEAM",
    "TB1",
    "TB1",
    "TB1 TB1",
  ].join("\n"),
};

describe("AI measurement inference", () => {
  it("counts exact structural type labels instead of substring matches", () => {
    expect(countExactDrawingLabel("F1 F10 F1 F1A", "F1")).toBe(2);
    expect(countExactDrawingLabel("F2* F2 F2*", "F2*")).toBe(2);
  });

  it("infers F1 count and normalizes footing dimensions from cm without changing the source entity", () => {
    const source = candidate("F1", {
      r_c_c_dimensions_cm_l: "160",
      r_c_c_dimensions_cm_b: "120",
      r_c_c_dimensions_cm_d: "35",
    });

    const suggestion = inferAiDraftMeasurement(source, [footingLayout]);
    expect(suggestion).not.toBeNull();
    expect(suggestion?.quantity).toBe(3);
    expect(suggestion?.unit).toBe("nr");
    expect(suggestion?.method).toBe("EXACT_LAYOUT_LABEL_COUNT");
    expect(suggestion?.normalizedDimensions).toMatchObject({
      kind: "FOOTING",
      lengthM: 1.6,
      widthM: 1.2,
      depthM: 0.35,
      volumePerUnitM3: 0.672,
      totalVolumeM3: 2.016,
    });
    expect(suggestion?.scopeCaution).toContain("Modification");
    expect(source.quantity).toBeNull();
    expect(source.unit).toBeNull();

    const draftCandidate = applyAiMeasurementSuggestion(source, suggestion);
    expect(draftCandidate.quantity).toBe(3);
    expect(draftCandidate.unit).toBe("nr");
  });

  it("handles starred footing labels and repeated footing occurrences", () => {
    const f2Star = inferAiDraftMeasurement(
      candidate("F2*", {
        r_c_c_dimensions_cm_l: "220",
        r_c_c_dimensions_cm_b: "180",
        r_c_c_dimensions_cm_d: "40",
      }),
      [footingLayout],
    );
    const f6 = inferAiDraftMeasurement(
      candidate("F6", {
        r_c_c_dimensions_cm_l: "180",
        r_c_c_dimensions_cm_b: "110",
        r_c_c_dimensions_cm_d: "40",
      }),
      [footingLayout],
    );

    expect(f2Star?.quantity).toBe(2);
    expect(f6?.quantity).toBe(4);
  });

  it("infers beam/tie-beam segment counts only from their matching layout pages", () => {
    const b1 = inferAiDraftMeasurement(
      candidate("B1", { dimensions_cm: "20 X 80" }),
      [footingLayout, slabLayout, tieBeamLayout],
    );
    const tb1 = inferAiDraftMeasurement(
      candidate("TB1", { dimensions_cm: "20 X 60" }),
      [footingLayout, slabLayout, tieBeamLayout],
    );

    expect(b1?.quantity).toBe(4);
    expect(b1?.normalizedDimensions).toMatchObject({
      kind: "BEAM_SECTION",
      widthM: 0.2,
      depthM: 0.8,
    });
    expect(tb1?.quantity).toBe(4);
  });

  it("does not create a count from a schedule page when no matching layout exists", () => {
    const scheduleOnly: AiMeasurementEvidencePage = {
      projectFileId: "file-1",
      pageNumber: 1,
      drawingTitles: ["SCHEDULE OF FOOTING"],
      text: "SCHEDULE OF FOOTING\nF1 160 120 35",
    };
    expect(
      inferAiDraftMeasurement(
        candidate("F1", {
          r_c_c_dimensions_cm_l: "160",
          r_c_c_dimensions_cm_b: "120",
          r_c_c_dimensions_cm_d: "35",
        }),
        [scheduleOnly],
      ),
    ).toBeNull();
  });

  it("suggests nr for a countable extracted entity that already has a positive quantity but no unit", () => {
    const suggestion = inferAiDraftMeasurement(
      candidate("D1", {}, {
        entityType: "DOOR",
        quantity: 8,
        unit: null,
      }),
      [],
    );
    expect(suggestion).toMatchObject({
      quantity: 8,
      unit: "nr",
      method: "COUNTABLE_ENTITY_UNIT",
    });
  });

  it("never replaces a complete extracted measurement", () => {
    expect(
      inferAiDraftMeasurement(
        candidate("F1", {}, { quantity: 3, unit: "nr" }),
        [footingLayout],
      ),
    ).toBeNull();
  });

  it("marks AI measurement provenance in the existing sourceReference string", () => {
    const suggestion = inferAiDraftMeasurement(
      candidate("F1", {
        r_c_c_dimensions_cm_l: "160",
        r_c_c_dimensions_cm_b: "120",
        r_c_c_dimensions_cm_d: "35",
      }),
      [footingLayout],
    );
    expect(suggestion).not.toBeNull();
    const marker = formatAiMeasurementSuggestionMarker(suggestion!);
    expect(marker).toContain("AI_MEASUREMENT_SUGGESTION:EXACT_LAYOUT_LABEL_COUNT:3:nr:P4");
    expect(hasAiMeasurementSuggestion(`source | ${marker}`)).toBe(true);
    expect(hasAiMeasurementSuggestion("source only")).toBe(false);
  });
});
'@

try {
    Write-Host "`n=== WRITING ADDITIVE INFERENCE MODULE ===" -ForegroundColor Cyan
    Write-Utf8NoBomLf -Path $InferencePath -Content $newModuleContent
    Write-Utf8NoBomLf -Path $TestPath -Content $newTestContent

    $oldImport = @'
} from "@/lib/guidance/ai-draft-boq";
import { createAuditLog } from "@/lib/repositories/audit-repository";
'@
    $newImport = @'
} from "@/lib/guidance/ai-draft-boq";
import {
  applyAiMeasurementSuggestion,
  formatAiMeasurementSuggestionMarker,
  hasAiMeasurementSuggestion,
  inferAiDraftMeasurement,
  type AiMeasurementEvidencePage,
  type AiMeasurementSuggestion,
} from "@/lib/guidance/ai-measurement-inference";
import { createAuditLog } from "@/lib/repositories/audit-repository";
'@
    Replace-Exact -Path $ServicePath -Old $oldImport -New $newImport -Label "service-import"

    $oldMarker = @'
function extractionMarker(entityId: string): string {
  return `EXTRACTED_ENTITY:${entityId}`;
}

function toCandidate(entity: {
'@
    $newMarker = @'
function extractionMarker(entityId: string): string {
  return `EXTRACTED_ENTITY:${entityId}`;
}

function jsonRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function toMeasurementEvidencePage(row: {
  projectFileId: string;
  pageNumber: number;
  textLayerJson: Prisma.JsonValue | null;
}): AiMeasurementEvidencePage {
  const layer = jsonRecord(row.textLayerJson);
  const signals = jsonRecord(layer?.signals);
  const rawTitles = signals?.drawingTitles;
  return {
    projectFileId: row.projectFileId,
    pageNumber: row.pageNumber,
    text: typeof layer?.text === "string" ? layer.text : null,
    normalizedText: typeof layer?.normalizedText === "string" ? layer.normalizedText : null,
    drawingTitles: Array.isArray(rawTitles)
      ? rawTitles.filter((value): value is string => typeof value === "string")
      : [],
  };
}

function toCandidate(entity: {
'@
    Replace-Exact -Path $ServicePath -Old $oldMarker -New $newMarker -Label "page-evidence-helper"

    $oldCandidates = @'
    const candidates = rows.map(toCandidate);
    const summary = summarizeAiDraftCandidates(candidates);

    const currentItems = current.sections.flatMap((section) => section.items);
'@
    $newCandidates = @'
    const sourceFileIds = [...new Set(rows.map((row) => row.projectFileId))];
    const pageRows = sourceFileIds.length > 0
      ? await tx.drawingPage.findMany({
          where: {
            companyId: actor.companyId,
            projectFileId: { in: sourceFileIds },
          },
          orderBy: [{ projectFileId: "asc" }, { pageNumber: "asc" }],
          select: {
            projectFileId: true,
            pageNumber: true,
            textLayerJson: true,
          },
        })
      : [];

    const pagesByFileId = new Map<string, AiMeasurementEvidencePage[]>();
    for (const pageRow of pageRows) {
      const page = toMeasurementEvidencePage(pageRow);
      const existing = pagesByFileId.get(page.projectFileId) ?? [];
      existing.push(page);
      pagesByFileId.set(page.projectFileId, existing);
    }

    const suggestionByEntityId = new Map<string, AiMeasurementSuggestion>();
    const candidates = rows.map((row) => {
      const candidate = toCandidate(row);
      const suggestion = inferAiDraftMeasurement(
        {
          ...candidate,
          technicalDataJson: row.technicalDataJson,
        },
        pagesByFileId.get(row.projectFileId) ?? [],
      );
      if (suggestion) suggestionByEntityId.set(row.id, suggestion);
      return applyAiMeasurementSuggestion(candidate, suggestion);
    });
    const candidateByEntityId = new Map(
      candidates.map((candidate) => [candidate.id, candidate] as const),
    );
    const summary = summarizeAiDraftCandidates(candidates);

    const currentItems = current.sections.flatMap((section) => section.items);
'@
    Replace-Exact -Path $ServicePath -Old $oldCandidates -New $newCandidates -Label "candidate-inference"

    $oldToAdd = @'
    const toAdd = rows
      .map((row) => ({ row, candidate: toCandidate(row) }))
      .filter(({ row, candidate }) =>
        !alreadyPresentIds.has(row.id) && isAiDraftCandidateUsable(candidate),
      );
'@
    $newToAdd = @'
    const toAdd = rows
      .map((row) => ({
        row,
        candidate: candidateByEntityId.get(row.id) ?? toCandidate(row),
        suggestion: suggestionByEntityId.get(row.id) ?? null,
      }))
      .filter(({ row, candidate }) =>
        !alreadyPresentIds.has(row.id) && isAiDraftCandidateUsable(candidate),
      );
'@
    Replace-Exact -Path $ServicePath -Old $oldToAdd -New $newToAdd -Label "to-add-inferred-candidate"

    $oldEmptyReturn = @'
        unreviewedAddedCount: 0,
        reviewedAddedCount: 0,
        measurementIncompleteAddedCount: 0,
      };
'@
    $newEmptyReturn = @'
        unreviewedAddedCount: 0,
        reviewedAddedCount: 0,
        measurementIncompleteAddedCount: 0,
        inferredMeasurementAddedCount: 0,
      };
'@
    Replace-Exact -Path $ServicePath -Old $oldEmptyReturn -New $newEmptyReturn -Label "empty-result-inferred-count"

    $oldCounters = @'
    let reviewedAddedCount = 0;
    let unreviewedAddedCount = 0;
    let measurementIncompleteAddedCount = 0;

    for (const { row, candidate } of toAdd) {
'@
    $newCounters = @'
    let reviewedAddedCount = 0;
    let unreviewedAddedCount = 0;
    let measurementIncompleteAddedCount = 0;
    let inferredMeasurementAddedCount = 0;

    for (const { row, candidate, suggestion } of toAdd) {
'@
    Replace-Exact -Path $ServicePath -Old $oldCounters -New $newCounters -Label "inferred-counter"

    $oldMeasurement = @'
      const measurementComplete = isAiDraftMeasurementComplete(candidate);
      const quantity = new Prisma.Decimal(getAiDraftQuantityValue(candidate));
      const unit = candidate.unit?.trim() ?? "";
      if (!measurementComplete) measurementIncompleteAddedCount += 1;
'@
    $newMeasurement = @'
      const measurementComplete = isAiDraftMeasurementComplete(candidate);
      const quantity = new Prisma.Decimal(getAiDraftQuantityValue(candidate));
      const unit = candidate.unit?.trim() ?? "";
      if (!measurementComplete) measurementIncompleteAddedCount += 1;
      if (suggestion && measurementComplete) inferredMeasurementAddedCount += 1;
'@
    Replace-Exact -Path $ServicePath -Old $oldMeasurement -New $newMeasurement -Label "measurement-counter"

    $oldReference = @'
      const marker = extractionMarker(row.id);
      const retainedSourceReference = row.sourceReference?.trim();
      const sourceReference = retainedSourceReference
        ? `${retainedSourceReference} | ${marker}`
        : marker;
'@
    $newReference = @'
      const marker = extractionMarker(row.id);
      const retainedSourceReference = row.sourceReference?.trim();
      const measurementMarker = suggestion
        ? formatAiMeasurementSuggestionMarker(suggestion)
        : null;
      const sourceReference = [
        retainedSourceReference,
        marker,
        measurementMarker,
      ].filter((value): value is string => Boolean(value)).join(" | ");

      const specification = [
        row.sourceText?.trim() || null,
        suggestion?.evidenceSummary
          ? `AI measurement evidence: ${suggestion.evidenceSummary}`
          : null,
      ].filter((value): value is string => Boolean(value)).join("\n\n");
'@
    Replace-Exact -Path $ServicePath -Old $oldReference -New $newReference -Label "measurement-provenance-marker"

    $oldSpecification = @'
          description: row.label,
          specification: row.sourceText ?? "",
          quantity,
'@
    $newSpecification = @'
          description: row.label,
          specification,
          quantity,
'@
    Replace-Exact -Path $ServicePath -Old $oldSpecification -New $newSpecification -Label "measurement-evidence-specification"

    $oldNotes = @'
          notes: measurementComplete
            ? "AI Draft from extracted project evidence. Professional quantity review and commercial rate selection are still required."
            : "AI Draft from extracted project evidence. Quantity and/or unit is unresolved and must be completed in the BOQ before validation.",
'@
    $newNotes = @'
          notes: measurementComplete
            ? suggestion
              ? "AI Draft from extracted project evidence with an AI-suggested measurement. Review the quantity/unit once in this BOQ before confirmation. Commercial rate selection is still required."
              : "AI Draft from extracted project evidence. Professional quantity review and commercial rate selection are still required."
            : "AI Draft from extracted project evidence. Quantity and/or unit is unresolved and must be completed in the BOQ before validation.",
'@
    Replace-Exact -Path $ServicePath -Old $oldNotes -New $newNotes -Label "ai-suggestion-review-note"

    $oldPreviouslyReviewed = @'
      const previouslyReviewed = (
        measurementComplete
        && (row.status === "CONFIRMED" || row.status === "CORRECTED")
        && row.confirmedAt !== null
      );
'@
    $newPreviouslyReviewed = @'
      const previouslyReviewed = (
        !suggestion
        && measurementComplete
        && (row.status === "CONFIRMED" || row.status === "CORRECTED")
        && row.confirmedAt !== null
      );
'@
    Replace-Exact -Path $ServicePath -Old $oldPreviouslyReviewed -New $newPreviouslyReviewed -Label "suggestions-stay-unconfirmed"

    $oldItemAudit = @'
          confidence: row.confidence.toString(),
          measurementComplete,
          rateAutomaticallyApplied: false,
'@
    $newItemAudit = @'
          confidence: row.confidence.toString(),
          measurementComplete,
          ...(suggestion
            ? {
                measurementSuggestion: {
                  method: suggestion.method,
                  confidence: suggestion.confidence,
                  pageNumbers: suggestion.pageNumbers,
                  evidenceSummary: suggestion.evidenceSummary,
                },
              }
            : {}),
          rateAutomaticallyApplied: false,
'@
    Replace-Exact -Path $ServicePath -Old $oldItemAudit -New $newItemAudit -Label "audit-measurement-suggestion"

    $oldBoqAudit = @'
        reviewedAddedCount,
        unreviewedAddedCount,
        measurementIncompleteAddedCount,
        ratesAutomaticallyApplied: false,
'@
    $newBoqAudit = @'
        reviewedAddedCount,
        unreviewedAddedCount,
        measurementIncompleteAddedCount,
        inferredMeasurementAddedCount,
        ratesAutomaticallyApplied: false,
'@
    Replace-Exact -Path $ServicePath -Old $oldBoqAudit -New $newBoqAudit -Label "boq-audit-inferred-count"

    $oldResult = @'
      unreviewedAddedCount,
      reviewedAddedCount,
      measurementIncompleteAddedCount,
    };
'@
    $newResult = @'
      unreviewedAddedCount,
      reviewedAddedCount,
      measurementIncompleteAddedCount,
      inferredMeasurementAddedCount,
    };
'@
    Replace-Exact -Path $ServicePath -Old $oldResult -New $newResult -Label "result-inferred-count"

    $oldLinked = @'
        const manuallyReviewedAiQuantity =
          provenance.sourceType === QuantityProvenanceSource.MANUAL_CONFIRMED
          && provenance.confirmedAt !== null
          && getAiDraftExtractedEntityId(item.sourceReference) !== null;

        if (!unreviewedAiQuantity && !manuallyReviewedAiQuantity) return [];

        return [{
          item,
          provenance,
          extractedEntityId,
          manuallyReviewedAiQuantity,
        }];
'@
    $newLinked = @'
        const manuallyReviewedAiQuantity =
          provenance.sourceType === QuantityProvenanceSource.MANUAL_CONFIRMED
          && provenance.confirmedAt !== null
          && getAiDraftExtractedEntityId(item.sourceReference) !== null;
        const aiSuggestedQuantity =
          unreviewedAiQuantity
          && hasAiMeasurementSuggestion(item.sourceReference);

        if (!unreviewedAiQuantity && !manuallyReviewedAiQuantity) return [];

        return [{
          item,
          provenance,
          extractedEntityId,
          manuallyReviewedAiQuantity,
          aiSuggestedQuantity,
        }];
'@
    Replace-Exact -Path $ServicePath -Old $oldLinked -New $newLinked -Label "confirmation-recognizes-ai-suggestion"

    $oldLoop = @'
      item,
      provenance,
      extractedEntityId,
      manuallyReviewedAiQuantity,
    } of linkedItems) {
'@
    $newLoop = @'
      item,
      provenance,
      extractedEntityId,
      manuallyReviewedAiQuantity,
      aiSuggestedQuantity,
    } of linkedItems) {
'@
    Replace-Exact -Path $ServicePath -Old $oldLoop -New $newLoop -Label "confirmation-loop-ai-suggestion"

    $oldConfirmGuard = @'
      if (!manuallyReviewedAiQuantity && !quantityMatchesExtraction) {
        skippedCount += 1;
        continue;
      }

      const extractionWasCorrectedInBoq =
        manuallyReviewedAiQuantity && !quantityMatchesExtraction;
      const boqMeasurementComplete =
        item.quantity.toNumber() > 0 && item.unit.trim().length > 0;

      if (manuallyReviewedAiQuantity && !boqMeasurementComplete) {
        skippedCount += 1;
        continue;
      }
'@
    $newConfirmGuard = @'
      const boqMeasurementComplete =
        item.quantity.toNumber() > 0 && item.unit.trim().length > 0;

      if (
        !manuallyReviewedAiQuantity
        && !aiSuggestedQuantity
        && !quantityMatchesExtraction
      ) {
        skippedCount += 1;
        continue;
      }

      if (
        (manuallyReviewedAiQuantity || aiSuggestedQuantity)
        && !boqMeasurementComplete
      ) {
        skippedCount += 1;
        continue;
      }

      const extractionWasCorrectedInBoq =
        (manuallyReviewedAiQuantity || aiSuggestedQuantity)
        && !quantityMatchesExtraction;
      const correctionReason = aiSuggestedQuantity
        ? "Accepted AI measurement suggestion during AI Draft BOQ review."
        : "Corrected during AI Draft BOQ review.";
'@
    Replace-Exact -Path $ServicePath -Old $oldConfirmGuard -New $newConfirmGuard -Label "confirmation-accepts-reviewed-ai-suggestion"

    Replace-Exact `
        -Path $ServicePath `
        -Old '                    reason: "Corrected during AI Draft BOQ review.",' `
        -New '                    reason: correctionReason,' `
        -Label "reviewable-correction-json-reason"

    Replace-Exact `
        -Path $ServicePath `
        -Old '                reason: "Corrected during AI Draft BOQ review.",' `
        -New '                reason: correctionReason,' `
        -Label "reviewable-audit-reason"

    Replace-Exact `
        -Path $ServicePath `
        -Old '                    reason: "Completed during AI Draft BOQ review.",' `
        -New '                    reason: correctionReason,' `
        -Label "reviewed-correction-json-reason"

    Replace-Exact `
        -Path $ServicePath `
        -Old '              reason: "Completed during AI Draft BOQ review.",' `
        -New '              reason: correctionReason,' `
        -Label "reviewed-audit-reason"

    $oldAiDraftMemo = @'
  const hasAiDraftItems = useMemo(
    () => Boolean(activeRevision?.sections.some(
      (section) => section.items.some(
        (item) => item.notes?.includes("AI Draft from extracted project evidence"),
      ),
    )),
    [activeRevision],
  );
  const showAiDraftReview = aiDraftMode || hasAiDraftItems;
'@
    $newAiDraftMemo = @'
  const hasAiDraftItems = useMemo(
    () => Boolean(activeRevision?.sections.some(
      (section) => section.items.some(
        (item) => item.notes?.includes("AI Draft from extracted project evidence"),
      ),
    )),
    [activeRevision],
  );
  const aiSuggestedMeasurementCount = useMemo(
    () => activeRevision?.sections.reduce(
      (total, section) =>
        total + section.items.filter(
          (item) => item.notes?.includes("AI-suggested measurement"),
        ).length,
      0,
    ) ?? 0,
    [activeRevision],
  );
  const showAiDraftReview = aiDraftMode || hasAiDraftItems;
'@
    Replace-Exact -Path $BoqPagePath -Old $oldAiDraftMemo -New $newAiDraftMemo -Label "boq-ai-suggestion-count"

    $oldBoqReviewCopy = @'
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Unchanged AI Draft quantities stay unconfirmed until you approve them here. Any quantity you edit follows the existing manual confirmation path. Quantara does not invent rates: use your purchased packages, catalogue/company library, or manual pricing before final validation.
              </p>
'@
    $newBoqReviewCopy = @'
              {aiSuggestedMeasurementCount > 0 && (
                <p className="mt-2 rounded-xl border border-blue-400/30 bg-blue-400/10 px-3 py-2 text-xs leading-5 text-blue-100">
                  Quantara inferred {aiSuggestedMeasurementCount} missing {aiSuggestedMeasurementCount === 1 ? "measurement" : "measurements"} from stored drawing evidence. Review the suggested quantity/unit in the BOQ table; the existing confirmation action is the single professional approval step.
                </p>
              )}
              <p className="mt-2 text-xs leading-5 text-slate-400">
                AI-suggested and unchanged AI Draft quantities stay unconfirmed until you approve them here. Any quantity you edit follows the existing manual confirmation path. Quantara does not invent rates: use your purchased packages, catalogue/company library, or manual pricing before final validation.
              </p>
'@
    Replace-Exact -Path $BoqPagePath -Old $oldBoqReviewCopy -New $newBoqReviewCopy -Label "boq-one-review-copy"

    $prismaAfter = (& git diff --binary -- prisma | Out-String)
    if ($prismaAfter -ne $prismaBefore) {
        throw "STOP: Prisma diff changed unexpectedly. Automatic rollback will run."
    }

    Invoke-Verification

    Write-Host "`n=== STAGING ONLY THE AUDITED CHANGESET ===" -ForegroundColor Cyan
    & git --literal-pathspecs add -- $InferencePath $ServicePath $BoqPagePath $TestPath
    Stop-IfLastExitCode "STOP: Failed to stage the audited files."

    Write-Host "`nPASS: patch applied and verified." -ForegroundColor Green
    Write-Host "No Prisma schema/migration was changed." -ForegroundColor Green
    Write-Host "No extraction parser/handler was changed." -ForegroundColor Green
    Write-Host "No existing extraction record is modified during AI Draft inference." -ForegroundColor Green
    Write-Host "Original repo remained untouched: $SourceRepoRoot" -ForegroundColor Green
    Write-Host "Isolated tested worktree: $WorktreePath" -ForegroundColor Green
    Write-Host "`nStaged files:" -ForegroundColor Cyan
    & git diff --cached --name-only

    Write-Host "`nNEXT SAFE COMMANDS (do not run if any verification above failed):" -ForegroundColor Yellow
    Write-Host "cd `"$WorktreePath`""
    Write-Host 'git diff --cached --stat'
    Write-Host 'git status --short'
    Write-Host 'git commit -m "feat: infer AI draft measurements from drawing evidence"'
    Write-Host 'git push -u origin fix/ai-measurement-inference-20260817-v4'
}
catch {
    $message = $_.Exception.Message
    Write-Host "`nPATCH/VERIFY FAILED: $message" -ForegroundColor Red
    Write-Host "Original repo remains untouched: $SourceRepoRoot" -ForegroundColor Green
    Write-Host "The isolated V4 worktree is being LEFT IN PLACE for inspection so we do not loop/reapply." -ForegroundColor Yellow
    Write-Host "Isolated path: $WorktreePath" -ForegroundColor Yellow
    Write-Host "Branch: $BranchName" -ForegroundColor Yellow
    throw $message
}
