param([string]$BackupRoot = 'output/backups')

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$backupBase = [IO.Path]::GetFullPath((Join-Path $projectRoot $BackupRoot))
if (-not $backupBase.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Backup destination must stay within the project.' }
$backupDir = Join-Path $backupBase ('pre-cleanup-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
$stage = Join-Path $backupDir 'snapshot'
$verified = Join-Path $backupDir 'verified'
New-Item -ItemType Directory -Path $stage -Force | Out-Null
$paths = @(& git -c core.quotepath=false -C $projectRoot ls-files --cached --others --exclude-standard)
if ($LASTEXITCODE -ne 0) { throw 'Cannot enumerate project files.' }
$paths += @(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'output/release') -Filter 'Gold-survival-v*.zip' -File | ForEach-Object { $_.FullName.Substring($projectRoot.Length + 1).Replace('\', '/') })
$paths = @($paths | Sort-Object -Unique)
$files = @()
$missing = @()
foreach ($relative in $paths) {
    $source = [IO.Path]::GetFullPath((Join-Path $projectRoot $relative))
    if (-not $source.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw "Unexpected source path: $relative" }
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { $missing += $relative; continue }
    $target = Join-Path $stage ('project/' + $relative)
    New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force | Out-Null
    $sha = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
    Copy-Item -LiteralPath $source -Destination $target
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sha) { throw "Snapshot copy mismatch: $relative" }
    $files += [ordered]@{ path = $relative; bytes = (Get-Item -LiteralPath $target).Length; sha256 = $sha }
}
$head = (& git -C $projectRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot read baseline commit.' }
$status = @(& git -c core.quotepath=false -C $projectRoot status --short)
if ($LASTEXITCODE -ne 0) { throw 'Cannot read working-tree status.' }
$bundlePath = Join-Path $stage 'repository-history.bundle'
& git -C $projectRoot bundle create $bundlePath --all
if ($LASTEXITCODE -ne 0) { throw 'Cannot back up committed Git history.' }
$oldErrorAction = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$bundleVerification = @(& git -C $projectRoot bundle verify $bundlePath 2>&1)
$bundleExit = $LASTEXITCODE
$ErrorActionPreference = $oldErrorAction
if ($bundleExit -ne 0) { throw 'Git history bundle verification failed.' }
$bundleSha = (Get-FileHash -LiteralPath $bundlePath -Algorithm SHA256).Hash.ToLowerInvariant()
$manifest = [ordered]@{ createdAt = [DateTime]::UtcNow.ToString('o'); sourceCommit = $head; workingTreeStatus = $status; scope = 'Tracked and non-ignored project files, including uncommitted contents; versioned player ZIPs; all locally available Git refs/history.'; excluded = @('Git working metadata and credentials', 'ignored browser profiles, caches, temporary outputs and local browser saves'); missingPaths = $missing; files = $files; historyBundle = @{ path = 'repository-history.bundle'; sha256 = $bundleSha; verified = $true } }
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $stage 'BACKUP_MANIFEST.json') -Encoding UTF8
@'
PRE-CLEANUP PROJECT BACKUP

project/ contains working files, including tracked modifications and non-ignored new files.
Versioned player ZIPs are included under project/output/release/.
BACKUP_MANIFEST.json records file hashes, working status and baseline commit.
repository-history.bundle preserves all locally available committed refs/history.
Ignored profiles, caches, credentials, temporary output and browser saves are excluded.

Restore only into a NEW directory first. Extract this ZIP and compare the manifest.
To recover committed history, use: git clone repository-history.bundle <new-directory>
Then compare or overlay project/ into that separate checkout; do not overwrite live work blindly.
This backup does not export browser localStorage or claim to include unavailable remote refs.
'@ | Set-Content -LiteralPath (Join-Path $stage 'BACKUP_README.txt') -Encoding UTF8
$archive = Join-Path $backupDir 'project-before-cleanup.zip'
[IO.Compression.ZipFile]::CreateFromDirectory($stage, $archive, [IO.Compression.CompressionLevel]::Optimal, $false)
[IO.Compression.ZipFile]::ExtractToDirectory($archive, $verified)
foreach ($file in $files) {
    $restored = Join-Path $verified ('project/' + $file.path)
    if ((Get-FileHash -LiteralPath $restored -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256) { throw "Extracted backup mismatch: $($file.path)" }
    if ((Get-FileHash -LiteralPath (Join-Path $projectRoot $file.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256) { throw "Source changed during backup: $($file.path)" }
}
if ((Get-FileHash -LiteralPath (Join-Path $verified 'repository-history.bundle') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $bundleSha) { throw 'Extracted Git history checksum mismatch.' }
$actual = @(Get-ChildItem -LiteralPath $verified -File -Recurse | ForEach-Object { $_.FullName.Substring($verified.Length + 1).Replace('\', '/') } | Sort-Object)
$expected = @(@($files | ForEach-Object { 'project/' + $_.path }) + @('repository-history.bundle', 'BACKUP_MANIFEST.json', 'BACKUP_README.txt') | Sort-Object)
if (Compare-Object $actual $expected) { throw 'Backup extraction contains unexpected or missing files.' }
$report = [ordered]@{ result = 'passed'; checkedAt = [DateTime]::UtcNow.ToString('o'); sourceCommit = $head; backupDirectory = $backupDir; archive = $archive; bytes = (Get-Item -LiteralPath $archive).Length; sha256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant(); projectFiles = $files.Count; archiveFiles = $actual.Count; playerArchives = @($files | Where-Object { $_.path -match '^output/release/Gold-survival-v.*\.zip$' }).Count; historyBundleVerified = $true; uncommittedWorkIncluded = $true; checks = @('source files copied with matching hashes', 'Git history bundle verified', 'independent extraction exactly matches manifest', 'source files unchanged during backup') }
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backupDir 'verification.json') -Encoding UTF8
$report | ConvertTo-Json -Depth 5
