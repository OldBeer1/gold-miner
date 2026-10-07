# v1.5.0 清理整合清单

顺序门槛：[游戏功能验收](../output/playwright/survival-v150-game-gate-report.json)已通过；清理前第二份备份 `output/backups/pre-cleanup-20261007-125608-edc22080` 已独立解压核验通过，383 项目文件、5 个版本玩家 ZIP 和可用 Git 历史均覆盖。备份 SHA-256：`e8262f973587ff3e622a3dede74f60ae3ab0266e9b48f0295bd9fc5208171a54`。

本清单只处理当前需求内可确认的重复入口和无运行用途的内容。历史原文、旧报告／截图、玩家 ZIP、迁移接口、已解锁成果及 GitHub 发布资产保留。

| 处置 | 原路径／范围 | 去向／保留入口 | 理由与引用检查 |
| --- | --- | --- | --- |
| 保留 | README、GAME_SPEC、FEATURE_ROADMAP、IMPLEMENTATION_PLAN、VALIDATION、GAMEPLAY_IMPROVEMENT_PLAN、AGENTS | 原路径 | 运行、现行规则、未来范围、状态、证据、此次需求、接手约定各有职责，最终同步 1.5.0 |
| 整合／归档 | FEATURE_ROADMAP 的已实现 v1.2～v1.4.1 设计与重复规格 | [规划原文](history/feature-roadmap-through-v141.md) | 根入口只保留产品路线和未来范围；现行数值在 GAME_SPEC，旧 18 项清单仍可追溯 |
| 整合／归档 | IMPLEMENTATION_PLAN 的旧交接与 17～29 步过程 | [实施快照](history/implementation-through-v141.md) | 根入口聚焦 30～35 步实际状态和最新交接 |
| 整合／归档 | VALIDATION 的 v1.1～v1.4.1 验收全文 | [验收原文](history/validation-through-v141.md) | 当前证据与历史证据分开，全部历史报告／截图原路径不变 |
| 归档 | 修改前的 GAME_SPEC、需求与执行提示词 | [v1.4.1 规格](history/game-spec-v141.md)、[原始需求](history/gameplay-improvement-request.md) | 保留原规则、候选参数与原始授权；当前需求入口维护本轮定稿 |
| 整合后删除独立入口 | `steps/17-*.md` ～ `steps/28-*.md` 共 12 文件 | [完成步骤合并原文](history/completed-steps-17-28.md) | 全部已交付；完整正文按步骤合并，各入口使用 `step-17`～`step-28` 锚点，更新 Markdown 引用和 AGENTS |
| 归档后删除运行配置 | `js/config.js` 的旧 `levels` 固定三关数组 | [三关布局数据](history/three-level-layouts.json) | 当前页面、rules、存档、模块导出与正式检查均使用确定性无限生成；只有历史 `verify-step02.cjs` 使用该数组，且其按钮／流程已属于三关版，按历史源码运行。保留历史脚本和完整数组 |
| 删除重复计算 | `growth.evaluate` 中 12 项下架任务的即时进度计算 | 历史定义与档案字段继续保留在 growth | 判定仅遍历 13 项现行定义；删除无消费的临时计算，不删除历史 ID、统计字段、迁移或报告接口 |
| 保留 | 旧存档适配、checkpoint/preferences API、旧统计暂存字段 | 原路径 | 检查脚本、历史快照或公开模块接口仍依赖；用途不明确的导出没有删掉 |
| 保留 | 旧玩家 ZIP、验收 JSON／PNG、历史浏览器脚本、Git 历史 | 原路径与 GitHub Release | 有追溯或恢复价值；没有删除远程资产、改写历史或强制推送 |

具体原文件 SHA-256、归档映射及保护清单见 [清理清单报告](../output/playwright/survival-v150-cleanup-manifest.json)。整合时校验文件链接、章节锚点、HTML 引用、运行模块与包清单；清理后回归结果统一见 [VALIDATION](../VALIDATION.md)。

恢复时把任一备份解压到**新的目录**，按 `BACKUP_MANIFEST.json` 校验；需要历史仓库时从 `repository-history.bundle` 克隆，再在独立目录对照 `project/` 文件。不要直接覆盖有未提交工作的当前目录。备份不包含真实浏览器 localStorage；本轮使用隔离测试档案，未读取或迁移个人存档。
