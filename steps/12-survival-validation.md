# 第 12 步：无限生存完整验收与交付

前置：11。依据：[扩展规格](../ENDLESS_SPEC.md)、[进度](../IMPLEMENTATION_PLAN.md)。

执行规则检查、1000 份布局验证、受控浏览器边界检查和原始游戏真实计时试玩。真实连续通过四关，经过四次商店进入第五关；另实测失败重开和刷新记录。原生 Chrome 标签隐藏必须实测，不用事件模拟替代。

检查文件直开、本地服务、两种桌面视口和短屏、缩放输入、商店限购、五种物体、声音、暂停和控制台。截图及报告放在 output/playwright。同步 README、VALIDATION、IMPLEMENTATION_PLAN 并更新交付包，排除浏览器缓存和用户数据。

只有全部要求通过才标记完成；真实试玩与受控检查分别记录，未验证项和限制明确列出。

```text
请读取 GAME_SPEC.md、ENDLESS_SPEC.md、IMPLEMENTATION_PLAN.md 和 steps/12-survival-validation.md，完成第 12 步完整验证、文档与交付，并更新进度和交接记录。
```
