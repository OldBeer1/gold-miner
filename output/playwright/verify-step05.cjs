"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
const report = { phase: "05", method: "real browser input + controlled settlement and clock; visibility event simulation", checks: [], errors: [] };
const url = pathToFileURL(path.resolve(__dirname, "../../index.html")).href;
const storageKey = "gold-miner.preferences.v1";

function installFixture() {
  let rules;
  Object.defineProperty(window, "GoldMinerRules", {
    get() { return rules; },
    set(original) {
      rules = Object.freeze({ ...original, advanceRun(run, delta, config) {
        if (window.__outcome !== undefined) {
          const income = window.__outcome;
          window.__outcome = undefined;
          run.wallet += income - run.levelIncome;
          run.levelIncome = income;
          run.remainingTime = .001;
        }
        return original.advanceRun(run, delta, config);
      } });
    },
  });
}

function installLoopProbe() {
  const request = window.requestAnimationFrame.bind(window);
  const cancel = window.cancelAnimationFrame.bind(window);
  const pending = new Set();
  window.__loopProbe = { maximum: 0, pending: 0 };
  window.requestAnimationFrame = callback => {
    const id = request(timestamp => {
      pending.delete(id);
      window.__loopProbe.pending = pending.size;
      callback(timestamp);
    });
    pending.add(id);
    window.__loopProbe.pending = pending.size;
    window.__loopProbe.maximum = Math.max(window.__loopProbe.maximum, pending.size);
    return id;
  };
  window.cancelAnimationFrame = id => {
    pending.delete(id);
    window.__loopProbe.pending = pending.size;
    cancel(id);
  };
}

async function diag(page) { return page.evaluate(() => GoldMiner.getDiagnostics()); }
async function finish(page, income) {
  await page.evaluate(value => { window.__outcome = value; }, income);
  await page.clock.fastForward(100);
  await page.locator("#result-screen").waitFor({ state: "visible" });
}
function listen(page) {
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()); });
}
function passed(name) { report.checks.push({ name, result: "passed" }); }
async function blockGameInputs(page) {
  await page.locator("#game-canvas").focus();
  const before = await diag(page);
  const scroll = await page.evaluate(() => scrollY);
  for (const key of ["Space", "ArrowDown", "s"]) await page.keyboard.press(key);
  await page.locator("#dynamite-button").dispatchEvent("click");
  await page.locator("#game-canvas").dispatchEvent("pointerdown", { button: 0, clientX: 640, clientY: 400 });
  assert.deepEqual((await diag(page)).run, before.run);
  if (before.screen === "paused") assert.equal(await page.evaluate(() => scrollY), scroll);
}

async function main() {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    report.browser = await browser.version();
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    await page.addInitScript(installFixture);
    await page.clock.install();
    listen(page);
    await page.goto(url);
    await page.evaluate(installLoopProbe);
    assert.equal((await diag(page)).soundEnabled, true);
    assert.equal((await diag(page)).highScore, 0);
    await page.locator("#start-button").click();
    let aimed = false;
    const stoneAngle = Math.atan2(520 - 480, 255 - 112) * 180 / Math.PI;
    for (let i = 0; i < 300; i += 1) {
      if (Math.abs((await diag(page)).run.hook.angle - stoneAngle) < 1.1) { aimed = true; break; }
      await page.clock.runFor(16);
    }
    assert.equal(aimed, true);
    await page.keyboard.press("Space");
    await page.clock.runFor(300);
    assert.equal((await diag(page)).run.hook.phase, "returning-loaded");
    await page.keyboard.down("Escape");
    await page.keyboard.down("Escape");
    await page.keyboard.up("Escape");
    const paused = await diag(page);
    assert.equal(paused.screen, "paused");
    assert.equal(paused.pauseReason, "manual");
    assert.equal(paused.loopRunning, false);
    assert.equal(paused.run.hook.phase, "returning-loaded");
    const canvasBefore = await page.locator("#game-canvas").boundingBox();
    await blockGameInputs(page);
    await page.clock.fastForward(120000);
    assert.deepEqual((await diag(page)).run, paused.run);
    assert.equal((await diag(page)).frameCount, paused.frameCount);
    await page.screenshot({ path: path.join(__dirname, "step05-paused-loaded.png"), fullPage: true });
    for (const id of ["resume-button", "pause-home-button"]) {
      const box = await page.locator(`#${id}`).boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height <= 720);
    }
    await page.locator("#resume-button").click();
    const resumed = await diag(page);
    assert.equal(resumed.screen, "playing");
    assert.ok(Math.abs(paused.run.remainingTime - resumed.run.remainingTime) < .15);
    assert.ok(Math.abs(paused.run.hook.length - resumed.run.hook.length) < 30);
    const canvasAfter = await page.locator("#game-canvas").boundingBox();
    assert.equal(canvasBefore.width, canvasAfter.width);
    assert.equal(canvasBefore.height, canvasAfter.height);
    await page.clock.runFor(100);
    const progressed = await diag(page);
    assert.ok(progressed.run.remainingTime < resumed.run.remainingTime);
    assert.ok(resumed.run.remainingTime - progressed.run.remainingTime < .2);
    assert.ok(progressed.run.hook.length < resumed.run.hook.length);
    passed("带物时 Esc 暂停，长按不重复切换；暂停 120 秒完全冻结、输入无效，继续无时间跳变或物体瞬移");

    await page.locator("#pause-button").click();
    assert.equal((await diag(page)).screen, "paused");
    await page.keyboard.press("Escape");
    assert.equal((await diag(page)).screen, "playing");
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const hidden = await diag(page);
    assert.equal(hidden.screen, "paused");
    assert.equal(hidden.pauseReason, "hidden");
    await page.clock.fastForward(90000);
    await page.locator("#resume-button").dispatchEvent("click");
    assert.equal((await diag(page)).screen, "paused");
    assert.deepEqual((await diag(page)).run, hidden.run);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    assert.equal((await diag(page)).screen, "paused");
    await page.screenshot({ path: path.join(__dirname, "step05-auto-pause.png"), fullPage: true });
    await page.keyboard.press("Escape");
    assert.equal((await diag(page)).screen, "playing");
    await page.evaluate(() => { delete document.hidden; });
    report.visibility = { method: "document.hidden override + visibilitychange event", limitation: "headless and offscreen headed Chrome tab switching both kept document.hidden=false; native tab switch remains for final manual verification" };
    passed("隐藏事件自动暂停，隐藏时拒绝继续；可见事件不自动恢复，玩家主动继续后才运行");

    await page.locator("#home-button").click();
    await page.locator("#sound-button").click();
    assert.equal((await diag(page)).soundEnabled, false);
    await page.locator("#start-button").click();
    await finish(page, 650);
    assert.equal((await diag(page)).highScore, 650);
    await blockGameInputs(page);
    await page.locator("#restart-button").click();
    await page.locator("#buy-strength").click();
    assert.equal((await diag(page)).run.wallet, 450);
    assert.equal((await diag(page)).highScore, 650);
    await blockGameInputs(page);
    await page.locator("#next-level-button").click();
    await finish(page, 1000);
    assert.equal((await diag(page)).highScore, 1650);
    await page.locator("#restart-button").click();
    await page.locator("#buy-diamond").click();
    await page.locator("#buy-dynamite").click();
    await page.locator("#next-level-button").click();
    await finish(page, 1300);
    assert.equal((await diag(page)).run.result.success, false);
    assert.equal((await diag(page)).highScore, 1650);
    const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
    assert.deepEqual(stored, { soundEnabled: false, highScore: 1650 });
    passed("成功记录从 650 累计到 1650；购物不扣记录，第 3 关失败收入不计入，存储只有两项");

    await page.reload();
    const reloaded = await diag(page);
    assert.equal(reloaded.screen, "home");
    assert.equal(reloaded.soundEnabled, false);
    assert.equal(reloaded.highScore, 1650);
    assert.equal(reloaded.loopRunning, false);
    assert.equal(reloaded.entrySnapshot, null);
    assert.equal(reloaded.shop, null);
    assert.equal(reloaded.run.levelId, 1);
    assert.equal(reloaded.run.wallet, 0);
    assert.equal(reloaded.run.bombs, 1);
    assert.equal(reloaded.run.totalIncome, 0);
    assert.deepEqual(reloaded.run.effects, { strength: false, diamondBoost: false });
    await page.screenshot({ path: path.join(__dirname, "step05-saved-home.png"), fullPage: true });
    await page.evaluate(installLoopProbe);
    for (let i = 0; i < 6; i += 1) {
      await page.locator("#start-button").click();
      await page.locator("#pause-button").click();
      await page.locator("#resume-button").click();
      await finish(page, 100);
      await page.locator("#restart-button").click();
      await page.keyboard.press("Escape");
      await page.locator("#pause-home-button").click();
      assert.equal((await diag(page)).loopRunning, false);
    }
    report.loop = await page.evaluate(() => window.__loopProbe);
    assert.equal(report.loop.maximum, 1);
    assert.equal(report.loop.pending, 0);
    assert.equal((await diag(page)).highScore, 1650);
    passed("刷新仅保留音效与记录，其他状态重置；连续开始、暂停、恢复、失败重试和返回保持唯一循环");

    for (const mode of ["broken-json", "wrong-fields", "getter-denied", "write-denied"]) {
      const isolated = await browser.newContext();
      const storagePage = await isolated.newPage();
      listen(storagePage);
      await storagePage.addInitScript(({ mode, key }) => {
        if (mode === "broken-json") localStorage.setItem(key, "{broken");
        if (mode === "wrong-fields") localStorage.setItem(key, JSON.stringify({ soundEnabled: "no", highScore: -1, wallet: 1000 }));
        if (mode === "getter-denied") Object.defineProperty(window, "localStorage", { get() { throw new Error("denied"); } });
        if (mode === "write-denied") Object.defineProperty(Storage.prototype, "setItem", { value() { throw new Error("quota exceeded"); } });
      }, { mode, key: storageKey });
      await storagePage.addInitScript(installFixture);
      await storagePage.clock.install();
      await storagePage.goto(url);
      assert.equal((await diag(storagePage)).soundEnabled, true);
      assert.equal((await diag(storagePage)).highScore, 0);
      await storagePage.locator("#sound-button").click();
      await storagePage.locator("#start-button").click();
      await storagePage.keyboard.press("Space");
      await storagePage.clock.runFor(500);
      assert.ok((await diag(storagePage)).run.input.acceptedCount === 1);
      await finish(storagePage, 650);
      assert.equal((await diag(storagePage)).highScore, 650);
      await isolated.close();
    }
    passed("损坏 JSON、字段类型错误、存储访问禁止和写入失败均可启动、出钩并完成结算，无未处理错误");

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.locator("#start-button").click();
    await page.keyboard.press("Escape");
    await page.screenshot({ path: path.join(__dirname, "step05-pause-1920.png"), fullPage: true });
    const largeCanvas = await page.locator("#game-canvas").boundingBox();
    assert.ok(Math.abs(largeCanvas.width / largeCanvas.height - 1.5) < .005);
    assert.ok(largeCanvas.y + largeCanvas.height <= 1080);
    assert.ok((await page.locator("#pause-home-button").boundingBox()).y < 1080);
    passed("1280×720、1920×1080 暂停页可见，画布比例保持，暂停恢复不改变尺寸");
    assert.deepEqual(report.errors, []);
    report.result = "passed";
    await context.close();
  } finally {
    await browser.close();
    await fs.writeFile(path.join(__dirname, "step05-browser-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
