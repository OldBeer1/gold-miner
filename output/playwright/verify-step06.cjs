"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.GOLD_PLAYWRIGHT_MODULE || "playwright");
const report = { phase: "06", method: "actual UI, browser clock and controlled settlement; real Web Audio and offline waveform rendering", checks: [], errors: [] };
function fixture() {
  let rules;
  Object.defineProperty(window, "GoldMinerRules", {
    get() { return rules; },
    set(original) {
      rules = Object.freeze({ ...original, advanceRun(run, delta, config) {
        if (window.__finish !== undefined) {
          run.wallet += window.__finish - run.levelIncome;
          run.levelIncome = window.__finish;
          run.remainingTime = .001;
          window.__finish = undefined;
        }
        return original.advanceRun(run, delta, config);
      } });
    },
  });
}
async function diag(page) { return page.evaluate(() => GoldMiner.getDiagnostics()); }
async function aim(page, x, y) {
  const angle = Math.atan2(x - 480, y - 112) * 180 / Math.PI;
  for (let i = 0; i < 700; i += 1) {
    const run = (await diag(page)).run;
    if (run.hook.phase === "swinging" && Math.abs(run.hook.angle - angle) < .8) return;
    await page.clock.runFor(16);
  }
  throw new Error("未瞄准目标");
}
function listen(page) {
  page.on("pageerror", e => report.errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") report.errors.push(m.text()); });
}
async function main() {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    report.browser = await browser.version();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    listen(page);
    await page.addInitScript(fixture);
    await page.clock.install();
    const requests = [];
    page.on("request", r => requests.push(r.url()));
    await page.goto(pathToFileURL(path.resolve(__dirname, "../../index.html")).href);
    assert.equal((await diag(page)).audio.initialized, false);
    await page.locator("#start-button").click();
    assert.equal((await diag(page)).audio.initialized, true);
    await page.waitForFunction(() => GoldMiner.getDiagnostics().audio.contextState === "running");
    await aim(page, 520, 255);
    await page.keyboard.press("Space");
    await page.clock.runFor(300);
    assert.equal((await diag(page)).run.hook.phase, "returning-loaded");
    await page.keyboard.press("s");
    const exploded = await diag(page);
    assert.equal(exploded.visuals.particles.length, 16);
    assert.equal(exploded.run.levelIncome, 0);
    assert.equal(exploded.audio.counts.explode, 1);
    await page.clock.runFor(100);
    await page.screenshot({ path: path.join(__dirname, "step06-explosion.png"), fullPage: true });
    await page.clock.runFor(700);
    assert.equal((await diag(page)).visuals.particles.length, 0);
    await aim(page, 390, 305);
    await page.keyboard.press("Space");
    for (let i = 0; i < 260 && (await diag(page)).run.levelIncome === 0; i += 1) await page.clock.runFor(16);
    const harvest = await diag(page);
    assert.equal(harvest.run.levelIncome, 300);
    assert.ok(harvest.visuals.particles.length > 0);
    assert.equal(harvest.visuals.labels[0].text, "+¥300");
    assert.ok(harvest.audio.counts.harvest > 0);
    await page.screenshot({ path: path.join(__dirname, "step06-harvest.png"), fullPage: true });
    await page.keyboard.press("Escape");
    const frozen = await diag(page);
    assert.equal(frozen.audio.activeVoices, 0);
    await page.clock.fastForward(30000);
    assert.deepEqual((await diag(page)).visuals, frozen.visuals);
    assert.deepEqual((await diag(page)).run, frozen.run);
    await page.locator("#resume-button").click();
    await page.clock.runFor(1100);
    assert.equal((await diag(page)).visuals.labels.length, 0);
    assert.equal((await diag(page)).visuals.particles.length, 0);
    report.checks.push("收获粒子/金额、爆炸、游戏时间动作、暂停冻结与清理通过");

    await page.evaluate(() => { window.__finish = 650; });
    await page.clock.fastForward(100);
    assert.equal((await diag(page)).audio.counts.success, 1);
    await page.locator("#restart-button").click();
    await page.locator("#next-level-button").click();
    await page.evaluate(() => { window.__finish = 0; });
    await page.clock.fastForward(100);
    const audio = (await diag(page)).audio;
    for (const name of ["button", "launch", "grab", "harvest", "explode", "success", "failure"]) assert.ok(audio.counts[name] > 0, name);
    await page.locator("#sound-button").click();
    const muted = await diag(page);
    assert.equal(muted.audio.activeVoices, 0);
    assert.equal(muted.audio.enabled, false);
    await page.locator("#restart-button").click();
    await page.keyboard.press("Space");
    await page.clock.runFor(400);
    assert.deepEqual((await diag(page)).audio.counts, muted.audio.counts);
    await page.locator("#sound-button").click();
    assert.equal((await diag(page)).audio.enabled, true);
    report.audioEvents = audio.counts;
    report.checks.push("七类实际 Web Audio 事件、首次手势初始化、全部静音、暂停停止声音通过");

    report.waveforms = await page.evaluate(async () => {
      const result = [];
      for (const name of ["button", "launch", "grab", "harvest", "explode", "success", "failure"]) {
        const offline = new OfflineAudioContext(1, 44100, 44100);
        const player = GoldMinerAudio.createPlayer(() => offline);
        player.unlock();
        const accepted = player.play(name);
        const buffer = await offline.startRendering();
        const samples = buffer.getChannelData(0);
        let peak = 0, sum = 0, nonzero = 0;
        for (const sample of samples) { peak = Math.max(peak, Math.abs(sample)); sum += sample * sample; if (Math.abs(sample) > .00001) nonzero += 1; }
        result.push({ name, accepted, peak, rms: Math.sqrt(sum / samples.length), nonzero, activeAfterEnd: player.getDiagnostics().activeVoices });
      }
      return result;
    });
    for (const waveform of report.waveforms) {
      assert.equal(waveform.accepted, true);
      assert.ok(waveform.peak > .005 && waveform.peak < .5);
      assert.ok(waveform.nonzero > 100);
      assert.equal(waveform.activeAfterEnd, 0);
    }
    report.checks.push("七类音效实际离线渲染均有非零波形、无削波、节点自然释放");

    for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(size);
      await page.locator("#home-button").click();
      assert.deepEqual((await diag(page)).visuals, { time: 0, particles: [], labels: [] });
      await page.locator("#start-button").click();
      const box = await page.locator("#game-canvas").boundingBox();
      assert.ok(Math.abs(box.width / box.height - 1.5) < .005);
      assert.ok(box.y + box.height <= size.height);
      for (const id of ["home-button", "pause-button", "dynamite-button"]) {
        const control = await page.locator(`#${id}`).boundingBox();
        assert.ok(control.y + control.height <= size.height);
      }
      await page.mouse.click(box.x + box.width * .6, box.y + box.height * .6);
      const run = (await diag(page)).run;
      assert.ok(Math.abs(run.input.lastPoint.x - 576) < 2);
      assert.ok(Math.abs(run.input.lastPoint.y - 384) < 2);
      await page.screenshot({ path: path.join(__dirname, `step06-${size.width}-scene.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1280, height: 480 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight), true);
    assert.ok(requests.every(request => request.startsWith("file:") || request.startsWith("data:")));
    report.checks.push("两种桌面尺寸、缩放输入、短屏滚动、文件直开且无远程素材通过");

    const silentPage = await browser.newPage();
    listen(silentPage);
    await silentPage.addInitScript(() => {
      Object.defineProperty(window, "AudioContext", { value: undefined });
      Object.defineProperty(window, "webkitAudioContext", { value: undefined });
    });
    await silentPage.goto(pathToFileURL(path.resolve(__dirname, "../../index.html")).href);
    await silentPage.locator("#start-button").click();
    await silentPage.keyboard.press("Space");
    assert.equal((await diag(silentPage)).audio.unavailable, true);
    assert.equal((await diag(silentPage)).run.input.acceptedCount, 1);
    report.checks.push("音频不可用时可正常启动与出钩，无未处理异常");
    assert.deepEqual(report.errors, []);
    report.result = "passed";
  } finally {
    await browser.close();
    await fs.writeFile(path.join(__dirname, "step06-browser-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
