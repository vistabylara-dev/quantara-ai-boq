$csvPath = "C:\Users\PC\Desktop\QUANTARA-PROTECTED-CORE-cca09fda.csv"
$csv = Import-Csv -Path $csvPath
$matchCount = 0
$totalCount = $csv.Count
$mismatches = @()

foreach ($row in $csv) {
    $filePath = $row.Path
    $expectedHash = $row.BlobSha
    if (Test-Path -LiteralPath $filePath) {
        $actualHash = git hash-object $filePath
        if ($actualHash -eq $expectedHash) {
            $matchCount++
        } else {
            $mismatches += "$filePath (Expected: $expectedHash, Got: $actualHash)"
        }
    } else {
        $mismatches += "$filePath (File missing)"
    }
}

Write-Host "PROTECTED CORE PRECHECK: $matchCount/$totalCount MATCH"
if ($mismatches.Count -gt 0) {
    Write-Host "Mismatches:"
    $mismatches | ForEach-Object { Write-Host $_ }
}
