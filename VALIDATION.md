# 黄金矿工：v1.5.0 验收记录

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

[项目检查](output/playwright/survival-v150-project-report.json)：22 份 Markdown、587 本地链接、140 章节锚点，HTML、模块和打包清单通过；285 份历史输出／旧包 SHA-256 不变。

玩家 ZIP **56259 字节／11 文件**，SHA-256：`2c0980689e386212c25adf0a35976aa603959536ae66c9b0f4e3492f12513991`。[独立解压核验](output/playwright/survival-v150-package-report.json)确认 10 个运行文件逐项与源码一致；[解压包浏览器检查](output/playwright/survival-v150-release-preflight-report.json)通过 7 组，包括真实输入、爆炸、暂停、保存、13 项成就、图鉴／报告、Seed／每日与本地资源加载。GitHub 正式发布与匿名下载复验待完成。

## 条件与限制

纯引擎模拟、受控浏览器时钟／历史样本、原始计时试玩各自注明。没有用受控 20 关宣称人工或真实计时完整赛程，没有新增性能基准或手机专项验收。

个人浏览器存档未访问；测试使用隔离页面、合成合法档案与保留原文的迁移样本。旧活动继续 1.4.0 的小尺寸，新挑战才使用新尺寸与赛题；这保证旧布局／报价不被静默改变。档案升级后旧程序不保证可读取，降级应先导出或使用原文备份。离线每日依赖设备时钟；localStorage 受浏览器／地址／权限影响，单页面修订检查不提供并发原子锁。这些为既有边界，未发现本轮阻断问题。
