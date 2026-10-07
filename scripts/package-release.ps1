param([string]$Version = '1.5.2')

$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Version must use major.minor.patch.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression

$goldProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$goldReleaseDirectory = Join-Path $goldProjectRoot 'output\release'
[void][System.IO.Directory]::CreateDirectory($goldReleaseDirectory)
$goldArchivePath = Join-Path $goldReleaseDirectory "Gold-survival-v$Version.zip"
$goldRuntimeFiles = @('index.html', 'styles.css', 'js/config.js', 'js/challenges.js', 'js/growth.js', 'js/rules.js', 'js/game.js', 'js/storage.js', 'js/effects.js', 'js/audio.js')
if ((Get-Content -LiteralPath (Join-Path $goldProjectRoot 'js/config.js') -Raw) -notmatch ('version: "' + [regex]::Escape($Version) + '"')) { throw 'Requested version does not match runtime config.' }
foreach ($goldRelativePath in $goldRuntimeFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $goldProjectRoot $goldRelativePath) -PathType Leaf)) {
        throw "Missing runtime file: $goldRelativePath"
    }
}

$goldPlayerReadme = @"
# 黄金矿工 · 更多可回收物 v$Version

## 开始游玩

1. 将整个 ZIP 解压到一个文件夹，保留 js 文件夹和 styles.css。
2. 使用 Chrome、Edge 等现代桌面浏览器打开 index.html。
3. 选择挑战模式后点击对应的开始按钮，或使用“继续…”恢复已有挑战。无需安装 Node.js、依赖或构建工具，也无需联网加载素材。

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

## 随机矿层与挑战模式

v1.5.2 每关新增 8 个可回收物：4 个小金块、1 颗钻石、1 颗红宝石、2 个钱袋。普通首关 23 个、后期 32～34 个，事件最多 36 个；保持自然错落分散。单物价值、目标、尺寸、计时、回速、成就、概率和价格保持，新挑战规则为 1.5.2。已开始的 1.4.0／1.5.0／1.5.1 挑战保留原数量、地图、后续生成和已支付报价；新开挑战才增加数量。首次档案升级先备份原文，历史成果保留。

从第 5 关开始，每逢 5 的倍数关有 60% 事件机会；黄金热潮、钻石矿脉、地质不稳定、黑市、贫瘠矿层每次只出现一种。商店提前显示下一关实际事件、目标与固定报价，刷新不重抽。

主页可选无限生存、Seed 挑战或每日挑战。无限无终点，Seed 与每日均为 20 关赛程，使用同一初始资源和商店；第 20 关成功后结束并保存报告。Seed 接受 0～4294967295 的整数。相同模式、规则版本、Seed 与相同道具选择复现一致内容。

每日使用设备 UTC+8 日期，跨日继续保持原日期与地图，新局使用当前日期。离线日期和成绩不提供防作弊保证，可重复练习。Seed 和每日个人最佳按赛题/规则独立保存，依次比较通过关数、有效成绩、有效采矿时长，最多保留最近更新的 200 个赛题。报告中的分享文本可以复制，游戏不会自动对外发送。

13 项现行成就只在无限模式解锁；生涯按模式汇总，图鉴与报告共用，挑战成绩不会改变无限最高纪录。有效 v1.2.0 档案可迁入，当前入口和已支付交易保留，首次升级保留原文备份。

矿工档案中的个人最佳可按全部、每日或 Seed 筛选，每页显示 10 条；筛选和翻页不改变保存的数据。主页会在 UTC+8 午夜更新每日题目，继续旧每日挑战仍保留原日期。保存失败时显示“已记录，本次未能保存”，恢复存储后可通过后续正常保存提交当前页面成果。

## 自动保存

自动保存关卡起点和商店交易。刷新或关内退出后，主页“继续游戏”从当前关起点重开：同一地图/奖励，钱包、炸药、时间和增益回到入关状态，关内新收入不保留；从商店继续时保留原商品、报价、钱包、购买次数与增益。失败清除本轮存档，最高记录保留。新挑战需确认覆盖已有存档。

音效、最高记录和成长档案统一保存。v1.1.0 的有效最高记录及关卡/商店可迁入，原数据保留；无法还原的次数与时长从升级后开始记录。保存失败会有提示，此时关闭页面后可能恢复旧进度。未知或损坏档案保留原数据，可临时游玩。移动文件夹、更换浏览器、文件直开/服务地址切换或清除浏览器数据可能使用不同存档。同一地址请只用一个页面游玩，外部更新会冻结并要求重新载入。

## 矿工档案与成就

主页可查看矿工档案、13 项现行成就、9 类矿井图鉴和最近 10 局报告。首次回收、累计金块／钻石／回收数、较低收入与 10 关目标带来正常游玩反馈；下架困难任务的历史徽章和称号保留。Seed／每日不解锁无限成就。成就提供徽章及部分称号，称号只作展示，不增加采矿能力。

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
