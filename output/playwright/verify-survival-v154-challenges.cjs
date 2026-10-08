"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs/promises"), path = require("node:path"), { pathToFileURL } = require("node:url"), { spawn } = require("node:child_process"), http = require("node:http");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
const config = require("../../js/config.js"), rules = require("../../js/rules.js"), growth = require("../../js/growth.js"), storage = require("../../js/storage.js"), challenges = require("../../js/challenges.js");
const { loadBaseline, fixture } = require("../../scripts/check-ui-compat.cjs"); const base = loadBaseline();
const report = { version: config.version, method: "real Chrome UI and input; controlled browser clock, formal-rule simulated saved entries; not real-time 20-level gameplay", checks: [], errors: [] };
const diag = page => page.evaluate(() => GoldMiner.getDiagnostics()), now = "2026-10-04T08:00:00.000Z";
const add = name => { report.checks.push(name); console.log(name); };
function advance(run) {
  while (run.elapsedTime < 45 && run.levelIncome < run.level.target) {
    if (run.hook.phase === "swinging" && run.minerals.some(m => m.safeRoute && m.status === "available" && Math.abs(Math.atan2(m.x - 480, m.y - 112) * 180 / Math.PI - run.hook.angle) <= .5)) rules.launchHook(run);
    rules.advanceRun(run, 1 / 120, config);
  }
  assert.ok(run.levelIncome >= run.level.target); rules.advanceRun(run, 100, config);
}
function savedAt(mode, seed, n, shop = false, date = "2026-10-04") {
  const challenge = challenges.create(mode, seed, mode === "daily" ? date : null);
  const doc = growth.createDocument({ soundEnabled: true, highScore: 0, bestClearedLevel: 0 }, now);
  let run = rules.createRun(config, 1, { challenge, runSeed: challenge.seed });
  let cp = rules.captureCheckpoint(run, "level", config); growth.createActive(doc, cp, `browser-${mode}-${seed}-${n}`, now, false); growth.enterLevel(doc, cp, now);
  for (let level = 1; level < n || shop && level === n; level++) {
    advance(run); cp = rules.captureCheckpoint(run, "shop", config); growth.settleLevel(doc, run, cp, now);
    if (shop && level === n) break;
    run = rules.createRun(config, level + 1, { challenge, runSeed: challenge.seed, level: run.shop.nextLevel, wallet: run.wallet, bombs: run.bombs, totalIncome: run.totalIncome, effects: run.shop.effects });
    growth.enterLevel(doc, rules.captureCheckpoint(run, "level", config), now);
  }
  assert.ok(storage.validateProgress(doc, config)); return doc;
}
async function pageFor(browser, url, document = null, time = now) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, timezoneId: "America/Los_Angeles" });
  page.on("pageerror", e => report.errors.push(e.message)); page.on("console", m => { if (m.type() === "error") report.errors.push(m.text()); });
  if (document) await page.addInitScript(({ key, document }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(document)); }, { key: storage.progressKey, document });
  await page.clock.install({ time: new Date(time) }); await page.clock.pauseAt(new Date(new Date(time).getTime() + 1)); await page.goto(url); return page;
}
async function playToTarget(page) {
  while (true) {
    const { run, screen } = await diag(page); if (run.levelIncome >= run.level.target) break;
    assert.equal(screen, "playing"); assert.ok(run.elapsedTime < 45);
    if (run.hook.phase === "swinging" && run.minerals.some(m => m.safeRoute && m.status === "available" && Math.abs(Math.atan2(m.x - 480, m.y - 112) * 180 / Math.PI - run.hook.angle) <= .7)) await page.keyboard.press("Space");
    let milliseconds = 200;
    if (run.hook.phase === "swinging") {
      const times = run.minerals.filter(m => m.safeRoute && m.status === "available").map(m => {
        const angle = Math.atan2(m.x - 480, m.y - 112) * 180 / Math.PI;
        const distance = (angle - run.hook.angle) * run.hook.swingDirection;
        return (distance >= 0 ? distance : run.hook.swingDirection > 0 ? 150 - run.hook.angle - angle : 150 + run.hook.angle + angle) / 65 * 1000;
      });
      milliseconds = Math.max(16, Math.min(200, Math.min(...times) - 8));
    }
    await page.clock.runFor(milliseconds);
  }
  await page.clock.runFor(61000);
}
async function ready(port) {
  for (let n = 0; n < 40; n++) {
    if (await new Promise(resolve => { const r = http.get(`http://127.0.0.1:${port}`, response => { response.resume(); resolve(response.statusCode === 200); }); r.on("error", () => resolve(false)); })) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  } throw new Error("Local service failed");
}
(async () => {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const root = path.resolve(__dirname, "../.."), url = pathToFileURL(path.join(root, "index.html")).href;
  const server = spawn(process.execPath, ["scripts/serve.cjs", "8094"], { cwd: root, windowsHide: true, stdio: "ignore" });
  try {
    report.browser = await browser.version();
    const page = await pageFor(browser, url); await page.locator("#challenge-mode").selectOption("seed");
    await page.locator("#start-button").click(); assert.match(await page.locator("#challenge-info").textContent(), /Seed 无效/); assert.equal((await diag(page)).progress.activeRun, null);
    for (const bad of ["-1", "1.5", "1e3", "4294967296"]) { await page.locator("#challenge-seed").fill(bad); await page.locator("#start-button").click(); assert.equal((await diag(page)).screen, "home"); }
    await page.locator("#challenge-seed").fill("00042"); await page.keyboard.press("Enter");
    const entered = await diag(page); assert.equal(entered.run.challenge.mode, "seed"); assert.equal(entered.run.runSeed, 42); assert.equal(entered.run.bombs, 1); assert.equal(entered.run.wallet, 0);
    await page.clock.runFor(2000); await page.locator("#home-button").click(); await page.reload(); await page.locator("#continue-button").click();
    assert.deepEqual((await diag(page)).run.level, entered.run.level); assert.equal((await diag(page)).run.elapsedTime, 0);
    await page.clock.runFor(61000); const failed = await diag(page); assert.equal(failed.progress.activeRun, null); assert.equal(failed.progress.profile.recentReports[0].mode, "seed"); assert.equal(failed.bestClearedLevel, 0);
    await page.locator("#result-report summary").click(); const share = page.locator("#result-report textarea"); assert.match(await share.inputValue(), /Seed：42/);
    await page.locator("#result-report button").filter({ hasText: "复制分享" }).click(); assert.match(await page.locator("#result-report button").textContent(), /已复制|Ctrl\+C/);
    add("非法 Seed 无写入、前导零规范化、真实入口/失败/恢复与复制分享"); await page.close();

    const cancel = await pageFor(browser, url, savedAt("endless", 42, 2)); const raw = await cancel.evaluate(key => localStorage.getItem(key), storage.progressKey);
    await cancel.locator("#challenge-mode").selectOption("daily"); cancel.once("dialog", d => d.dismiss()); await cancel.locator("#start-button").click(); assert.equal(await cancel.evaluate(key => localStorage.getItem(key), storage.progressKey), raw);
    cancel.once("dialog", d => d.accept()); await cancel.locator("#start-button").click(); assert.equal((await diag(cancel)).run.challenge.mode, "daily"); assert.equal((await diag(cancel)).progress.profile.recentReports[0].reason, "abandoned");
    add("切换模式取消精确保留档案，确认记录放弃并以统一初始状态开始每日"); await cancel.close();

    const daily = await pageFor(browser, url, savedAt("daily", 0, 1, false, "2026-10-03"), "2026-10-03T15:59:59Z");
    await daily.locator("#challenge-mode").selectOption("daily"); assert.match(await daily.locator("#challenge-info").textContent(), /2026-10-03/);
    await daily.clock.runFor(2000); await daily.locator("#continue-button").click(); assert.equal((await diag(daily)).run.challenge.date, "2026-10-03");
    await daily.locator("#home-button").click(); await daily.locator("#challenge-mode").selectOption("daily"); assert.match(await daily.locator("#challenge-info").textContent(), /2026-10-04/);
    daily.once("dialog", d => d.accept()); await daily.locator("#start-button").click(); assert.equal((await diag(daily)).run.challenge.date, "2026-10-04");
    await daily.clock.runFor(61000); await daily.locator("#result-home-button").click(); await daily.locator("#challenge-mode").selectOption("daily"); assert.match(await daily.locator("#challenge-info").textContent(), /最佳/);
    add("非 UTC+8 系统时区下午夜换日、旧每日继续不换图、新每日个人最佳与设备时钟说明"); await daily.close();

    for (const eventId of Object.keys(config.events.definitions).filter(id => id !== "none")) {
      let seed = 0; while (rules.selectEvent(config, 5, seed) !== eventId) seed++;
      const p = await pageFor(browser, url, savedAt("endless", seed, 4, true)); await p.locator("#continue-button").click();
      const initial = await diag(p); assert.equal(initial.shop.nextLevel.event.id, eventId); assert.match(await p.locator("#shop-event").textContent(), new RegExp(config.events.definitions[eventId].name));
      await p.locator("#buy-dynamite").click(); const purchased = await diag(p); assert.equal(purchased.run.wallet, initial.run.wallet - initial.shop.prices.dynamite);
      await p.reload(); await p.locator("#continue-button").click(); const restored = await diag(p); assert.deepEqual(restored.shop, purchased.shop); assert.equal(restored.run.wallet, purchased.run.wallet);
      await p.locator("#next-level-button").click(); assert.deepEqual((await diag(p)).run.level, initial.shop.nextLevel);
      assert.match(await p.locator("#event-label").textContent(), new RegExp(config.events.definitions[eventId].name));
      await p.locator("#pause-button").click(); const paused = (await diag(p)).run; await p.clock.runFor(120000); assert.deepEqual((await diag(p)).run, paused);
      await p.screenshot({ path: path.join(__dirname, `survival-v154-event-${eventId}.png`), fullPage: true });
      await p.locator("#resume-button").click(); await p.clock.runFor(61000); assert.equal((await diag(p)).progress.profile.recentReports[0].eventCounts[eventId], 1);
      await p.close();
    }
    add("五类事件预告、固定报价、真实购买/刷新/入关、暂停和失败报告记录");

    const final = await pageFor(browser, url, savedAt("seed", 42, 20)); await final.locator("#continue-button").click();
    await final.evaluate(() => { window.__originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error("denied"); }; });
    await playToTarget(final);
    const completed = await diag(final); assert.equal(completed.screen, "result"); assert.equal(completed.progress.activeRun, null); assert.equal(completed.progress.profile.recentReports[0].reason, "completed"); assert.equal(completed.progress.profile.recentReports[0].totals.levelsCleared, 20);
    assert.equal(completed.bestClearedLevel, 0); assert.equal(completed.highScore, 0); assert.ok(Object.values(completed.progress.profile.achievements).every(a => !a.unlockedAt));
    assert.match(await final.locator("#result-title").textContent(), /赛程完成/); assert.match(await final.locator("#restart-button").textContent(), /重新挑战/);
    assert.equal(completed.saveError, true); assert.match(await final.locator("#result-description").textContent(), /本次未能保存/); assert.doesNotMatch(await final.locator("#input-feedback").textContent(), /已保存/);
    await final.evaluate(() => { Storage.prototype.setItem = __originalSetItem; }); await final.locator("#sound-button").click(); assert.equal((await diag(final)).saveError, false);
    await final.screenshot({ path: path.join(__dirname, "survival-v154-completed.png"), fullPage: true }); await final.reload(); assert.ok(await final.locator("#continue-button").isHidden());
    await final.locator("#latest-report-button").click(); assert.match(await final.locator("#profile-content").textContent(), /20 关赛程完成/);
    add("正式规则模拟前 19 关入口，真实 UI/受控时钟终结 20 关；保存拒绝/重试、刷新与记录隔离"); await final.close();

    for (const [width, height] of [[1280,720],[1920,1080],[1280,480]]) {
      const p = await pageFor(browser, url); await p.setViewportSize({ width, height });
      for (const mode of ["endless", "seed", "daily"]) { await p.locator("#challenge-mode").selectOption(mode); assert.ok(await p.locator("#start-button").isVisible()); assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
      await p.screenshot({ path: path.join(__dirname, `survival-v154-home-${width}x${height}.png`), fullPage: true });
      await p.locator('[data-profile="career"]').first().click(); assert.match(await p.locator("#profile-content").textContent(), /分模式生涯/); assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await p.close();
    }
    add("三种桌面视口三模式入口、资料页面与短屏滚动，无横向溢出");

    const old = fixture(base,"endless","shop"); old.rulesVersion = "1.2.0"; old.activeRun.rulesetVersion = "1.2.0"; old.activeRun.checkpoint.rulesVersion = "1.2.0";
    old.profile.career.bestClearedLevel = 20; old.profile.legacyRecords.bestClearedLevel = 20; base.growth.evaluate(old, null, now, true); base.growth.equipTitle(old, "clear_20");
    delete old.profile.modeStats; delete old.profile.challengeRecords; delete old.profile.endlessChestRewardIds; delete old.activeRun.challenge; delete old.activeRun.eventCounts;
    delete old.activeRun.checkpoint.run.challenge; delete old.activeRun.checkpoint.run.level.event; delete old.activeRun.checkpoint.shop.nextLevel;
    const legacy = await pageFor(browser, url, old); const migrated = await diag(legacy); assert.ok(!migrated.saveError); assert.equal(migrated.progress.profile.equippedTitleId, "clear_20"); assert.equal(migrated.bestClearedLevel, 20);
    assert.equal(await legacy.evaluate(key => localStorage.getItem(key), storage.v120BackupKey), JSON.stringify(old));
    await legacy.locator("#continue-button").click(); assert.deepEqual((await diag(legacy)).shop.prices, old.activeRun.checkpoint.shop.prices); assert.equal((await diag(legacy)).shop.nextLevel.event.id, "none");
    await legacy.locator("#next-level-button").click(); assert.equal((await diag(legacy)).run.level.event.id, "none"); add("v1.2 商店迁移保留最高纪录/称号/原报价，备份原文且当前下一关保持普通矿层"); await legacy.close();

    const unknown = { ...savedAt("seed", 42, 1), rulesVersion: "9.0.0" }, broken = await pageFor(browser, url, unknown);
    const original = await broken.evaluate(key => localStorage.getItem(key), storage.progressKey); await broken.locator("#start-button").click(); assert.equal((await diag(broken)).screen, "playing"); assert.ok((await diag(broken)).saveError); assert.equal(await broken.evaluate(key => localStorage.getItem(key), storage.progressKey), original);
    add("未知档案保留原文，可临时游玩并真实显示不能保存"); await broken.close();

    await ready(8094); const file = await pageFor(browser, url), web = await pageFor(browser, "http://127.0.0.1:8094");
    for (const p of [file, web]) { await p.locator("#challenge-mode").selectOption("seed"); await p.locator("#challenge-seed").fill("4294967295"); await p.locator("#start-button").click(); }
    assert.deepEqual((await diag(file)).run.level, (await diag(web)).run.level); assert.equal((await diag(web)).run.runSeed, 0xffffffff);
    await web.locator("#sound-button").click(); assert.equal((await diag(web)).soundEnabled, false);
    add("最大 Seed 文件/HTTP 地图一致，HTTP 静音与保存"); await file.close(); await web.close();
    assert.deepEqual(report.errors, []); report.result = "passed";
  } finally { server.kill(); await browser.close(); await fs.writeFile(path.join(__dirname, "survival-v154-challenges-ui-report.json"), JSON.stringify(report, null, 2) + "\n"); }
})().catch(error => { console.error(error); process.exitCode = 1; });
