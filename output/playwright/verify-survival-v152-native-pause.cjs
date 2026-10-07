"use strict";
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
const path = require("node:path");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const report = { phase: "v152", version: "1.5.2", method: "native Chrome tabs via CDP with noDefaults, no document visibility overrides", errors: [] };
(async () => {
  const server = spawn(process.execPath, ["scripts/serve.cjs", "8099"], { cwd: path.resolve(__dirname, "../.."), windowsHide: true, stdio: "ignore" });
  const helper = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
    "--remote-debugging-port=9239", `--user-data-dir=${path.join(__dirname, "survival-v152-native-profile")}`,
    "--no-first-run", "--no-default-browser-check", "--window-position=-32000,-32000",
    "--disable-backgrounding-occluded-windows", "about:blank",
  ], { windowsHide: true, stdio: "ignore" });
  let browser;
  for (let i = 0; i < 40; i += 1) {
    try { browser = await chromium.connectOverCDP("http://127.0.0.1:9239", { noDefaults: true }); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  if (!browser) { helper.kill(); server.kill(); throw new Error("Chrome 启动失败"); }
  const context = browser.contexts()[0];
  try {
    const page = context.pages()[0];
    page.on("dialog", dialog => dialog.accept());
    page.on("pageerror", e => report.errors.push(e.message));
    await page.goto("http://127.0.0.1:8099");
    await page.locator("#start-button").click();
    const second = await context.newPage();
    await second.goto("about:blank");
    await second.bringToFront();
    await page.waitForFunction(() => document.hidden, null, { timeout: 5000 });
    const frozen = await page.evaluate(() => GoldMiner.getDiagnostics());
    assert.equal(frozen.screen, "paused");
    assert.equal(frozen.pauseReason, "hidden");
    assert.equal(frozen.loopRunning, false);
    assert.equal(frozen.audio.activeVoices, 0);
    await new Promise(resolve => setTimeout(resolve, 2200));
    assert.deepEqual((await page.evaluate(() => GoldMiner.getDiagnostics())).run, frozen.run);
    assert.deepEqual((await page.evaluate(() => GoldMiner.getDiagnostics())).visuals, frozen.visuals);
    await page.bringToFront();
    await page.waitForFunction(() => !document.hidden);
    assert.equal(await page.evaluate(() => GoldMiner.getDiagnostics().screen), "paused");
    await page.screenshot({ path: path.join(__dirname, "survival-v152-native-auto-pause.png"), fullPage: true });
    await page.locator("#resume-button").click();
    const resumed = await page.evaluate(() => GoldMiner.getDiagnostics());
    assert.equal(resumed.screen, "playing");
    assert.ok(frozen.run.remainingTime - resumed.run.remainingTime < .2);
    assert.deepEqual(report.errors, []);
    report.result = "passed";
    report.hiddenSeconds = 2.2;
    report.checks = ["真实切标签触发隐藏事件并自动暂停", "隐藏期间游戏和动画冻结且音频停止", "回到标签仍暂停，主动继续无计时跳变"];
    await page.locator("#home-button").click();
    assert.equal(await page.evaluate(() => GoldMiner.getDiagnostics().homeDateTimerActive), true);
    await second.bringToFront(); await page.waitForFunction(() => document.hidden);
    assert.equal(await page.evaluate(() => GoldMiner.getDiagnostics().homeDateTimerActive), false);
    await page.bringToFront(); await page.waitForFunction(() => !document.hidden);
    assert.equal(await page.evaluate(() => GoldMiner.getDiagnostics().homeDateTimerActive), true);
    assert.equal(await page.evaluate(() => GoldMiner.getDiagnostics().loopRunning), false);
    report.checks.push("主页隐藏取消日期定时器，恢复仅重启日期检查，未开启采矿循环");
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); helper.kill(); server.kill(); }
  await fs.writeFile(path.join(__dirname, "survival-v152-native-pause-report.json"), `${JSON.stringify(report, null, 2)}\n`);
})().catch(e => { console.error(e.message); process.exitCode = 1; });
