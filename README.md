# 黄金矿工 · 无限生存

原生 HTML、CSS、JavaScript 和 Canvas 2D 像素风单机游戏，无构建步骤、第三方运行依赖或远程素材。当前正式版本为 **v1.2.0：矿工成长档案**，第 17～22 步已完成实现、验收与 GitHub 交付。后续第 23 步为 v1.3.0 随机事件。

![采矿画面](output/playwright/survival-v120-scene-1280x720.png)

## 游玩

双击 `index.html`，使用 Chrome、Edge 等现代桌面浏览器打开。点击“新挑战”，已有存档时点击“继续游戏”。玩家包解压整个目录后直接打开，无需 Node.js 或联网。

[下载 v1.2.0 玩家包](https://github.com/OldBeer1/gold-miner/releases/download/v1.2.0/Gold-survival-v1.2.0.zip) · [版本说明](https://github.com/OldBeer1/gold-miner/releases/tag/v1.2.0) · [源码仓库](https://github.com/OldBeer1/gold-miner)。本地同一玩家包为 `output/release/Gold-survival-v1.2.0.zip`，打包、独立解压及公开下载复验见 [VALIDATION.md](VALIDATION.md)。

需要本地服务时，在项目根目录使用 **PowerShell**：

```powershell
node .\scripts\serve.cjs
```

打开 [本机游戏](http://127.0.0.1:8080)，Ctrl+C 停止；端口占用可用 `node .\scripts\serve.cjs 8081`。文件直开无需服务，两种地址使用各自的浏览器存档。

## 操作与流程

| 操作 | 行为 |
| --- | --- |
| 空格／点击矿区 | 待机时出钩 |
| ↓／S／炸药按钮 | 销毁携带物，快速空钩返回 |
| Esc／暂停按钮 | 暂停或继续；切标签自动暂停，回来需主动继续 |
| 返回开始 | 保留挑战入口或商店存档，回主页 |
| 音效开关 | 切换音效并保存 |

每关基础 60 秒，提前达标仍可继续赚钱，到截止结算。物体完整收回才入账；火药桶碰撞即原地爆炸，范围销毁无奖励。成功后入店再进入下一关，失败结束挑战。

钱包、炸药跨关保留，增益只影响下一关。成绩仅累计成功关收入，购物不扣成绩，失败关不累计。前三关热身，10～19 同档，20、30、40……关升档；每关保留 45 秒内无炸药／增益达标路线。精确物体、概率、价格、难度和截止规则统一在 [GAME_SPEC.md](GAME_SPEC.md)。

## 保存

- 入关前保存起点；关内退出／刷新后回同一入口，保留布局和随机结果，关内收入、道具消耗与时间奖励回滚。
- 成功结算和成功购物保存商店；恢复商品、报价、资金、库存、限购和增益，成绩不重复入账。
- 返回主页保留挑战，新挑战确认覆盖，取消不改存档；正常存储时失败清挑战，最高纪录保留。
- 保存被拒绝或数据损坏时显示真实结果，当前页面仍可玩，但关闭后不能保证最新状态。存档只属于当前浏览器与地址。

成长档案、活动挑战和近期报告统一保存。v1.1.0 音效、最高纪录、有效关卡／商店通过显式迁移保留；未知历史统计从升级后记录，旧键保留。损坏或未知的新档案保留原数据，可临时游玩；其他页面更新档案时冻结并要求重新载入，首发按单页面游玩设计。键、结构及异常边界见 [现行规格的保存章节](GAME_SPEC.md#7-自动保存与历史记录)。

## 矿工成长档案

主页新增“矿工档案”“成就”“矿井图鉴”和最近报告。18 项成就提供徽章及部分可装备称号，称号只作展示；支持分类与解锁筛选，隐藏项解锁前仅给提示。

生涯统计区分成功关有效成绩、包含最终失败关的实际回收收入、出钩／命中／回收与有效采矿时长。9 类图鉴先记录布局发现，再由实际回收或火药桶引爆完成研究；钱袋 5 档和宝箱 3 档奖励需回收后发现。

本关统计与成就候选在结算后保存，入口重试会回滚。失败保存单局报告，确认覆盖生成主动放弃报告，只包含已提交成果；最近报告最多 10 份。暂停可打开资料，关闭后仍需主动继续。

## 开发与验证

在项目根目录使用 **PowerShell** 执行无第三方运行依赖的检查：

```powershell
node .\scripts\check-checkpoints.cjs
node .\scripts\check-growth.cjs
node .\scripts\check-rules.cjs
```

浏览器检查需要开发环境已有 Playwright 和 Chrome；必要时用 `GOLD_PLAYWRIGHT_MODULE` 指向已有包。脚本在 `output/playwright/`，它们不属于游戏运行依赖。

| 脚本 | 检查内容 |
| --- | --- |
| `verify-survival-v120-growth.cjs` | 成长页面、迁移、报告、输入、存储拒绝、外部修订与三种视口 |
| `verify-survival-v120-real-run.cjs` | v1.2.0 原始地图真实计时连续四关、第五关失败及成长统计 |
| `verify-survival-v120-native-pause.cjs` | v1.2.0 原生标签隐藏与恢复 |
| `verify-survival-v120-smoke.cjs` | 最终画面、缩放输入、文件／HTTP、七类音效与静音 |
| `verify-survival-release.cjs` | 独立解压玩家包的运行完整性 |

v1.2.0 检查脚本自行启动并关闭各自的本地测试服务。旧 v1.1.0 脚本与报告保留用于历史追溯，当前成长验收使用上述 v1.2.0 入口。实际结果、测试条件和局限只在 [VALIDATION.md](VALIDATION.md) 维护；纯文档修改检查内容与链接，不重复完整游戏试玩。

玩家包沿用 [package-release.ps1](scripts/package-release.ps1)，使用对应实现版本号，核对运行文件、清单、SHA-256 和独立解压结果。保留旧 ZIP，排除依赖、缓存、浏览器配置和日志；每个版本验收后按 [AGENTS.md](AGENTS.md) 的完整 GitHub 交付要求执行。

## 开发入口与后续路线

| 文档 | 职责 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 接手顺序、开发与验证约定 |
| [GAME_SPEC.md](GAME_SPEC.md) | 当前已经实现的玩法、数值与保存规则 |
| [FEATURE_ROADMAP.md](FEATURE_ROADMAP.md) | v1.2.0 成长设计与 v1.3.0～v1.4.0 后续规格 |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | 当前状态、唯一分步索引和最新交接 |
| [VALIDATION.md](VALIDATION.md) | 当前版本实际验证与限制 |
| [docs/HISTORY.md](docs/HISTORY.md) | 旧规格、完成步骤、历史交接与验收原文索引 |

v1.2.0 第 17～22 步已完成；v1.3.0 第 23～25 步为随机事件，v1.4.0 第 26～28 步为 Seed／每日挑战。任务状态只在实施计划维护，每份 `steps/` 文件提供范围、验证和执行提示词。后续从 [第 23 步](steps/23-random-event-rules.md) 开始。

| 文件 | 实现职责 |
| --- | --- |
| `index.html` / `styles.css` | 中文页面、商店和布局 |
| `js/config.js` | 数值、概率与配置 |
| `js/rules.js` | 确定性生成、路线、碰撞、奖励、交易与快照 |
| `js/game.js` | 页面流程、输入、单更新循环与绘制 |
| `js/storage.js` | 保存校验、恢复与旧音效继承 |
| `js/growth.js` | 稳定成就目录、暂存统计、图鉴、统一档案更新与报告 |
| `js/effects.js` / `js/audio.js` | 视觉与音效反馈 |
