# 黄金矿工：v1.5.4 验收记录

更新：2026-10-08。发行 **1.5.4**，规则保持 **1.5.3**。以下只记录本轮实际执行；旧 v1.5.0～v1.5.3 原文已移至 [历史验收](docs/history/validation-through-v153.md)，更早证据从 [历史索引](docs/HISTORY.md) 查阅。测试使用隔离档案，未访问真实个人存档。

## 游戏验收

| 实际检查 | 结果与条件 | 证据 |
| --- | --- | --- |
| 绘制开销与一致性 | 三视口同原始入口、手动 RAF／performance 时钟 60 帧；fillRect 15980→4640（约 -71%），每帧一次背景 drawImage；Canvas PNG、正式时间和帧数精确相同 | [旧基线](output/playwright/survival-v154-optimization-baseline-report.json)、[优化后](output/playwright/survival-v154-optimization-ui-report.json) |
| 碰撞与生成精确对照 | 40054 条随机／边界／零长度射线及 100 张地图与发布 v153 完全一致；不改变可能命中物体的求交或稳定顺序 | [optimization engine](output/playwright/survival-v154-optimization-engine-report.json) |
| 正式规则 | 45 项、1700 普通地图、45 秒无道具达标、数量／配比／间距／边界／确定性与后期预算通过 | [rules](output/playwright/survival-v154-rules-report.json) |
| 事件与备用 | 660 普通／事件同输入检查、60 强制备用、极高关号，事件降级 0→0 | [layouts](output/playwright/survival-v154-layouts-report.json) |
| 五套已发布规则兼容 | 450 地图和 450 商店逐项一致，1500 后期地图的四策略结果与发布标签精确相同；v153 档案原文／修订保留，直接读取零写入 | [compat](output/playwright/survival-v154-compat-report.json)、[legacy budgets](output/playwright/survival-v154-legacy-budgets-report.json) |
| 保存与成长 | 快照 6 项、13 项成就与 13 组成长边界、挑战 12 组／两个模式各 20 关模拟；旧迁移、重复提交、拒绝保存、未知／损坏格式、外部修订和混合规则通过 | [checkpoints](output/playwright/survival-v154-checkpoints-report.json)、[growth](output/playwright/survival-v154-growth-report.json)、[challenges](output/playwright/survival-v154-challenges-report.json)、[gameplay](output/playwright/survival-v154-gameplay-report.json) |
| 抓取边界与危险物 | 九类物体、圆角／切线／零长度、最早接触、石头、火药桶与截止在途通过；三视口七场景共 21 个受控浏览器案例 | [hook](output/playwright/survival-v154-hook-report.json)、[hook UI](output/playwright/survival-v154-hook-ui-report.json)、[新增物独立回收](output/playwright/survival-v154-density-report.json) |
| 页面与流程 | 三视口普通／五事件／备用 21 场景；模式／继续／覆盖取消、日期、商店、三类终局、分享、0／10／11／200 分页、浏览不写入、固定 HUD／隐藏主页无重复 DOM 写入 | [layouts UI](output/playwright/survival-v154-layouts-ui-report.json)、[experience](output/playwright/survival-v154-experience-report.json)、[challenges UI](output/playwright/survival-v154-challenges-ui-report.json) |
| 键盘焦点 | 发布版装备后焦点落到 BODY 已复现；优化版装备／卸下后聚焦可见卸下按钮，Enter／Tab 连续操作与后续筛选通过 | [复现](output/playwright/survival-v154-focus-baseline-report.json)、[修复](output/playwright/survival-v154-focus-ui-report.json) |
| 成就／声音／标签暂停 | 现行及历史称号保留，七类声音与文件／HTTP 通过；原生标签隐藏 2.2 秒冻结钩子、时间、特效与音频，返回仍暂停，主动继续不补算 | [achievements](output/playwright/survival-v154-achievements-ui-report.json)、[smoke](output/playwright/survival-v154-smoke-report.json)、[native pause](output/playwright/survival-v154-native-pause-report.json) |

游戏阶段于 Git `07df26d` 保存。整理前 [门槛报告](output/playwright/survival-v154-feature-gate-report.json)封存 26 份实际报告及 10 个运行文件哈希；本轮没有创建整项目备份 ZIP、副本或额外 Git bundle。最初问题与测量入口提交为 `e0dd756`。

## 原始计时试玩与性能边界

随机无限 Seed **2002876409**，原始地图／时钟、真实鼠标和空格，无炸药／商店增益，连续四关四次商店，第五关不出钩自然失败。达标 **10.53／10.66／19.61／15.49 秒**，收入 **2100／1700／1700／1750**，有效成绩 **7250**，40 次出钩／命中／回收，采矿时长 **300000 ms**。钱袋／古物的实际时间变化保留，四类新增物均回收，自然获得 9 项成就，刷新保留成绩。[real run](output/playwright/survival-v154-real-run-report.json)。这不是受控时钟或完整 20 关真实试玩。

Node 100 个固定场景预热后五轮交替执行发布引擎与优化版：生成中位耗时旧版 **4.07～5.18 ms**、新版 **1.69～1.95 ms**，逐项地图结果相同。真实浏览器测量使用本机 Windows、Headless Chrome **154.0.8037.98**，三视口 × 首关／1000 关 × 两版本，共 **12 次四秒**；中位帧间隔均约 **6.1 ms**，旧版 P95 **6.2～6.3 ms**、新版 **6.2～6.4 ms**。新版最大 **7.2 ms**、无 >50 ms 帧或长任务，旧版一次 **54.5 ms**。[performance UI](output/playwright/survival-v154-performance-ui-report.json)。没有稳定 FPS 提升证据；已确认减少 Canvas 调用和生成计算，不外推所有设备。

浏览器场景未处理错误均为空。游戏模拟、受控布局／时钟、原始计时试玩分别标注；截图与画面检查覆盖三种桌面视口。

## 整理、回归与发布

游戏验收通过后才整理。[清单](docs/OPTIMIZATION_V154.md#整理清单)与 [manifest](output/playwright/survival-v154-cleanup-manifest.json)记录两份旧入口归档、当前说明整合及引用更新。没有删除运行代码、迁移、历史证据、旧 ZIP、用户数据或 GitHub 资产。历史文件 SHA-256 由项目检查核对。


整理后 [引用检查](output/playwright/survival-v154-regression-project-report.json)通过：28 份 Markdown、当前本地链接／章节锚点、HTML 十个运行文件、模块与打包白名单；83 份 v152、108 份 v153 及更早受保护历史材料 SHA-256 保持。两份缺失本地旧备份仍单列。整理前项目报告是阶段快照，最终引用和历史保护以整理后报告为准。[回归哈希核验](output/playwright/survival-v154-regression-report.json)确认十个运行文件、26 份封存报告不变，两份归档来源与 Git 基线一致；没有因纯文档整合重复完整真实试玩。JavaScript 32 个、PowerShell 4 个解析及差异格式通过，备份脚本只解析未执行。

v1.5.4 玩家 ZIP **59741 字节／11 文件**，SHA-256 `5869672865e4c344c12b12bf19e06a05227db64c31655b7c2cc426929924a53a`。[独立解压](output/playwright/survival-v154-package-report.json)确认十个运行文件与源码一致；[玩家包浏览器](output/playwright/survival-v154-release-preflight-report.json)通过 7 组，包含真实输入、爆炸、暂停、保存、成就／图鉴／报告、Seed／每日和本地资源加载。正式 GitHub Release 和匿名下载复验尚待执行，完成后追加事实。

## 条件与限制

保留像素风、原生技术栈、单循环、原物理步长和全部玩法参数。发行更新不创建新赛题身份，v153 当前关／商店／后续关与记录直接延续；较早规则照其原参数运行。

两份历史本地备份文件缺失由引用检查单列报告，不属于可克隆的运行资源，本轮未重建或删除它们。localStorage 按浏览器／地址隔离、离线日期取设备时间、单活动页面修订保护不提供跨页面原子锁，均为既有边界。未进行手机专项适配或所有硬件的帧率保证；未发现本轮尚未修复的功能故障。
