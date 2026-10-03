"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(process.argv[2] || "output/release/preflight-player");
const prefix = process.argv[3] || "survival-v110-release-preflight";
const report = { phase: "local-release-v1.1.0", method: "extracted player archive, file open, original game rules and real keyboard/button input; controlled browser clock; contact explosion uses an explicit four-object fixture", checks: [], errors: [] };
const diag = page => page.evaluate(() => GoldMiner.getDiagnostics());

function installExplosionFixture() {
  let rules;
  Object.defineProperty(window, "GoldMinerRules", {
    get() { return rules; },
    set(original) {
      rules = Object.freeze({ ...original,
        createRun(config, n = 1, entry = {}) {
          if (!window.__explosionFixture) return original.createRun(config, n, entry);
          const level = { id: n, target: 650, duration: 60, layout: [
            { id: "keg", type: "powderKeg", x: 480, y: 360 },
            { id: "near-ruby", type: "ruby", x: 540, y: 360 },
            { id: "near-relic", type: "cursedRelic", x: 480, y: 420 },
            { id: "far-chest", type: "treasureChest", x: 640, y: 360, rewardRoll: .9 },
          ] };
          return original.createRun(config, n, { ...entry, level, effects: { protectionCharm: true } });
        },
      });
    },
  });
}

(async () => {
  for (const file of ["index.html", "styles.css", "README.md", "js/config.js", "js/rules.js", "js/game.js", "js/storage.js", "js/effects.js", "js/audio.js"]) {
    assert.ok((await fs.stat(path.join(root, file))).isFile());
  }
  report.checks.push("玩家包包含全部运行文件与中文说明");
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    report.browser = await browser.version();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on("dialog",dialog => dialog.accept());
    const requests = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => report.errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()); });
    await page.addInitScript(installExplosionFixture);
    await page.clock.install();
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1));
    await page.goto(pathToFileURL(path.join(root, "index.html")).href);
    assert.equal((await diag(page)).screen, "home");
    await page.locator("#start-button").click();
    assert.equal((await diag(page)).screen, "playing");
    await page.locator("#game-canvas").focus(); await page.keyboard.press("Space");
    assert.equal((await diag(page)).run.input.acceptedCount, 1);
    await page.clock.runFor(100); await page.keyboard.press("Escape");
    const paused = await diag(page); assert.equal(paused.screen, "paused");
    await page.clock.fastForward(5000);
    assert.deepEqual((await diag(page)).run, paused.run); assert.deepEqual((await diag(page)).visuals, paused.visuals);
    await page.locator("#resume-button").click(); await page.clock.runFor(100);
    assert.ok(paused.run.remainingTime - (await diag(page)).run.remainingTime < .2);
    report.checks.push("文件直开、随机关卡开始、键盘出钩、暂停冻结及继续无跳变");
    const savedEntry = (await diag(page)).checkpoint;
    await page.reload(); await page.locator("#continue-button").click();
    assert.deepEqual((await diag(page)).checkpoint,savedEntry);
    assert.equal((await diag(page)).run.remainingTime,60);
    report.checks.push("玩家包刷新可继续同一关起点，资源与完整布局保留");
    await page.locator("#home-button").click(); await page.evaluate(() => { window.__explosionFixture = true; });
    await page.locator("#start-button").click(); await page.locator("#game-canvas").focus(); await page.keyboard.press("Space");
    await page.clock.runFor(250); const before = await diag(page);
    assert.ok(before.run.minerals.every(mineral => mineral.status === "available"));
    await page.clock.runFor(150); const exploded = await diag(page);
    assert.deepEqual(exploded.run.minerals.map(mineral => mineral.status), ["destroyed", "destroyed", "destroyed", "available"]);
    assert.equal(exploded.run.hook.phase, "returning-empty"); assert.equal(exploded.run.hook.carryingId, null);
    assert.equal(exploded.run.wallet, 0); assert.equal(exploded.run.levelIncome, 0); assert.equal(exploded.run.bombs, 1);
    assert.equal(exploded.run.effects.protectionCharm, true);
    assert.ok(Math.abs(exploded.run.elapsedTime + exploded.run.remainingTime - 60) < 1e-7);
    assert.equal(exploded.audio.counts.explode || 0, (before.audio.counts.explode || 0) + 1);
    assert.equal(exploded.visuals.particles.length, 16);
    await page.screenshot({ path: path.join(__dirname, `${prefix}-explosion.png`), fullPage: true });
    await page.clock.runFor(1000); assert.equal((await diag(page)).audio.counts.explode, exploded.audio.counts.explode);
    report.checks.push("玩家包火药桶接触即原地爆炸，近物销毁、远物保留、空钩返回，不扣时间或消耗库存/护符");
    assert.ok(requests.every(url => url.startsWith("file:") || url.startsWith("data:")));
    assert.deepEqual(report.errors, []);
    report.checks.push("资源均本地加载，无远程素材请求、无未处理浏览器错误");
    report.result = "passed";
    console.log(`玩家包验证通过：${report.checks.length} 项。`);
  } finally {
    await browser.close(); await fs.writeFile(path.join(__dirname, `${prefix}-report.json`), JSON.stringify(report, null, 2) + "\n");
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
