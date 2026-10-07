# 黄金矿工：实施状态与最新交接

更新：2026-10-07。当前源码 **v1.5.1**，新挑战规则 **1.5.1**，旧活动挑战继续 **1.4.0／1.5.0**。第 30～35 步为已交付 v1.5.0；本轮第 36～40 步处理自然分散布局。

状态只在本文件维护。现行规则见 [GAME_SPEC](GAME_SPEC.md)，此次范围见 [GAMEPLAY_IMPROVEMENT_PLAN](GAMEPLAY_IMPROVEMENT_PLAN.md)，实际结果见 [VALIDATION](VALIDATION.md)。

## 1. 当前任务状态

| 步骤 | 版本 | 内容与完成条件 | 前置 | 状态 |
| --- | --- | --- | --- | --- |
| 36 | v1.5.1 | [即时备份](GAMEPLAY_IMPROVEMENT_PLAN.md#step-36) | v1.5.0 | 已完成 |
| 37 | v1.5.1 | [分散生成／路障／备用](GAMEPLAY_IMPROVEMENT_PLAN.md#step-37) | 36 | 已完成 |
| 38 | v1.5.1 | [三套规则与兼容](GAMEPLAY_IMPROVEMENT_PLAN.md#step-38) | 37 | 已完成 |
| 39 | v1.5.1 | [综合验收](GAMEPLAY_IMPROVEMENT_PLAN.md#step-39) | 38 | 已完成 |
| 40 | v1.5.1 | [文档／打包／完整发布](GAMEPLAY_IMPROVEMENT_PLAN.md#step-40) | 39 | 已完成（正式发布、公开下载复验） |
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

### 2026-10-07：v1.5.1 自然错落分散，功能验收通过

先核验新即时备份，再处理九个空间分区、类型随机配对、分区内取点、补充物多层分布和路障定位；普通、五事件与最多 64 个固定错落备用模板均走正式 45 秒路线验证。原后期预算不降低；校准高价值补充物深度及最后一个验证步，实际计时与物理步长、大小、收益、速度、成就和商店保持。

configForVersion 缓存 1.4.0／1.5.0 配置，旧布局生成原样保留；旧活动、预告、报价和后续关卡继续旧身份。storage 新增 v150 原文备份与一次档案升级，主键／结构保持；成长校验允许合法混合规则但旧档不能接受未来身份。新开及 Seed 重开为 1.5.1。

45 规则／1700 地图、660 事件、60 强制备用、180 旧地图／180 旧商店精确比较、快照／成长／碰撞／保存、21 浏览器场景、原生暂停和四关原始计时通过。后期保持既有 35／28 秒中位数门槛；事件降级 0→0。版本证据和环境／方法边界见 VALIDATION。仅同步本轮文档，没有扩展清理或修改旧证据；待完成独立 ZIP、GitHub 发布与公开下载复验。

### 2026-10-07：v1.5.1 完整交付

验收源码 5356f215cb916e69ff187c1f93660c81509015ff 已完整推送 main，正式 v1.5.1 标签固定该提交；[Release](https://github.com/OldBeer1/gold-miner/releases/tag/v1.5.1) 与 [玩家 ZIP](https://github.com/OldBeer1/gold-miner/releases/download/v1.5.1/Gold-survival-v1.5.1.zip) 为最新稳定版。58264 字节／11 文件，SHA-256 5dfc86dbd5b4928f2a1585fe9fc8bf204833f3006e591aeb3a2009d66c68af74。

[公开下载复验](output/playwright/survival-v151-published-release-report.json)和[源码／玩家包最终核验](output/playwright/survival-v151-final-check-report.json)通过；10 个运行文件逐字节对应当前源码、标签 Git blob 和独立解压包。发布证据和本交接另提交推送 main，标签及玩家包保持不变。36～40 无剩余功能工作；旧活动仍用原布局、浏览器／地址隔离及单页面存档边界见现行规格。即时备份只留本地，未访问个人存档，没有扩展清理或改写历史／旧资产。
