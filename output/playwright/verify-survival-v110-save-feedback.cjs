"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const report = { version: "1.1.0", method: "original level, browser-controlled clock; only storage deletion is rejected", checks: [], errors: [] };
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    const page = await browser.newPage({viewport:{width:1280,height:720}});
    page.on("pageerror",error=>report.errors.push(error.message));
    await page.addInitScript(()=>{Storage.prototype.removeItem=()=>{throw Error("blocked deletion");};});
    await page.clock.install(); await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1));
    await page.goto(pathToFileURL(path.resolve("index.html")).href); await page.locator("#start-button").click();
    assert.ok(await page.locator("#save-status").isVisible());
    await page.clock.fastForward(60100);
    assert.equal(await page.evaluate(()=>GoldMiner.getDiagnostics().run.result.success),false);
    assert.ok(await page.locator("#save-status").isVisible());
    const message=await page.locator("#save-status").textContent(); assert.match(message,/清除失败/); assert.match(message,/旧进度可能仍可恢复/);
    assert.equal(await page.evaluate(()=>GoldMiner.getDiagnostics().checkpoint),null);
    assert.ok(await page.evaluate(()=>GoldMinerStorage.loadCheckpoint(localStorage,GoldMinerConfig).checkpoint));
    await page.screenshot({path:path.join(__dirname,"survival-v110-save-delete-warning.png"),fullPage:true});
    assert.deepEqual(report.errors,[]); report.checks.push("保存状态可见；失败清档被拒绝时准确提示磁盘旧进度仍可能恢复"); report.result="passed";
    await fs.writeFile(path.join(__dirname,"survival-v110-save-feedback-report.json"),JSON.stringify(report,null,2)+"\n");
    console.log("保存状态可见性与删除失败反馈检查通过。");
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
