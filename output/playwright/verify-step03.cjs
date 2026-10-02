"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
const report = { phase: "03", method: "controlled state + browser clock", checks: [], errors: [] };
const root = path.resolve(__dirname, "../..");

function installProbe() {
  let wrapped;
  Object.defineProperty(window, "GoldMinerRules", {
    configurable: true,
    get() { return wrapped; },
    set(original) {
      wrapped = Object.freeze({ ...original, advanceRun(run, delta, config) {
        if (window.__forceOutcome) {
          const action = window.__forceOutcome;
          window.__forceOutcome = null;
          run.levelIncome = action.income;
          run.wallet += action.income;
          if (action.consumeBombs) run.bombs = 0;
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
  window.__loopProbe = { pending: 0, maximum: 0 };
  window.requestAnimationFrame = callback => {
    const id = request(time => { pending.delete(id); window.__loopProbe.pending = pending.size; callback(time); });
    pending.add(id);
    window.__loopProbe.pending = pending.size;
    window.__loopProbe.maximum = Math.max(pending.size, window.__loopProbe.maximum);
    return id;
  };
  window.cancelAnimationFrame = id => { pending.delete(id); window.__loopProbe.pending = pending.size; cancel(id); };
}

async function diag(page) { return page.evaluate(() => GoldMiner.getDiagnostics()); }
async function finish(page, income, consumeBombs = false) {
  await page.evaluate(action => { window.__forceOutcome = action; }, { income, consumeBombs });
  await page.clock.fastForward(100);
  await page.locator("#result-screen").waitFor({ state: "visible" });
  assert.equal((await diag(page)).loopRunning, false);
  assert.equal(await page.evaluate(() => window.__loopProbe.pending), 0);
}

async function main() {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    report.browser = await browser.version();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.addInitScript(installProbe);
    page.on("pageerror", error => report.errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()); });
    await page.clock.install();
    await page.goto(pathToFileURL(path.join(root, "index.html")).href);
    await page.evaluate(installLoopProbe);
    await page.getByRole("button", { name: "开始采矿", exact: true }).click();
    const firstEntry = (await diag(page)).entrySnapshot;
    assert.equal(firstEntry.wallet, 0);
    assert.equal(firstEntry.bombs, 1);
    await finish(page, 650);
    assert.equal((await diag(page)).run.totalIncome, 650);
    await page.getByRole("button", { name: "进入商店 →", exact: true }).click();
    assert.equal((await diag(page)).screen, "shop");
    assert.equal((await diag(page)).shop.nextLevelId, 2);
    assert.equal(await page.locator("#shop-wallet").textContent(), "¥ 650");
    await page.screenshot({ path: path.join(__dirname, "step03-shop.png") });
    await fs.writeFile(path.join(__dirname, "step03-shop.aria.txt"), await page.locator("body").ariaSnapshot());
    await page.clock.fastForward(300000);
    assert.equal((await diag(page)).screen, "shop");
    assert.equal((await diag(page)).loopRunning, false);
    await page.locator("#game-canvas").focus();
    await page.keyboard.press("Space");
    assert.equal((await diag(page)).screen, "shop");
    await page.getByRole("button", { name: "开始下一关 →", exact: true }).click();
    const entry2 = (await diag(page)).entrySnapshot;
    assert.equal(entry2.levelId, 2);
    assert.equal(entry2.wallet, 650);
    assert.equal(entry2.totalIncome, 650);
    assert.ok((await diag(page)).run.remainingTime > 59.8);
    assert.equal((await diag(page)).run.minerals.length, 15);
    report.checks.push({ name: "第 1 关成功→商店等待 5 分钟→第 2 关", result: "passed" });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await finish(page, 200, true);
      assert.equal((await diag(page)).run.result.success, false);
      assert.equal((await diag(page)).run.wallet, 850);
      assert.equal((await diag(page)).run.totalIncome, 650);
      if (attempt === 0) await page.screenshot({ path: path.join(__dirname, "step03-failure.png") });
      await page.getByRole("button", { name: "重试当前关 ↻", exact: true }).click();
      const retry = await diag(page);
      assert.equal(retry.run.levelId, 2);
      assert.equal(retry.run.wallet, 650);
      assert.equal(retry.run.bombs, 1);
      assert.equal(retry.run.totalIncome, 650);
      assert.equal(retry.run.levelIncome, 0);
      assert.ok(retry.run.remainingTime > 59.8);
      assert.equal(retry.run.hook.phase, "swinging");
      assert.ok(retry.run.minerals.every(mineral => mineral.status === "available"));
      assert.deepEqual(retry.entrySnapshot, entry2);
    }
    report.checks.push({ name: "第 2 关连续失败重试三次恢复金额、库存、矿物和计时，不刷钱", result: "passed" });
    await finish(page, 1000);
    assert.equal((await diag(page)).run.totalIncome, 1650);
    await page.getByRole("button", { name: "进入商店 →", exact: true }).click();
    await page.getByRole("button", { name: "开始下一关 →", exact: true }).click();
    assert.equal((await diag(page)).run.levelId, 3);
    assert.equal((await diag(page)).run.minerals.length, 18);
    await page.screenshot({ path: path.join(__dirname, "step03-level3.png") });

    await finish(page, 100);
    await page.getByRole("button", { name: "重试当前关 ↻", exact: true }).click();
    assert.equal((await diag(page)).run.wallet, 1650);
    assert.equal((await diag(page)).run.totalIncome, 1650);
    assert.equal((await diag(page)).run.levelId, 3);
    await finish(page, 1400);
    assert.equal((await diag(page)).run.totalIncome, 3050);
    await page.getByRole("heading", { name: "三关通关！", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "进入商店 →", exact: true }).count(), 0);
    await page.screenshot({ path: path.join(__dirname, "step03-complete.png") });
    report.checks.push({ name: "第二次商店→第 3 关→失败重试→直接通关，无第三次商店", result: "passed" });
    await page.getByRole("button", { name: "重新开始 ↻", exact: true }).click();
    assert.equal((await diag(page)).run.levelId, 1);
    assert.equal((await diag(page)).run.wallet, 0);
    assert.equal((await diag(page)).run.totalIncome, 0);
    assert.equal((await diag(page)).run.bombs, 1);
    assert.equal((await diag(page)).run.minerals.length, 12);
    for (let index = 0; index < 5; index += 1) {
      await page.getByRole("button", { name: "← 返回开始", exact: true }).click();
      assert.equal((await diag(page)).entrySnapshot, null);
      assert.equal((await diag(page)).loopRunning, false);
      await page.getByRole("button", { name: "开始采矿", exact: true }).click();
    }
    assert.equal(await page.evaluate(() => window.__loopProbe.maximum), 1);
    report.checks.push({ name: "重新开始与返回主页清理状态，每次最多一个动画帧", result: "passed" });

    for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(viewport);
      const rect = await page.locator("#game-canvas").boundingBox();
      assert.ok(Math.abs(rect.width / rect.height - 1.5) < .001 && rect.y + rect.height < viewport.height);
      const center = await page.evaluate(() => {
        const r = document.getElementById("game-canvas").getBoundingClientRect();
        return GoldMiner.clientToCanvasPoint(r.left + r.width / 2, r.top + r.height / 2);
      });
      assert.ok(Math.abs(center.x - 480) < .001 && Math.abs(center.y - 320) < .001);
    }
    const response = await fetch("http://127.0.0.1:8080/js/rules.js");
    assert.equal(response.status, 200);
    report.checks.push({ name: "两种桌面视口比例与坐标转换、正在运行的 HTTP 服务", result: "passed" });
    assert.deepEqual(report.errors, []);
    report.result = "passed";
  } finally {
    await browser.close();
    await fs.writeFile(path.join(__dirname, "step03-browser-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
