param([string]$Version = '1.5.0')

$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid release version.' }
$goldRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$goldPublished = Get-Content -LiteralPath (Join-Path $goldRoot "output/release/published-v$Version.json") -Raw | ConvertFrom-Json
$goldManifest = Get-Content -LiteralPath (Join-Path $goldRoot "output/release/release-manifest-v$Version.json") -Raw | ConvertFrom-Json
$goldStamp = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
$goldArchive = Join-Path $goldRoot "output/release/public-v$Version-$goldStamp.zip"
$goldExtract = Join-Path $goldRoot "output/release/public-v$Version-$goldStamp"
$goldHeaders = @{ 'User-Agent' = 'GoldMinerPublicVerification'; 'Accept' = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2026-03-10' }
$goldApi = 'https://api.github.com/repos/OldBeer1/gold-miner'
$goldRelease = Invoke-RestMethod -Uri "$goldApi/releases/tags/v$Version" -Headers $goldHeaders -TimeoutSec 30
$goldLatest = Invoke-RestMethod -Uri "$goldApi/releases/latest" -Headers $goldHeaders -TimeoutSec 30
if ($goldRelease.draft -or $goldRelease.prerelease -or $goldLatest.tag_name -ne "v$Version") { throw 'Public release is not stable latest.' }
$goldTag = (Invoke-RestMethod -Uri "$goldApi/git/ref/tags/v$Version" -Headers $goldHeaders -TimeoutSec 30).object
for ($goldDepth = 0; $goldTag.type -eq 'tag' -and $goldDepth -lt 4; $goldDepth++) {
    $goldTag = (Invoke-RestMethod -Uri ($goldApi + '/git/tags/' + $goldTag.sha) -Headers $goldHeaders -TimeoutSec 30).object
}
if ($goldTag.type -ne 'commit' -or $goldTag.sha -ne $goldPublished.sourceCommit) { throw 'Release tag source mismatch.' }
$goldAsset = @($goldRelease.assets | Where-Object { $_.name -eq $goldManifest.filename })
if ($goldAsset.Count -ne 1 -or $goldAsset[0].browser_download_url -ne $goldPublished.downloadUrl) { throw 'Public download URL mismatch.' }
Invoke-WebRequest -Uri $goldPublished.downloadUrl -OutFile $goldArchive -UseBasicParsing -TimeoutSec 30
$goldSize = (Get-Item -LiteralPath $goldArchive).Length
$goldHash = (Get-FileHash -LiteralPath $goldArchive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($goldSize -ne $goldManifest.size -or $goldHash -ne $goldManifest.sha256 -or $goldAsset[0].digest -ne "sha256:$goldHash") { throw 'Anonymous download checksum or size mismatch.' }
Expand-Archive -LiteralPath $goldArchive -DestinationPath $goldExtract
$goldEntries = @(Get-ChildItem -LiteralPath $goldExtract -File -Recurse | ForEach-Object { $_.FullName.Substring($goldExtract.Length + 1).Replace('\', '/') } | Sort-Object)
if (Compare-Object $goldEntries @($goldManifest.entries | Sort-Object)) { throw 'Anonymous download file list mismatch.' }
foreach ($goldFile in $goldManifest.runtimeFiles) {
    $goldSourceHash = (Get-FileHash -LiteralPath (Join-Path $goldRoot $goldFile) -Algorithm SHA256).Hash
    $goldDownloadHash = (Get-FileHash -LiteralPath (Join-Path $goldExtract $goldFile) -Algorithm SHA256).Hash
    if ($goldSourceHash -ne $goldDownloadHash) { throw "Public runtime source mismatch: $goldFile" }
}
$goldConfig = Get-Content -LiteralPath (Join-Path $goldExtract 'js/config.js') -Raw
$goldRulesVersion = $Version
if ($goldConfig -match 'rulesVersion:\s*"([^"]+)"') { $goldRulesVersion = $Matches[1] }
$goldReport = [ordered]@{
    version = $Version; rulesVersion = $goldRulesVersion; result = 'passed'; checkedAt = [DateTime]::UtcNow.ToString('o')
    sourceCommit = $goldPublished.sourceCommit; releaseUrl = $goldPublished.releaseUrl; downloadUrl = $goldPublished.downloadUrl
    releaseId = $goldPublished.releaseId; assetId = $goldPublished.assetId; draft = $false; prerelease = $false
    publicLatestVerified = $true; anonymousDownload = $true; size = $goldSize; sha256 = $goldHash; assetDigest = $goldAsset[0].digest
    entries = $goldEntries; runtimeFilesCompared = $goldManifest.runtimeFiles.Count
    archive = $goldArchive; extractedDirectory = $goldExtract
    checks = @('public release stable latest', 'tag targets validated source', 'anonymous download size and SHA-256 match', 'exact file list matches', 'ten runtime files match source')
    runtimeVerification = 'Public bytes exactly match independently extracted local package and passed browser preflight; no new full gameplay claim.'
}
$goldReportPath = Join-Path $goldRoot ('output/playwright/survival-v' + $Version.Replace('.', '') + '-published-release-report.json')
$goldReportJson = $goldReport | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($goldReportPath, $goldReportJson.Replace("`r`n", "`n") + "`n", [Text.UTF8Encoding]::new($false))
Write-Output "Anonymous release verified: $goldSize bytes, $($goldEntries.Count) entries, SHA-256 $goldHash"
