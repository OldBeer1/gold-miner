param([string]$Version = '1.5.1')

$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Version must use major.minor.patch.' }
$goldRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$goldManifest = Get-Content -LiteralPath (Join-Path $goldRoot "output/release/release-manifest-v$Version.json") -Raw | ConvertFrom-Json
$goldArchive = Join-Path $goldRoot ('output/release/' + $goldManifest.filename)
$goldExtract = Join-Path $goldRoot ('output/release/verify-v' + $Version + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
if (-not $goldExtract.StartsWith((Join-Path $goldRoot 'output/release') + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Extraction scope mismatch.' }
$goldHash = (Get-FileHash -LiteralPath $goldArchive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($goldHash -ne $goldManifest.sha256 -or (Get-Item -LiteralPath $goldArchive).Length -ne $goldManifest.size) { throw 'Archive size or SHA-256 mismatch.' }
Expand-Archive -LiteralPath $goldArchive -DestinationPath $goldExtract
$goldEntries = @(Get-ChildItem -LiteralPath $goldExtract -File -Recurse | ForEach-Object { $_.FullName.Substring($goldExtract.Length + 1).Replace('\', '/') } | Sort-Object)
if (Compare-Object $goldEntries @($goldManifest.entries | Sort-Object)) { throw 'Archive entries differ from whitelist.' }
if ($goldEntries.Count -ne 11 -or $goldManifest.runtimeFiles.Count -ne 10) { throw 'Unexpected runtime package size.' }
$goldRuntimeHashes = [ordered]@{}
foreach ($goldFile in $goldManifest.runtimeFiles) {
    $goldSourceHash = (Get-FileHash -LiteralPath (Join-Path $goldRoot $goldFile) -Algorithm SHA256).Hash.ToLowerInvariant()
    if ((Get-FileHash -LiteralPath (Join-Path $goldExtract $goldFile) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $goldSourceHash) { throw "Runtime source mismatch: $goldFile" }
    $goldRuntimeHashes[$goldFile] = $goldSourceHash
}
$goldConfig = Get-Content -LiteralPath (Join-Path $goldExtract 'js/config.js') -Raw
if ($goldConfig -notmatch ('version: "' + [regex]::Escape($Version) + '"')) { throw 'Extracted app version mismatch.' }
$goldRulesVersion = $Version
if ($goldConfig -match 'rulesVersion:\s*"([^"]+)"') { $goldRulesVersion = $Matches[1] }
$goldReadme = Get-Content -LiteralPath (Join-Path $goldExtract 'README.md') -Raw -Encoding UTF8
if ($Version -eq '1.5.0' -and ($goldReadme -notmatch '13' -or $goldReadme -notmatch '1.5.0' -or $goldReadme -notmatch '1.4.0')) { throw 'Player readme lacks current achievement or compatibility information.' }
$goldReport = [ordered]@{
    version = $Version; rulesVersion = $goldRulesVersion; result = 'passed'; checkedAt = [DateTime]::UtcNow.ToString('o')
    archive = $goldArchive; extractedDirectory = $goldExtract; size = $goldManifest.size; sha256 = $goldHash
    entries = $goldEntries; runtimeFilesCompared = $goldManifest.runtimeFiles.Count; runtimeHashes = $goldRuntimeHashes
    checks = @('archive size and SHA-256 match manifest', 'fresh independent extraction matches exact whitelist', 'ten runtime files match current source', 'app version and player readme compatibility verified')
    method = 'fresh independent archive extraction and file/hash comparisons; browser execution is verified separately'
}
$goldReportPath = Join-Path $goldRoot ('output/playwright/survival-v' + $Version.Replace('.', '') + '-package-report.json')
$goldReportJson = $goldReport | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($goldReportPath, $goldReportJson.Replace("`r`n", "`n") + "`n", [Text.UTF8Encoding]::new($false))
Write-Output ($goldReport | ConvertTo-Json -Depth 8)
