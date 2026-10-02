"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const report = { phase: "07", method: "real input and elapsed time; no clock overrides", errors: [] };
  try {
    const page = await browser.newPage();
    page.on("pageerror", e => report.errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, "../../index.html")).href);
    await page.locator("#sound-button").click();
    await page.locator("#start-button").click();
    const angle = Math.atan2(660 - 480, 480 - 112) * 180 / Math.PI;
    await page.waitForFunction(angle => Math.abs(GoldMiner.getDiagnostics().run.hook.angle - angle) < 1, angle, { polling: "raf" });
    await page.keyboard.press("Space");
    await page.waitForFunction(() => GoldMiner.getDiagnostics().run.hook.phase === "returning-loaded");
    const start = performance.now();
    const grabbed = await page.evaluate(() => GoldMiner.getDiagnostics());
    assert.equal(grabbed.run.hook.carryingId, "l1-r2");
    assert.equal(grabbed.run.levelIncome, 0);
    const geometry = await page.evaluate(() => {
      const run = GoldMiner.getDiagnostics().run;
      const point = GoldMinerRules.hookPoint(run.hook, GoldMinerConfig);
      const canvas = document.getElementById("game-canvas");
      const ctx = canvas.getContext("2d");
      const pixel = (x, y) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data);
      return { point, ropePixel: pixel((480 + point.x) / 2, (112 + point.y) / 2), carriedPixel: pixel(point.x + 6, point.y - 8) };
    });
    assert.deepEqual(geometry.ropePixel, [239, 224, 175, 255]);
    assert.ok([[123, 137, 137], [160, 170, 166], [82, 97, 102]].some(color => color.every((channel, index) => geometry.carriedPixel[index] === channel)));
    await page.screenshot({ path: path.join(__dirname, "final-deep-stone-loaded.png"), fullPage: true });
    await page.waitForFunction(() => GoldMiner.getDiagnostics().run.levelIncome === 20, null, { timeout: 8000 });
    report.carrySeconds = Number(((performance.now() - start) / 1000).toFixed(2));
    assert.ok(report.carrySeconds >= 4.8 && report.carrySeconds <= 7);
    assert.equal(await page.evaluate(() => GoldMiner.getDiagnostics().run.wallet), 20);
    report.geometry = geometry;
    report.result = "passed";
    report.checks = ["深处石头实际回收约 5～7 秒，抓住时不入账", "绳索中点像素及钩尖携带物像素匹配，物体随钩子绘制"];
    assert.deepEqual(report.errors, []);
  } finally {
    await browser.close();
    await fs.writeFile(path.join(__dirname, "final-carry-times-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
