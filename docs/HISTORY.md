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
