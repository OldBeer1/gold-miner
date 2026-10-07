# 黄金矿工：v1.5.1 验收记录

更新：2026-10-07。发行及新挑战规则 **1.5.1**；旧活动规则 **1.4.0／1.5.0**。本轮仅修改自然分散生成和必要兼容，不扩大项目清理。以下为本轮实际结果，后面的 v1.5.0 记录保留为历史证据。

## v1.5.1 游戏验收

| 实际检查 | 结果与条件 | 证据 |
| --- | --- | --- |
| 正式规则模拟 | 45 项、1700 普通地图，分散跨度／间距／边界／45 秒无道具路线通过；后期稳健路线中位数至少 35 秒，四种有限策略中最快中位数至少 28 秒，原门槛保持 | [rules](output/playwright/survival-v151-rules-report.json) |
| 快照、成长与挑战 | 快照 6 项、13 成就正反及 13 组成长边界、12 组挑战／660 普通事件地图；Seed 与每日各 20 关正式模拟、备用及降级通过 | [checkpoints](output/playwright/survival-v151-checkpoints-report.json)、[growth](output/playwright/survival-v151-growth-report.json)、[challenges](output/playwright/survival-v151-challenges-report.json) |
| 分散及保存专项 | 60 个强制备用（普通／五事件、早期至极大关号）通过；660 个新旧同种子事件对比，降级旧 0／新 0；三模式 v150 备份拒绝／重试、跨日、修订、未知及规则隔离通过 | [layouts](output/playwright/survival-v151-layouts-report.json) |
| 两套旧规则精确比较 | 对已发布 1.4.0／1.5.0 源码，合计 180 地图、180 商店精确一致；三模式旧入口／商店／报告及分享、一次升级与原文备份通过 | [compat](output/playwright/survival-v151-compat-report.json) |
| 碰撞及历史成果 | 四类目标擦边／边缘外、最近命中、石头／桶、下架历史成果、幂等、拒绝保存和修订保护通过 | [gameplay](output/playwright/survival-v151-gameplay-report.json) |
| Chrome 分散画面与旧存档控件 | 三视口 × 普通／五事件／备用，共 21 场景，无横向溢出，信息条不遮挡画布；旧 1.4／1.5 商店、下一关和同 Seed 新规则重开通过 | [layouts UI](output/playwright/survival-v151-layouts-ui-report.json) |
| Chrome 页面和流程 | DOM／日期／焦点／0、10、11、200 记录分页、拒绝保存重试、HTTP 双页面外部修订；五事件／交易／迁移／三种终局／分享／三视口／文件与 HTTP 通过 | [experience](output/playwright/survival-v151-experience-report.json)、[challenges UI](output/playwright/survival-v151-challenges-ui-report.json) |
| Chrome 成就与音效 | 13 现行／历史称号／目录、三视口缩放输入、文件与 HTTP、七类非零无削波音效通过 | [achievements UI](output/playwright/survival-v151-achievements-ui-report.json)、[smoke](output/playwright/survival-v151-smoke-report.json) |
| 原生标签 | 真实 Chrome 隐藏 2.2 秒，时间／钩子／动画冻结，音频释放，回来仍暂停且无时间补算，主页日期计时器按可见性取消／重建 | [native pause](output/playwright/survival-v151-native-pause-report.json) |

已实际查看普通、备用、事件与短屏截图，主要目标覆盖左右和不同深度，没有原固定半径圆弧。[普通 720](output/playwright/survival-v151-layout-none-1280x720.png)、[备用 720](output/playwright/survival-v151-layout-fallback-1280x720.png)、[地质不稳定 1080](output/playwright/survival-v151-layout-unstable-1920x1080.png)、[短屏](output/playwright/survival-v151-layout-none-1280x480.png)。720 及 1080 正常视口保持主要控件可用，480 短屏滚动。

### 原始计时与校准依据

原始随机无限 Seed **1438134658**，真实鼠标／空格、未改布局／计时／钱包／携带／结局：四关四店，第五关不出钩自然失败。四关达标约 **13.04／9.01／14.18／17.02 秒**；有效成绩 **6350**，28 次出钩、27 次回收，正式记录 **300000 ms**。自然取得 8 项成就，包含首次回收、金块累计、钻石累计、单关收入等；未将模拟 20 关写成真实赛程试玩。[real run](output/playwright/survival-v151-real-run-report.json)。

初版校准发现少数路线模拟超过 45 秒约一个物理步（0.008 秒），以及浅层高价值补充物让后期捷径中位数低于既有 28 秒门槛。新版验证最后一步截断至 45 秒；额外红宝石、宝箱与古物保留一定深度，其他补充物仍覆盖浅、中、深层。最终普通、事件、备用和后期预算均通过，没有降低检查门槛或改变收益、计时、速度、概率和价格。实际参数只在 GAME_SPEC 维护。

### 本轮备份与边界

即时备份：`output/backups/pre-cleanup-20261007-134041-1e9dca02/project-before-cleanup.zip`，**67204909 字节**，407 项目文件／410 解压文件、6 旧玩家包；SHA-256 `ee7054ce432f8571ae1dbf5aaecfed7ba793b2fad47c0303dbb7898df5c1109f`。复制、源文件不变、Git bundle 与独立解压精确清单通过。[backup](output/playwright/survival-v151-backup-report.json)。恢复到新目录，按清单核验，再从 bundle 克隆并对比 project/，不盲目覆盖现有工作。

测试全部使用隔离档案；个人浏览器存档未访问。旧挑战仍可能呈扇形，新开挑战才使用分散地图；旧内容与赛题身份保留。文件直开／HTTP 地址隔离、设备日期、单活动页面和保存权限仍为既有边界。未新增手机专项适配、FPS 基准或人工长期难度结论。

浏览器文件场景正常；首次沙箱内 HTTP 与原生 CDP 连接受环境限制，在授权范围内使用沙箱外本机检查后全部通过。没有把环境连接失败当作产品通过证据。25 个 JavaScript 文件、4 个 PowerShell 脚本解析及 Git 差异格式检查通过。

## v1.5.1 发布状态

游戏验收与独立玩家包检查已通过；[验收汇总](output/playwright/survival-v151-validation-report.json)记录 16 份报告及运行文件 SHA-256。玩家包 58264 字节／11 文件，SHA-256：`5dfc86dbd5b4928f2a1585fe9fc8bf204833f3006e591aeb3a2009d66c68af74`；[独立解压](output/playwright/survival-v151-package-report.json)、[解压包 7 项浏览器检查](output/playwright/survival-v151-release-preflight-report.json)通过。正式 GitHub 发布、公开下载复验及最终远程核对尚在交付中。v1.5.0 的发布事实保留如下。

---

# 黄金矿工：v1.5.0 历史验收记录

更新：2026-10-07。发行与新规则 **1.5.0**；旧活动使用 **1.4.0**。Windows、真实 Chrome 与已有 Playwright，无新增运行依赖。下表记录实际执行结果；历史 v1.1～v1.4.1 验收从 [历史索引](docs/HISTORY.md) 查阅。

## 游戏阶段

游戏功能检查全部通过后才开始第二份备份和清理：[阶段门槛](output/playwright/survival-v150-game-gate-report.json)保存验收前运行文件 SHA-256、报告路径与报告哈希。证据条件如下：

| 检查与条件 | 实际结果 | 证据 |
| --- | --- | --- |
| 正式规则模拟 | 45 项、1700 份布局通过，45 秒内无炸药／增益达标 | [rules](output/playwright/survival-v150-rules-report.json) |
| 快照与交易 | 6 组通过，入口回滚、商店、非法状态与拒绝写入 | [checkpoints](output/playwright/survival-v150-checkpoints-report.json) |
| 受控正式入账与成长 | 13 项成就正反、13 组事件／保存／图鉴／报告边界通过 | [growth](output/playwright/survival-v150-growth-report.json) |
| 挑战与事件模拟 | 12 组、660 普通／事件地图，Seed 与每日各完整 20 关，强制备用与事件降级通过 | [challenges](output/playwright/survival-v150-challenges-report.json) |
| 旧规则精确比较 | 对已发布 v1.4.0 源码，三模式 90 地图与 90 商店精确一致；旧入口／商店／报告保留 | [compat](output/playwright/survival-v150-compat-report.json) |
| 轮廓及兼容专项 | 四类目标新边缘可抓、边缘外不吸附、最近命中／石头／桶、下架历史／补发／拒绝保存／规则键分离通过 | [gameplay](output/playwright/survival-v150-gameplay-report.json) |
| Chrome，受控时钟与历史样本 | 模式、焦点、DOM、日期、0／10／11／200 记录分页、保存重试和 HTTP 外部修订通过 | [experience](output/playwright/survival-v150-experience-report.json) |
| Chrome，正式模拟入口与受控时钟 | 五事件、固定报价／购买／刷新、日期、三类终局／复制分享、20 关结束、迁移／拒绝保存和文件／HTTP 通过 | [challenges UI](output/playwright/survival-v150-challenges-ui-report.json) |
| Chrome，历史样本与真实控件 | 13 项现行目录、历史徽章／装备、旧商店下一关和旧 Seed 重开使用新规则通过 | [achievements UI](output/playwright/survival-v150-achievements-ui-report.json) |
| 原生 Chrome 标签 | 真实隐藏 2.2 秒，时间／钩子／特效冻结，音频释放，返回仍暂停、主动恢复无补算；主页日期定时器按可见性取消／恢复 | [native pause](output/playwright/survival-v150-native-pause-report.json) |
| Chrome 布局／输入与离线音频 | 三视口、短屏滚动、文件／HTTP、缩放输入、七类非零无削波音效通过 | [smoke](output/playwright/survival-v150-smoke-report.json) |

### 原始计时试玩

原始随机无限地图 Seed **1109182553**，真实鼠标／空格、原始计时，没有改地图、时间、收入、携带状态或结局。连续四关、四次商店，第五关不出钩自然失败；每关 60 秒，累计有效采矿 **300000 ms**。前四关真实达标约 **8.42／8.91／11.83／16.16 秒**，无炸药／增益；有效成绩 **6420**，29 次出钩／29 次回收。

自然取得 **8 项**：开工大吉、精准捕获、白手起家、第一份收获、收获颇丰、闪闪发光、小有金山、积少成多。此次没有自然取得通过 5／10 关、30 个回收、炸药 10 次与 8 类收藏；它们有正式正反条件检查，不把模拟当作自然取得证据。报告：[real run](output/playwright/survival-v150-real-run-report.json)，[第一关](output/playwright/survival-v150-real-level1.png)、[最终报告](output/playwright/survival-v150-real-report.png)。

### 显示尺寸与抓取结论

| 视口 | 小金块直径，旧→新 | 钻石／红宝石宽×高，旧→新 | 钱袋宽×高，旧→新 |
| --- | --- | --- | --- |
| 1280×720 | 18.96→27.08 px | 13.54×16.25→20.31×24.38 px | 16.25×18.96→24.38×28.44 px |
| 1920×1080 | 27.88→39.83 px | 19.92×23.90→29.88×35.85 px | 23.90×27.88→35.85×41.83 px |
| 1280×480 | 27.88→39.83 px | 19.92×23.90→29.88×35.85 px | 23.90×27.88→35.85×41.83 px |

短屏保持较大画布并滚动；HUD 矿层条不覆盖画布，无横向溢出。[基线测量](output/playwright/survival-v150-baseline-report.json)、[新版测量](output/playwright/survival-v150-enlarged-report.json)、[720 画面](output/playwright/survival-v150-enlarged-1280x720.png)。正式碰撞新增可抓区域与可见轮廓同步，旧边缘外路径改善，最早碰撞仍阻挡；没有新增远距离吸附。测量与键鼠试玩支持此次改善，但不是人工玩家长期难度或 FPS 基准。

## 备份与清理

| 阶段 | 本地目录（均在 output/backups） | ZIP 字节／文件 | 项目文件／旧玩家包 | SHA-256 |
| --- | --- | --- | --- | --- |
| 修改前 | pre-cleanup-20261007-123837-b458f4fe | 56026842／333 | 330／5 | 2b4c3d70a7b22fe10a8652daa6c25111bfe8172642566b3550691e03a331a819 |
| 游戏验收后、清理前 | pre-cleanup-20261007-125608-edc22080 | 61662213／386 | 383／5 | e8262f973587ff3e622a3dede74f60ae3ab0266e9b48f0295bd9fc5208171a54 |

两次都覆盖未提交需求和有效项目文件，可用 Git bundle、复制 SHA、独立解压精确清单、逐文件哈希和备份期间源文件不变均通过。恢复说明在各 ZIP 的 BACKUP_README.txt；先恢复到新目录再对比，不覆盖当前工作。

清理按 [保留／整合／归档／删除清单](docs/CLEANUP_V150.md)执行。5 份旧根文档快照、12 份已完成步骤正文及固定三关数据保留归档；删除 12 个重复步骤入口、停用三关配置和下架任务的无消费即时计算。旧迁移接口、历史统计字段、旧 ZIP／报告／截图与 GitHub 资产保留。原路径和源哈希见 [manifest](output/playwright/survival-v150-cleanup-manifest.json)。

## 清理回归与发布

清理后六类引擎／兼容检查，以及体验、挑战、历史成就、原生标签暂停和画面／音效浏览器检查全部再次通过；JavaScript、PowerShell 语法与差异格式检查通过。[回归汇总](output/playwright/survival-v150-regression-report.json)记录报告和当前运行文件哈希。游戏阶段报告已原样另存 feature 前缀，清理前门槛与清理后结果可分别追溯。

[项目检查](output/playwright/survival-v150-project-report.json)：22 份 Markdown、593 本地链接、140 章节锚点，HTML、模块和打包清单通过；285 份历史输出／旧包 SHA-256 不变。

玩家 ZIP **56259 字节／11 文件**，SHA-256：`2c0980689e386212c25adf0a35976aa603959536ae66c9b0f4e3492f12513991`。[独立解压核验](output/playwright/survival-v150-package-report.json)确认 10 个运行文件逐项与源码一致；[解压包浏览器检查](output/playwright/survival-v150-release-preflight-report.json)通过 7 组，包括真实输入、爆炸、暂停、保存、13 项成就、图鉴／报告、Seed／每日与本地资源加载。正式最新稳定 [v1.5.0 Release](https://github.com/OldBeer1/gold-miner/releases/tag/v1.5.0) 与 [玩家 ZIP](https://github.com/OldBeer1/gold-miner/releases/download/v1.5.0/Gold-survival-v1.5.0.zip) 已发布，源码标签为 `018dfce235b3c2851a7b429c17c5a95d5b32ea88`。[公开下载报告](output/playwright/survival-v150-published-release-report.json)确认匿名下载 56259 字节／11 文件，SHA-256 与独立包相同。10 个运行文件同时与当前源码、解压包和标签 Git blob 逐字节一致，见 [最终核验](output/playwright/survival-v150-final-check-report.json)。发布证据和最终交接最后提交推送 main；标签固定在验收源码，最后文档提交不修改运行文件。

## 条件与限制

纯引擎模拟、受控浏览器时钟／历史样本、原始计时试玩各自注明。没有用受控 20 关宣称人工或真实计时完整赛程，没有新增性能基准或手机专项验收。

个人浏览器存档未访问；测试使用隔离页面、合成合法档案与保留原文的迁移样本。旧活动继续 1.4.0 的小尺寸，新挑战才使用新尺寸与赛题；这保证旧布局／报价不被静默改变。档案升级后旧程序不保证可读取，降级应先导出或使用原文备份。离线每日依赖设备时钟；localStorage 受浏览器／地址／权限影响，单页面修订检查不提供并发原子锁。这些为既有边界，未发现本轮阻断问题。

发布阶段未声称新的完整试玩：公开包与通过 7 组浏览器检查的本地包字节一致，额外执行的是匿名下载、元数据、Git blob 和清单核验。清理后阶段的项目检查快照另存 [regression project](output/playwright/survival-v150-regression-project-report.json)，当前引用报告随最终文档重新检查；原阶段报告哈希可追溯。
