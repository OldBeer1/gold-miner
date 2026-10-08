# 黄金矿工：历史资料索引

整理：2026-10-04。这里保存已完成工作的原文与证据入口。当前规则读 [GAME_SPEC](../GAME_SPEC.md)，当前状态与下一步读 [IMPLEMENTATION_PLAN](../IMPLEMENTATION_PLAN.md)，未来产品需求读 [FEATURE_ROADMAP](../FEATURE_ROADMAP.md)。

## 版本与完成里程碑

| 阶段 | 已完成内容 | 原文 |
| --- | --- | --- |
| 三关首版，01～07 | 固定三关、基础商店、失败重试、像素画面和音效 | [首版规格](history/three-level-spec.md)、[完成步骤](history/completed-steps-01-16.md#step-01) |
| v1.0.0，08～12 | 无限生存、随机奖励、火药桶、四槽商店与公开交付 | [无限扩展规格原文](history/survival-expansion-spec.md)、[完成步骤](history/completed-steps-01-16.md#step-08) |
| v1.1.0，13～16 | 关间保存、阶梯难度、动态价格、新纪录与正式交付 | [存档与难度扩展原文](history/save-difficulty-expansion-spec.md)、[完成步骤](history/completed-steps-01-16.md#step-13) |

无限扩展原文含后续 v1.1.0 衔接说明，各历史正文保留当时的参数、阶段状态及执行提示词。查历史设计或调参时可参考，实施当前任务按现行规格与最新交接执行。

## 完整记录与证据

- [截至本次整理的完整交接与实施日志](history/implementation-log-2026-10-04.md)：首版、无限版、v1.1.0 和功能规划的原始过程记录。
- [截至 v1.1.0 的验收全文](history/validation-through-v1.1.0.md)：包括首版、v1.0.0、v1.1.0 的条件、结果、局限与发布复验。
- [第 01～16 步合并原文](history/completed-steps-01-16.md)：旧任务已完成，原独立文件退出现行 `steps/`。
- 当前版本实际验证入口仍是 [VALIDATION.md](../VALIDATION.md)。

历史报告、截图与检查脚本仍在 `output/playwright/`，旧 ZIP 和本地清单仍在原输出位置。`final-*`、`step01～07` 属于三关首版，未带 `v110` 的 `survival-*` 对应旧无限版证据；具体版本以报告内容和验收原文为准。旧证据不能证明未来成长、事件或挑战功能已实现。

## 本次整理范围

根目录两份扩展规格已整合进 GAME_SPEC；其原文保留在历史目录。第 01～16 步独立文件合并为一份历史文档。旧交接和旧验收移出当前入口，分步状态只在当前实施计划维护。

归档保留原文事实并重新定位本地链接；当前源码、历史证据、玩家包和浏览器数据未由文档整理改动。远程版本与下载链接未在本轮重新联网核验，发布事实以保留的历史记录为依据。

## 2026-10-07：v1.5.0 整理归档

- [截至 v1.4.1 的规划原文](history/feature-roadmap-through-v141.md)：18 项旧成就、成长字段、事件／每日／Seed 与体验范围。
- [整理前实施快照](history/implementation-through-v141.md)：17～29 完整交接和 30～34 游戏完成记录。
- [截至 v1.4.1 的验收原文](history/validation-through-v141.md)：旧证据与发布复验。
- [v1.4.1 现行规格快照](history/game-spec-v141.md)：原尺寸和规则。
- [原始游戏／清理需求及提示词](history/gameplay-improvement-request.md)：候选与执行顺序，含本轮游戏阶段定稿。
- [第 17～28 步合并原文](history/completed-steps-17-28.md)：已完成的 12 个独立入口归档。
- [旧固定三关数组](history/three-level-layouts.json)：从运行配置退出，完整数据留存。

历史脚本只证明其标注版本，三关 verify-step02 等应在对应历史源码运行；该阶段检查使用 README 当时的 v150 入口；当前检查版本见现行 README。旧 ZIP、JSON、PNG 与 GitHub 发布资产保留原处。整理理由和恢复方式见 [本轮清单](CLEANUP_V150.md)，当前实际回归见 [VALIDATION](../VALIDATION.md)。

## 2026-10-08：v1.5.4 整合入口

- [截至 v1.5.3 的实施状态与完整交接](history/implementation-through-v153.md)：30～50 步、各版阶段状态和最终发布事实。
- [截至 v1.5.3 的验收原文](history/validation-through-v153.md)：v150～v153 游戏、备份、性能、兼容与公开发布证据。
- [v1.5.4 问题、测量和整理清单](OPTIMIZATION_V154.md)：先完成游戏验收，再整合当前文档；没有确认可删除的运行代码。

本轮根实施计划与 VALIDATION 只维护当前任务与实际验证，旧记录保留在上述归档。历史文中的“本轮／最新”仅指其对应版本。当前检查入口以 README 为准；旧报告与 ZIP 不删。历史本地备份引用的两份缺失文件单列说明，不属于可克隆的运行资源。
