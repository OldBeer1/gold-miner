param([string]$Version = '1.0.0')

$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Version must use major.minor.patch.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem

$goldProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$goldReleaseDirectory = Join-Path $goldProjectRoot 'output\release'
[void][System.IO.Directory]::CreateDirectory($goldReleaseDirectory)
$goldArchivePath = Join-Path $goldReleaseDirectory "Gold-survival-v$Version.zip"
$goldRuntimeFiles = @('index.html', 'styles.css', 'js/config.js', 'js/rules.js', 'js/game.js', 'js/storage.js', 'js/effects.js', 'js/audio.js')
foreach ($goldRelativePath in $goldRuntimeFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $goldProjectRoot $goldRelativePath) -PathType Leaf)) {
        throw "Missing runtime file: $goldRelativePath"
    }
}

$goldPlayerReadme = @"
# 黄金矿工 · 无限生存 v$Version

## 开始游玩

1. 将整个 ZIP 解压到一个文件夹，保留 js 文件夹和 styles.css。
2. 使用 Chrome、Edge 等现代桌面浏览器打开 index.html。
3. 点击“开始挑战”。无需安装 Node.js、依赖或构建工具，也无需联网加载素材。

## 操作

| 操作 | 行为 |
| --- | --- |
| 空格 / 点击矿区 | 钩子待机时出钩 |
| ↓ / S / 炸药按钮 | 销毁携带物，快速空钩返回 |
| Esc / 暂停按钮 | 暂停或继续 |
| 音效开关 | 开启或关闭音效 |
| 返回开始 | 结束当前挑战 |

切换标签页自动暂停，返回后需主动继续。

## 玩法

随机无限关卡，每关基础时间 60 秒，达标后可继续赚钱，到时间结算。成功后进入四槽商店，每次累计最多购买四件，再进入下一关；失败结束本轮，重新挑战从第一关开始。

回收类物体拖回矿工处才触发收入或奖励。钩尖碰到火药桶立即原地爆炸，清除 80 个画布像素范围内的未回收物体，抓钩空钩返回。爆炸不扣时间、不消耗炸药或护身符；被炸毁物体没有收益或特殊效果。

## 保存

浏览器只保存音效设置、最高收入和最高已通过关数。刷新会结束当前挑战，不保存中途进度。移动文件夹、更换浏览器或清除浏览器数据可能使用不同记录。

源码、需求文档和更新版本：https://github.com/OldBeer1/gold-miner
"@

$goldStream = [System.IO.File]::Open($goldArchivePath, [System.IO.FileMode]::Create)
$goldArchive = [System.IO.Compression.ZipArchive]::new($goldStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($goldRelativePath in $goldRuntimeFiles) {
        [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $goldArchive, (Join-Path $goldProjectRoot $goldRelativePath), $goldRelativePath,
            [System.IO.Compression.CompressionLevel]::Optimal)
    }
    $goldReadmeEntry = $goldArchive.CreateEntry('README.md')
    $goldWriter = [System.IO.StreamWriter]::new($goldReadmeEntry.Open(), [System.Text.UTF8Encoding]::new($false))
    try { $goldWriter.Write($goldPlayerReadme.Replace("`r`n", "`n") + "`n") } finally { $goldWriter.Dispose() }
} finally { $goldArchive.Dispose(); $goldStream.Dispose() }

$goldManifest = [ordered]@{
    version = $Version
    filename = [System.IO.Path]::GetFileName($goldArchivePath)
    size = (Get-Item -LiteralPath $goldArchivePath).Length
    sha256 = (Get-FileHash -LiteralPath $goldArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    runtimeFiles = $goldRuntimeFiles
    entries = $goldRuntimeFiles + 'README.md'
}
$goldManifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $goldReleaseDirectory 'release-manifest.json') -Encoding utf8
Write-Output "玩家包已生成：$goldArchivePath（$($goldManifest.size) 字节，9 个文件）"
Write-Output "SHA-256：$($goldManifest.sha256)"
