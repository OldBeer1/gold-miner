"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
const report = { version: "1.2.0", method: "real Chrome UI, controlled clock and explicit layouts; native tab hiding tested separately", checks: [], errors: [] };
const diag = page => page.evaluate(() => GoldMiner.getDiagnostics());
const add = name => { report.checks.push(name); console.log(name); };
function fixture() {
  let rules;
  Object.defineProperty(window, "GoldMinerRules", { get() { return rules; }, set(original) {
    rules = Object.freeze({ ...original, createRun(config, n = 1, entry = {}) {
      if (!window.__growthFixture || entry.level) return original.createRun(config, n, entry);
      const layout = window.__growthFixture === "barrel" ? [
        { id: "keg", type: "powderKeg", x: 480, y: 360 },
        ...[[535, 335], [535, 385], [425, 335], [425, 385]].map(([x, y], i) => ({ id: `near-${i}`, type: "smallGold", x, y })),
      ] : [{ id: "gold", type: "largeGold", x: 480, y: 260 }];
      return original.createRun(config, n, { ...entry, level: { id: n, target: 300, duration: 60, layout } });
    } });
  } });
}
async function controlled(browser, url, initialize, data) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", e => report.errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") report.errors.push(m.text()); });
  await page.addInitScript(fixture);
  if (initialize) await page.addInitScript(initialize, data);
  await page.clock.install(); await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1));
  await page.goto(url); return page;
}
async function launch(page) { await page.locator("#game-canvas").focus(); await page.keyboard.press("Space"); }
async function profile(page, name) { await page.locator(`[data-profile="${name}"]`).filter({ visible: true }).first().click(); }
async function serveReady(port) {
  for (let i = 0; i < 40; i++) {
    const ok = await new Promise(resolve => { const r = http.get(`http://127.0.0.1:${port}`, response => { response.resume(); resolve(response.statusCode === 200); }); r.on("error", () => resolve(false)); });
    if (ok) return; await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error("本地服务未启动");
}
(async () => {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const server = spawn(process.execPath, ["scripts/serve.cjs", "8083"], { cwd: path.resolve(__dirname, "../.."), windowsHide: true, stdio: "ignore" });
  try {
    report.browser = await browser.version();
    const fileUrl = pathToFileURL(path.resolve(__dirname, "../../index.html")).href;
    const page = await controlled(browser, fileUrl);
    await profile(page, "achievements"); assert.equal(await page.locator("[data-achievement]").count(), 18);
    const hidden = page.locator('[data-achievement="last_second_rescue"]'); assert.match(await hidden.textContent(), /？？？/); assert.doesNotMatch(await hidden.textContent(), /实际获得加时/);
    await page.locator("#achievement-status").selectOption("已解锁"); assert.equal(await page.locator("[data-achievement]").count(), 0);
    await page.locator("#achievement-status").selectOption("未解锁"); assert.equal(await page.locator("[data-achievement]").count(), 18);
    await page.locator("#achievement-category").selectOption("技巧"); assert.equal(await page.locator("[data-achievement]").count(), 2);
    await profile(page, "collection"); assert.equal(await page.locator("[data-mineral]").count(), 9);
    assert.equal(await page.locator("details").count(), 0); await page.keyboard.press("Escape"); assert.equal((await diag(page)).screen, "home");
    add("三类资料入口、18 项成就筛选、隐藏提示与 9 类未研究图鉴");
    for (const [width, height] of [[1280, 720], [1920, 1080], [1280, 480]]) {
      await page.setViewportSize({ width, height });
      await page.locator("#home-screen").evaluate(node => { node.scrollTop = 0; });
      if (height >= 600) {
        const home = await page.locator("#home-screen").boundingBox();
        const nav = await page.locator("#home-screen .profile-actions").boundingBox();
        assert.ok(nav.y + nav.height <= home.y + home.height, "常规视口主页资料按钮应完整可见");
      }
      await page.screenshot({ path: path.join(__dirname, `survival-v120-home-final-${width}x${height}.png`), fullPage: true });
      for (const name of ["career", "achievements", "collection"]) {
        await profile(page, name);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const box = await page.locator("#profile-close-button").boundingBox(); assert.ok(box.y >= 0 && box.y + box.height <= height);
        await page.locator("#profile-content").evaluate(node => { node.scrollTop = node.scrollHeight; });
        await page.screenshot({ path: path.join(__dirname, `survival-v120-${name}-${width}x${height}.png`), fullPage: true });
        await page.locator("#profile-close-button").click();
      }
    }
    await page.setViewportSize({ width: 1280, height: 720 }); add("三种视口、短屏长列表滚动、返回按钮和无横向溢出");
    await page.evaluate(() => { window.__growthFixture = "gold"; }); await page.locator("#start-button").click();
    const entry = await diag(page); assert.equal(entry.saveError, false); assert.equal(entry.progress.profile.career.runsStarted, 1);
    await launch(page); await page.clock.runFor(2100); const collected = await diag(page);
    assert.equal(collected.run.levelIncome, 300); assert.equal(collected.run.growth.objectsRecovered, 1);
    assert.equal(collected.progress.profile.career.objectsRecovered, 0); assert.equal(collected.progress.profile.collection.largeGold.seen, 1);
    await page.reload(); await page.locator("#continue-button").click(); const restored = await diag(page);
    assert.equal(restored.run.levelIncome, 0); assert.equal(restored.run.growth.objectsRecovered, 0); assert.equal(restored.progress.profile.career.runsStarted, 1);
    assert.equal(restored.progress.profile.collection.largeGold.seen, 1); assert.equal(restored.progress.activeRun.runId, entry.progress.activeRun.runId);
    await launch(page); await page.clock.runFor(300); assert.equal((await diag(page)).run.hook.phase, "returning-loaded");
    await page.keyboard.press("ArrowDown"); assert.equal((await diag(page)).run.growth.dynamiteUsed, 1);
    await page.reload(); await page.locator("#continue-button").click();
    assert.equal((await diag(page)).run.bombs, 1); assert.equal((await diag(page)).run.growth.dynamiteUsed, 0);
    assert.equal((await diag(page)).progress.profile.collection.largeGold.seen, 1);
    add("文件直开：回收及实际炸药使用后刷新回入口，资源与成长回滚、发现与挑战次数不重计");
    await page.keyboard.press("Escape"); const paused = await diag(page);
    await profile(page, "career"); await page.clock.fastForward(120000); assert.deepEqual((await diag(page)).run, paused.run);
    await page.locator("#profile-content").evaluate(node => { node.tabIndex = 0; node.focus(); });
    await page.keyboard.press("Space"); assert.deepEqual((await diag(page)).run, paused.run);
    assert.equal((await diag(page)).screen, "profile");
    await page.keyboard.press("Escape"); assert.equal((await diag(page)).screen, "paused");
    await page.locator("#game-canvas").focus();
    await page.keyboard.press("Space"); assert.deepEqual((await diag(page)).run, paused.run);
    await page.locator("#resume-button").click(); add("暂停查看资料、菜单空格不穿透、Esc 返回仍暂停、暂停时长不累计");
    await launch(page); await page.clock.fastForward(61000); const won = await diag(page);
    assert.ok(won.run.result.success); assert.equal(won.progress.profile.career.qualifiedIncome, 300);
    assert.equal(won.progress.profile.career.objectsRecovered, 1); assert.ok(won.progress.profile.collection.largeGold.researchedAt);
    assert.equal(won.levelUnlocks.length, 2); assert.equal(won.audio.counts.success > 0, true);
    assert.match(await page.locator("#result-achievements").textContent(), /开工大吉/);
    const toast = await page.locator("#achievement-notice-text").textContent(); await page.locator("#next-achievement-button").click();
    assert.notEqual(await page.locator("#achievement-notice-text").textContent(), toast);
    await page.reload(); await page.locator("#continue-button").click(); const shop = await diag(page);
    assert.equal(shop.screen, "shop"); assert.equal(shop.progress.profile.career.qualifiedIncome, 300);
    assert.equal(await page.locator("#achievement-notice").isVisible(), false);
    await page.locator("#buy-dynamite").click(); const bought = await diag(page);
    assert.equal(bought.saveError, false); assert.equal(bought.shop.purchaseCount, 1);
    await page.reload(); await page.locator("#continue-button").click(); assert.deepEqual((await diag(page)).shop, bought.shop);
    await page.evaluate(() => { window.__growthFixture = "gold"; });
    await page.locator("#next-level-button").click(); assert.equal((await diag(page)).progress.profile.collection.largeGold.seen, 2);
    add("成功结算一次提交统计、图鉴与多成就；提示排队；商店恢复不重复，交易固定");
    await page.clock.fastForward(61000); const failed = await diag(page); assert.equal(failed.progress.activeRun, null);
    assert.equal(failed.progress.profile.recentReports.length, 1); assert.equal(failed.progress.profile.recentReports[0].totals.qualifiedIncome, 300);
    assert.match(await page.locator("#result-report").textContent(), /本次挑战报告/);
    await page.reload(); assert.equal(await page.locator("#continue-button").isVisible(), false);
    await page.locator("#latest-report-button").click(); assert.match(await page.locator("#profile-content").textContent(), /有效成绩收入/);
    await page.keyboard.press("Escape"); add("失败与报告同次保存，刷新报告可看、失败局不可继续");
    await page.locator("#start-button").click(); await page.locator("#home-button").click(); const beforeCancel = await diag(page);
    page.once("dialog", dialog => dialog.dismiss()); await page.locator("#start-button").click(); assert.deepEqual((await diag(page)).progress, beforeCancel.progress);
    page.once("dialog", dialog => dialog.accept()); await page.locator("#start-button").click(); const replaced = await diag(page);
    assert.equal(replaced.progress.profile.career.runsAbandoned, 1); assert.equal(replaced.progress.profile.recentReports[0].reason, "abandoned");
    add("返回主页保留挑战、取消覆盖无变化、确认覆盖记录放弃且只含已提交成果");
    await page.locator("#home-button").click(); await page.evaluate(() => { window.__growthFixture = "barrel"; });
    page.once("dialog", d => d.accept()); await page.locator("#start-button").click(); await launch(page); await page.clock.runFor(500);
    const exploded = await diag(page); assert.equal(exploded.run.growth.objectsDestroyedByBarrel, 4); assert.equal(exploded.run.growth.objectsRecovered, 0);
    assert.equal(exploded.run.bombs, 1); await page.clock.fastForward(61000);
    assert.ok((await diag(page)).progress.profile.achievements.blast_four.unlockedAt);
    await page.locator("#result-home-button").click(); await profile(page, "collection");
    const barrel = page.locator('[data-mineral="powderKeg"]'); assert.match(await barrel.textContent(), /已引爆 1 次/); await barrel.locator("summary").click();
    assert.match(await barrel.textContent(), /无连锁/); await page.keyboard.press("Escape");
    add("真实键盘接触引爆桶、排除自身计四物体、失败提交成就和桶研究详情");
    const legacy = await controlled(browser, fileUrl, () => {
      localStorage.setItem("gold-miner.survival.preferences.v2", JSON.stringify({ soundEnabled: false, highScore: 10000, bestClearedLevel: 20 }));
    });
    assert.equal((await diag(legacy)).soundEnabled, false); await profile(legacy, "achievements");
    await legacy.locator('[data-achievement="clear_20"] button').click(); assert.equal((await diag(legacy)).progress.profile.equippedTitleId, "clear_20");
    await legacy.reload(); assert.match(await legacy.locator("#equipped-title").textContent(), /老练矿工/);
    await legacy.evaluate(() => { window.__growthFixture = "gold"; }); await legacy.locator("#start-button").click(); await launch(legacy); await legacy.clock.fastForward(61000);
    assert.equal((await diag(legacy)).audio.counts.success || 0, 0); add("旧最高纪录补发可证明成就、称号装备与刷新保存、静音覆盖解锁提示");
    await legacy.evaluate(() => {
      const loaded = GoldMinerStorage.loadProgress(localStorage, GoldMinerConfig), doc = loaded.document, now = new Date().toISOString();
      GoldMinerGrowth.abandon(doc, now);
      for (let i = 0; i < 11; i++) {
        const run = GoldMinerRules.createRun(GoldMinerConfig, 1, { runSeed: i });
        const cp = GoldMinerRules.captureCheckpoint(run, "level", GoldMinerConfig);
        GoldMinerGrowth.createActive(doc, cp, `report-fixture-${i}`, now, false);
        GoldMinerGrowth.enterLevel(doc, cp, now); GoldMinerGrowth.abandon(doc, now);
      }
      if (!GoldMinerStorage.saveProgress(localStorage, doc, GoldMinerConfig, loaded.revision).saved) throw Error("report fixture save failed");
    });
    await legacy.reload(); await profile(legacy, "career");
    assert.equal(await legacy.locator("#profile-content button").count(), 10);
    assert.equal((await diag(legacy)).progress.profile.career.qualifiedIncome, 300);
    add("11 局以上报告在页面仅保留最近 10 份，生涯与永久成就不裁剪");
    const config = require("../../js/config.js"), rules = require("../../js/rules.js"), oldConfig = { ...config, version: "1.1.0" };
    for (const kind of ["level", "shop"]) {
      const run = rules.createRun(oldConfig, 4, { runSeed: 321, wallet: 1000, totalIncome: 5000 });
      if (kind === "shop") { run.levelIncome = 2000; run.wallet += 2000; rules.advanceRun(run, 61, oldConfig); rules.purchaseItem(run, rules.createShop(run, oldConfig), "dynamite", oldConfig); }
      const cp = rules.captureCheckpoint(run, kind, oldConfig);
      const imported = await controlled(browser, fileUrl, checkpoint => {
        localStorage.setItem("gold-miner.survival.checkpoint.v1", JSON.stringify(checkpoint));
        localStorage.setItem("gold-miner.survival.preferences.v2", JSON.stringify({ soundEnabled: false, highScore: 10000, bestClearedLevel: 20 }));
      }, cp);
      const migrated = await diag(imported);
      assert.equal(migrated.saveError, false); assert.equal(migrated.progress.activeRun.statisticsComplete, false);
      assert.deepEqual(migrated.checkpoint.run.level, cp.run.level); assert.equal(migrated.checkpoint.run.wallet, cp.run.wallet);
      await imported.locator("#continue-button").click();
      if (kind === "shop") assert.deepEqual((await diag(imported)).shop, cp.shop);
      else { await imported.clock.fastForward(61000); assert.match(await imported.locator("#result-report").textContent(), /升级后记录/); }
      assert.equal((await diag(imported)).progress.profile.career.qualifiedIncome, 0);
      assert.equal(await imported.evaluate(() => JSON.parse(localStorage.getItem("gold-miner.survival.checkpoint.v1")).rulesVersion), "1.1.0");
      await imported.close();
    }
    add("浏览器旧关卡/商店迁移保留布局、钱包与报价，旧键保留、报告标明升级后记录");
    for (const mode of ["write", "read", "broken", "unknown"]) {
      const test = await controlled(browser, fileUrl, mode === "write" ? () => { Storage.prototype.setItem = () => { throw Error("quota"); }; }
        : mode === "read" ? () => { Storage.prototype.getItem = () => { throw Error("denied"); }; }
        : mode === "broken" ? () => { localStorage.setItem("gold-miner.survival.progress.v1", "{broken"); }
        : () => { localStorage.setItem("gold-miner.survival.progress.v1", '{"schemaVersion":99}'); });
      assert.equal((await diag(test)).saveError, true); await test.evaluate(() => { window.__growthFixture = "gold"; });
      await test.locator("#start-button").click(); await launch(test); await test.clock.fastForward(61000);
      assert.equal((await diag(test)).saveError, true); assert.match(await test.locator("#save-status").textContent(), /无法|未能|不能|失败/);
      if (["broken", "unknown"].includes(mode)) assert.equal(await test.evaluate(() => localStorage.getItem("gold-miner.survival.progress.v1")), mode === "broken" ? "{broken" : '{"schemaVersion":99}');
      await test.close();
    }
    add("写入/读取拒绝、损坏与未知版本保留原数据，临时游玩与保存反馈真实");
    await serveReady(8083); const context = await browser.newContext(); const first = await context.newPage(); const second = await context.newPage();
    first.on("pageerror", e => report.errors.push(e.message)); second.on("pageerror", e => report.errors.push(e.message));
    await first.goto("http://127.0.0.1:8083"); await first.locator("#start-button").click(); const snapshot = await diag(first);
    await second.goto("http://127.0.0.1:8083"); await second.locator("#sound-button").click();
    await first.waitForFunction(() => GoldMiner.getDiagnostics().externalChange);
    const conflict = await diag(first); assert.equal(conflict.screen, "paused"); assert.equal(conflict.loopRunning, false);
    assert.ok(conflict.run.elapsedTime >= snapshot.run.elapsedTime); assert.equal(await first.locator("#resume-button").isEnabled(), false);
    await first.locator("#reload-progress-button").click(); await first.waitForFunction(() => Boolean(window.GoldMiner));
    assert.equal((await diag(first)).externalChange, false);
    assert.equal((await diag(first)).soundEnabled, false); add("HTTP 本地服务运行、真实 storage 事件识别外部修订，暂停并重载最新档案");
    await context.close(); assert.deepEqual(report.errors, []); report.result = "passed";
  } finally {
    await browser.close(); server.kill();
    await fs.writeFile(path.join(__dirname, "survival-v120-growth-ui-report.json"), JSON.stringify(report, null, 2) + "\n");
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
