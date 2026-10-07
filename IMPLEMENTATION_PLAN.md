# 黄金矿工：实施状态与最新交接

更新：2026-10-07。当前源码 **v1.5.0**，新挑战规则 **1.5.0**，旧活动挑战继续 **1.4.0**。用户要求的执行顺序已落实；本地实现、整理、回归与独立玩家包已通过，正在完成 GitHub 交付。

状态只在本文件维护。现行规则见 [GAME_SPEC](GAME_SPEC.md)，此次范围见 [GAMEPLAY_IMPROVEMENT_PLAN](GAMEPLAY_IMPROVEMENT_PLAN.md)，实际结果见 [VALIDATION](VALIDATION.md)。

## 1. 当前任务状态

| 步骤 | 版本 | 内容与完成条件 | 前置 | 状态 |
| --- | --- | --- | --- | --- |
| 30 | v1.5.0 | [测量与定稿](GAMEPLAY_IMPROVEMENT_PLAN.md#step-30) | v1.4.1 | 已完成 |
| 31 | v1.5.0 | [抓取尺寸、碰撞和布局](GAMEPLAY_IMPROVEMENT_PLAN.md#step-31) | 30 | 已完成 |
| 32 | v1.5.0 | [成就目录和判定](GAMEPLAY_IMPROVEMENT_PLAN.md#step-32) | 30 | 已完成 |
| 33 | v1.5.0 | [旧档案与历史成果](GAMEPLAY_IMPROVEMENT_PLAN.md#step-33) | 31、32 | 已完成 |
| 34 | v1.5.0 | [游戏功能验收](GAMEPLAY_IMPROVEMENT_PLAN.md#step-34) | 33 | 已完成 |
| 35 | v1.5.0 | [备份后整合与完整交付](GAMEPLAY_IMPROVEMENT_PLAN.md#step-35) | 34 | 本地回归与玩家包通过；GitHub 交付中 |

只有对应实现与实际验证通过才标记完成。第 35 步还需独立玩家包、正式 GitHub Release、公开下载复验和最终远程一致性，不把本地验收当作完整交付。

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

清理后回归、引用和独立玩家包全部通过；当前仅剩 GitHub 标签／Release／公开下载复验及最终推送。持续授权按 [AGENTS](AGENTS.md) 执行。
