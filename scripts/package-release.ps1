param([string]$Version = '1.2.0')

$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Version must use major.minor.patch.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem

$goldProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$goldReleaseDirectory = Join-Path $goldProjectRoot 'output\release'
[void][System.IO.Directory]::CreateDirectory($goldReleaseDirectory)
$goldArchivePath = Join-Path $goldReleaseDirectory "Gold-survival-v$Version.zip"
$goldRuntimeFiles = @('index.html', 'styles.css', 'js/config.js', 'js/growth.js', 'js/rules.js', 'js/game.js', 'js/storage.js', 'js/effects.js', 'js/audio.js')
if ((Get-Content -LiteralPath (Join-Path $goldProjectRoot 'js/config.js') -Raw) -notmatch ('version: "' + [regex]::Escape($Version) + '"')) { throw 'Requested version does not match runtime config.' }
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
3. 点击“新挑战”，或使用“继续游戏”恢复已有挑战。无需安装 Node.js、依赖或构建工具，也无需联网加载素材。

## 操作

| 操作 | 行为 |
| --- | --- |
| 空格 / 点击矿区 | 钩子待机时出钩 |
| ↓ / S / 炸药按钮 | 销毁携带物，快速空钩返回 |
| Esc / 暂停按钮 | 暂停或继续 |
| 音效开关 | 开启或关闭音效 |
| 返回开始 | 保留存档，回到主页 |

切换标签页自动暂停，返回后需主动继续。

## 玩法

随机无限关卡，每关基础时间 60 秒，达标后可继续赚钱，到时间结算。成功后进入四槽商店，每次累计最多购买四件，再进入下一关；失败结束本轮，重新挑战从第一关开始。

前三关熟悉操作，4～10 关逐渐增加石头和目标；10～19 同档，20、30、40……关升档。后期矿物收入同步增加，商店按下一关定价。清障、绕路或炸药各有时间与资源成本。

回收类物体拖回矿工处才触发收入或奖励。钩尖碰到火药桶立即原地爆炸，清除 80 个画布像素范围内的未回收物体，抓钩空钩返回。爆炸不扣时间、不消耗炸药或护身符；被炸毁物体没有收益或特殊效果。

## 保存

自动保存关卡起点和商店交易。刷新或关内退出后，主页“继续游戏”从当前关起点重开：同一地图/奖励，钱包、炸药、时间和增益回到入关状态，关内新收入不保留；从商店继续时保留原商品、报价、钱包、购买次数与增益。失败清除本轮存档，最高记录保留。新挑战需确认覆盖已有存档。

音效、最高记录和成长档案统一保存。v1.1.0 的有效最高记录及关卡/商店可迁入，原数据保留；无法还原的次数与时长从升级后开始记录。保存失败会有提示，此时关闭页面后可能恢复旧进度。未知或损坏档案保留原数据，可临时游玩。移动文件夹、更换浏览器、文件直开/服务地址切换或清除浏览器数据可能使用不同存档。同一地址请只用一个页面游玩，外部更新会冻结并要求重新载入。

## 矿工档案与成就

主页可查看矿工档案、18 项成就、9 类矿井图鉴和最近 10 局报告。成就提供徽章及部分称号，称号只作展示，不增加采矿能力。

本关回收、技巧与时长在正式结算后记录；关内刷新或返回后从入口继续，这些尚未结算的成果会回滚。布局发现和到达关数在首次入关时记录，继续同一入口不重复。

报告区分成功关有效成绩和包含失败关的实际回收收入。正式失败结束挑战并保存报告；确认新挑战覆盖旧局会记录主动放弃，只包含已结算成果。取消覆盖不改变数据，返回主页保留挑战。暂停可以查看资料，关闭资料后仍暂停，需主动继续。

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
$goldManifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $goldReleaseDirectory "release-manifest-v$Version.json") -Encoding utf8
Write-Output "玩家包已生成：$goldArchivePath（$($goldManifest.size) 字节，$($goldManifest.entries.Count) 个文件）"
Write-Output "SHA-256：$($goldManifest.sha256)"
