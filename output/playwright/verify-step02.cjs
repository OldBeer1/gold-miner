"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, "../..");
const report = { phase: "02", checks: [], errors: [] };

async function main() {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    report.browser = await browser.version();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on("pageerror", error => report.errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()); });
    await page.goto(pathToFileURL(path.join(root, "index.html")).href);
    await fs.writeFile(path.join(__dirname, "step02-home.aria.txt"), await page.locator("body").ariaSnapshot());
    await page.screenshot({ path: path.join(__dirname, "step02-home.png") });
    await page.getByRole("button", { name: "开始采矿", exact: true }).click();
    const startedAt = Date.now();
    for (const [index, id] of ["l1-big1", "l1-big3", "l1-g5", "l1-g1"].entries()) {
      const aim = await page.evaluate(id => {
        const mineral = GoldMinerConfig.levels[0].layout.find(m => m.id === id);
        return Math.atan2(mineral.x - GoldMinerConfig.miner.anchor.x, mineral.y - GoldMinerConfig.miner.anchor.y) * 180 / Math.PI;
      }, id);
      await page.waitForFunction(angle => {
        const run = GoldMiner.getDiagnostics().run;
        return run.hook.phase === "swinging" && Math.abs(run.hook.angle - angle) < 1.1;
      }, aim, { timeout: 12000 });
      const before = await page.evaluate(() => GoldMiner.getDiagnostics().run.levelIncome);
      if (index % 2 === 0) await page.keyboard.press("Space");
      else await page.locator("#game-canvas").click({ position: { x: 120, y: 240 } });
      await page.waitForFunction(id => GoldMiner.getDiagnostics().run.hook.carryingId === id, id, { timeout: 5000 });
      assert.equal(await page.evaluate(() => GoldMiner.getDiagnostics().run.levelIncome), before);
      const accepted = await page.evaluate(() => GoldMiner.getDiagnostics().run.input.acceptedCount);
      await page.keyboard.press("Space");
      assert.equal(await page.evaluate(() => GoldMiner.getDiagnostics().run.input.acceptedCount), accepted);
      if (index === 0) await page.screenshot({ path: path.join(__dirname, "step02-carrying.png") });
      await page.waitForFunction(() => GoldMiner.getDiagnostics().run.hook.phase === "swinging", null, { timeout: 10000 });
      const income = await page.evaluate(() => GoldMiner.getDiagnostics().run.levelIncome);
      report.checks.push({ action: "actual-grab", id, before, after: income, grabbedWithoutBanking: true });
      console.log(`实际抓取 ${id}，收入 ${income}`);
      if (index === 2) {
        assert.equal(income, 700);
        assert.equal(await page.evaluate(() => GoldMiner.getDiagnostics().screen), "playing");
        await page.screenshot({ path: path.join(__dirname, "step02-qualified.png") });
      }
    }
    await page.waitForFunction(() => GoldMiner.getDiagnostics().run.remainingTime <= 10, null, { timeout: 60000 });
    assert.equal(await page.locator("#hud-time").evaluate(e => e.classList.contains("is-urgent")), true);
    await page.waitForFunction(() => GoldMiner.getDiagnostics().screen === "result", null, { timeout: 15000 });
    const realElapsedSeconds = (Date.now() - startedAt) / 1000;
    assert.ok(realElapsedSeconds >= 59.5 && realElapsedSeconds <= 62);
    const success = await page.evaluate(() => GoldMiner.getDiagnostics());
    assert.equal(success.run.result.success, true);
    assert.equal(success.run.levelIncome, 800);
    assert.equal(success.run.wallet, 800);
    assert.equal(success.run.totalIncome, 800);
    assert.equal(success.loopRunning, false);
    await page.locator("#game-canvas").focus();
    await page.keyboard.press("Space");
    assert.equal(await page.evaluate(() => GoldMiner.getDiagnostics().run.totalIncome), 800);
    await page.screenshot({ path: path.join(__dirname, "step02-success.png") });
    report.checks.push({ action: "real-time-success", realElapsedSeconds, income: 800, result: "passed" });
    console.log("真实 60 秒成功流程通过。");

    await page.getByRole("button", { name: "再玩一次", exact: true }).click();
    const fresh = await page.evaluate(() => GoldMiner.getDiagnostics().run);
    assert.equal(fresh.wallet, 0);
    assert.equal(fresh.minerals.filter(m => m.status === "available").length, 12);
    await page.getByRole("button", { name: "← 返回开始", exact: true }).click();
    await page.clock.install();
    await page.getByRole("button", { name: "开始采矿", exact: true }).click();
    await page.clock.fastForward(61000);
    assert.equal(await page.evaluate(() => GoldMiner.getDiagnostics().run.result.success), false);
    await page.screenshot({ path: path.join(__dirname, "step02-failure.png") });
    await page.getByRole("button", { name: "再玩一次", exact: true }).click();
    assert.equal(await page.evaluate(() => GoldMiner.getDiagnostics().screen), "playing");
    assert.ok(await page.evaluate(() => GoldMiner.getDiagnostics().run.remainingTime > 59.8));
    report.checks.push({ action: "clock-assisted-failure-and-restart", result: "passed" });

    await page.setViewportSize({ width: 1920, height: 1080 });
    const layout = await page.evaluate(() => {
      const rect = document.getElementById("game-canvas").getBoundingClientRect();
      return { ratio: rect.width / rect.height, bottom: rect.bottom, height: innerHeight, width: document.documentElement.scrollWidth, viewportWidth: innerWidth };
    });
    assert.ok(Math.abs(layout.ratio - 1.5) < .001 && layout.bottom < layout.height && layout.width <= layout.viewportWidth);
    report.checks.push({ action: "1920x1080-layout", result: "passed" });
    assert.deepEqual(report.errors, []);
    report.result = "passed";
  } finally {
    await browser.close();
    await fs.writeFile(path.join(__dirname, "step02-browser-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
