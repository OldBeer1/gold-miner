"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
const { spawn } = require("node:child_process");
const http = require("node:http");
const report = { phase: "44", version: "1.5.4", method: "original game, layout/input checks and actual offline audio rendering", checks: [], errors: [], viewports: [] };
(async () => {
  const server = spawn(process.execPath, ["scripts/serve.cjs", "8104"], { cwd: path.resolve(__dirname, "../.."), windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  server.stderr.on("data", chunk => { report.serverDiagnostics = (report.serverDiagnostics || "") + chunk; });
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    const page = await browser.newPage();
    const requests = [];
    page.on("request", request => requests.push(request.url()));
    page.on("dialog", dialog => dialog.accept());
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, "../../index.html")).href);
    for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }, { width: 1280, height: 480 }]) {
      await page.setViewportSize(size);
      const bounds = await page.evaluate(() => {
        const panel = document.querySelector("#home-screen .welcome-panel").getBoundingClientRect();
        const scene = document.querySelector(".scene-shell").getBoundingClientRect();
        return { panel: { top: panel.top, bottom: panel.bottom }, scene: { top: scene.top, bottom: scene.bottom }, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(bounds.overflow, false); assert.ok(bounds.panel.top >= bounds.scene.top && bounds.panel.bottom <= bounds.scene.bottom, "开始页面板必须完整显示");
      await page.screenshot({ path: path.join(__dirname, `survival-v154-home-${size.width}x${size.height}.png`), fullPage: true });
      await page.locator("#start-button").click();
      const box = await page.locator("#game-canvas").boundingBox(); assert.ok(Math.abs(box.width / box.height - 1.5) < .005);
      if (size.height >= 720) for (const selector of ["#game-canvas", "#home-button", "#pause-button", "#dynamite-button"]) {
        const control = await page.locator(selector).boundingBox(); assert.ok(control.y >= 0 && control.y + control.height <= size.height);
      }
      await page.locator("#game-canvas").click({ position: { x: box.width * .6, y: box.height * .6 } });
      const input = await page.evaluate(() => GoldMiner.getDiagnostics().run.input);
      assert.ok(Math.abs(input.lastPoint.x - 576) < 2 && Math.abs(input.lastPoint.y - 384) < 2);
      await page.screenshot({ path: path.join(__dirname, `survival-v154-scene-${size.width}x${size.height}.png`), fullPage: true });
      await page.locator("#home-button").click();
      assert.equal(await page.evaluate(() => GoldMiner.getDiagnostics().loopRunning), false);
      report.viewports.push({ ...size, result: "passed" });
    }
    report.checks.push("开始页完整显示、桌面画布与按钮可见、短屏无横向溢出、缩放输入准确、返回停止循环");
    assert.ok(requests.every(url => url.startsWith("file:") || url.startsWith("data:")));
    report.checks.push("文件直开且无远程素材或运行依赖");
    report.waveforms = await page.evaluate(async () => {
      const result = [];
      for (const name of ["button", "launch", "grab", "harvest", "explode", "success", "failure"]) {
        const offline = new OfflineAudioContext(1, 44100, 44100), player = GoldMinerAudio.createPlayer(() => offline);
        player.unlock(); const accepted = player.play(name); const buffer = await offline.startRendering();
        let peak = 0, nonzero = 0;
        for (const sample of buffer.getChannelData(0)) { peak = Math.max(peak, Math.abs(sample)); if (Math.abs(sample) > .00001) nonzero += 1; }
        result.push({ name, accepted, peak, nonzero, activeAfterEnd: player.getDiagnostics().activeVoices });
      }
      return result;
    });
    for (const waveform of report.waveforms) { assert.equal(waveform.accepted, true); assert.ok(waveform.peak > .005 && waveform.peak < .5); assert.ok(waveform.nonzero > 100); assert.equal(waveform.activeAfterEnd, 0); }
    report.checks.push("七类音效非零波形、无削波、节点释放");
    let ready = false;
    for (let i = 0; i < 40 && !ready; i++) {
      ready = await new Promise(resolve => { const r = http.get("http://127.0.0.1:8104", response => { response.resume(); resolve(response.statusCode === 200); }); r.on("error", () => resolve(false)); });
      if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, report.serverDiagnostics || "local server readiness");
    await page.goto("http://127.0.0.1:8104"); await page.locator("#start-button").click();
    assert.equal(await page.evaluate(() => GoldMiner.getDiagnostics().screen), "playing");
    await page.locator("#sound-button").click();
    const muted = await page.evaluate(() => GoldMiner.getDiagnostics()); assert.equal(muted.audio.enabled, false); assert.equal(muted.audio.activeVoices, 0);
    report.checks.push("本地服务启动、音频初始化与静音释放");
    assert.deepEqual(report.errors, []); report.result = "passed";
    console.log("最终布局、缩放输入、离线素材和七类音效检查通过。");
  } finally { await browser.close(); server.kill(); await fs.writeFile(path.join(__dirname, "survival-v154-smoke-report.json"), JSON.stringify(report, null, 2) + "\n"); }
})().catch(error => { console.error(error); process.exitCode = 1; });
