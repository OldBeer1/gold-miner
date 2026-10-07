"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs/promises"), path = require("node:path"), { pathToFileURL } = require("node:url"), { spawnSync, spawn } = require("node:child_process");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
const { loadBaseline, fixture } = require("../../scripts/check-ui-compat.cjs");
const config = require("../../js/config.js"), storage = require("../../js/storage.js"), challenges = require("../../js/challenges.js");
const base = loadBaseline(), root = path.resolve(__dirname, "../.."), url = pathToFileURL(path.join(root, "index.html")).href;
const report = { version: config.version, rulesVersion: config.rulesVersion, method: "real Chrome controls, DOM MutationObserver and controlled clock; committed baseline source and explicit valid records; no FPS benchmark claim", checks: [], errors: [], mutations: {} };
const diag = page => page.evaluate(() => GoldMiner.getDiagnostics());
const add = name => { report.checks.push(name); console.log(name); };
async function pageFor(browser, target = url, document = null, time = "2026-10-05T08:00:00Z", denied = false) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, timezoneId: "America/Los_Angeles" });
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()); });
  await page.addInitScript(({ key, document, denied }) => {
    if (document && localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(document));
    if (denied) { window.__originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error("storage denied fixture"); }; }
  }, { key: storage.progressKey, document, denied });
  await page.clock.install({ time: new Date(time) }); await page.clock.pauseAt(new Date(Date.parse(time) + 1)); await page.goto(target); return page;
}
async function observe(page) {
  await page.evaluate(() => {
    window.__mutations = {}; window.__observers = [];
    for (const selector of ["#home-screen", "#hud-target", "#hud-wallet", "#pause-button", "#dynamite-button", "#sound-button"]) {
      __mutations[selector] = 0;
      const observer = new MutationObserver(records => { __mutations[selector] += records.length; });
      observer.observe(document.querySelector(selector), { subtree: true, childList: true, characterData: true, attributes: true }); __observers.push(observer);
    }
  });
  const before = await diag(page); await page.clock.runFor(5000); const after = await diag(page);
  const changes = await page.evaluate(() => { __observers.forEach(o => o.disconnect()); return __mutations; });
  return { frames: after.frameCount - before.frameCount, elapsedSeconds: after.run.elapsedTime - before.run.elapsedTime, changes };
}
function withRecords(count) {
  const doc = storage.adaptV140Progress(fixture(base, "seed", "report"),config,"2026-10-07T08:00:00Z"); doc.profile.challengeRecords = {};
  for (let n = 0; n < count; n++) {
    const mode = n % 2 ? "daily" : "seed", date = new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10), challenge = challenges.create(mode, n, mode === "daily" ? date : null);
    doc.profile.challengeRecords[challenges.key(challenge)] = { challenge, runId: `record-${n}`, updatedAt: new Date(Date.parse("2026-10-03T08:00:00Z") + n * 1000).toISOString(), levelsCleared: n % 21, qualifiedIncome: n * 100, activePlayMs: n * 60000 };
  }
  assert.ok(storage.validateProgress(doc, config)); return doc;
}
(async () => {
  const oldRoot = path.join(root, "output/release/baseline-v140");
  for (const file of ["index.html", "styles.css", "js/config.js", "js/challenges.js", "js/growth.js", "js/rules.js", "js/storage.js", "js/game.js", "js/audio.js", "js/effects.js"]) {
    const source = spawnSync("git", ["show", `9a82b3a21b82752dba77743d144614075020970a:${file}`], { encoding: "utf8" }); assert.equal(source.status, 0, source.stderr);
    await fs.mkdir(path.dirname(path.join(oldRoot, file)), { recursive: true }); await fs.writeFile(path.join(oldRoot, file), source.stdout);
  }
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const server = spawn(process.execPath, ["scripts/serve.cjs", "8102"], { cwd: root, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  server.stderr.on("data", chunk => { report.serverDiagnostics = (report.serverDiagnostics || "") + chunk; });
  try {
    report.browser = await browser.version();
    const initial = fixture(base, "seed"), p = await pageFor(browser, url, initial);
    const raw = await p.evaluate(key => localStorage.getItem(key), storage.progressKey);
    assert.equal(await p.evaluate(key=>localStorage.getItem(key),storage.v140BackupKey),JSON.stringify(initial)); assert.equal(JSON.parse(raw).rulesVersion,"1.5.1"); assert.deepEqual((await diag(p)).checkpoint,initial.activeRun.checkpoint);
    assert.equal(await p.locator("#challenge-mode").inputValue(), "seed"); assert.equal(await p.locator("#challenge-seed").inputValue(), "42"); assert.match(await p.locator("#start-button").textContent(), /Seed/);
    assert.match(await p.locator("#checkpoint-description").textContent(), /Seed 42/);
    await p.locator("#challenge-mode").selectOption("daily"); await p.locator("#continue-button").click(); assert.equal((await diag(p)).run.challenge.mode, "seed"); assert.equal((await diag(p)).homeDateTimerActive, false);
    await p.locator("#home-button").click(); assert.equal(await p.locator("#challenge-mode").inputValue(), "daily"); assert.equal(await p.evaluate(() => document.activeElement.id), "continue-button"); assert.equal((await diag(p)).homeDateTimerActive, true);
    const afterContinue = JSON.parse(await p.evaluate(key => localStorage.getItem(key), storage.progressKey)), beforeContinue = JSON.parse(raw);
    // 继续入口沿用既有保存边界，会递增修订；不会重复累计入关成果。
    assert.equal(afterContinue.revision, beforeContinue.revision + 1); delete afterContinue.revision; delete beforeContinue.revision;
    assert.deepEqual(afterContinue, beforeContinue); await p.close();
    add("v1.4.0 原文备份与单次档案升级，模式/Seed 初始化，继续不重复成果且保留用户选择与返回焦点");

    for (const [name, target] of [["v140", pathToFileURL(path.join(oldRoot, "index.html")).href], ["v151", url]]) {
      const page = await pageFor(browser, target); await page.locator("#challenge-mode").selectOption("daily"); await page.locator("#start-button").click(); report.mutations[name] = await observe(page); await page.close();
    }
    assert.ok(report.mutations.v140.changes["#home-screen"] > 0);
    assert.ok(report.mutations.v151.frames >= 250); assert.ok(Math.abs(report.mutations.v151.elapsedSeconds - 5) < .05);
    for (const changes of Object.values(report.mutations.v151.changes)) assert.equal(changes, 0);
    add("同一受控 5 秒：隐藏主页和固定信息/按钮无重复 DOM 写入，采矿帧循环和计时保留");

    const midnight = await pageFor(browser, url, null, "2026-10-03T15:59:59Z"); await midnight.locator("#challenge-mode").selectOption("daily");
    assert.match(await midnight.locator("#challenge-info").textContent(), /2026-10-03/); await midnight.clock.runFor(2000);
    assert.match(await midnight.locator("#challenge-info").textContent(), /2026-10-04/); assert.equal(await midnight.locator("#challenge-info").evaluate(node => node.childNodes.length), 1);
    await midnight.clock.runFor(61000); assert.equal(await midnight.locator("#challenge-info").evaluate(node => node.childNodes.length), 1); assert.equal((await diag(midnight)).frameCount, 0);
    await midnight.clock.setSystemTime(new Date("2026-10-02T12:00:00Z")); await midnight.clock.runFor(61000); assert.match(await midnight.locator("#challenge-info").textContent(), /2026-10-02/);
    assert.equal((await diag(midnight)).run.elapsedTime, 0); await midnight.close();
    add("主页 UTC+8 午夜自动换日、时钟回退、说明单文字节点，无采矿循环或时间推进");

    for (const count of [0, 10, 11, 200]) {
      const page = await pageFor(browser, url, withRecords(count)), before = await page.evaluate(key => localStorage.getItem(key), storage.progressKey);
      await page.locator('[data-profile="career"]').first().click();
      assert.equal(await page.locator("#record-list [data-record]").count(), Math.min(10, count));
      assert.match(await page.locator("#record-page-status").textContent(), new RegExp(`${count} 条`));
      assert.equal(await page.locator("#record-previous").isDisabled(), true);
      await page.evaluate(() => { window.__career = document.querySelector(".profile-stats"); });
      if (count > 10) {
        await page.locator("#record-next").click(); assert.match(await page.locator("#record-page-status").textContent(), /第 2/);
        assert.equal(await page.evaluate(() => document.querySelector(".profile-stats") === __career), true);
        await page.locator("#record-previous").click(); assert.match(await page.locator("#record-page-status").textContent(), /第 1/);
      }
      await page.locator("#record-filter").selectOption("daily"); assert.equal(await page.locator("#record-list [data-record]").count(), Math.min(10, Math.floor(count / 2)));
      assert.match(await page.locator("#record-page-status").textContent(), /第 1/);
      await page.locator("#record-filter").selectOption("seed"); assert.equal(await page.locator("#record-list [data-record]").count(), Math.min(10, Math.ceil(count / 2)));
      if (count === 200) {
        for (let n = 1; n < 10; n++) await page.locator("#record-next").click(); assert.match(await page.locator("#record-page-status").textContent(), /第 10 \/ 10 页 · 100 条/); assert.equal(await page.locator("#record-next").isDisabled(), true);
        await page.screenshot({ path: path.join(__dirname, "survival-v151-records.png"), fullPage: true });
      }
      assert.equal(await page.evaluate(key => localStorage.getItem(key), storage.progressKey), before); await page.keyboard.press("Escape"); await page.close();
    }
    add("0/10/11/200 记录筛选与分页边界，只更新记录区域，浏览不写档案");

    const denied = await pageFor(browser, url, initial, undefined, true); const untouched = await denied.evaluate(key => localStorage.getItem(key), storage.progressKey);
    denied.on("dialog", d => d.accept()); await denied.locator("#start-button").click(); await denied.clock.runFor(61000);
    assert.equal((await diag(denied)).screen, "result"); assert.ok((await diag(denied)).saveError); assert.match(await denied.locator("#result-description").textContent(), /已记录，本次未能保存/);
    assert.doesNotMatch(await denied.locator("#input-feedback").textContent(), /已保存/); assert.equal(await denied.evaluate(key => localStorage.getItem(key), storage.progressKey), untouched);
    await denied.evaluate(() => { Storage.prototype.setItem = __originalSetItem; }); await denied.locator("#sound-button").click();
    assert.equal((await diag(denied)).saveError, false); assert.doesNotMatch(await denied.locator("#result-description").textContent(), /未能保存/);
    assert.equal(await denied.evaluate(key => JSON.parse(localStorage.getItem(key)).profile.recentReports[0].reason, storage.progressKey), "failed");
    await denied.close(); add("拒绝保存的失败说明准确、原文保留；恢复写入并重试保存完整内存报告");

    for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }, { width: 1280, height: 480 }]) {
      const page = await pageFor(browser, url, initial); await page.setViewportSize(size);
      for (const mode of ["endless", "seed", "daily"]) {
        await page.locator("#challenge-mode").selectOption(mode); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (size.height >= 720) { const bounds = await page.locator("#start-button").boundingBox(); assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= size.height); }
      }
      await page.screenshot({ path: path.join(__dirname, `survival-v151-home-active-${size.width}x${size.height}.png`), fullPage: true });
      await page.locator("#continue-button").click(); const hud = await page.locator("#game-hud").boundingBox(), bar = await page.locator("#event-label").boundingBox(), canvas = await page.locator("#game-canvas").boundingBox();
      assert.ok(hud.y + hud.height <= bar.y + 1); assert.ok(bar.y + bar.height <= canvas.y + 1);
      await page.locator('[data-profile="career"]').filter({ visible: true }).first().count().then(async count => { if (!count) await page.locator("#pause-button").click(); });
      await page.locator('[data-profile="career"]').filter({ visible: true }).first().click(); const paused = (await diag(page)).run;
      await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => document.activeElement.id), "profile-close-button");
      await page.keyboard.press("Escape"); assert.equal((await diag(page)).screen, "paused"); assert.deepEqual((await diag(page)).run, paused); assert.equal((await diag(page)).homeDateTimerActive, false);
      await page.close();
    }
    add("三视口活动存档主页、矿层条与画布不重叠，资料焦点循环与暂停隔离");
    let ready = false;
    for (let n = 0; n < 40; n++) { try { const response = await fetch("http://127.0.0.1:8102"); if (response.ok) { ready = true; break; } } catch {} if (server.exitCode !== null) break; await new Promise(resolve => setTimeout(resolve, 100)); }
    assert.ok(ready, report.serverDiagnostics || "HTTP test server unavailable");
    const context = await browser.newContext(), first = await context.newPage(), second = await context.newPage();
    for (const page of [first, second]) page.on("pageerror", error => report.errors.push(error.message));
    await first.goto("http://127.0.0.1:8102"); await first.locator("#start-button").click();
    await second.goto("http://127.0.0.1:8102"); await second.locator("#sound-button").click();
    await first.waitForFunction(() => GoldMiner.getDiagnostics().externalChange);
    const frozen = await diag(first); assert.equal(frozen.screen, "paused"); assert.equal(frozen.loopRunning, false); assert.equal(await first.locator("#resume-button").isDisabled(), true);
    await first.locator("#reload-progress-button").click(); await first.waitForFunction(() => !!window.GoldMiner); assert.equal((await diag(first)).externalChange, false); assert.equal((await diag(first)).soundEnabled, false);
    await context.close(); add("HTTP 两页面真实 storage 修订事件冻结旧页面，重载恢复最新档案");
    assert.deepEqual(report.errors, []); report.result = "passed";
  } finally { server.kill(); await browser.close(); await fs.writeFile(path.join(__dirname, "survival-v151-experience-report.json"), JSON.stringify(report, null, 2) + "\n"); }
})().catch(error => { console.error(error); process.exitCode = 1; });
