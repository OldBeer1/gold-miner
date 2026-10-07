# 黄金矿工：实施状态与最新交接

更新：2026-10-07。当前源码 **v1.5.0**，新挑战规则 **1.5.0**，旧活动挑战继续 **1.4.0**。用户要求的执行顺序已落实；三项需求与完整 GitHub 交付已完成，第 30～35 步全部完成。

状态只在本文件维护。现行规则见 [GAME_SPEC](GAME_SPEC.md)，此次范围见 [GAMEPLAY_IMPROVEMENT_PLAN](GAMEPLAY_IMPROVEMENT_PLAN.md)，实际结果见 [VALIDATION](VALIDATION.md)。

## 1. 当前任务状态

| 步骤 | 版本 | 内容与完成条件 | 前置 | 状态 |
| --- | --- | --- | --- | --- |
| 30 | v1.5.0 | [测量与定稿](GAMEPLAY_IMPROVEMENT_PLAN.md#step-30) | v1.4.1 | 已完成 |
| 31 | v1.5.0 | [抓取尺寸、碰撞和布局](GAMEPLAY_IMPROVEMENT_PLAN.md#step-31) | 30 | 已完成 |
| 32 | v1.5.0 | [成就目录和判定](GAMEPLAY_IMPROVEMENT_PLAN.md#step-32) | 30 | 已完成 |
| 33 | v1.5.0 | [旧档案与历史成果](GAMEPLAY_IMPROVEMENT_PLAN.md#step-33) | 31、32 | 已完成 |
| 34 | v1.5.0 | [游戏功能验收](GAMEPLAY_IMPROVEMENT_PLAN.md#step-34) | 33 | 已完成 |
| 35 | v1.5.0 | [备份后整合与完整交付](GAMEPLAY_IMPROVEMENT_PLAN.md#step-35) | 34 | 已完成（正式发布、公开下载复验） |

只有对应实现与实际验证通过才标记完成。第 35 步已完成独立玩家包、正式 GitHub Release、公开下载复验和最终证据同步；源码标签固定在验收源码。

## 2. 已完成基线

| 范围 | 结果 | 原文入口 |
| --- | --- | --- |
| 01～16 | 三关首版、无限模式、保存、阶梯难度、动态报价 | [历史索引](docs/HISTORY.md) |
| 17～22 | v1.2.0 成长档案、成就、图鉴和报告 | [完成步骤](docs/history/completed-steps-17-28.md#step-17) |
| 23～28 | 随机事件、Seed／每日，统一交付 v1.4.0 | [完成步骤](docs/history/completed-steps-17-28.md#step-23) |
| 29 | v1.4.1 页面与操作优化，规则保持 1.4.0 | [历史交接](docs/history/implementation-through-v141.md) |

旧候选、阶段状态和提示词已归档，不重复执行；历史发布事实与证据按对应版本查阅。

## 3. 最新交接

### 2026-10-07：v1.5.0 游戏完成，备份后整合

小金块、钻石、红宝石和钱袋放大；可见轮廓、正式碰撞、生成间距和矿区边界共用配置。价值、回速、计时、事件概率和价格保持。采用现有轮廓容错，石头与桶按最近命中阻挡。成就保留 6 项、新增／替换 7 项，12 个旧任务停止新解锁，历史徽章与称号仍可查阅。

关键接口：rules.configForVersion 按挑战选择当前／1.4.0 配置并缓存；createRun、advanceRun、createShop 和 captureCheckpoint 使用有效规则。growth 区分现行与历史目录；storage 首次升级备份 v140 原文并按无限已提交统计补发。旧活动、报价、报告与个人最佳保留原规则；新赛题派生和纪录键使用 1.5.0。

先完成 30～34 步正式规则、快照、成长、挑战、浏览器和原始计时试玩，再创建并核验第二份备份，然后开展清理。两次备份及实际游戏结果见 VALIDATION；清理范围、原路径、归档去向和保留理由见 [清单](docs/CLEANUP_V150.md)。未引入运行依赖，迁移与公开模块接口保留。

清理后回归、引用、独立玩家包和公开下载复验全部通过；发布证据与最终交接最后提交推送，核对远程与本地一致。持续授权按 [AGENTS](AGENTS.md) 执行。

### 2026-10-07：v1.5.0 完整交付

验收源码 `018dfce235b3c2851a7b429c17c5a95d5b32ea88` 已推送 main，v1.5.0 标签固定在该提交；正式最新稳定 [Release](https://github.com/OldBeer1/gold-miner/releases/tag/v1.5.0) 与 [玩家 ZIP](https://github.com/OldBeer1/gold-miner/releases/download/v1.5.0/Gold-survival-v1.5.0.zip) 已发布。新规则 1.5.0，旧活动按 1.4.0 继续；个人最佳与报告保留实际规则，不混用赛题成绩。

[匿名下载复验](output/playwright/survival-v150-published-release-report.json)通过：56259 字节、11 文件、SHA-256 `2c0980689e386212c25adf0a35976aa603959536ae66c9b0f4e3492f12513991`。10 个运行文件与独立解压包、当前源码和标签 Git blob 逐字节一致，[最终运行／发布核验](output/playwright/survival-v150-final-check-report.json)保留证据。

最终文档、发布报告与交接另提交推送 main；标签及玩家包运行文件保持不变。两份备份仅在本地，源码／文档／脚本／验收 JSON／PNG 全部有效交付内容同步，缓存、依赖、凭据与个人存档不进入仓库或玩家包。30～35 无剩余功能工作，未发现本轮阻断；旧规则尺寸、浏览器地址隔离、离线时钟和单活动页面限制见现行规格。
